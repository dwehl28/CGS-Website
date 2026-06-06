import type { Metadata } from "next";
import Link from "next/link";

import PageIntro from "@/components/PageIntro";
import { buildMetadata } from "@/lib/seo";
import {
  aboutCommitments,
  aboutPillars,
  siteConfig,
  socialLinks,
} from "@/lib/site-content";

export const metadata: Metadata = buildMetadata({
  title: "About CGS",
  description:
    "Learn what Crossodog Golf Society is building, who it is for, and how the club mixes events, content, and community.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <main className="min-h-screen text-white">
      <section className="page-shell">
        <PageIntro
          eyebrow="What CGS is building"
          title="About Crossodog Golf Society"
          description={`${siteConfig.name} is built around a simple idea: golf should feel more welcoming, more social, and more alive online than the usual polished-but-distant club model.`}
          align="center"
          actions={[
            { href: "/membership", label: "Join the clubhouse" },
            { href: "/events", label: "See the events", variant: "secondary" },
          ]}
        />

        <div className="grid gap-6 md:grid-cols-3">
          {aboutPillars.map((pillar) => (
            <div
              key={pillar.title}
              className="subtle-grid-card rounded-[1.75rem] p-6"
            >
              <h2 className="text-3xl">{pillar.title}</h2>
              <p className="mt-4 text-sm leading-7 text-zinc-300">
                {pillar.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="panel rounded-[2rem] p-8">
            <div className="eyebrow">The clubhouse standard</div>
            <h2 className="mt-4 text-4xl">How CGS wants to show up</h2>
            <p className="mt-4 max-w-xl leading-7 text-zinc-300">
              The goal is not to be golf for a tiny in-group. The goal is to
              make golf feel like something people can watch, join, and wear
              with confidence.
            </p>

            <div className="mt-6 flex flex-wrap gap-4">
              <Link href="/membership" className="btn-primary">
                Join the clubhouse
              </Link>
              <Link href="/events" className="btn-secondary">
                See the events
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {aboutCommitments.map((commitment, index) => (
              <div
                key={commitment.title}
                className="subtle-grid-card rounded-[1.5rem] p-5"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
                  0{index + 1}
                </p>
                <h3 className="mt-3 text-2xl">{commitment.title}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-400">
                  {commitment.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 panel rounded-[2rem] p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="eyebrow">Where the brand lives</div>
              <h2 className="mt-4 text-4xl">Follow the CGS story in motion</h2>
            </div>
            <Link href="/media" className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              Visit media room
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="subtle-grid-card rounded-[1.35rem] px-5 py-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      {link.category}
                    </p>
                    <h3 className="mt-2 text-2xl">{link.label}</h3>
                  </div>
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: link.accent }}
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-3 text-sm leading-7 text-zinc-400">
                  {link.description}
                </p>
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
