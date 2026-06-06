import type { Metadata } from "next";
import Link from "next/link";

import EventCountdown from "@/components/EventCountdown";
import FAQSection from "@/components/FAQSection";
import PageIntro from "@/components/PageIntro";
import { buildMetadata } from "@/lib/seo";
import { competitionArchive, getEventBySlug } from "@/lib/site-content";
import {
  buildEventJsonLd,
  buildFaqJsonLd,
  createJsonLd,
} from "@/lib/structured-data";

function requireEvent() {
  const event = getEventBySlug("season-2");

  if (!event) {
    throw new Error("Expected Season 2 event content to exist.");
  }

  return event;
}

const event = requireEvent();
const seasonArchive = competitionArchive.find(
  (archive) => archive.href === event.href
);

export const metadata: Metadata = buildMetadata({
  title: event.title,
  description: event.summary,
  path: event.href,
});

export default function Season2Page() {
  return (
    <main className="min-h-screen text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={createJsonLd(buildEventJsonLd(event))}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={createJsonLd(buildFaqJsonLd(event.faqs))}
      />

      <section className="page-shell max-w-5xl">
        <PageIntro
          eyebrow={event.category}
          title={event.title}
          description={event.summary}
          actions={[
            {
              href: seasonArchive?.resultHref ?? "https://www.youtube.com/@CrossodogGolfSociety",
              label: seasonArchive?.resultLabel ?? "Watch finals",
              external: true,
            },
            { href: "/events/season-3", label: "View Season 3", variant: "secondary" },
          ]}
        >
          <div className="mt-5 inline-meta">
            <span>{event.scheduleLabel}</span>
            <span>Solo Stableford</span>
            <span>Results archive</span>
          </div>
          <div className="mt-6">
            <EventCountdown startDate={event.startDate} endDate={event.endDate} />
          </div>
        </PageIntro>

        <div className="panel rounded-[2rem] p-8">
          <h2 className="text-3xl">Season overview</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {event.overview.map((row) => (
              <div
                key={row.label}
                className="subtle-grid-card rounded-[1.2rem] px-4 py-4"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  {row.label}
                </p>
                <p className="mt-2 text-sm text-zinc-100">{row.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 panel rounded-[2rem] p-8">
          <h2 className="text-3xl">Season 2 results post</h2>
          <div className="mt-5 space-y-4">
            {event.body.map((paragraph) => (
              <p key={paragraph} className="leading-7 text-zinc-300">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-10 panel rounded-[2rem] p-8">
          <h2 className="text-3xl">Who this season suits</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {event.pathways.map((pathway) => (
              <div
                key={pathway.title}
                className="subtle-grid-card rounded-[1.35rem] p-5"
              >
                <h3 className="text-2xl">{pathway.title}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-400">
                  {pathway.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 panel rounded-[2rem] p-8">
          <h2 className="text-3xl">Watch the archive</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <a
              href="https://www.youtube.com/watch?v=gZjw-iSFTws"
              target="_blank"
              rel="noopener noreferrer"
              className="subtle-grid-card rounded-[1.35rem] p-5"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--tan)]">
                A Grade
              </p>
              <h3 className="mt-3 text-2xl">Grand Final</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                Four weeks of competition came down to one final night.
              </p>
            </a>

            <a
              href="https://www.youtube.com/watch?v=Cfv3sKLNVig"
              target="_blank"
              rel="noopener noreferrer"
              className="subtle-grid-card rounded-[1.35rem] p-5"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--tan)]">
                B Grade
              </p>
              <h3 className="mt-3 text-2xl">Finals</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                The B Grade finalists headed to Augusta to close the season.
              </p>
            </a>

            <a
              href="https://www.youtube.com/shorts/FOYhSVt3TsE"
              target="_blank"
              rel="noopener noreferrer"
              className="subtle-grid-card rounded-[1.35rem] p-5"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--tan)]">
                Major
              </p>
              <h3 className="mt-3 text-2xl">Results short</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                The first CGS Major results sit alongside the Season 2 finish.
              </p>
            </a>
          </div>

          <div className="mt-6 flex flex-wrap gap-4">
            <Link href="/events/season-3" className="btn-primary">
              View Season 3
            </Link>
            <Link href="/events" className="btn-secondary">
              Back to events
            </Link>
          </div>
        </div>

        <div className="mt-12">
          <FAQSection
            title="Season 2 FAQs"
            intro="A few quick answers for players and followers jumping into the new six-week run."
            items={event.faqs}
          />
        </div>
      </section>
    </main>
  );
}
