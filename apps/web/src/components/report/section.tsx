import type { ReactNode } from 'react';

/** Quiet section frame: one small heading and an optional lead line. No kicker, no decoration. */
export function Section({ id, title, lead, children }: { id: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-16 border-b py-8 sm:py-10 print:break-inside-avoid print:py-4">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-1.5">
          <h2 id={id} className="font-display text-xl font-semibold leading-tight sm:text-2xl">
            {title}
          </h2>
          {lead && <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground text-pretty sm:text-sm">{lead}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}
