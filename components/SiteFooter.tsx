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
    <footer className="mt-20 border-t border-[rgba(16,32,51,0.1)] bg-[rgba(255,255,255,0.74)]">
      <div className="mx-auto grid w-full max-w-[94rem] gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 xl:grid-cols-[1.1fr_0.8fr_0.9fr]">
        <div>
          <div className="flex items-center gap-4">
            <Image
              src="/cgs-logo.png"
              alt={siteConfig.name}
              width={68}
              height={68}
              className="h-16 w-16 rounded-full border border-[rgba(16,32,51,0.12)] bg-white object-cover shadow-[0_14px_30px_rgba(16,32,51,0.08)]"
            />
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Crossodog Golf Society
              </p>
              <h3 className="mt-2 text-2xl text-[var(--ink)]">
                Built for everyday golfers.
              </h3>
            </div>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-7 text-[var(--body-copy)]">
            CGS brings together community golf, creator-led coverage, and live
            competition without the gatekeeping.
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
            Pages
          </h4>
          <div className="flex flex-col gap-2 text-sm text-[var(--body-copy)]">
            {navigationLinks.map((link) => (
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
                className="rounded-full border border-[rgba(16,32,51,0.12)] bg-white/70 px-3 py-2 text-sm text-[var(--ink)]"
              >
                {link.label}
              </a>
            ))}
          </div>
          <a
            href={`mailto:${siteConfig.email}`}
            className="mt-4 block text-sm text-[var(--body-copy)]"
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
          <Link
            href="/clubhouse-admin"
            className="mt-2 inline-flex rounded-full border border-[rgba(16,32,51,0.12)] bg-white/70 px-3 py-2 text-sm text-[var(--ink)]"
          >
            Clubhouse Admin
          </Link>
          <div className="mt-5 flex flex-col gap-2 text-sm text-[var(--body-copy)]">
            {supportLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-[rgba(16,32,51,0.08)] px-5 py-4 text-center text-xs uppercase tracking-[0.16em] text-[var(--muted)] sm:px-6">
        &copy; 2026 {siteConfig.name} | Built for everyday golfers
      </div>
    </footer>
  );
}
