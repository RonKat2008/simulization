// Prints powerStructure for both mock runs. Usage: pnpm --filter @simulization/shared exec tsx scripts/check-power.ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { powerStructure } from '../src/index';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'mock');
for (const name of ['labeled', 'blind']) {
  const m = JSON.parse(readFileSync(join(dir, `mock-run.${name}.json`), 'utf8'));
  console.log(name, JSON.stringify(powerStructure(m.events, m.agents, m.run.finalScores), null, 1));
}
console.log('empty', JSON.stringify(powerStructure([], [])));
