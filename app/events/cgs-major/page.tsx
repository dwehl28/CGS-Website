import type { Metadata } from "next";
import Link from "next/link";

import EventCountdown from "@/components/EventCountdown";
import EventInterestForm from "@/components/EventInterestForm";
import FAQSection from "@/components/FAQSection";
import { buildMetadata } from "@/lib/seo";
import { getEventBySlug } from "@/lib/site-content";
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

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="eyebrow">{event.category}</div>
        <h1 className="mt-6 text-5xl md:text-6xl">{event.title}</h1>
        <div className="mt-5">
          <EventCountdown startDate={event.startDate} endDate={event.endDate} />
        </div>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
          {event.summary}
        </p>

        <div className="mt-10 panel rounded-[2rem] p-8">
          <h2 className="text-3xl">Event overview</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {event.overview.map((row) => (
              <div
                key={row.label}
                className="rounded-[1.2rem] border border-white/8 bg-black/18 px-4 py-4"
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
                className="rounded-[1.35rem] border border-white/8 bg-black/18 p-5"
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
              <li>Join the waitlist so CGS knows you want a spot.</li>
              <li>CGS can follow up with final session, pricing, and entry details.</li>
              <li>Playing members will be easiest to prioritise when registrations open.</li>
            </ul>

            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href="/membership"
                className="btn-primary"
              >
                Become a Member
              </Link>

              <Link
                href="/scoreboard"
                className="btn-secondary"
              >
                Open live scoreboard
              </Link>

              <Link
                href="/events"
                className="btn-secondary"
              >
                Back to Events
              </Link>
            </div>
          </div>

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
