// Owner: Person B. Per-run AgentRelay orchestration on top of RelayClient: naming, setup,
// message delivery and inbox pulls. Message ORDERING and DM conversation ids are UNCONFIRMED
// until tested against a real key (see relayClient.ts).
import { INBOX_SIZE, type AgentState, type AgentTurnInput } from "@simulization/shared";
import { mapLimit } from "./limits";
import type { RelayClient, RelayMessage } from "./relayClient";

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
  return name.startsWith(prefix) && name.length > prefix.length ? name.slice(prefix.length).toUpperCase() : null;
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
   * UNCONFIRMED: API ordering. We keep API order and take the LAST element of each returned
   * array as the newest id (assumes oldest-first; if newest-first, cursors would regress).
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
    const fresh: InboxMessage[] = [];

    const ingest = (key: string, label: string, msgs: RelayMessage[]): void => {
      if (msgs.length === 0) return;
      nextCursors[key] = msgs[msgs.length - 1]!.id;
      for (const m of msgs) {
        if (m.from === me) continue;
        const from = agentIdFromRelayName(runId, m.from) ?? m.from;
        fresh.push({ from, channel: label, text: m.text, round });
      }
    };

    const pub = channelName(runId, "public");
    ingest(`ch:${pub}`, "public", await this.client.channelMessages(token, pub, cursor.c[`ch:${pub}`]));

    if (coalitionId) {
      const ch = channelName(runId, coalitionId);
      ingest(`ch:${ch}`, coalitionId, await this.client.channelMessages(token, ch, cursor.c[`ch:${ch}`]));
    }

    const convs = await this.client.dmConversations(token);
    for (const conv of convs) {
      const key = `dm:${conv}`;
      ingest(key, "dm", await this.client.dmMessages(token, conv, cursor.c[key]));
    }

    const inbox = [...cursor.recent, ...fresh].slice(-INBOX_SIZE);
    return { inbox, inboxCursor: serializeCursor({ c: nextCursors, recent: inbox }) };
  }
}
