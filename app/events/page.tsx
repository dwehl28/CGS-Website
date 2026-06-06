import type { Metadata } from "next";
import Link from "next/link";

import EventCountdown from "@/components/EventCountdown";
import PageIntro from "@/components/PageIntro";
import { buildMetadata } from "@/lib/seo";
import {
  competitionArchive,
  seasonMoments,
  upcomingEventCards,
} from "@/lib/site-content";

export const metadata: Metadata = buildMetadata({
  title: "Events",
  description:
    "Explore Season 3, CGS results archives, charity streams, and the signature golf moments shaping the calendar.",
  path: "/events",
});

export default function EventsPage() {
  return (
    <main className="min-h-screen text-white">
      <section className="page-shell">
        <PageIntro
          eyebrow="Built like a season"
          title="CGS Events"
          description="Season 3 is underway after launching Monday 25 May 2026 at 7pm AEST with seven CGS teams, new faces, new combinations, and the Ambrose format back in play."
          align="center"
          actions={[
            { href: "/events/season-3", label: "View Season 3" },
            { href: "/scoreboard", label: "Open scoreboard", variant: "secondary" },
          ]}
        />

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {seasonMoments.map((moment) => (
            <div
              key={moment.title}
              className="subtle-grid-card rounded-[1.6rem] p-5"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                {moment.label}
              </p>
              <h2 className="mt-3 text-3xl">{moment.title}</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                {moment.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-8">
          {upcomingEventCards.map((event, index) => (
            <div
              key={event.slug}
              className="panel rounded-[2rem] p-6 md:p-8"
            >
              <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
                <div>
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                      {event.category}
                    </p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.2em] text-zinc-300">
                      0{index + 1}
                    </span>
                  </div>

                  <h2 className="text-4xl">{event.titleWithDate}</h2>
                  <p className="mt-4 leading-7 text-zinc-300">{event.summary}</p>

                  <div className="mt-5">
                    <EventCountdown startDate={event.startDate} endDate={event.endDate} />
                  </div>
                </div>

                <div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {event.overview.slice(0, 6).map((row) => (
                      <div
                        key={`${event.slug}-${row.label}`}
                        className="subtle-grid-card rounded-[1.2rem] px-4 py-4"
                      >
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                          {row.label}
                        </p>
                        <p className="mt-2 text-sm text-zinc-100">{row.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 space-y-2 text-sm text-zinc-400">
                    <p>{event.scheduleLabel}</p>
                    {event.pricingLabel && <p>{event.pricingLabel}</p>}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-4">
                    <Link href={event.href} className="btn-primary">
                      {event.slug === "season-3" ? "View Season 3" : "Learn More"}
                    </Link>
                    <Link href="/scoreboard" className="btn-secondary">
                      Open live scoreboard
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow">Results archive</div>
              <h2 className="mt-4 text-4xl">Past CGS competitions</h2>
            </div>
            <Link
              href="/media"
              className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]"
            >
              Open media room
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {competitionArchive.map((competition) => (
              <div key={competition.title} className="panel rounded-[1.75rem] p-6">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--tan)]">
                  {competition.label}
                </p>
                <h3 className="mt-3 text-3xl">{competition.title}</h3>
                <p className="mt-4 text-sm leading-7 text-zinc-300">
                  {competition.description}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href={competition.href} className="btn-secondary">
                    Open archive
                  </Link>
                  <a
                    href={competition.resultHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                  >
                    {competition.resultLabel}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
