'use client';

import { useId } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { pct as fmt } from './format';

export interface ChartRow {
  name: string;
  LABELED?: number;
  BLIND?: number;
  /** Value and sample, shown in the screen-reader table so the chart is never the only source of numbers. */
  labeledText: string;
  blindText: string;
}

export interface RateChartProps {
  title: string;
  caption: string;
  rows: ChartRow[];
  /** Reference line (e.g. CHANCE). */
  reference?: { value: number; label: string };
}

const LABELED_FILL = 'var(--primary)';
const BLIND_FILL = 'var(--accent)';
const TICK = { fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-body), ui-monospace, monospace' };
/** Every panel uses the same fixed axis so bar heights compare across metrics. */
const AXIS_TICKS = [0, 0.25, 0.5, 0.75, 1];

export function RateChart({ title, caption, rows, reference }: RateChartProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const hatch = `hatch-${uid}`;

  return (
    <figure className="relative flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-raised transition-colors duration-150 hover:border-border-strong sm:p-5 print:break-inside-avoid">
      <figcaption className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold tracking-[-0.01em]">{title}</h3>
        <p className="font-mono text-[11px] leading-snug text-muted-foreground text-pretty">{caption}</p>
      </figcaption>

      <div className="h-48 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={rows} margin={{ top: 16, right: reference ? 64 : 6, bottom: 0, left: 0 }} barGap={3}>
            <defs>
              <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill={BLIND_FILL} />
                <rect width="2" height="6" fill="var(--background)" opacity="0.55" />
              </pattern>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={TICK} stroke="var(--border)" tickLine={false} interval={0} />
            <YAxis tick={TICK} stroke="var(--border)" tickLine={false} width={36} domain={[0, 1]} ticks={AXIS_TICKS} tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`} />
            {reference && (
              <ReferenceLine
                y={reference.value}
                stroke="var(--subtle-foreground)"
                strokeDasharray="4 4"
                label={{ value: reference.label, position: 'right', fill: 'var(--muted-foreground)', fontSize: 10, offset: 6 }}
              />
            )}
            <Bar dataKey="LABELED" fill={LABELED_FILL} radius={[3, 3, 0, 0]} isAnimationActive={false} minPointSize={1}>
              <LabelList dataKey="LABELED" position="top" formatter={(v) => fmt(Number(v))} fill="var(--foreground)" fontSize={10} fontFamily="var(--font-body), ui-monospace, monospace" />
            </Bar>
            <Bar dataKey="BLIND" fill={`url(#${hatch})`} stroke={BLIND_FILL} radius={[3, 3, 0, 0]} isAnimationActive={false} minPointSize={1}>
              <LabelList dataKey="BLIND" position="top" formatter={(v) => fmt(Number(v))} fill="var(--foreground)" fontSize={10} fontFamily="var(--font-body), ui-monospace, monospace" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="sr-only"><table aria-label={`${title}: values and sample sizes`}>
        <thead>
          <tr><th scope="col">Category</th><th scope="col">LABELED</th><th scope="col">BLIND</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}><th scope="row">{r.name}</th><td>{r.labeledText}</td><td>{r.blindText}</td></tr>
          ))}
        </tbody>
      </table></div>
    </figure>
  );
}
