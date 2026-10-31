// Owner: E. Mastra post-run workflow.
import { getRun } from "@/mastra/db";
import { mastra } from "@/mastra";

// An Opus review of a full event log takes minutes.
export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  try {
    const row = await getRun(runId);
    if (!row) return Response.json({ error: `Unknown run ${runId}` }, { status: 404 });
    if (row.status !== "done") {
      return Response.json({ error: `Run ${runId} is ${row.status}, not done` }, { status: 409 });
    }

    const run = await mastra.getWorkflow("analyzeRunWorkflow").createRun();
    const result = await run.start({ inputData: { runId } });
    if (result.status !== "success") {
      console.error(`[analyze ${runId}] workflow did not complete`);
      return Response.json({ error: "Analysis failed; retry or inspect report delivery status" }, { status: 500 });
    }
    return Response.json(result.result);
  } catch (error) {
    console.error(`[analyze ${runId}] request failed`);
    return Response.json({ error: "Analysis failed" }, { status: 500 });
  }
}
