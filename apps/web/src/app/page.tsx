// Landing page. Owner: D (HUD/pages). Base design from v0 (chat n6MLntLYcDE).
import { Hero } from "@/components/landing/hero";
import { Cta, Finding, Steps } from "@/components/landing/simple-sections";
import { MotionRoot } from "@/components/landing/reveal";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <SiteHeader />
      <MotionRoot>
      <main id="main" className="overflow-x-clip">
        <Hero />
        <Steps />
        <Finding />
        <Cta />
      </main>
      </MotionRoot>
      <SiteFooter />
    </>
  );
}
