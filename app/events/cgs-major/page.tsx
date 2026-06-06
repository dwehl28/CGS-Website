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
  const event = getEventBySlug("cgs-major");

  if (!event) {
    throw new Error("Expected CGS Major event content to exist.");
  }

  return event;
}

const event = requireEvent();
const majorArchive = competitionArchive.find(
  (archive) => archive.href === event.href
);

export const metadata: Metadata = buildMetadata({
  title: event.title,
  description: event.summary,
  path: event.href,
});

export default function CGSMajorPage() {
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
              href: majorArchive?.resultHref ?? "https://www.youtube.com/@CrossodogGolfSociety",
              label: majorArchive?.resultLabel ?? "Watch results",
              external: true,
            },
            { href: "/events/season-3", label: "View Season 3", variant: "secondary" },
          ]}
        >
          <div className="mt-5 inline-meta">
            <span>{event.pricingLabel ?? "Pricing to be confirmed"}</span>
            <span>Waste Management Course</span>
            <span>Results archive</span>
          </div>
          <div className="mt-6">
            <EventCountdown startDate={event.startDate} endDate={event.endDate} />
          </div>
        </PageIntro>

        <div className="panel rounded-[2rem] p-8">
          <h2 className="text-3xl">Event overview</h2>
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
          <h2 className="text-3xl">About the event</h2>
          <div className="mt-5 space-y-4">
            {event.body.map((paragraph) => (
              <p key={paragraph} className="leading-7 text-zinc-300">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-10 panel rounded-[2rem] p-8">
          <h2 className="text-3xl">Who this event suits</h2>
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
          <h2 className="text-3xl">Watch the Major archive</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <a
              href="https://www.youtube.com/watch?v=9hC0x-vxrHI"
              target="_blank"
              rel="noopener noreferrer"
              className="subtle-grid-card rounded-[1.35rem] p-5"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--tan)]">
                Event stream
              </p>
              <h3 className="mt-3 text-2xl">Major day</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                The long-form record of CGS at the Tee Lounge.
              </p>
            </a>

            <a
              href="https://www.youtube.com/shorts/FOYhSVt3TsE"
              target="_blank"
              rel="noopener noreferrer"
              className="subtle-grid-card rounded-[1.35rem] p-5"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--tan)]">
                Results
              </p>
              <h3 className="mt-3 text-2xl">Major results</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                A quick look at how the boys stacked up in the first CGS Major.
              </p>
            </a>

            <a
              href="https://www.youtube.com/shorts/KzwO1izuALQ"
              target="_blank"
              rel="noopener noreferrer"
              className="subtle-grid-card rounded-[1.35rem] p-5"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--tan)]">
                Prize moment
              </p>
              <h3 className="mt-3 text-2xl">Closest to pin</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                Lachy&apos;s closest-to-the-pin winner moment with Pin Pursuit.
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
            title="CGS Major FAQs"
            intro="A few quick answers for players and supporters deciding whether to raise their hand now."
            items={event.faqs}
          />
        </div>
      </section>
    </main>
  );
}
