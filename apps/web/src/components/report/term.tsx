'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { GLOSSARY, type GlossaryKey } from './glossary';

const TIP_WIDTH = 288;
const EDGE = 8;

/**
 * A metric term with an accessible definition: a real button (keyboard focusable), the definition is
 * linked with aria-describedby, opens on hover, focus or tap, closes on Escape, blur, scroll or outside tap.
 */
export function Term({ k, children, className = '' }: { k: GlossaryKey; children: ReactNode; className?: string }) {
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: EDGE, top: 0 });

  const show = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (r) {
      const width = Math.min(TIP_WIDTH, window.innerWidth - EDGE * 2);
      setPos({ left: Math.max(EDGE, Math.min(r.left, window.innerWidth - width - EDGE)), top: r.bottom + 6 });
    }
    setOpen(true);
  }, []);
  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: PointerEvent) => !btn.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('scroll', hide, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', hide, true);
    };
  }, [open, hide]);

  return (
    <span className="inline" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={btn}
        type="button"
        aria-describedby={id}
        aria-expanded={open}
        onFocus={show}
        onBlur={hide}
        onClick={() => (open ? hide() : show())}
        className={`cursor-help rounded-sm text-left underline decoration-dotted decoration-muted-foreground/70 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary print:no-underline ${className}`}
      >
        {children}
      </button>
      <span
        role="tooltip"
        id={id}
        style={{ left: pos.left, top: pos.top, width: Math.min(TIP_WIDTH, 9999) }}
        className={`pointer-events-none fixed z-50 max-w-[calc(100vw-1rem)] rounded-md border bg-surface-raised px-3 py-2 text-left text-[11px] font-normal normal-case leading-relaxed tracking-normal text-foreground shadow-lg ${open ? 'visible' : 'invisible'} print:hidden`}
      >
        {GLOSSARY[k]}
      </span>
    </span>
  );
}
