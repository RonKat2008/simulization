"use client";
import { useId } from "react";

export type Option<T extends string> = { value: T; title: string; detail: string; tone: "primary" | "accent" };

const TONE = {
  primary: { on: "border-primary bg-primary/10", text: "text-primary", dot: "border-primary bg-primary" },
  accent: { on: "border-accent bg-accent/10", text: "text-accent", dot: "border-accent bg-accent" },
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
      <legend className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">{legend}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const selected = value === o.value;
          const tone = TONE[o.tone];
          return (
            <label
              key={o.value}
              className={`relative flex cursor-pointer flex-col gap-1.5 rounded-md border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-primary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 ${
                selected ? tone.on : "bg-surface-raised hover:border-muted-foreground/60 active:bg-background"
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
                <span className={`font-display text-xl font-semibold tracking-widest ${tone.text}`}>{o.title}</span>
                <span
                  aria-hidden="true"
                  className={`size-3 rounded-full border ${selected ? tone.dot : "border-muted-foreground/60"}`}
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
