import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import EventCountdown from "@/components/EventCountdown";
import { getPublishedClubhouseUpdates } from "@/lib/clubhouse-updates";
import { getMediaHubData } from "@/lib/media";
import { buildMetadata } from "@/lib/seo";
import { competitionArchive, events, siteConfig } from "@/lib/site-content";

const featuredEvent = events[0];
const featuredArchive = competitionArchive[0];

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

  const headlineStats = [
    {
      value: "Season 3",
      label: "Underway after the Monday 25 May launch.",
    },
    {
      value: "7 teams",
      label: "Ambrose scoring with new faces in the mix.",
    },
    {
      value: "Live board",
      label: "Built for site followers and Twitch capture.",
    },
  ];

  const primaryPaths = [
    {
      label: "Events",
      title: "Season 3 hub",
      description: "Follow the current Ambrose season, teams, and archive trail.",
      href: "/events",
    },
    {
      label: "Scoreboard",
      title: "Live scoring",
      description: "Open competition boards or capture the stream overlay for Twitch.",
      href: "/scoreboard",
    },
    {
      label: "Membership",
      title: "Join CGS",
      description: "Pick the social path or put your hand up for playing events.",
      href: "/membership",
    },
    {
      label: "Media",
      title: "Watch the story",
      description: "See the latest uploads, shorts, streams, and CGS moments.",
      href: "/media",
    },
  ];

  const streamRows = [
    { position: "1", player: "Current leader", score: "-4" },
    { position: "2", player: "Chasing pack", score: "-2" },
    { position: "3", player: "On the move", score: "E" },
  ];

  return (
    <main className="site-home min-h-screen">
      <section className="home-hero">
        <div className="home-hero-inner">
          <div>
            <p className="home-kicker">Crossodog Golf Society</p>
            <h1 className="home-title">
              Golf for the average person, built like game day.
            </h1>
            <p className="home-lede">
              CGS brings community golf, live scoring, creator-led coverage, and
              clubhouse energy into one bright home. Season 3 is underway after
              teeing off on Monday 25 May 2026 at 7pm AEST.
            </p>

            <div className="home-actions mt-8">
              <Link href="/events/season-3" className="btn-primary">
                View Season 3
              </Link>
              <Link href="/scoreboard" className="btn-secondary">
                Open scoreboard
              </Link>
              <a
                href={mediaData.featuredVideo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                Watch latest video
              </a>
            </div>

            <div className="home-stat-row" aria-label="CGS current highlights">
              {headlineStats.map((stat) => (
                <div key={stat.value} className="home-stat">
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="home-logo-card">
              <Image
                src="/cgs-logo.png"
                alt={siteConfig.name}
                width={360}
                height={360}
                priority
              />
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                  Current season
                </p>
                <h2 className="mt-2 text-4xl">{featuredEvent.title}</h2>
                <p className="mt-3 leading-7 text-[var(--body-copy)]">
                  {featuredEvent.summary}
                </p>
                <div className="mt-5">
                  <EventCountdown
                    startDate={featuredEvent.startDate}
                    endDate={featuredEvent.endDate}
                  />
                </div>
              </div>
            </div>

            <a
              href={mediaData.featuredVideo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="home-feature-card block"
            >
              <div
                className="home-feature-top"
                style={{ backgroundImage: `url(${mediaData.featuredVideo.thumbnail})` }}
              />
              <div className="home-feature-copy">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sand)]">
                  Latest watch
                </p>
                <h2 className="mt-2 text-3xl">{mediaData.featuredVideo.title}</h2>
                <p className="mt-3 text-sm text-[var(--body-copy)]">
                  {mediaData.featuredVideo.publishedLabel} |{" "}
                  {mediaData.featuredVideo.viewCountLabel}
                </p>
              </div>
            </a>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-wide">
          <div className="home-path-grid">
            {primaryPaths.map((item) => (
              <Link key={item.title} href={item.href} className="home-path-card">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                  {item.label}
                </p>
                <h2 className="mt-4 text-3xl">{item.title}</h2>
                <p className="mt-4 leading-7 text-[var(--body-copy)]">
                  {item.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-section-airy">
        <div className="home-wide">
          <div className="home-stream-panel">
            <div>
              <p className="home-kicker">Stream asset</p>
              <h2 className="home-band-heading mt-5">
                A scoreboard that works on the site and on Twitch.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--body-copy)]">
                Each live competition can now expose a dedicated stream overlay:
                a bright top-corner board designed for OBS browser sources,
                quick admin scoring, six visible teams, and chunky on-screen reading.
              </p>
              <div className="home-actions mt-7">
                <Link href="/scoreboard" className="btn-primary">
                  Choose a live board
                </Link>
                <Link href="/clubhouse-admin/scoreboard" className="btn-secondary">
                  Manage scores
                </Link>
              </div>
            </div>

            <div className="home-score-strip" aria-label="Stream scoreboard preview">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                Overlay preview
              </p>
              {streamRows.map((row) => (
                <div key={row.position} className="home-score-row">
                  <span>{row.position}</span>
                  <span>{row.player}</span>
                  <span>{row.score}</span>
                </div>
              ))}
              <p className="text-sm leading-7 text-[var(--body-copy)]">
                Use the stream link from any published scoreboard card as the OBS
                browser source. Scores update from the admin control desk.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-section-airy">
        <div className="home-wide">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="home-kicker">Clubhouse pulse</p>
              <h2 className="home-band-heading mt-5">Current updates, no clutter.</h2>
            </div>
            <Link href="/media" className="btn-secondary">
              Open media room
            </Link>
          </div>

          <div className="home-notice-grid">
            <div className="grid gap-4">
              {featuredUpdate ? (
                <article className="home-notice">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                    {featuredUpdate.statusLabel}
                  </p>
                  <h3 className="mt-3 text-3xl">{featuredUpdate.title}</h3>
                  <p className="mt-4 leading-7 text-[var(--body-copy)]">
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
                </article>
              ) : null}

              {secondaryUpdates.map((update) => (
                <article key={update.id} className="home-notice">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sand)]">
                    {update.statusLabel}
                  </p>
                  <h3 className="mt-3 text-2xl">{update.title}</h3>
                  <p className="mt-3 leading-7 text-[var(--body-copy)]">
                    {update.summary}
                  </p>
                </article>
              ))}

              <article className="home-notice">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sand)]">
                  Results archive
                </p>
                <h3 className="mt-3 text-2xl">{featuredArchive.title}</h3>
                <p className="mt-3 leading-7 text-[var(--body-copy)]">
                  {featuredArchive.description}
                </p>
                <Link href={featuredArchive.href} className="btn-secondary mt-6">
                  Open archive
                </Link>
              </article>
            </div>

            <div className="home-media-panel">
              <div
                className="home-media-thumb"
                style={{ backgroundImage: `url(${mediaData.featuredVideo.thumbnail})` }}
              />
              <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                    Featured upload
                  </p>
                  <h3 className="mt-3 text-4xl">{mediaData.featuredVideo.title}</h3>
                  <p className="mt-4 leading-7 text-[var(--body-copy)]">
                    {mediaData.featuredVideo.description}
                  </p>
                </div>
                <a
                  href={mediaData.featuredVideo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                >
                  Watch now
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
