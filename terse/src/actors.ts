import { Actor, Persisted } from "terse-sdk/actor"

/**
 * ExperimentRunner: Terse durable-actor version of scripts/run-batch.ts.
 * Same state machine: start -> poll every POLL_MS (re-arming the alarm) -> analyze each
 * finished run once -> synthesize -> done. Failed/timed-out runs are dropped WITH a reason.
 *
 * UNCONFIRMED: that global fetch and process.env are available inside the actor runtime.
 * UNCONFIRMED: exact alarm API shape (this.alarm.set(epochMs) -> onAlarm()), taken from research notes.
 */

type Phase = "idle" | "starting" | "polling" | "synthesizing" | "done" | "failed"
type RunStatus = "running" | "done" | "failed" | "timeout"

const POLL_MS = 5_000
const TIMEOUT_MS = 20 * 60_000

interface RunnerStatus {
  phase: Phase
  n: number
  runIds: string[]
  statuses: Record<string, RunStatus>
  analyzed: string[]
  dropped: Record<string, string>
  synthesis: string
  error: string
}

function env(name: string): string {
  // UNCONFIRMED: process.env inside actors. Falls back to empty so we fail with a clear message.
  const v = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name]
  if (!v) throw new Error(`${name} is not set (add it with: terse secrets add ${name})`)
  return v.replace(/\/+$/, "")
}

async function call(method: "GET" | "POST", url: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${url} -> HTTP ${res.status}: ${text.slice(0, 300)}`)
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    return { raw: text }
  }
}

export class ExperimentRunner extends Actor {
    @Persisted n = 0
    @Persisted runIds: string[] = []
    @Persisted statuses: Record<string, RunStatus> = {}
    @Persisted analyzed: string[] = []
    @Persisted dropped: Record<string, string> = {}
    @Persisted phase: Phase = "idle"
    @Persisted startedAt = 0
    @Persisted synthesis = ""
    @Persisted error = ""

    /** Kick off a batch of n runs. Returns immediately; progress happens via alarms. */
    async startBatch(n = 8): Promise<RunnerStatus> {
        if (this.phase === "starting" || this.phase === "polling" || this.phase === "synthesizing") {
            throw new Error(`batch already in progress (phase=${this.phase})`)
        }
        this.n = n
        this.runIds = []
        this.statuses = {}
        this.analyzed = []
        this.dropped = {}
        this.synthesis = ""
        this.error = ""
        this.startedAt = Date.now()
        this.phase = "starting"
        this.alarm.set(Date.now() + 100)
        return this.status()
    }

    async status(): Promise<RunnerStatus> {
        return {
            phase: this.phase,
            n: this.n,
            runIds: this.runIds,
            statuses: this.statuses,
            analyzed: this.analyzed,
            dropped: this.dropped,
            synthesis: this.synthesis,
            error: this.error
        }
    }

    /** Manually (re)run synthesis, e.g. after fixing an analyze failure. */
    async runSynthesis(): Promise<string> {
        await call("POST", `${env("WEB_URL")}/api/synthesize`)
        this.synthesis = "ok"
        return this.synthesis
    }

    async onAlarm(): Promise<void> {
        try {
            if (this.phase === "starting") await this.stepStart()
            else if (this.phase === "polling") await this.stepPoll()
            else if (this.phase === "synthesizing") await this.stepSynthesize()
        } catch (err) {
            // Never silent: record, then retry polling/starting on the next tick unless clearly fatal.
            this.error = (err as Error).message
            if (this.phase === "starting") {
                this.phase = "failed"
                return
            }
            this.alarm.set(Date.now() + POLL_MS)
        }
    }

    private async stepStart(): Promise<void> {
        const res = await call("POST", `${env("SIM_URL")}/batch`, { n: this.n })
        const ids = Array.isArray(res.runIds) ? res.runIds.map(String) : []
        if (ids.length === 0) throw new Error(`no runIds in /batch response: ${JSON.stringify(res)}`)
        this.runIds = ids
        this.statuses = Object.fromEntries(ids.map((id) => [id, "running" as RunStatus]))
        this.phase = "polling"
        this.alarm.set(Date.now() + POLL_MS)
    }

    private async stepPoll(): Promise<void> {
        const timedOut = Date.now() - this.startedAt > TIMEOUT_MS
        let statuses = { ...this.statuses }
        let analyzed = [...this.analyzed]
        let dropped = { ...this.dropped }

        for (const id of this.runIds.filter((r) => statuses[r] === "running")) {
            if (timedOut) {
                statuses = { ...statuses, [id]: "timeout" }
                dropped = { ...dropped, [id]: "still running after 20 min" }
                continue
            }
            let info: Record<string, unknown>
            try {
                info = await call("GET", `${env("SIM_URL")}/runs/${id}`)
            } catch (err) {
                this.error = `poll ${id}: ${(err as Error).message}`
                continue
            }
            const status = String(info.status ?? "unknown")
            if (status === "failed") {
                statuses = { ...statuses, [id]: "failed" }
                dropped = { ...dropped, [id]: String(info.error ?? info.reason ?? "sim reported status=failed") }
            } else if (status === "done") {
                statuses = { ...statuses, [id]: "done" }
                try {
                    await call("POST", `${env("WEB_URL")}/api/analyze/${id}`)
                    analyzed = [...analyzed, id]
                } catch (err) {
                    dropped = { ...dropped, [id]: `analyze failed: ${(err as Error).message}` }
                }
            }
        }

        this.statuses = statuses
        this.analyzed = analyzed
        this.dropped = dropped

        const stillRunning = this.runIds.some((r) => statuses[r] === "running")
        if (stillRunning) {
            this.alarm.set(Date.now() + POLL_MS)
        } else {
            this.phase = "synthesizing"
            this.alarm.set(Date.now() + 100)
        }
    }

    private async stepSynthesize(): Promise<void> {
        if (this.analyzed.length === 0) {
            this.synthesis = "skipped: no run was analyzed"
            this.phase = "failed"
            return
        }
        await call("POST", `${env("WEB_URL")}/api/synthesize`)
        this.synthesis = "ok"
        this.phase = "done"
    }
}
