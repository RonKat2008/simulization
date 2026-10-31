import Link from "next/link";
import { Hero } from "@/components/landing/hero";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { Disclosure } from "@/components/landing/ui";

export default function Home() {
  return <>
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">Skip to content</a>
    <SiteHeader />
    <main id="main">
      <Hero />
      <section aria-labelledby="how-title" className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
        <div><h2 id="how-title" className="text-2xl font-semibold">Follow the evidence</h2><p className="mt-3 text-base leading-relaxed text-muted-foreground">The village makes the experiment visible. Each result can be traced back to the recorded events behind it.</p></div>
        <ol className="divide-y border-y">
          <li className="py-4"><h3 className="text-base font-semibold">1. See what agents know</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Company names and other merchants’ coin balances can be shown or hidden. An agent never sees another merchant’s true inventory quality or value.</p></li>
          <li className="py-4"><h3 className="text-base font-semibold">2. Watch four phases unfold</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Negotiate, trade, act and reveal. Select a merchant to inspect actions, accepted pacts, self-reported plans and verified coin history.</p></li>
          <li className="py-4"><h3 className="text-base font-semibold">3. Check the run’s report</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Compare behavior counts and their denominators, separate from game score. Recorded settings remain attached to each run.</p></li>
        </ol>
      </section>
      <section aria-label="How to interpret results" className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <Disclosure summary="What these observations can—and cannot—show">
          <p>The engine flags quality claims that differ from true quality by two or more, executed thefts and broken pacts. These are observable game events; a flag does not establish an agent’s intent.</p>
          <p>Differences between company groups are exploratory. One run cannot prove a provider is biased or unethical. Behavior without company labels may have several explanations; it does not by itself demonstrate recognition of model style.</p>
          <p>Reports keep company-label condition, wealth visibility and live versus scripted mode separate. Wealth and coalition formation alone do not establish leadership. Generated private plans are self-reports, not access to internal thoughts.</p>
          <Link href="/report" className="min-h-8 py-1 text-primary underline underline-offset-4">Inspect persisted reports and methods</Link>
        </Disclosure>
      </section>
    </main>
    <SiteFooter />
  </>;
}
