import type { Metadata } from "next";
import Link from "next/link";

import EventCountdown from "@/components/EventCountdown";
import EventInterestForm from "@/components/EventInterestForm";
import FAQSection from "@/components/FAQSection";
import PageIntro from "@/components/PageIntro";
import { buildMetadata } from "@/lib/seo";
import { getEventBySlug } from "@/lib/site-content";
import {
  buildEventJsonLd,
  buildFaqJsonLd,
  createJsonLd,
} from "@/lib/structured-data";

function requireEvent() {
  const event = getEventBySlug("season-3");

  if (!event) {
    throw new Error("Expected Season 3 event content to exist.");
  }

  return event;
}

const event = requireEvent();

export const metadata: Metadata = buildMetadata({
  title: event.title,
  description: event.summary,
  path: event.href,
});

export default function Season3Page() {
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
            { href: "#event-interest", label: "Register interest" },
            { href: "/scoreboard", label: "Open scoreboard", variant: "secondary" },
          ]}
        >
          <div className="mt-5 inline-meta">
            <span>{event.scheduleLabel}</span>
            <span>Seven CGS teams</span>
            <span>Team Ambrose</span>
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
          <h2 className="text-3xl">How Season 3 works</h2>
          <div className="mt-5 space-y-4">
            {event.body.map((paragraph) => (
              <p key={paragraph} className="leading-7 text-zinc-300">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-10 panel rounded-[2rem] p-8">
          <h2 className="text-3xl">What changes this season</h2>
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

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="panel rounded-[2rem] p-8">
            <h2 className="text-3xl">What happens next</h2>

            <ul className="mt-5 list-inside list-disc space-y-3 text-zinc-300">
              <li>Season 3 started Monday 25 May 2026 at 7pm AEST.</li>
              <li>Seven CGS teams move back into the Ambrose format.</li>
              <li>Old competition results stay available through the archive.</li>
            </ul>

            <div className="mt-6 flex flex-wrap gap-4">
              <Link href="/membership" className="btn-primary">
                Become a Member
              </Link>

              <Link href="/scoreboard" className="btn-secondary">
                Open live scoreboard
              </Link>

              <Link href="/events/season-2" className="btn-secondary">
                View Season 2 results
              </Link>
            </div>
          </div>

          <div id="event-interest">
            <EventInterestForm
              eventName={event.title}
              eventSlug={event.slug}
              title={event.interestForm.title}
              description={event.interestForm.description}
              buttonLabel={event.interestForm.buttonLabel}
              options={event.interestForm.options}
              showHandicap={event.interestForm.showHandicap}
            />
          </div>
        </div>

        <div className="mt-12">
          <FAQSection
            title="Season 3 FAQs"
            intro="A few quick answers for players and followers jumping into the new Ambrose season."
            items={event.faqs}
          />
        </div>
      </section>
    </main>
  );
}
