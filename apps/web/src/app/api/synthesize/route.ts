// Owner: E. Cross-run synthesis.
import { synthesizeRuns } from "@/mastra/agents";
import { loadEventIds, loadSynthesisRuns, saveSynthesis } from "@/mastra/db";
import { NoReviewsError, runSynthesis } from "@/mastra/pipeline";

export const maxDuration = 300;

export async function POST() {
  try {
    const content = await runSynthesis({
      loadRuns: loadSynthesisRuns,
      loadEventIds,
      synthesize: synthesizeRuns,
      save: saveSynthesis,
    });
    return Response.json(content);
  } catch (error) {
    if (error instanceof NoReviewsError) {
      return Response.json({ error: error.message, skippedRuns: error.skippedRuns }, { status: 409 });
    }
    console.error("[synthesize]", error);
    return Response.json({ error: "Synthesis failed" }, { status: 500 });
  }
}
