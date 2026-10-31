"use client";
import { useId } from "react";

export type Option<T extends string> = { value: T; title: string; detail: string; tone: "primary" | "accent" };

const TONE = {
  primary: { on: "border-primary bg-primary/[0.06]", text: "text-primary", dot: "border-primary bg-primary" },
  accent: { on: "border-accent bg-accent/[0.06]", text: "text-accent", dot: "border-accent bg-accent" },
} as const;

/** Accessible radio-card group with a research-oriented explanation per option. */
export function OptionGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  disabled,
}: {
  legend: string;
  name: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  const groupId = useId();
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled} id={groupId}>
      <legend className="mb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-subtle-foreground">{legend}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const selected = value === o.value;
          const tone = TONE[o.tone];
          return (
            <label
              key={o.value}
              className={`relative flex cursor-pointer flex-col gap-1.5 rounded-lg border p-4 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-primary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 ${
                selected ? tone.on : "bg-surface hover:border-border-strong hover:bg-surface-raised"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={selected}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2">
                <span className={`text-base font-semibold ${selected ? tone.text : "text-foreground"}`}>{o.title}</span>
                <span
                  aria-hidden="true"
                  className={`size-3 rounded-full border ${selected ? tone.dot : "border-border-strong"}`}
                />
              </span>
              <span className="text-sm leading-relaxed text-muted-foreground">{o.detail}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
