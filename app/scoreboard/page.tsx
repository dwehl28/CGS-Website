import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import PageIntro from "@/components/PageIntro";
import { buildMetadata } from "@/lib/seo";
import { getPublishedCompetitionScoreboards } from "@/lib/scoreboards";
import { competitionArchive } from "@/lib/site-content";

export const metadata: Metadata = buildMetadata({
  title: "Live Scoreboard",
  description:
    "Follow live CGS competition scoreboards, leaderboard movement, and final results as they are updated.",
  path: "/scoreboard",
});

export const dynamic = "force-dynamic";

function formatBoardTime(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Just updated";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
}

export default async function ScoreboardPage() {
  const feed = await getPublishedCompetitionScoreboards();
  const firstCompetition = feed.competitions[0] ?? null;

  return (
    <main className="min-h-screen text-white">
      <section className="page-shell">
        <PageIntro
          eyebrow="Live scoring"
          title="CGS Scoreboard"
          description="A live home for CGS competition scoring. Season 3 is underway after the Monday 25 May 2026 launch, and archived competitions stay available for anyone checking old results."
          align="center"
          actions={[
            { href: "/events/season-3", label: "View Season 3" },
            { href: "/membership", label: "Join CGS", variant: "secondary" },
          ]}
        />

        {feed.warningMessage ? (
          <div className="mx-auto max-w-3xl rounded-[1.4rem] border border-[var(--tan)]/30 bg-[rgba(202,147,103,0.12)] px-5 py-4 text-sm leading-7 text-zinc-200">
            {feed.warningMessage}
          </div>
        ) : null}

        <div className="home-stream-panel mt-10">
          <div>
            <div className="eyebrow">Twitch stream asset</div>
            <h2 className="home-band-heading mt-5">OBS-ready scoreboards now live here.</h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--body-copy)]">
              Published scoreboards now include a dedicated stream overlay URL.
              Use it as an OBS browser source for a bright top-corner board with
              up to six teams, live score updates, and no website header or footer.
            </p>
            <div className="mt-7 flex flex-wrap gap-4">
              {firstCompetition ? (
                <Link
                  href={`/scoreboard/${firstCompetition.slug}/stream`}
                  className="btn-primary"
                >
                  Preview stream overlay
                </Link>
              ) : null}
              <Link href="/clubhouse-admin/scoreboard" className="btn-secondary">
                Manage scoreboard
              </Link>
            </div>
          </div>

          <div className="home-score-strip">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
              Capture format
            </p>
            <div className="home-score-row">
              <span>URL</span>
              <span>/scoreboard/[board]/stream</span>
              <span>OBS</span>
            </div>
            <div className="home-score-row">
              <span>Size</span>
              <span>Top-left half-screen panel</span>
              <span>1920</span>
            </div>
            <div className="home-score-row">
              <span>Data</span>
              <span>Manual admin controls, realtime stream view</span>
              <span>Live</span>
            </div>
          </div>
        </div>

        {feed.competitions.length > 0 ? (
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {feed.competitions.map((competition) => (
              <div key={competition.id} className="panel rounded-[2rem] p-6 md:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="chip text-zinc-100">{competition.statusLabel}</span>
                  <span
                    className={`chip text-zinc-100 ${
                      competition.isLive
                        ? "border-[var(--line-strong)] bg-[var(--accent-soft)]"
                        : ""
                    }`}
                  >
                    {competition.isLive ? "Live now" : "Ready to view"}
                  </span>
                </div>

                <h2 className="mt-5 text-4xl">{competition.title}</h2>
                <p className="mt-4 text-sm leading-7 text-zinc-300">
                  {competition.summary}
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="subtle-grid-card rounded-[1.25rem] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Round
                    </p>
                    <p className="mt-2 text-white">
                      {competition.roundLabel ?? "Competition"}
                    </p>
                  </div>
                  <div className="subtle-grid-card rounded-[1.25rem] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Updated
                    </p>
                    <p className="mt-2 text-white">
                      {formatBoardTime(competition.updatedAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {competition.entries.slice(0, 3).map((entry) => (
                    <div
                      key={entry.id}
                      className="subtle-grid-card rounded-[1.2rem] px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                            Position {entry.position}
                          </p>
                          <div className="mt-2 flex items-center gap-3">
                            {entry.isCgsMember ? (
                              <Image
                                src="/cgs-logo.png"
                                alt="CGS member"
                                width={24}
                                height={24}
                                className="h-6 w-6 rounded-full border border-white/12 bg-white/90 p-1"
                              />
                            ) : null}
                            <p className="text-lg text-white">{entry.playerName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="chip text-zinc-100">
                            {entry.grossLabel}
                          </span>
                          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                            Score
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-4">
                  <Link href={`/scoreboard/${competition.slug}`} className="btn-primary">
                    Open live board
                  </Link>
                  <Link
                    href={`/scoreboard/${competition.slug}/stream`}
                    className="btn-secondary"
                  >
                    Stream overlay
                  </Link>
                  {competition.ctaLabel && competition.ctaHref ? (
                    competition.ctaHref.startsWith("/") ? (
                      <Link href={competition.ctaHref} className="btn-secondary">
                        {competition.ctaLabel}
                      </Link>
                    ) : (
                      <a
                        href={competition.ctaHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary"
                      >
                        {competition.ctaLabel}
                      </a>
                    )
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mx-auto mt-12 max-w-3xl panel rounded-[2rem] p-8 text-center md:p-10">
            <h2 className="text-4xl">No public board is live just yet</h2>
            <p className="mt-5 text-base leading-8 text-zinc-300">
              The scoreboard system is ready. As soon as CGS publishes a competition
              board, it will appear here and start updating in real time.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <Link href="/events" className="btn-primary">
                View events
              </Link>
              <Link href="/membership" className="btn-secondary">
                Join CGS
              </Link>
            </div>
          </div>
        )}

        <div className="mt-14">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow">Results archive</div>
              <h2 className="mt-4 text-4xl">Old competition placeholders</h2>
            </div>
            <Link
              href="/events"
              className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]"
            >
              Open events
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
