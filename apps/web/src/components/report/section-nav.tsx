'use client';

import { useEffect, useState } from 'react';

export interface NavItem {
  id: string;
  label: string;
  /** Reading-order bucket: answer, evidence, method. */
  stage: 'Answer' | 'Evidence' | 'Method';
}

/** Sticky in-page navigation with the current section highlighted. Plain anchors, so it works without JS. */
export function SectionNav({ items }: { items: NavItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? '');

  useEffect(() => {
    // Observe the whole <section>, not the small heading, so the active item tracks what fills the screen.
    const sectionOf = new Map<Element, string>();
    for (const i of items) {
      const el = document.getElementById(i.id)?.closest('section');
      if (el) sectionOf.set(el, i.id);
    }
    const els = [...sectionOf.keys()];
    if (els.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const visible = new Set<string>();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(sectionOf.get(e.target) ?? '');
          else visible.delete(sectionOf.get(e.target) ?? '');
        }
        const first = items.find((i) => visible.has(i.id));
        if (first) setActive(first.id);
      },
      { rootMargin: '-48px 0px -60% 0px' },
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, [items]);

  return (
    <nav aria-label="Report sections" className="sticky top-0 z-30 border-b bg-background/95 print:hidden">
      <ul className="mx-auto flex max-w-6xl items-center gap-x-1 overflow-x-auto px-4 py-2 text-xs sm:px-6 lg:px-8">
        {items.map((it, i) => {
          const newStage = i === 0 || items[i - 1]!.stage !== it.stage;
          return (
            <li key={it.id} className="flex shrink-0 items-center gap-1">
              {newStage && (
                <span className={`pr-1 font-mono text-[10px] uppercase tracking-[0.08em] text-subtle-foreground ${i > 0 ? 'ml-2 border-l pl-3' : ''}`}>{it.stage}</span>
              )}
              <a
                href={`#${it.id}`}
                aria-current={active === it.id ? 'location' : undefined}
                className={`rounded-md px-2.5 py-1.5 transition-colors duration-150 hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  active === it.id ? 'bg-surface-raised font-medium text-foreground' : 'text-muted-foreground'
                }`}
              >
                {it.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
