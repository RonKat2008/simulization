function Arm({ tone, name, line, children }: { tone: 'primary' | 'accent'; name: string; line: string; children: React.ReactNode }) {
  const border = tone === 'primary' ? 'border-primary/60' : 'border-accent/60'
  const text = tone === 'primary' ? 'text-primary' : 'text-accent'
  return (
    <div className={`flex flex-col gap-2 rounded-lg border ${border} bg-surface p-4`}>
      <p className={`font-mono text-xs font-semibold tracking-[0.18em] ${text}`}>{name}</p>
      <p className="text-sm text-foreground">{line}</p>
      <div className="flex flex-wrap gap-1.5" aria-hidden="true">{children}</div>
    </div>
  )
}

const Chip = ({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) => (
  <span className={`rounded-sm border px-1.5 py-0.5 font-mono text-[11px] ${muted ? 'border-dashed text-muted-foreground' : 'text-foreground'}`}>{children}</span>
)

/** The whole design in one picture: shared inputs fan out into two arms that differ only in the label. */
export function DesignDiagram() {
  return (
    <figure className="flex flex-col gap-3" aria-labelledby="design-cap">
      <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1.4fr] md:gap-4">
        <div className="flex flex-col justify-center gap-2 rounded-lg border bg-surface-raised p-4">
          <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground">SAME</p>
          <ul className="flex flex-col gap-1 text-sm text-foreground">
            <li>seed</li>
            <li>18 agents, 3 labs</li>
            <li>prompts and rules</li>
            <li>wealth visibility</li>
          </ul>
        </div>
        <p aria-hidden="true" className="self-center text-center text-2xl text-muted-foreground max-md:rotate-90">→</p>
        <div className="grid gap-3">
          <Arm tone="primary" name="LABELED" line="Each partner's lab is shown.">
            <Chip>Ivy · OpenAI</Chip>
            <Chip>Rook · Google</Chip>
          </Arm>
          <Arm tone="accent" name="BLIND" line="Only names. No lab.">
            <Chip muted>Ivy · ?</Chip>
            <Chip muted>Rook · ?</Chip>
          </Arm>
        </div>
      </div>
      <figcaption id="design-cap" className="text-xs text-muted-foreground">
        Only the identity label differs. Everything else is held fixed.
      </figcaption>
    </figure>
  )
}
