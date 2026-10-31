import type { ReportData } from './types';

/**
 * Run groups present, by (mode, wealth visibility). Runs are pooled only inside one group, so this is a
 * switch, not a filter over a pooled mean. Plain links (?group=key): no client state crosses the boundary.
 */
export function GroupSelector({ data }: { data: ReportData }) {
  if (data.groups.length <= 1) {
    return (
      <p className="font-mono text-xs text-muted-foreground">
        <span className={data.group.isStub ? 'text-accent' : 'text-foreground'}>{data.group.label}</span>
        {data.group.isStub ? ' · stub' : ''}
      </p>
    );
  }
  return (
    <nav aria-label="Run group" className="flex flex-col gap-2 print:hidden">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground">
        Run group · n = LABELED/BLIND
      </p>
      <ul className="flex flex-wrap gap-2">
        {data.groups.map((g) => {
          const current = g.key === data.group.key;
          return (
            <li key={g.key}>
              <a
                href={`?group=${encodeURIComponent(g.key)}`}
                aria-current={current ? 'true' : undefined}
                className={`inline-flex items-baseline gap-1.5 min-h-9 items-center rounded-md border px-3 py-1 text-xs transition-colors duration-150 hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  current ? 'border-primary bg-surface text-foreground' : 'text-muted-foreground'
                } ${g.isStub ? 'border-dashed' : ''}`}
              >
                <span>{g.label}</span>
                {g.isStub ? <span className="text-accent">stub</span> : null}
                <span className="font-mono tabular-nums">
                  n={g.labeledRuns}/{g.blindRuns}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
