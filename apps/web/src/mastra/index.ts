// Owner: E. Mastra instance, server side only. Runs on Next.js / Vercel, never inside DOs.
import { Mastra } from '@mastra/core/mastra';
import { reviewRun, reviewerAgent, synthesisAgent } from './agents';
import { loadRunData, saveRunAnalysis } from './db';
import { createAnalyzeWorkflow } from './workflow';

export const analyzeRunWorkflow = createAnalyzeWorkflow({
  load: loadRunData,
  review: reviewRun,
  save: saveRunAnalysis,
});

export const mastra = new Mastra({
  agents: { reviewerAgent, synthesisAgent },
  workflows: { analyzeRunWorkflow },
});
