// Sim worker entry: frozen HTTP surface (see CLAUDE.md). All routes are 501 stubs for now.
export { WorldActor } from "./world/WorldActor";
export { AgentActor } from "./agents/AgentActor";

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

const json = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: CORS_HEADERS });

const notImplemented = (route: string): Response =>
  json({ error: "Not implemented", route }, 501);

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    const { pathname } = new URL(request.url);
    const method = request.method;

    if (method === "POST" && pathname === "/runs") return notImplemented("POST /runs");
    if (method === "POST" && pathname === "/batch") return notImplemented("POST /batch");

    const match = pathname.match(/^\/runs\/([^/]+)(\/events|\/ws|\/stop)?$/);
    if (match) {
      const suffix = match[2] ?? "";
      if (method === "GET" && suffix === "") return notImplemented("GET /runs/:id");
      if (method === "GET" && suffix === "/events") return notImplemented("GET /runs/:id/events");
      if (method === "GET" && suffix === "/ws") return notImplemented("GET /runs/:id/ws");
      if (method === "POST" && suffix === "/stop") return notImplemented("POST /runs/:id/stop");
    }
    return json({ error: "Not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
