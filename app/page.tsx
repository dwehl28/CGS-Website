import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import EventCountdown from "@/components/EventCountdown";
import { getPublishedClubhouseUpdates } from "@/lib/clubhouse-updates";
import { getMediaHubData } from "@/lib/media";
import { buildMetadata } from "@/lib/seo";
import {
  events,
  siteConfig,
} from "@/lib/site-content";

const featuredEvent = events[0];
const supportingEvent = events[1];

export const metadata: Metadata = buildMetadata({
  title: "Home",
  description: siteConfig.description,
  path: "/",
});

export default async function Home() {
  const mediaData = await getMediaHubData(3);
  const clubhouseUpdates = await getPublishedClubhouseUpdates(3);
  const featuredUpdate = clubhouseUpdates[0];
  const secondaryUpdates = clubhouseUpdates.slice(1, 3);

  const frontPageNotes = [
    {
      label: "Current run",
      value: "Season 2",
      detail: "Solo Stableford across six weeks.",
    },
    {
      label: "Featured date",
      value: "2 May",
      detail: "CGS Major lands inside the season.",
    },
    {
      label: "Reigning champs",
      value: "Birdie Hunters",
      detail: "Season 1 winners set the benchmark.",
    },
  ];

  const primaryPaths = [
    {
      label: "Events",
      title: "Season 2 and the Major",
      description: "Start with the calendar, competition format, and the next key date.",
      href: "/events",
    },
    {
      label: "Scoreboard",
      title: "Follow live scoring",
      description: "Open the competition board when scores are being updated live.",
      href: "/scoreboard",
    },
    {
      label: "Membership",
      title: "Join the clubhouse",
      description: "See the playing and social paths without overcomplicating it.",
      href: "/membership",
    },
    {
      label: "Media",
      title: "Watch the coverage",
      description: "Catch the latest uploads, highlights, and CGS content in one place.",
      href: "/media",
    },
  ];

  return (
    <main className="min-h-screen text-white">
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-6 md:py-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.92fr] lg:items-end">
          <div className="space-y-7">
            <div className="space-y-6">
              <div className="eyebrow">Season 2 is live</div>
              <p className="text-sm uppercase tracking-[0.28em] text-[var(--sand)]">
                Crossodog Golf Society
              </p>
              <h1 className="max-w-3xl text-5xl leading-[0.96] sm:text-6xl md:text-7xl">
                Community golf with a clear season to follow.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-zinc-200 sm:text-lg">
                Crossodog Golf Society is built for everyday golfers. Right now the
                focus is Season 2, a six-week solo Stableford run with the CGS Major
                locked for May 2, 2026 before the grand final closes the season.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link href="/events/season-2" className="btn-primary">
                View Season 2
              </Link>
              <a
                href={mediaData.featuredVideo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                Watch latest video
              </a>
              <Link href="/scoreboard" className="btn-secondary">
                Open live scoreboard
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {frontPageNotes.map((note) => (
                <div key={note.label} className="front-note rounded-[1.35rem] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    {note.label}
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-white">{note.value}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{note.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel front-stage rounded-[2rem] p-6 md:p-8">
            <div className="front-mark">
              <Image
                src="/cgs-logo.png"
                alt=""
                width={520}
                height={520}
                className="h-auto w-full"
                aria-hidden="true"
              />
            </div>

            <div className="relative z-[1] space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--sky)]">
                    Current focus
                  </p>
                  <h2 className="mt-3 max-w-sm text-3xl sm:text-4xl">
                    {featuredEvent.title}
                  </h2>
                </div>

                <span className="chip text-zinc-100">{featuredEvent.homepageBadge}</span>
              </div>

              <p className="max-w-xl text-sm leading-7 text-zinc-300">
                {featuredEvent.summary}
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="front-stage-card rounded-[1.35rem] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--sky)]">
                    Season timing
                  </p>
                  <div className="mt-4">
                    <EventCountdown
                      startDate={featuredEvent.startDate}
                      endDate={featuredEvent.endDate}
                    />
                  </div>
                </div>

                <div className="front-stage-card rounded-[1.35rem] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--sky)]">
                    Featured date
                  </p>
                  <h3 className="mt-3 text-2xl">{supportingEvent.title}</h3>
                  <p className="mt-2 text-sm uppercase tracking-[0.16em] text-[var(--sand)]">
                    {supportingEvent.titleWithDate}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">
                    Waste Management Course. Live streamed. Positioned inside the
                    current season.
                  </p>
                  <Link href={supportingEvent.href} className="btn-secondary mt-5">
                    Open major details
                  </Link>
                </div>
              </div>

              <div className="front-stage-card rounded-[1.35rem] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--sky)]">
                  Why the homepage is lighter
                </p>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-300">
                  The front page should give people the shape of CGS quickly, then let
                  the event, scoreboard, membership, and media pages carry the deeper
                  detail.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-4 sm:px-6 md:py-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {primaryPaths.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="front-link-card rounded-[1.45rem] px-5 py-5"
            >
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--sky)]">
                {item.label}
              </p>
              <h2 className="mt-3 text-2xl text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-300">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="panel rounded-[2rem] p-6 md:p-8">
          <div className="eyebrow">Clubhouse noticeboard</div>
          <h2 className="mt-5 text-4xl">What matters right now</h2>

          {featuredUpdate ? (
            <div className="front-stage-card mt-6 rounded-[1.6rem] p-5">
              <span className="chip text-zinc-100">{featuredUpdate.statusLabel}</span>
              <h3 className="mt-4 text-2xl">{featuredUpdate.title}</h3>
              <p className="mt-4 text-sm leading-7 text-zinc-200">
                {featuredUpdate.summary}
              </p>

              {featuredUpdate.ctaLabel && featuredUpdate.ctaHref ? (
                featuredUpdate.ctaHref.startsWith("/") ? (
                  <Link href={featuredUpdate.ctaHref} className="btn-primary mt-6">
                    {featuredUpdate.ctaLabel}
                  </Link>
                ) : (
                  <a
                    href={featuredUpdate.ctaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary mt-6"
                  >
                    {featuredUpdate.ctaLabel}
                  </a>
                )
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            {secondaryUpdates.map((update) => (
              <div key={update.id} className="front-list-divider pt-4 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="chip text-zinc-100">{update.statusLabel}</span>
                  {update.ctaLabel && update.ctaHref ? (
                    update.ctaHref.startsWith("/") ? (
                      <Link
                        href={update.ctaHref}
                        className="text-sm uppercase tracking-[0.16em] text-[var(--sky)]"
                      >
                        {update.ctaLabel}
                      </Link>
                    ) : (
                      <a
                        href={update.ctaHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm uppercase tracking-[0.16em] text-[var(--sky)]"
                      >
                        {update.ctaLabel}
                      </a>
                    )
                  ) : null}
                </div>
                <h3 className="mt-4 text-xl">{update.title}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-300">{update.summary}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel rounded-[2rem] p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow">Latest watch</div>
              <h2 className="mt-5 text-4xl">One featured upload is enough on the front page.</h2>
            </div>
            <a
              href={siteConfig.youtubeChannelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm uppercase tracking-[0.18em] text-[var(--sky)]"
            >
              Open YouTube
            </a>
          </div>

          <a
            href={mediaData.featuredVideo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="poster-card mt-6 block overflow-hidden rounded-[1.7rem]"
          >
            <div
              className="video-thumb min-h-[18rem] rounded-[1.45rem]"
              style={{ backgroundImage: `url(${mediaData.featuredVideo.thumbnail})` }}
            />
            <div className="p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--sand)]">
                Featured upload
              </p>
              <h3 className="mt-3 text-3xl">{mediaData.featuredVideo.title}</h3>
              <p className="mt-4 text-sm text-zinc-300">
                {mediaData.featuredVideo.publishedLabel} | {mediaData.featuredVideo.viewCountLabel}
              </p>
            </div>
          </a>

          <div className="front-stage-card mt-5 rounded-[1.4rem] p-5">
            <p className="text-sm leading-7 text-zinc-300">
              If someone wants more than the latest upload, the media page can do the
              heavy lifting with the full channel view, shorts, and live content links.
            </p>
            <Link href="/media" className="btn-secondary mt-5">
              Open media page
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
