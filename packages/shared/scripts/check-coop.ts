// Prints cooperation, favoritism, label effect and ethicality for both mock runs.
// Usage: pnpm --filter @simulization/shared exec tsx scripts/check-coop.ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethicality, inGroupFavoritism, labelEffect, type EthicalityBucket, type CooperationSide, type RunInput } from '../src/index';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'mock');
const load = (name: string): RunInput => {
  const m = JSON.parse(readFileSync(join(dir, `mock-run.${name}.json`), 'utf8'));
  return { runId: m.run.id, events: m.events, agents: m.agents };
};
const pct = (v: number | null) => (v === null ? 'null' : `${(v * 100).toFixed(1)}%`);
const counts = (b: Record<string, { count: number }>) =>
  Object.entries(b).map(([k, v]) => `${k}=${v.count}`).join(' ');
const coop = (label: string, s: CooperationSide) =>
  `  CR_${label} = ${s.cooperative} / (${s.cooperative} + ${s.defecting}) = ${pct(s.rate)}  [${counts(s.breakdown)}]`;
const eth = (label: string, b: EthicalityBucket) =>
  `  ${label.padEnd(8)} ${b.ethical} / ${b.total} = ${pct(b.rate)}  [${counts(b.breakdown)}]`;

const runs = { labeled: load('labeled'), blind: load('blind') };
for (const [name, r] of Object.entries(runs)) {
  const f = inGroupFavoritism(r.events, r.agents);
  const e = ethicality(r.events, r.agents);
  console.log(`\n== ${name} (${r.runId})`);
  console.log(coop('in', f.cooperation.inGroup));
  console.log(coop('out', f.cooperation.outGroup));
  console.log(`  favoritism = ${f.value === null ? 'null' : f.value.toFixed(4)}`);
  console.log('  ethicality:');
  console.log(eth('overall', e.overall));
  console.log(eth('in', e.inGroup));
  console.log(eth('out', e.outGroup));
  for (const [c, b] of Object.entries(e.byCompany)) console.log(eth(`co ${c}`, b));
  const agentRates = Object.entries(e.byAgent).map(([id, b]) => `${id}:${pct(b.rate)}`).join(' ');
  console.log(`  per agent: ${agentRates}`);
}
const le = labelEffect([runs.labeled], [runs.blind]);
console.log('\nlabel effect', JSON.stringify(le));
console.log('empty favoritism', JSON.stringify(inGroupFavoritism([], []).value), 'empty ethicality rate', ethicality([], []).overall.rate);
console.log('empty label effect', JSON.stringify(labelEffect([], [])));
