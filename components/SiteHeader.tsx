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
    <header className="sticky top-0 z-50 w-full border-b border-[rgba(16,32,51,0.1)] bg-[rgba(255,255,255,0.82)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[94rem] items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/cgs-logo.png"
            alt="Crossodog Golf Society logo"
            width={44}
            height={44}
            className="h-11 w-11 rounded-full border border-[rgba(16,32,51,0.12)] bg-white object-cover shadow-[0_10px_24px_rgba(16,32,51,0.08)]"
            priority
          />
          <div>
            <p className="text-sm font-semibold text-[var(--ink)] md:text-base">
              {siteConfig.name}
            </p>
            <p className="hidden text-xs text-[var(--muted-strong)] sm:block">
              {siteConfig.tagline}
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 text-sm text-[var(--muted-strong)] lg:flex">
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
                    : "hover:bg-white hover:text-[var(--ink)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden rounded-full border border-[rgba(16,32,51,0.1)] bg-white/70 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--muted-strong)] md:block">
            {featuredEvent.titleWithDate}
          </div>

          <Link
            href="/scoreboard"
            className="hidden rounded-full border border-[rgba(16,32,51,0.12)] bg-white/70 px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-white xl:inline-block"
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
            className="rounded-full border border-[rgba(16,32,51,0.12)] bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--ink)] md:hidden"
            aria-expanded={isOpen}
            aria-label={isOpen ? "Close menu" : "Open menu"}
            onClick={() => setIsOpen((current) => !current)}
          >
            {isOpen ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-[rgba(16,32,51,0.1)] bg-[rgba(255,255,255,0.96)] md:hidden">
          <div className="mx-auto flex w-full max-w-[94rem] flex-col gap-2 px-4 py-4 sm:px-6">
            <div className="mb-2 rounded-[1.2rem] border border-[rgba(16,32,51,0.1)] bg-white/70 px-4 py-3 text-sm text-[var(--body-copy)]">
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
                      ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                      : "text-[var(--ink)] hover:bg-white"
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

            <a
              href={siteConfig.youtubeChannelUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="mt-1 rounded-xl px-3 py-3 text-base text-[var(--ink)] hover:bg-white"
            >
              Watch CGS
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
