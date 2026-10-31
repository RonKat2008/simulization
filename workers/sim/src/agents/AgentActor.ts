// Owner: Person B. One per agent: persistent memory/state and relay calls.
import { DurableObject } from "cloudflare:workers";

export class AgentActor extends DurableObject<Env> {
  async fetch(_request: Request): Promise<Response> {
    return Response.json({ error: "TODO(Person B)" }, { status: 501 });
  }
}
