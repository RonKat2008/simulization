import type { ReportData } from './types';

/**
 * Run groups present, by (mode, wealth visibility). Runs are pooled only inside one group, so this is a
 * switch, not a filter over a pooled mean. Plain links (?group=key): no client state crosses the boundary.
 */
export function GroupSelector({ data }: { data: ReportData }) {
  if (data.groups.length <= 1) {
    return (
      <p className="text-xs text-muted-foreground">
        <span className={data.group.isStub ? 'text-accent' : 'text-foreground'}>{data.group.label}</span>
        {data.group.isStub ? ' · stub' : ''}
      </p>
    );
  }
  return (
    <nav aria-label="Run group" className="flex flex-col gap-1.5 print:hidden">
      <p className="text-xs text-muted-foreground">
        Run group · n = LABELED/BLIND
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {data.groups.map((g) => {
          const current = g.key === data.group.key;
          return (
            <li key={g.key}>
              <a
                href={`?group=${encodeURIComponent(g.key)}`}
                aria-current={current ? 'true' : undefined}
                className={`inline-flex items-baseline gap-1.5 rounded-sm border px-2 py-1 text-xs transition-colors hover:border-primary/60 hover:text-foreground ${
                  current ? 'border-primary text-foreground' : 'text-muted-foreground'
                } ${g.isStub ? 'border-dashed' : ''}`}
              >
                <span>{g.label}</span>
                {g.isStub ? <span className="text-accent">stub</span> : null}
                <span className="tabular-nums">
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
