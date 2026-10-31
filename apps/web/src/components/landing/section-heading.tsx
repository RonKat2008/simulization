type SectionHeadingProps = {
  id: string
  kicker: string
  title: string
  description?: string
}

export function SectionHeading({ id, kicker, title, description }: SectionHeadingProps) {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-xs uppercase tracking-[0.2em] text-primary">{kicker}</p>
      <h2 id={id} className="font-display text-3xl font-semibold leading-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
          {description}
        </p>
      )}
    </div>
  )
}
