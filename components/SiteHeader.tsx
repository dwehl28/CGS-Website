"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { events, navigationLinks, siteConfig } from "@/lib/site-content";

const featuredEvent = events[0];

export default function SiteHeader() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[rgba(8,18,32,0.84)] backdrop-blur-xl">
      <div className="top-strip hidden md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-2 text-[11px] uppercase tracking-[0.18em] text-zinc-100 sm:px-6">
          <div className="flex flex-wrap items-center gap-4">
            <span>Season 2 live</span>
            <span>Solo Stableford</span>
            <span>Major on 2 May</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link href="/scoreboard">Live scoreboard</Link>
            <a href={siteConfig.youtubeChannelUrl} target="_blank" rel="noopener noreferrer">
              Watch CGS
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:gap-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/cgs-logo.png"
            alt="Crossodog Golf Society logo"
            width={44}
            height={44}
            className="h-11 w-11 rounded-full border border-white/14 bg-white object-cover shadow-[0_0_0_6px_rgba(101,215,255,0.08)]"
            priority
          />
          <div>
            <p className="text-sm font-semibold text-white md:text-base">
              {siteConfig.name}
            </p>
            <p className="hidden text-xs text-[var(--sand)] sm:block">{siteConfig.tagline}</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 text-sm text-zinc-200 md:flex">
          {navigationLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-pill ${
                  isActive
                    ? "nav-pill-active"
                    : "text-zinc-200 hover:bg-white/8 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/scoreboard"
            className="hidden rounded-full border border-[rgba(255,190,24,0.3)] bg-[rgba(255,190,24,0.1)] px-4 py-2 text-sm font-semibold text-[var(--sand)] hover:bg-[rgba(255,190,24,0.16)] lg:inline-block"
          >
            Live Scores
          </Link>

          <Link
            href="/membership"
            className="hidden rounded-full bg-[var(--sun)] px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_12px_28px_rgba(255,190,24,0.18)] hover:bg-[#ffc843] sm:inline-block"
          >
            Join CGS
          </Link>

          <button
            type="button"
            className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-semibold text-white md:hidden"
            aria-expanded={isOpen}
            aria-label={isOpen ? "Close menu" : "Open menu"}
            onClick={() => setIsOpen((current) => !current)}
          >
            {isOpen ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-white/8 bg-[rgba(8,18,32,0.96)] md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-4">
            <div className="mb-2 rounded-[1.2rem] border border-[rgba(255,190,24,0.2)] bg-[rgba(255,190,24,0.08)] px-4 py-3 text-sm text-[var(--sand)]">
              {featuredEvent.titleWithDate}
            </div>

            {navigationLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className={`rounded-xl px-3 py-3 text-base ${
                    isActive
                      ? "bg-[var(--accent-soft)] text-white"
                      : "text-zinc-100 hover:bg-white/6"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            <Link
              href="/membership"
              onClick={() => setIsOpen(false)}
              className="mt-2 inline-block rounded-full bg-[var(--sun)] px-4 py-3 text-center font-semibold text-slate-950"
            >
              Join CGS
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
