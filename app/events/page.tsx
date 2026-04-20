import type { Metadata } from "next";
import Link from "next/link";

import EventCountdown from "@/components/EventCountdown";
import { buildMetadata } from "@/lib/seo";
import { events, seasonMoments, upcomingEventCards } from "@/lib/site-content";

export const metadata: Metadata = buildMetadata({
  title: "Events",
  description:
    "Explore Season 2, the CGS Major, charity streams, and the signature golf moments shaping the calendar.",
  path: "/events",
});

export default function EventsPage() {
  return (
    <main className="min-h-screen text-white">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="eyebrow">Built like a season</div>
          <h1 className="mt-6 text-5xl md:text-6xl">CGS Events</h1>
          <p className="mt-5 text-lg leading-8 text-zinc-300">
            Season 2 is now underway, and the CGS Major lands on 2 May inside
            the run before the grand final and later community moments bring the
            rest of the calendar forward.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {seasonMoments.map((moment) => (
            <div
              key={moment.title}
              className="panel interactive-card rounded-[1.6rem] p-5"
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
              className="panel interactive-card rounded-[2rem] p-6 md:p-8"
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
                        className="rounded-[1.2rem] border border-white/8 bg-black/18 px-4 py-4"
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
                    {events.some((liveEvent) => liveEvent.slug === event.slug) ? (
                      <>
                        <Link
                          href={event.href}
                          className="btn-primary"
                        >
                          {event.slug === "season-2"
                            ? "View Season 2"
                            : event.slug === "cgs-major"
                            ? "Register Interest"
                            : "Learn More"}
                        </Link>
                        <Link
                          href="/scoreboard"
                          className="btn-secondary"
                        >
                          Open live scoreboard
                        </Link>
                      </>
                    ) : (
                      <button className="rounded-full border border-white/12 bg-white/5 px-5 py-3">
                        Coming Soon
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
