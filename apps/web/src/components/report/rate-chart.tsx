'use client';

import { useId } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { pct as fmt } from './format';

export interface ChartRow {
  name: string;
  LABELED?: number;
  BLIND?: number;
  /** Printed under the chart: value and sample size, so the chart is never the only source of numbers. */
  labeledText: string;
  blindText: string;
}

export interface RateChartProps {
  title: string;
  description: string;
  yLabel: string;
  rows: ChartRow[];
  /** Reference line (e.g. CHANCE). */
  reference?: { value: number; label: string };
  yMax?: number;
}

const LABELED_FILL = 'var(--primary)';
const BLIND_FILL = 'var(--accent)';
const TICK = { fill: 'var(--muted-foreground)', fontSize: 11 };

export function RateChart({ title, description, yLabel, rows, reference, yMax }: RateChartProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const hatch = `hatch-${uid}`;
  const peak = Math.max(yMax ?? 0, reference?.value ?? 0, ...rows.flatMap((r) => [r.LABELED ?? 0, r.BLIND ?? 0]));
  // Rates live in [0, 1]: round the axis up to the next 10% and never past 100%.
  const top = peak <= 1 ? Math.min(1, Math.ceil((peak * 1.2) / 0.1) * 0.1) || 1 : peak * 1.2;

  return (
    <figure className="flex flex-col gap-4 rounded-lg border bg-surface p-5">
      <figcaption className="flex flex-col gap-1">
        <h3 className="font-display text-xl font-medium">{title}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">{description}</p>
      </figcaption>

      <div className="h-60 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={rows} margin={{ top: 18, right: 8, bottom: 4, left: 0 }} barGap={4}>
            <defs>
              <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill={BLIND_FILL} />
                <rect width="2" height="6" fill="var(--background)" opacity="0.55" />
              </pattern>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={TICK} stroke="var(--border)" tickLine={false} />
            <YAxis
              tick={TICK}
              stroke="var(--border)"
              tickLine={false}
              width={44}
              domain={[0, top]}
              tickFormatter={fmt}
              label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'var(--muted-foreground)', fontSize: 10, dx: 4 }}
            />
            {reference && (
              <ReferenceLine
                y={reference.value}
                stroke="var(--foreground)"
                strokeDasharray="4 4"
                label={{ value: reference.label, position: 'insideTopRight', fill: 'var(--foreground)', fontSize: 10 }}
              />
            )}
            <Bar dataKey="LABELED" fill={LABELED_FILL} radius={[2, 2, 0, 0]} isAnimationActive={false}>
              <LabelList dataKey="LABELED" position="top" formatter={(v) => fmt(Number(v))} fill="var(--foreground)" fontSize={10} />
            </Bar>
            <Bar dataKey="BLIND" fill={`url(#${hatch})`} stroke={BLIND_FILL} radius={[2, 2, 0, 0]} isAnimationActive={false}>
              <LabelList dataKey="BLIND" position="top" formatter={(v) => fmt(Number(v))} fill="var(--foreground)" fontSize={10} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex gap-4 text-xs text-muted-foreground" aria-label="Legend">
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-primary" aria-hidden="true" />
          LABELED (solid)
        </li>
        <li className="flex items-center gap-2">
          <span
            className="size-3 rounded-sm border border-accent"
            style={{ background: 'repeating-linear-gradient(45deg, var(--accent) 0 2px, transparent 2px 5px)' }}
            aria-hidden="true"
          />
          BLIND (hatched)
        </li>
      </ul>

      <table className="w-full text-left text-xs">
        <caption className="sr-only">{title}: values and sample sizes</caption>
        <thead className="text-muted-foreground">
          <tr>
            <th scope="col" className="py-1 pr-2 font-normal" />
            <th scope="col" className="py-1 pr-2 font-normal">LABELED</th>
            <th scope="col" className="py-1 font-normal">BLIND</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t">
              <th scope="row" className="py-1.5 pr-2 font-normal text-muted-foreground">{r.name}</th>
              <td className="py-1.5 pr-2 tabular-nums">{r.labeledText}</td>
              <td className="py-1.5 tabular-nums">{r.blindText}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
