"use client";
import { useEventStore } from "@/store/eventStore";
import { useRun } from "./run-context";
import { COMPANY_BG } from "./run-helpers";

export function Roster() {
  const { agents, label, shownCompany } = useRun();
  const selected = useEventStore((s) => s.selectedAgentId);
  const select = useEventStore((s) => s.select);

  return (
    <section aria-label="Merchants">
      <ul className="flex flex-wrap gap-1.5">
        {agents.map((a) => {
          const on = selected === a.id;
          const company = shownCompany(a.id);
          return (
            <li key={a.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => select(on ? null : a.id)}
                className={`flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs transition-colors ${
                  on ? "border-primary bg-primary/15 text-foreground" : "text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                <span className={`size-2 ${company ? COMPANY_BG[company] ?? "bg-muted-foreground/40" : "bg-muted-foreground/40"}`} aria-hidden="true" />
                {label(a.id)}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
