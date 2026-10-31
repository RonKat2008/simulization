// 3-lab judge ensemble: one Mastra agent per registry entry (judges.ts), all with the reviewer's
// instructions and ReviewSchema. Gateway models use Mastra's "vercel/<provider>/<model>" router (AI_GATEWAY_API_KEY).
import { Agent } from '@mastra/core/agent';
import { ReviewSchema, type Review } from '@simulization/shared';
import { REVIEWER_INSTRUCTIONS } from './agents';
import { displayModel, getJudgeSpecs, judgeTimeoutMs, type Env, type JudgeSpec } from './judges';

export interface JudgeRunner {
  spec: JudgeSpec;
  review: (prompt: string) => Promise<Review>;
}

function runnerFor(spec: JudgeSpec, timeoutMs: number, env: Env): JudgeRunner {
  const agent = new Agent({
    id: `judge-${spec.id}`,
    name: `Run judge (${displayModel(spec.model)})`,
    instructions: REVIEWER_INSTRUCTIONS,
    model: spec.model,
  });
  return {
    spec,
    review: async (prompt) => {
      if (spec.model.startsWith('vercel/') && !env.AI_GATEWAY_API_KEY) throw new Error('AI_GATEWAY_API_KEY is not set');
      // Streamed so a long review doesn't sit on an idle connection until it times out.
      const stream = await agent.stream(prompt, {
        structuredOutput: { schema: ReviewSchema },
        modelSettings: { maxOutputTokens: 32000 },
        // claude-opus-5-5 defaults to medium effort; other providers ignore this key.
        providerOptions: { anthropic: { effort: 'high' } },
        abortSignal: AbortSignal.timeout(timeoutMs),
      });
      // A refusal or truncated reply leaves no object, so it must fail rather than store an empty review.
      const review = ReviewSchema.safeParse(await stream.object);
      if (!review.success) {
        throw new Error(`${displayModel(spec.model)} returned no valid review (finishReason: ${await stream.finishReason})`);
      }
      return review.data;
    },
  };
}

/** Resolved per run so env changes apply without a redeploy. */
export function getJudgeRunners(env: Env = process.env): JudgeRunner[] {
  const timeoutMs = judgeTimeoutMs(env);
  return getJudgeSpecs(env).map((spec) => runnerFor(spec, timeoutMs, env));
}
