import type { EventRecord, FaqItem } from "@/lib/site-content";
import { siteConfig, socialLinks } from "@/lib/site-content";

import { absoluteUrl } from "@/lib/seo";

type JsonLdValue = Record<string, unknown> | Array<Record<string, unknown>>;

function sanitizeJsonLd(value: JsonLdValue) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function createJsonLd(value: JsonLdValue) {
  return {
    __html: sanitizeJsonLd(value),
  };
}

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: siteConfig.name,
    url: siteConfig.siteUrl,
    description: siteConfig.description,
    email: siteConfig.email,
    logo: absoluteUrl("/cgs-logo.png"),
    sameAs: socialLinks.map((link) => link.href),
  };
}

export function buildWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: siteConfig.name,
    url: siteConfig.siteUrl,
    description: siteConfig.description,
    publisher: {
      "@id": absoluteUrl("/#organization"),
    },
  };
}

function getEventOverviewValue(event: EventRecord, label: string) {
  return event.overview.find((item) => item.label.toLowerCase() === label.toLowerCase())
    ?.value;
}

function getEventStatus(event: EventRecord) {
  const now = Date.now();
  const start = new Date(event.startDate).getTime();
  const end = event.endDate ? new Date(event.endDate).getTime() : start;

  if (Number.isFinite(end) && end < now) {
    return "https://schema.org/EventCompleted";
  }

  if (Number.isFinite(start) && start <= now && end >= now) {
    return "https://schema.org/EventInProgress";
  }

  return "https://schema.org/EventScheduled";
}

function getEventAttendanceMode(event: EventRecord) {
  const hasStream = Boolean(getEventOverviewValue(event, "Stream"));

  return hasStream
    ? "https://schema.org/MixedEventAttendanceMode"
    : "https://schema.org/OfflineEventAttendanceMode";
}

export function buildEventJsonLd(event: EventRecord) {
  const venueName = getEventOverviewValue(event, "Venue") ?? event.title;
  const start = new Date(event.startDate);
  const end = event.endDate ? new Date(event.endDate) : null;
  const hasValidStartDate = Number.isFinite(start.getTime());
  const hasValidEndDate = Boolean(end && Number.isFinite(end.getTime()));

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": absoluteUrl(`${event.href}#event`),
    name: event.titleWithDate,
    description: event.summary,
    url: absoluteUrl(event.href),
    ...(hasValidStartDate ? { startDate: event.startDate } : {}),
    ...(hasValidEndDate ? { endDate: event.endDate } : {}),
    eventStatus: getEventStatus(event),
    eventAttendanceMode: getEventAttendanceMode(event),
    image: [absoluteUrl("/opengraph-image")],
    organizer: {
      "@id": absoluteUrl("/#organization"),
    },
    location: {
      "@type": "Place",
      name: venueName,
    },
  };
}

export function buildFaqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
