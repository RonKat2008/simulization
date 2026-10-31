// Owner: E. Mastra instance, server side only. Runs on Next.js / Vercel, never inside DOs.
import { Mastra } from '@mastra/core/mastra';
import { OPUS, reviewRun, reviewerAgent, synthesisAgent } from './agents';
import { getCrossReviewer } from './crossJudgeAgent';
import { loadRunData, saveRunAnalysis } from './db';
import { createAnalyzeWorkflow } from './workflow';

export const analyzeRunWorkflow = createAnalyzeWorkflow({
  load: loadRunData,
  review: reviewRun,
  reviewModel: OPUS,
  crossReview: () => getCrossReviewer(),
  save: saveRunAnalysis,
});

export const mastra = new Mastra({
  agents: { reviewerAgent, synthesisAgent },
  workflows: { analyzeRunWorkflow },
});
