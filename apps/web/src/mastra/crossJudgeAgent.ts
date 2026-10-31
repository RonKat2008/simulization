// Cross-family second reviewer: same instructions and schema as the Opus reviewer, a non-Anthropic
// model via the Vercel AI Gateway (Mastra's "vercel/<provider>/<model>" router, key AI_GATEWAY_API_KEY).
import { Agent } from '@mastra/core/agent';
import { ReviewSchema, type Review } from '@simulization/shared';
import { REVIEWER_INSTRUCTIONS } from './agents';
import { DEFAULT_CROSS_JUDGE_MODEL } from './crossJudge';

/** Leaves room under the analyze route's 300s maxDuration; the cross judge runs alongside Opus. */
const DEFAULT_TIMEOUT_MS = 240_000;

export interface CrossReviewer {
  /** Gateway model id, e.g. "openai/gpt-5.5". */
  model: string;
  review: (prompt: string) => Promise<Review>;
}

/**
 * Read per run so env changes apply without a redeploy. Enabled when AI_GATEWAY_API_KEY is set,
 * unless CROSS_JUDGE=0. Returns null when disabled (the analysis then stores no crossJudge field).
 */
export function getCrossReviewer(env: NodeJS.ProcessEnv = process.env): CrossReviewer | null {
  const flag = env.CROSS_JUDGE?.trim();
  if (flag === '0' || flag === 'false') return null;
  if (!env.AI_GATEWAY_API_KEY) {
    if (flag === '1' || flag === 'true') console.warn('[cross-judge] CROSS_JUDGE=1 but AI_GATEWAY_API_KEY is not set; skipping');
    return null;
  }
  const model = (env.CROSS_JUDGE_MODEL?.trim() || DEFAULT_CROSS_JUDGE_MODEL).replace(/^vercel\//, '');
  const parsedTimeout = Number(env.CROSS_JUDGE_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : DEFAULT_TIMEOUT_MS;

  const agent = new Agent({
    id: 'cross-reviewer',
    name: 'Cross-family run reviewer',
    instructions: REVIEWER_INSTRUCTIONS,
    model: `vercel/${model}`,
  });

  return {
    model,
    review: async (prompt) => {
      const stream = await agent.stream(prompt, {
        structuredOutput: { schema: ReviewSchema },
        modelSettings: { maxOutputTokens: 32000 },
        abortSignal: AbortSignal.timeout(timeoutMs),
      });
      const review = ReviewSchema.safeParse(await stream.object);
      if (!review.success) {
        throw new Error(`cross-reviewer (${model}) returned no valid review (finishReason: ${await stream.finishReason})`);
      }
      return review.data;
    },
  };
}
