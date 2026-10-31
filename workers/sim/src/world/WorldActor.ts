// Owner: Person A. One per run: the referee and single source of truth.
import { DurableObject } from "cloudflare:workers";

export class WorldActor extends DurableObject<Env> {
  async fetch(_request: Request): Promise<Response> {
    return Response.json({ error: "TODO(Person A)" }, { status: 501 });
  }
}
