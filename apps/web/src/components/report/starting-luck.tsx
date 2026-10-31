'use client';

import { useState } from 'react';
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { StartingLuckResult } from '../../../../../packages/shared/src/starting-luck';

/** Supply one completed run, independent of the replay cursor. */
export function StartingLuck({ result }: { result: StartingLuckResult }) {
  const [selected, setSelected] = useState('');
  const row = result.rows.find(r => r.id === selected) ?? result.rows[0];
  return <details className="rounded-md border bg-surface p-3 sm:p-4">
    <summary className="cursor-pointer text-sm font-medium">Starting Luck and Behavior · {result.behaviorIssues.length ? 'Evidence incomplete' : result.inventoryIssues.length ? 'Starting value unavailable' : `${result.points.length} agents plotted`}</summary>
    <div className="mt-3 space-y-3 text-sm">
      <p className="break-all">Run {result.runId} · {result.condition} · Wealth: {result.wealthVisibility} · {result.mode}</p>
      <p className="text-muted-foreground">Initial inventory advantage: total true value of assigned goods. Observed association with engine-flagged false quality claims / recorded offers, not proof that disadvantage causes cheating or a measure of morality.</p>
      {result.issues.length > 0 ? <ul>{result.issues.map(issue => <li key={issue}>{issue}</li>)}</ul> : result.points.length ? <div className="h-64" aria-label="Starting value and false quality claim rate scatter plot">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}><ScatterChart margin={{ bottom: 24, left: 12, right: 16 }}>
          <CartesianGrid stroke="var(--border)" />
          <XAxis type="number" dataKey="startValue" name="Initial total true value" label={{ value: 'Initial total true value', position: 'bottom' }} />
          <YAxis type="number" dataKey="rate" domain={[0, 1]} name="False claims / offers" tickFormatter={v => `${Math.round(Number(v) * 100)}%`} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={result.points} fill="var(--primary)" isAnimationActive={false} onClick={point => setSelected(String(point.payload?.id))} />
        </ScatterChart></ResponsiveContainer>
      </div> : <p>No offers. No agents have a defined offer rate.</p>}
      <label className="block">Agent detail <select className="ml-2 max-w-full rounded border bg-background p-1" value={row?.id ?? ''} onChange={e => setSelected(e.target.value)}>{result.rows.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      {row && <p className="break-words">{row.name} · Exact model: {row.model} · Provider: {row.provider || 'Unknown (not recorded)'} · Run: {row.runId} · Start value: {row.startValue ?? 'Unavailable'} · {result.behaviorIssues.length ? 'Behavior rate unavailable (incomplete event evidence)' : row.offers ? `${row.falseClaims}/${row.offers} false claims/offers (${(row.rate! * 100).toFixed(1)}%)` : 'No offers'}</p>}
      <div className="overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">All agents, including agents without plotted data</caption><thead><tr><th>Agent</th><th>Exact model</th><th>Initial value</th><th>False claims / offers</th></tr></thead><tbody>{result.rows.map(r => <tr key={r.id}><th className="font-normal">{r.name}</th><td className="break-words">{r.model}</td><td>{r.startValue ?? 'Unavailable'}</td><td>{result.behaviorIssues.length ? 'Unavailable' : r.offers ? `${r.falseClaims}/${r.offers}` : 'No offers'}</td></tr>)}</tbody></table></div>
      <p className="text-xs text-muted-foreground">{result.version} · Full run analysis · {result.source ?? 'Initial source not recorded'}</p>
    </div>
  </details>;
}

/** Select one run within the report's already selected stratum. No pooled chart. */
export function StartingLuckSection({ results }: { results: StartingLuckResult[] }) {
  const [selected, setSelected] = useState('');
  const result = results.find(r => r.runId === selected) ?? results[0];
  if (!result) return null;
  return <section aria-label="Starting Luck and Behavior" className="mx-auto max-w-6xl border-b px-4 py-6 sm:px-6 lg:px-8">
    {results.length > 1 && <label className="mb-3 block text-sm">Completed run
      <select className="ml-2 max-w-full rounded border bg-background p-1 font-mono text-xs" value={result.runId} onChange={e => setSelected(e.target.value)}>
        {results.map(r => <option key={r.runId} value={r.runId}>{r.runId} · {r.condition} · {r.wealthVisibility} · {r.mode}</option>)}
      </select>
    </label>}
    <StartingLuck key={result.runId} result={result} />
  </section>;
}
