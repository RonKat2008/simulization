/**
 * Fallback experiment runner. Performs EXACTLY the Terse job steps (see terse/src/actors.ts):
 *   1. POST {SIM_URL}/batch {n}            -> { runIds }
 *   2. poll GET {SIM_URL}/runs/:id         -> status running|done|failed
 *   3. on done:   POST {WEB_URL}/api/analyze/:runId (once)
 *      on failed / timeout: drop WITH a reason (never silent)
 *   4. POST {WEB_URL}/api/synthesize (unless --no-synthesis)
 *
 * Usage: pnpm batch -- --n 8 --poll 5000 --timeout-min 20 [--no-synthesis]
 * Env:   SIM_URL, WEB_URL (process env, else repo-root .env)
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, "..")

type RunStatus = "running" | "done" | "failed" | "unknown"
interface RunRow {
  runId: string
  condition: string
  status: RunStatus | "timeout"
  analyzed: boolean
  reason: string
}

function parseDotenv(path: string): Record<string, string> {
  let text: string
  try {
    text = readFileSync(path, "utf8")
  } catch {
    return {}
  }
  const out: Record<string, string> = {}
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq < 1) continue
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "")
    let val = line.slice(eq + 1).trim()
    if (/^(".*"|'.*')$/.test(val)) val = val.slice(1, -1)
    out[key] = val
  }
  return out
}

function parseArgs(argv: string[]) {
  const args = { n: 8, poll: 5000, timeoutMin: 20, synthesis: true }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => Number(argv[++i])
    if (a === "--n") args.n = next()
    else if (a === "--poll") args.poll = next()
    else if (a === "--timeout-min") args.timeoutMin = next()
    else if (a === "--no-synthesis") args.synthesis = false
    else if (a === "--") continue
    else fail(`Unknown argument: ${a}`)
  }
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "number" && (!Number.isFinite(v) || v <= 0)) fail(`Invalid value for --${k}`)
  }
  return args
}

function fail(msg: string): never {
  console.error(`[run-batch] ERROR: ${msg}`)
  process.exit(1)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`)

async function http(method: "GET" | "POST", url: string, body?: unknown): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (err) {
    const cause = (err as { cause?: { code?: string } }).cause?.code
    throw new Error(`${method} ${url} unreachable${cause ? ` (${cause})` : ""}: ${(err as Error).message}`)
  }
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${url} -> HTTP ${res.status}: ${text.slice(0, 300)}`)
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { raw: text }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const dotenv = parseDotenv(join(repoRoot, ".env"))
  const simUrl = (process.env.SIM_URL ?? dotenv.SIM_URL ?? "").replace(/\/+$/, "")
  const webUrl = (process.env.WEB_URL ?? dotenv.WEB_URL ?? "").replace(/\/+$/, "")
  if (!simUrl) fail("SIM_URL is not set (env or repo-root .env)")
  if (!webUrl) log(`WARN: WEB_URL not set; analysis/synthesis calls will fail and be logged`)

  log(`Starting batch n=${args.n} via ${simUrl}/batch`)
  let runIds: string[]
  try {
    const res = (await http("POST", `${simUrl}/batch`, { n: args.n })) as { runIds?: unknown }
    if (!Array.isArray(res.runIds) || res.runIds.length === 0) throw new Error(`no runIds in response: ${JSON.stringify(res)}`)
    runIds = res.runIds.map(String)
  } catch (err) {
    fail(`Could not start batch: ${(err as Error).message}`)
  }
  log(`Batch started: ${runIds.length} runs`)

  const rows = new Map<string, RunRow>(
    runIds.map((id) => [id, { runId: id, condition: "?", status: "running", analyzed: false, reason: "" }]),
  )
  const deadline = Date.now() + args.timeoutMin * 60_000
  const pending = new Set(runIds)

  while (pending.size > 0) {
    if (Date.now() > deadline) {
      for (const id of pending) {
        const row = rows.get(id)!
        rows.set(id, { ...row, status: "timeout", reason: `still running after ${args.timeoutMin} min` })
        log(`DROPPED ${id}: ${rows.get(id)!.reason}`)
      }
      pending.clear()
      break
    }
    for (const id of [...pending]) {
      const row = rows.get(id)!
      let info: Record<string, unknown>
      try {
        info = (await http("GET", `${simUrl}/runs/${id}`)) as Record<string, unknown>
      } catch (err) {
        log(`poll ${id} error (will retry): ${(err as Error).message}`)
        continue
      }
      const status = String(info.status ?? "unknown") as RunStatus
      const condition = typeof info.condition === "string" ? info.condition : row.condition
      if (status === "done") {
        pending.delete(id)
        let analyzed = false
        let reason = ""
        try {
          await http("POST", `${webUrl}/api/analyze/${id}`)
          analyzed = true
          log(`ANALYZED ${id} (${condition})`)
        } catch (err) {
          reason = `analyze failed: ${(err as Error).message}`
          log(`DROPPED ${id}: ${reason}`)
        }
        rows.set(id, { ...row, condition, status, analyzed, reason })
      } else if (status === "failed") {
        pending.delete(id)
        const why = typeof info.error === "string" ? info.error : typeof info.reason === "string" ? info.reason : "sim reported status=failed"
        rows.set(id, { ...row, condition, status, reason: why })
        log(`DROPPED ${id}: ${why}`)
      } else {
        rows.set(id, { ...row, condition, status })
      }
    }
    if (pending.size > 0) {
      log(`waiting on ${pending.size}/${runIds.length} runs`)
      await sleep(args.poll)
    }
  }

  let synthesis: { ran: boolean; ok: boolean; error?: string } = { ran: false, ok: false }
  if (args.synthesis) {
    const analyzedCount = [...rows.values()].filter((r) => r.analyzed).length
    if (analyzedCount === 0) {
      synthesis = { ran: false, ok: false, error: "skipped: no run was analyzed" }
      log(`Synthesis ${synthesis.error}`)
    } else {
      try {
        await http("POST", `${webUrl}/api/synthesize`)
        synthesis = { ran: true, ok: true }
        log("Synthesis complete")
      } catch (err) {
        synthesis = { ran: true, ok: false, error: (err as Error).message }
        log(`Synthesis FAILED: ${synthesis.error}`)
      }
    }
  }

  const table = [...rows.values()]
  console.log("\nrunId".padEnd(30) + "condition".padEnd(11) + "status".padEnd(9) + "analyzed".padEnd(10) + "reason")
  for (const r of table) {
    console.log(`${r.runId.padEnd(29)} ${r.condition.padEnd(10)} ${String(r.status).padEnd(8)} ${String(r.analyzed).padEnd(9)} ${r.reason}`)
  }

  const outDir = join(here, "out")
  mkdirSync(outDir, { recursive: true })
  const outFile = join(outDir, `batch-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
  writeFileSync(outFile, JSON.stringify({ args, simUrl, webUrl, runs: table, synthesis }, null, 2) + "\n")
  log(`Summary written to ${outFile}`)

  const dropped = table.filter((r) => !r.analyzed).length
  process.exit(dropped === table.length ? 2 : 0)
}

main().catch((err) => fail((err as Error).message))
