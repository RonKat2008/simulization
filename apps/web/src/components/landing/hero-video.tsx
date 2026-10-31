"use client";

import { useEffect, useRef, useState } from "react";

interface Chapter {
  start: number;
  end: number;
  label: string;
}

const BASE = "/videos";
const MOBILE_QUERY = "(max-width: 767px)";

/**
 * Full-bleed decorative background video of a real recorded Simulization game.
 * Place inside a `relative` container; it fills it absolutely (inset-0) behind content.
 */
export default function HeroVideo({ showChapters = false, className = "" }: { showChapters?: boolean; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(true); // poster-only until we know the preference
  const [mobile, setMobile] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [label, setLabel] = useState("");

  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mm = window.matchMedia(MOBILE_QUERY);
    const sync = () => {
      setReduced(rm.matches);
      setMobile(mm.matches);
    };
    sync();
    rm.addEventListener("change", sync);
    mm.addEventListener("change", sync);
    return () => {
      rm.removeEventListener("change", sync);
      mm.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (!showChapters || reduced) return;
    const ctl = new AbortController();
    fetch(`${BASE}/hero-chapters.json`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((c: Chapter[]) => setChapters(Array.isArray(c) ? c : []))
      .catch(() => {});
    return () => ctl.abort();
  }, [showChapters, reduced]);

  // Pause when offscreen or tab hidden; play otherwise.
  useEffect(() => {
    const v = videoRef.current;
    const wrap = wrapRef.current;
    if (!v || !wrap || reduced) return;
    let visible = true;
    const update = () => {
      if (visible && !document.hidden) v.play().catch(() => {});
      else v.pause();
    };
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
      update();
    });
    io.observe(wrap);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [reduced, mobile]);

  // Follow currentTime for the caption chip.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !chapters.length) return;
    const onTime = () => {
      const t = v.currentTime;
      const next = chapters.find((c) => t >= c.start && t < c.end)?.label ?? "";
      setLabel((prev) => (prev === next ? prev : next));
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [chapters]);

  return (
    <div ref={wrapRef} aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Poster is the base layer so there is never a blank frame or layout shift. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${BASE}/hero-poster.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover" />
      {!reduced && (
        <video
          key={mobile ? "m" : "d"}
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          autoPlay
          loop
          playsInline
          preload="metadata"
          poster={`${BASE}/hero-poster.jpg`}
          aria-hidden
          tabIndex={-1}
        >
          {mobile ? (
            <source src={`${BASE}/hero-mobile.mp4`} type="video/mp4" />
          ) : (
            <>
              <source src={`${BASE}/hero.webm`} type="video/webm" />
              <source src={`${BASE}/hero.mp4`} type="video/mp4" />
            </>
          )}
        </video>
      )}
      {/* Scrims for text contrast (theme tokens): uniform on phones, left-to-right on wide screens, fade into the page at the bottom. */}
      <div className="absolute inset-0 bg-background/85 md:hidden" />
      <div
        className="absolute inset-0 hidden md:block"
        style={{
          background:
            "linear-gradient(90deg, color-mix(in oklab, var(--background) 94%, transparent) 0%, color-mix(in oklab, var(--background) 80%, transparent) 38%, color-mix(in oklab, var(--background) 30%, transparent) 70%, color-mix(in oklab, var(--background) 10%, transparent) 100%)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-40" style={{ background: "linear-gradient(to bottom, transparent, var(--background))" }} />
      {showChapters && chapters.length > 0 && !reduced && (
        <div aria-live="off" className="absolute bottom-6 right-4 hidden max-w-sm flex-col items-end gap-2 sm:flex sm:right-6">
          <div className="flex gap-1">
            {chapters.map((c) => (
              <span
                key={c.start}
                className={`h-1 w-6 rounded-full transition-colors duration-300 ${c.label === label ? "bg-primary" : "bg-foreground/20"}`}
              />
            ))}
          </div>
          {label && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-background/80 px-3 py-1.5 text-xs text-foreground backdrop-blur">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-primary">Real replay</span>
              <span className="truncate">{label}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
