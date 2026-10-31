"use client";
import { useCallback, useRef, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const VIEWS = [
  { key: "game", label: "Game" },
  { key: "data", label: "Data" },
  { key: "research", label: "Research" },
] as const;
export type ViewKey = (typeof VIEWS)[number]["key"];

const HINT: Record<ViewKey, string> = {
  game: "Watch the village market",
  data: "Charts and tables of the run",
  research: "Research metrics and evidence",
};

const isView = (v: string | null): v is ViewKey => VIEWS.some((x) => x.key === v);

/** Selected view lives in ?view= so it survives reloads and can be shared. */
export function useView(): [ViewKey, (v: ViewKey) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("view");
  const view: ViewKey = isView(raw) ? raw : "game";
  const set = useCallback(
    (v: ViewKey) => {
      const next = new URLSearchParams(params.toString());
      next.set("view", v);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, router, pathname],
  );
  return [view, set];
}

export const tabId = (k: ViewKey) => `view-tab-${k}`;
export const panelId = (k: ViewKey) => `view-panel-${k}`;

export function ViewTabs({ view, onChange }: { view: ViewKey; onChange: (v: ViewKey) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (ev: KeyboardEvent) => {
    const i = VIEWS.findIndex((v) => v.key === view);
    let n = -1;
    if (ev.key === "ArrowRight") n = (i + 1) % VIEWS.length;
    else if (ev.key === "ArrowLeft") n = (i + VIEWS.length - 1) % VIEWS.length;
    else if (ev.key === "Home") n = 0;
    else if (ev.key === "End") n = VIEWS.length - 1;
    if (n < 0) return;
    ev.preventDefault();
    const k = VIEWS[n]!.key;
    onChange(k);
    refs.current[k]?.focus();
  };

  return (
    <div role="tablist" aria-label="Run view" onKeyDown={onKeyDown} className="flex gap-1 border-b">
      {VIEWS.map((v) => {
        const on = v.key === view;
        return (
          <button
            key={v.key}
            ref={(el) => {
              refs.current[v.key] = el;
            }}
            id={tabId(v.key)}
            role="tab"
            type="button"
            aria-selected={on}
            aria-controls={panelId(v.key)}
            tabIndex={on ? 0 : -1}
            title={HINT[v.key]}
            onClick={() => onChange(v.key)}
            className={`-mb-px rounded-t-sm border-b-2 px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary active:bg-surface-raised ${
              on ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:bg-surface-raised/60 hover:text-foreground"
            }`}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
