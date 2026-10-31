const STACK = [
  { name: 'Cloudflare Durable Objects', role: 'referee + agent memory' },
  { name: 'AgentRelay', role: 'every agent message' },
  { name: 'Terse Durable Actors', role: 'batch experiment jobs' },
  { name: 'Neon', role: 'event log' },
  { name: 'Mastra', role: 'Opus review workflow' },
  { name: 'Vercel', role: 'hosting' },
]

export function StackStrip() {
  return (
    <section aria-labelledby="stack-title" className="border-b">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 lg:px-8">
        <h2 id="stack-title" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Built on
        </h2>
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3 lg:grid-cols-6">
          {STACK.map((item) => (
            <li
              key={item.name}
              className="group flex flex-col gap-1 bg-background px-4 py-5 transition-colors hover:bg-surface"
            >
              <span className="text-sm text-foreground transition-colors group-hover:text-accent">
                {item.name}
              </span>
              <span className="text-xs text-muted-foreground">{item.role}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
