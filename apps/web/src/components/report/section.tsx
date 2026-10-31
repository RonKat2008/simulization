import type { ReactNode } from 'react';
import { Eyebrow } from '@/components/landing/ui';

/** Section frame: mono eyebrow, one clear heading, optional lead. `lg` marks the answer; `md` is evidence. */
export function Section({
  id,
  title,
  lead,
  index,
  kicker = 'Evidence',
  size = 'md',
  children,
}: {
  id: string;
  title: string;
  lead?: ReactNode;
  index?: string;
  kicker?: string;
  size?: 'md' | 'lg';
  children: ReactNode;
}) {
  const pad = size === 'lg' ? 'py-14 sm:py-20' : 'py-10 sm:py-14';
  const heading = size === 'lg' ? 'text-title' : 'text-2xl tracking-[-0.02em] sm:text-[1.75rem]';
  return (
    <section aria-labelledby={id} className={`scroll-mt-16 border-b ${pad} print:break-inside-avoid print:py-4`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-7 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3">
          {index ? <Eyebrow index={index}>{kicker}</Eyebrow> : null}
          <h2 id={id} className={`${heading} font-semibold leading-tight text-balance`}>
            {title}
          </h2>
          {lead && <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">{lead}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}
