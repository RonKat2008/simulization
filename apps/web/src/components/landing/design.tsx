import { SectionHeading } from './section-heading'

const ROWS = [
  ['Seed, rules, rewards, prompt', 'identical', 'identical'],
  ['Agent sees other agents', 'name + company', 'name only'],
  ['Company field in agent input', 'present', 'absent (not blank)'],
  ['In-group scored by', 'true company', 'true company'],
]

export function Design() {
  return (
    <section id="design" aria-labelledby="design-title" className="scroll-mt-14 border-b">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 md:py-20">
        <SectionHeading
          id="design-title"
          kicker="Design"
          title="Same market, same seeds. One cue removed."
          description="Tajfel's minimal group paradigm (1971) showed that people favor an in-group even when the label is arbitrary. Here the company label is the group cue and BLIND is the control: if bias persists without labels, it comes from recognizing a style, not a name."
        />
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="border-b bg-surface text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-normal">Factor</th>
                <th scope="col" className="px-4 py-3 font-normal text-primary">LABELED</th>
                <th scope="col" className="px-4 py-3 font-normal text-accent">BLIND</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([factor, a, b]) => (
                <tr key={factor} className="border-b last:border-b-0">
                  <th scope="row" className="px-4 py-3 font-normal text-muted-foreground">{factor}</th>
                  <td className="px-4 py-3">{a}</td>
                  <td className="px-4 py-3">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground">label effect</span> = metric(LABELED) − metric(BLIND),
          per company, averaged over paired seeds.
        </p>
      </div>
    </section>
  )
}
