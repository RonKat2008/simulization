// Owner: B. Copies a finished run from the sim service into Neon so /report and /api/analyze can read it.
// The sim keeps runs in Terse actors only; this is the one bridge into the reporting database.
import { neon } from "@neondatabase/serverless";
import { COMPANIES, ConditionSchema, EventSchema, type Event } from "@simulization/shared";
import { z } from "zod";

export const maxDuration = 60;

const SIM_URL = process.env.SIM_URL ?? process.env.NEXT_PUBLIC_SIM_URL ?? "http://localhost:8787";

const RunStatusSchema = z.object({
  id: z.string(),
  condition: z.string(),
  seed: z.number().int(),
  status: z.enum(["running", "done", "failed"]),
  round: z.number().int().optional(),
  phase: z.string().optional(),
  finalScores: z.record(z.string(), z.number()).nullish(),
  agents: z.array(z.object({ id: z.string(), name: z.string(), company: z.string().optional() })).optional(),
});

interface AgentRow {
  agent_id: string;
  name: string;
  company: string;
  provider: string;
  model: string;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

/** Agent rows from the sim's roster when present, else from event actor ids (company is the id prefix). */
function agentRows(status: z.infer<typeof RunStatusSchema>, events: Event[]): AgentRow[] {
  const roster = new Map<string, { name: string; company: string }>();
  for (const a of status.agents ?? []) roster.set(a.id, { name: a.name, company: a.company ?? a.id[0]! });
  for (const e of events) {
    if (e.actorId !== "world" && !roster.has(e.actorId)) {
      roster.set(e.actorId, { name: e.actorId, company: e.actorCompany ?? e.actorId[0]! });
    }
  }
  return [...roster].map(([id, a]) => {
    const company = COMPANIES.find((c) => c.id === a.company);
    return { agent_id: id, name: a.name, company: a.company, provider: company?.provider ?? "unknown", model: company?.model ?? "unknown" };
  });
}

function eventRow(e: Event) {
  return {
    id: e.id,
    run_id: e.runId,
    seq: e.seq,
    round: e.round,
    phase: e.phase,
    type: e.type,
    actor_id: e.actorId,
    actor_company: e.actorCompany ?? null,
    target_id: e.targetId ?? null,
    target_company: e.targetCompany ?? null,
    channel: e.channel ?? null,
    text: e.text ?? null,
    private_plan: e.privatePlan ?? null,
    claim: e.claim ?? null,
    ground_truth: e.groundTruth ?? null,
    flags: e.flags,
    ts: new Date(e.ts).toISOString(),
  };
}

export async function POST(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const url = process.env.DATABASE_URL;
  if (!url) return Response.json({ error: "DATABASE_URL is not set" }, { status: 500 });

  try {
    const id = encodeURIComponent(runId);
    const status = RunStatusSchema.parse(await fetchJson(`${SIM_URL}/runs/${id}`));
    const condition = ConditionSchema.parse(status.condition.toUpperCase());
    const events = z.array(EventSchema).parse(await fetchJson(`${SIM_URL}/runs/${id}/events?after=0`));
    const agents = agentRows(status, events);

    const sql = neon(url);
    await sql.transaction([
      sql`INSERT INTO runs (id, condition, seed, status, current_round, current_phase, final_scores)
          VALUES (${status.id}, ${condition}, ${status.seed}, ${status.status}, ${status.round ?? 0}, ${status.phase ?? null},
                  ${status.finalScores ? JSON.stringify(status.finalScores) : null}::jsonb)
          ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, current_round = EXCLUDED.current_round,
            current_phase = EXCLUDED.current_phase, final_scores = EXCLUDED.final_scores`,
      sql`INSERT INTO agents (run_id, agent_id, name, company, provider, model)
          SELECT ${status.id}, a.agent_id, a.name, a.company, a.provider, a.model
          FROM jsonb_to_recordset(${JSON.stringify(agents)}::jsonb)
            AS a(agent_id text, name text, company text, provider text, model text)
          ON CONFLICT (run_id, agent_id) DO UPDATE SET name = EXCLUDED.name`,
      sql`INSERT INTO events (id, run_id, seq, round, phase, type, actor_id, actor_company, target_id, target_company,
                              channel, text, private_plan, claim, ground_truth, flags, ts)
          SELECT e.id, e.run_id, e.seq, e.round, e.phase, e.type, e.actor_id, e.actor_company, e.target_id, e.target_company,
                 e.channel, e.text, e.private_plan, e.claim, e.ground_truth, e.flags, e.ts
          FROM jsonb_to_recordset(${JSON.stringify(events.map(eventRow))}::jsonb)
            AS e(id text, run_id text, seq int, round int, phase text, type text, actor_id text, actor_company text,
                 target_id text, target_company text, channel text, text text, private_plan text, claim jsonb,
                 ground_truth jsonb, flags text[], ts timestamptz)
          ON CONFLICT (id) DO NOTHING`,
    ]);

    return Response.json({ runId: status.id, condition, status: status.status, agents: agents.length, events: events.length });
  } catch (error) {
    console.error(`[import ${runId}]`, error);
    const message = error instanceof z.ZodError ? "sim returned an unexpected shape" : "import failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
