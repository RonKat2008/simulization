// Owner: Person B. Terse Durable Actors for Simulization (CLAUDE.md Part 2 / Part 11).
//   MerchantAgent    one per agent (actorId `${runId}.${agentId}` (":" is not a legal actor id char)): persistent memory + turn pipeline.
//   ExperimentRunner the batch + synthesis job as a durable state machine (actorId e.g. "main").
import { Actor, Emittable, Persisted } from "durable-actors"
import {
  GatewayModelClient,
  StubModelClient,
  RunRelay,
  RelayClient,
  AGENTRELAY_DEFAULT_BASE_URL,
  isOlderTurnKey,
  isTurnExpired,
  logTurn,
  passOutput,
  signalFromDeadline,
  takeTurn,
  turnKey,
  withRelayInbox,
} from "@simulization/agents"
import type { AgentState, AgentTurnInput, AgentTurnOutput } from "@simulization/shared"

// ---------------------------------------------------------------- MerchantAgent

function relayFromEnv(): RunRelay | null {
  const key = process.env.AGENTRELAY_API_KEY
  if (!key) return null
  return new RunRelay(new RelayClient(key, process.env.AGENTRELAY_BASE_URL || AGENTRELAY_DEFAULT_BASE_URL))
}

export class MerchantAgent extends Actor {
  @Persisted private initialized = false
  @Persisted private name = ""
  @Persisted private company = ""
  @Persisted private provider = ""
  @Persisted private model = ""
  @Persisted private memory = ""
  @Persisted private inboxCursor: string | null = null
  @Persisted private relayToken: string | undefined = undefined
  @Persisted private turns = 0
  @Persisted private lastTurnKey: string | null = null
  @Persisted private completedTurnKey: string | null = null
  @Persisted private completedTurnJson: string | null = null

  // NOTE: deliberately no @Interleave: turns are serialized per agent and a thrown turn rolls back.

  async init(state: AgentState): Promise<void> {
    this.name = state.name
    this.company = state.company
    this.provider = state.provider
    this.model = state.model
    this.memory = state.memory
    this.inboxCursor = state.inboxCursor
    this.relayToken = state.relayToken
    this.turns = 0
    this.lastTurnKey = null
    this.initialized = true
  }

  async load(): Promise<AgentState> {
    return await this.snapshot()
  }

  async save(state: AgentState): Promise<void> {
    await this.requireInit()
    await this.applyState(state)
  }

  /**
   * `deadline` (epoch ms) replaces an AbortSignal, which cannot cross the actor RPC boundary. Past it the
   * result is dropped unsaved (the world already passed the turn). `lastTurnKey` (round:phase) is claimed at
   * turn start so a late turn from an older phase never runs or saves over a newer one.
   */
  async takeTurn(runId: string, agentId: string, input: AgentTurnInput, deadline?: number): Promise<AgentTurnOutput> {
    await this.requireInit()
    const gatewayKey = process.env.AI_GATEWAY_API_KEY
    if (!gatewayKey && process.env.MODEL_MODE !== "stub") {
      return passOutput("AI_GATEWAY_API_KEY not set", this.memory)
    }
    const key = turnKey(input)
    if (this.completedTurnKey === key && this.completedTurnJson !== null) return JSON.parse(this.completedTurnJson) as AgentTurnOutput
    if (isOlderTurnKey(key, this.lastTurnKey)) {
      return passOutput(`stale turn ${key} (already at ${this.lastTurnKey})`, this.memory)
    }
    this.lastTurnKey = key
    const signal = signalFromDeadline(deadline)
    const { input: turnInput, state } = await withRelayInbox(relayFromEnv(), runId, agentId, await this.snapshot(), input)
    const result = await takeTurn({
      agentId,
      state,
      input: turnInput,
      model: process.env.MODEL_MODE === "stub" ? new StubModelClient() : new GatewayModelClient(gatewayKey!),
      signal,
      deadline,
    })
    if (isTurnExpired(signal, deadline) || this.lastTurnKey !== key) return result.output
    await this.db.transaction(async () => {
      await this.applyState(result.state)
      this.turns = this.turns + 1
      this.completedTurnKey = key
      this.completedTurnJson = JSON.stringify(result.output)
    })
    logTurn(runId, input, result.meta)
    return result.output
  }

  private async requireInit(): Promise<void> {
    if (!this.initialized) {
      throw new Error(`MerchantAgent ${this.id} is not initialized: call init(state) first`)
    }
  }

  private async snapshot(): Promise<AgentState> {
    await this.requireInit()
    return {
      name: this.name,
      company: this.company,
      provider: this.provider,
      model: this.model,
      memory: this.memory,
      inboxCursor: this.inboxCursor,
      ...(this.relayToken !== undefined ? { relayToken: this.relayToken } : {}),
    }
  }

  private async applyState(state: AgentState): Promise<void> {
    this.name = state.name
    this.company = state.company
    this.provider = state.provider
    this.model = state.model
    this.memory = state.memory
    this.inboxCursor = state.inboxCursor
    this.relayToken = state.relayToken
  }
}

// ---------------------------------------------------------------- ExperimentRunner

export type ExperimentPhase = "idle" | "starting" | "polling" | "synthesizing" | "done" | "failed"
export type RunProgress = "running" | "done" | "analyzing" | "analyzed" | "dropped"
export interface DroppedRun {
  runId: string
  reason: string
}
export interface ExperimentStatus {
  phase: ExperimentPhase
  n: number
  runIds: string[]
  statuses: Record<string, RunProgress>
  analyzed: string[]
  dropped: DroppedRun[]
  startedAt: number
  synthesized: boolean
  log: string[]
}

const POLL_MS = 5_000
const TIMEOUT_MS = 20 * 60_000
const HTTP_TIMEOUT_MS = 20_000
const ANALYZE_TIMEOUT_MS = 120_000
const LOG_LINES = 50

const trimSlash = (s: string): string => s.replace(/\/+$/, "")

async function http(method: "GET" | "POST", url: string, body?: unknown, timeoutMs = HTTP_TIMEOUT_MS): Promise<unknown> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${url} -> HTTP ${res.status}: ${text.slice(0, 200)}`)
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

export class ExperimentRunner extends Actor {
  @Persisted private n = 0
  @Persisted private runIds: string[] = []
  @Persisted @Emittable statuses: Record<string, RunProgress> = {}
  @Persisted private analyzed: string[] = []
  @Persisted private dropped: DroppedRun[] = []
  @Persisted @Emittable phase: ExperimentPhase = "idle"
  @Persisted private startedAt = 0
  @Persisted private synthesized = false
  @Persisted private log: string[] = []

  async startBatch(n: number): Promise<ExperimentStatus> {
    if (this.phase === "starting" || this.phase === "polling" || this.phase === "synthesizing") {
      throw new Error(`batch already in progress (phase=${this.phase}); call status()`)
    }
    if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error(`n must be an integer 1..100, got ${n}`)
    this.n = n
    this.runIds = []
    this.statuses = {}
    this.analyzed = []
    this.dropped = []
    this.synthesized = false
    this.log = []
    this.startedAt = Date.now()
    this.phase = "starting"
    await this.note(`batch requested: n=${n}`)
    this.alarm.set(Date.now() + 10)
    return await this.report()
  }

  async status(): Promise<ExperimentStatus> {
    return await this.report()
  }

  /** Re-run (or run) synthesis on its own, e.g. after a failed synthesis. */
  async runSynthesis(): Promise<ExperimentStatus> {
    if (this.phase === "starting" || this.phase === "polling") {
      throw new Error(`runs still in progress (phase=${this.phase})`)
    }
    this.phase = "synthesizing"
    await this.note("synthesis requested")
    this.alarm.set(Date.now() + 10)
    return await this.report()
  }

  /** One bounded step per tick: start, OR poll all runs (+ at most one analyze), OR synthesize. */
  async onAlarm(): Promise<void> {
    try {
      if (this.phase === "starting") await await this.tickStart()
      else if (this.phase === "polling") await await this.tickPoll()
      else if (this.phase === "synthesizing") await await this.tickSynthesize()
    } catch (err) {
      await this.fail(`unexpected error in ${this.phase}: ${(err as Error).message}`)
    }
  }

  private async tickStart(): Promise<void> {
    const simUrl = await this.env("SIM_URL")
    if (!simUrl) return
    try {
      const res = (await http("POST", `${simUrl}/batch`, { n: this.n })) as { runIds?: unknown }
      if (!Array.isArray(res.runIds) || res.runIds.length === 0) throw new Error(`no runIds in response ${JSON.stringify(res)}`)
      const ids = res.runIds.map(String)
      this.runIds = ids
      this.statuses = Object.fromEntries(ids.map((id) => [id, "running" as RunProgress]))
      this.phase = "polling"
      await this.note(`batch started: ${ids.length} runs`)
      this.alarm.set(Date.now() + POLL_MS)
    } catch (err) {
      await this.fail(`could not start batch: ${(err as Error).message}`)
    }
  }

  private async tickPoll(): Promise<void> {
    const simUrl = await this.env("SIM_URL")
    const webUrl = await this.env("WEB_URL")
    if (!simUrl) return
    const timedOut = Date.now() - this.startedAt > TIMEOUT_MS
    const running = this.runIds.filter((id) => this.statuses[id] === "running")

    // Poll all running runs in parallel (bounded by n <= 100, each with a 20s timeout).
    const polled = await Promise.all(
      running.map(async (id) => {
        try {
          return [id, (await http("GET", `${simUrl}/runs/${id}`)) as Record<string, unknown>] as const
        } catch (err) {
          await this.note(`poll ${id} error (will retry): ${(err as Error).message}`)
          return [id, null] as const
        }
      }),
    )
    let statuses = { ...this.statuses }
    let dropped = [...this.dropped]
    for (const [id, info] of polled) {
      const s = info ? String(info.status ?? "unknown") : "unknown"
      if (s === "done") statuses = { ...statuses, [id]: "done" }
      else if (s === "failed") {
        const why = typeof info?.error === "string" ? info.error : typeof info?.reason === "string" ? info.reason : "sim reported status=failed"
        statuses = { ...statuses, [id]: "dropped" }
        dropped = [...dropped, { runId: id, reason: why }]
        await this.note(`DROPPED ${id}: ${why}`)
      } else if (timedOut) {
        const why = "still running after 20 min"
        statuses = { ...statuses, [id]: "dropped" }
        dropped = [...dropped, { runId: id, reason: why }]
        await this.note(`DROPPED ${id}: ${why}`)
      }
    }
    this.statuses = statuses
    this.dropped = dropped

    // At most one analyze call per tick keeps the tick bounded (a long call still holds the actor <= 120s).
    const next = this.runIds.find((id) => this.statuses[id] === "done")
    if (next) {
      this.statuses = { ...this.statuses, [next]: "analyzing" }
      if (!webUrl) {
        await this.dropRun(next, "WEB_URL not set")
      } else {
        try {
          await http("POST", `${webUrl}/api/analyze/${next}`, undefined, ANALYZE_TIMEOUT_MS)
          this.statuses = { ...this.statuses, [next]: "analyzed" }
          this.analyzed = [...this.analyzed, next]
          await this.note(`ANALYZED ${next}`)
        } catch (err) {
          await this.dropRun(next, `analyze failed: ${(err as Error).message}`)
        }
      }
    }

    const unsettled = this.runIds.some((id) => this.statuses[id] === "running" || this.statuses[id] === "done")
    if (unsettled) {
      const hasDone = this.runIds.some((id) => this.statuses[id] === "done")
      this.alarm.set(Date.now() + (hasDone ? 100 : POLL_MS))
      return
    }
    await this.note(`all runs settled: ${this.analyzed.length} analyzed, ${this.dropped.length} dropped`)
    this.phase = "synthesizing"
    this.alarm.set(Date.now() + 10)
  }

  private async tickSynthesize(): Promise<void> {
    const webUrl = await this.env("WEB_URL")
    if (!webUrl) return
    if (this.analyzed.length === 0) {
      await this.fail("synthesis skipped: no run was analyzed")
      return
    }
    try {
      await http("POST", `${webUrl}/api/synthesize`, undefined, ANALYZE_TIMEOUT_MS)
      this.synthesized = true
      this.phase = "done"
      await this.note("synthesis complete")
    } catch (err) {
      await this.fail(`synthesis failed: ${(err as Error).message}`)
    }
  }

  /** Reads a required base URL; on absence marks the batch failed (never silent) and returns null. */
  private async env(name: "SIM_URL" | "WEB_URL"): Promise<string | null> {
    const v = process.env[name]
    if (v) return trimSlash(v)
    await this.fail(`${name} is not set`)
    return null
  }

  private async dropRun(runId: string, reason: string): Promise<void> {
    this.statuses = { ...this.statuses, [runId]: "dropped" }
    this.dropped = [...this.dropped, { runId, reason }]
    await this.note(`DROPPED ${runId}: ${reason}`)
  }

  private async fail(message: string): Promise<void> {
    this.phase = "failed"
    await this.note(`FAILED: ${message}`)
  }

  private async note(line: string): Promise<void> {
    this.log = [...this.log, `${new Date().toISOString()} ${line}`].slice(-LOG_LINES)
  }

  private async report(): Promise<ExperimentStatus> {
    return {
      phase: this.phase,
      n: this.n,
      runIds: this.runIds,
      statuses: this.statuses,
      analyzed: this.analyzed,
      dropped: this.dropped,
      startedAt: this.startedAt,
      synthesized: this.synthesized,
      log: this.log,
    }
  }
}
