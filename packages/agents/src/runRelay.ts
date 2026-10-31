// Owner: Person B. Per-run AgentRelay orchestration on top of RelayClient: naming, setup,
// message delivery and inbox pulls. Verified live: the API lists newest-first, RelayClient re-sorts
// oldest-first, and cursors here use the max message id per source (see relayClient.ts).
import { INBOX_SIZE, type AgentState, type AgentTurnInput } from "@simulization/shared";
import { mapLimit } from "./limits";
import { compareIds, type RelayClient, type RelayMessage } from "./relayClient";

export type InboxMessage = AgentTurnInput["inbox"][number];

const SETUP_CONCURRENCY = 6;
const RUN_PREFIX = "run-";

const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** FNV-1a hash in base36: keeps run slugs short but unique per full run id. */
function hash36(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Short, stable, lowercase slug of a run id: readable prefix + hash of the full id (no cross-run collisions). */
const runSlug = (runId: string): string => `${slug(runId).slice(0, 6).replace(/-+$/, "") || "x"}-${hash36(runId)}`;

export function relayAgentName(runId: string, agentId: string): string {
  return `${RUN_PREFIX}${runSlug(runId)}-${slug(agentId) || "x"}`;
}

export function channelName(runId: string, channel: string): string {
  return `${RUN_PREFIX}${runSlug(runId)}-${slug(channel) || "x"}`;
}

/** Inverse of relayAgentName ("A-04" round-trips; agent ids are uppercase letter + number). Null if not from this run. */
export function agentIdFromRelayName(runId: string, name: string): string | null {
  const prefix = `${RUN_PREFIX}${runSlug(runId)}-`;
  if (!name.startsWith(prefix) || name.length <= prefix.length) return null;
  const suffix = name.slice(prefix.length);
  return /^merchant-\d+$/.test(suffix) ? suffix : suffix.toUpperCase();
}

// ---- cursor ----

export interface InboxCursor {
  c: Record<string, string>;
  recent: InboxMessage[];
}

export function parseCursor(raw: string | null | undefined): InboxCursor {
  if (!raw) return { c: {}, recent: [] };
  try {
    const v = JSON.parse(raw) as Partial<InboxCursor> | null;
    if (!v || typeof v !== "object") return { c: {}, recent: [] };
    const c: Record<string, string> = {};
    if (v.c && typeof v.c === "object") {
      for (const [k, id] of Object.entries(v.c)) if (typeof id === "string") c[k] = id;
    }
    const recent = Array.isArray(v.recent)
      ? v.recent.filter(
          (m): m is InboxMessage =>
            !!m && typeof m.from === "string" && typeof m.channel === "string" && typeof m.text === "string" && typeof m.round === "number",
        )
      : [];
    return { c, recent: recent.slice(-INBOX_SIZE) };
  } catch {
    return { c: {}, recent: [] };
  }
}

export function serializeCursor(cursor: InboxCursor): string {
  return JSON.stringify({ c: cursor.c, recent: cursor.recent.slice(-INBOX_SIZE) });
}

// ---- RunRelay ----

export interface RelayAction {
  channel: string;
  to?: string;
  text: string;
}

export class RunRelay {
  constructor(private readonly client: RelayClient) {}

  /** Creates the public channel, registers every agent and joins it to public. Returns agentId -> token. */
  async setupRun(runId: string, agentIds: string[]): Promise<Record<string, string>> {
    const pub = channelName(runId, "public");
    await this.client.createChannel(pub, `Public channel for ${runId}`);
    const entries = await mapLimit(agentIds, SETUP_CONCURRENCY, async (agentId) => {
      const token = await this.client.registerAgent(relayAgentName(runId, agentId), { runId, agentId });
      await this.client.join(token, pub);
      return [agentId, token] as const;
    });
    return Object.fromEntries(entries);
  }

  /** Call AFTER the WorldActor has validated and logged the message event. */
  async deliverMessage(runId: string, fromToken: string, action: RelayAction, idempotencyKey: string): Promise<void> {
    if (action.channel === "public") {
      await this.client.post(fromToken, channelName(runId, "public"), action.text, idempotencyKey);
    } else if (action.channel === "dm") {
      if (!action.to) throw new Error("dm message requires `to`");
      await this.client.dm(fromToken, relayAgentName(runId, action.to), action.text, idempotencyKey);
    } else {
      await this.client.post(fromToken, channelName(runId, action.channel), action.text, idempotencyKey);
    }
  }

  async createCoalition(runId: string, coalitionId: string, creatorToken: string): Promise<void> {
    const ch = channelName(runId, coalitionId);
    await this.client.createChannel(ch, `Coalition ${coalitionId}`);
    await this.client.join(creatorToken, ch);
  }

  async joinCoalition(runId: string, coalitionId: string, token: string): Promise<void> {
    await this.client.join(token, channelName(runId, coalitionId));
  }

  async leaveCoalition(runId: string, coalitionId: string, token: string): Promise<void> {
    await this.client.leave(token, channelName(runId, coalitionId));
  }

  /**
   * Reads public + current coalition + all DM conversations since per-source cursors.
   * Cursors are the max (newest) id seen per source, independent of the order the client returns.
   */
  async pullInbox(
    runId: string,
    agentId: string,
    state: AgentState,
    coalitionId: string | null,
    round: number,
  ): Promise<{ inbox: InboxMessage[]; inboxCursor: string }> {
    const token = state.relayToken;
    if (!token) throw new Error(`agent ${agentId} has no relayToken`);
    const cursor = parseCursor(state.inboxCursor);
    const me = relayAgentName(runId, agentId);
    const nextCursors: Record<string, string> = { ...cursor.c };
    const fresh: Array<{ id: string; msg: InboxMessage }> = [];

    // Ids are kept through ingest so messages from different sources can be merged in true time order.
    const ingest = (key: string, label: string, msgs: RelayMessage[]): void => {
      if (msgs.length === 0) return;
      nextCursors[key] = msgs.reduce((max, m) => (compareIds(m.id, max) > 0 ? m.id : max), cursor.c[key] ?? msgs[0]!.id);
      for (const m of msgs) {
        if (m.from === me) continue;
        const from = agentIdFromRelayName(runId, m.from) ?? m.from;
        fresh.push({ id: m.id, msg: { from, channel: label, text: m.text, round } });
      }
    };

    const readChannel = async (channel: string, label: string): Promise<void> => {
      const key = `ch:${channel}`;
      ingest(key, label, await this.client.channelMessages(token, channel, cursor.c[key]));
    };
    const readDms = async (): Promise<void> => {
      const convs = await this.client.dmConversations(token);
      const reads = await Promise.all(
        convs.map(async (conv) => ({ key: `dm:${conv}`, msgs: await this.client.dmMessages(token, conv, cursor.c[`dm:${conv}`]) })),
      );
      for (const { key, msgs } of reads) ingest(key, "dm", msgs);
    };

    // All sources in parallel (12s turn budget).
    await Promise.all([
      readChannel(channelName(runId, "public"), "public"),
      ...(coalitionId ? [readChannel(channelName(runId, coalitionId), coalitionId)] : []),
      readDms(),
    ]);

    // `round` is the round in which this agent FIRST received the message (not when it was sent), and
    // it is kept in `recent` unchanged afterwards. Fresh messages are merged oldest-first across sources.
    const ordered = [...fresh].sort((x, y) => compareIds(x.id, y.id)).map((f) => f.msg);
    const inbox = [...cursor.recent, ...ordered].slice(-INBOX_SIZE);
    return { inbox, inboxCursor: serializeCursor({ c: nextCursors, recent: inbox }) };
  }
}
