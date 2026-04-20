import Image from "next/image";
import Link from "next/link";

import {
  navigationLinks,
  siteConfig,
  socialLinks,
  supportLinks,
} from "@/lib/site-content";

export default function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-white/8 bg-[rgba(7,17,30,0.78)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-6 md:grid-cols-2 xl:grid-cols-[1.15fr_0.7fr_0.7fr_0.95fr]">
        <div>
          <div className="flex items-center gap-4">
            <Image
              src="/cgs-logo.png"
              alt={siteConfig.name}
              width={68}
              height={68}
              className="h-16 w-16 rounded-full border border-white/12 bg-white object-cover"
            />
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--sky)]">
                Crossodog Golf Society
              </p>
              <h3 className="mt-2 text-2xl text-white">Play it louder.</h3>
            </div>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-7 text-zinc-300">
            A golf brand for everyday players, built around community, content,
            and event moments that feel approachable but still competitive.
          </p>
          <p className="mt-4 max-w-sm text-sm leading-7 text-zinc-500">
            CGS sits between league play, creator media, merch, and clubhouse-style
            community. The goal is to feel memorable before a visitor even clicks a
            second page.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/events" className="btn-secondary">
              View events
            </Link>
            <Link href="/scoreboard" className="btn-secondary">
              Open scoreboard
            </Link>
          </div>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Navigate
          </h4>
          <div className="flex flex-col gap-2 text-sm text-zinc-300">
            {navigationLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Support
          </h4>
          <div className="flex flex-col gap-2 text-sm text-zinc-300">
            {supportLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            Connect
          </h4>
          <div className="flex flex-wrap gap-2">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/10 bg-white/6 px-3 py-2 text-sm text-zinc-100"
              >
                {link.label}
              </a>
            ))}
          </div>
          <a
            href={`mailto:${siteConfig.email}`}
            className="mt-4 block text-sm text-zinc-300"
          >
            {siteConfig.email}
          </a>
          <a
            href={siteConfig.linktreeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-sm text-[var(--sky)]"
          >
            Linktree
          </a>
        </div>
      </div>

      <div className="border-t border-white/6 px-5 py-4 text-center text-xs uppercase tracking-[0.16em] text-zinc-500 sm:px-6">
        &copy; 2026 {siteConfig.name} | Built for everyday golfers
      </div>
    </footer>
  );
}
