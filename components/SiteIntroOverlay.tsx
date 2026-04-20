"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { siteConfig } from "@/lib/site-content";

const INTRO_STORAGE_KEY = "cgs-intro-seen-v1";

type IntroPhase = "booting" | "visible" | "closing" | "hidden";

export default function SiteIntroOverlay() {
  const pathname = usePathname();
  const timeoutRefs = useRef<number[]>([]);
  const [phase, setPhase] = useState<IntroPhase>(
    pathname === "/" ? "booting" : "hidden"
  );

  useEffect(() => {
    timeoutRefs.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutRefs.current = [];

    if (pathname !== "/") {
      document.body.style.removeProperty("overflow");
      timeoutRefs.current.push(
        window.setTimeout(() => {
          setPhase("hidden");
        }, 0)
      );
      return;
    }

    try {
      if (window.sessionStorage.getItem(INTRO_STORAGE_KEY) === "seen") {
        document.body.style.removeProperty("overflow");
        timeoutRefs.current.push(
          window.setTimeout(() => {
            setPhase("hidden");
          }, 0)
        );
        return;
      }
    } catch {
      // Ignore storage errors and continue showing the intro.
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    document.body.style.overflow = "hidden";
    timeoutRefs.current.push(
      window.setTimeout(() => {
        setPhase("visible");
      }, 0)
    );

    const closingDelay = prefersReducedMotion ? 900 : 2300;
    const hiddenDelay = prefersReducedMotion ? 1250 : 2950;

    timeoutRefs.current.push(
      window.setTimeout(() => {
        setPhase("closing");
      }, closingDelay)
    );

    timeoutRefs.current.push(
      window.setTimeout(() => {
        try {
          window.sessionStorage.setItem(INTRO_STORAGE_KEY, "seen");
        } catch {
          // Ignore storage errors and just hide the intro.
        }

        setPhase("hidden");
        document.body.style.removeProperty("overflow");
      }, hiddenDelay)
    );

    return () => {
      timeoutRefs.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutRefs.current = [];
      document.body.style.removeProperty("overflow");
    };
  }, [pathname]);

  if (phase === "hidden" || phase === "booting") {
    return null;
  }

  const dismissIntro = () => {
    try {
      window.sessionStorage.setItem(INTRO_STORAGE_KEY, "seen");
    } catch {
      // Ignore storage errors and just hide the intro.
    }

    timeoutRefs.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutRefs.current = [];
    setPhase("closing");

    window.setTimeout(() => {
      setPhase("hidden");
      document.body.style.removeProperty("overflow");
    }, 420);
  };

  return (
    <div
      className={`intro-overlay ${phase === "closing" ? "intro-overlay-closing" : ""}`}
      aria-hidden="true"
    >
      <div className="intro-orbit intro-orbit-a" />
      <div className="intro-orbit intro-orbit-b" />
      <div className="intro-scanline" />

      <button type="button" onClick={dismissIntro} className="intro-skip">
        Skip intro
      </button>

      <div className="intro-shell">
        <div className="intro-logo-shell">
          <div className="intro-logo-glow" />
          <Image
            src="/cgs-logo.png"
            alt={siteConfig.name}
            width={340}
            height={340}
            className="intro-logo"
            priority
          />
        </div>

        <div className="intro-copy">
          <p className="intro-kicker">Season 2 is live</p>
          <h1>{siteConfig.name}</h1>
          <p>
            Community golf, creator energy, and a six-week solo Stableford run
            with the CGS Major locked for 2 May inside the season.
          </p>
        </div>
      </div>
    </div>
  );
}
