// Mastra runs server-side in Next.js. Terse owns durable delivery; Neon stores results.
import { Mastra } from '@mastra/core/mastra';
import { reviewerAgent, synthesisAgent } from './agents';
import { getJudgeRunners } from './judgeAgents';
import { loadRunData, saveRunAnalysis } from './db';
import { createAnalyzeWorkflow } from './workflow';

export const analyzeRunWorkflow = createAnalyzeWorkflow({
  load: loadRunData,
  judges: () => getJudgeRunners(),
  save: saveRunAnalysis,
});

export const mastra = new Mastra({
  agents: { reviewerAgent, synthesisAgent },
  workflows: { analyzeRunWorkflow },
});
