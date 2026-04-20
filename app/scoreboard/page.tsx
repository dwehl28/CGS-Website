import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { buildMetadata } from "@/lib/seo";
import { getPublishedCompetitionScoreboards } from "@/lib/scoreboards";

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

  return (
    <main className="min-h-screen text-white">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="eyebrow">Live scoring</div>
          <h1 className="mt-6 text-5xl md:text-6xl">CGS Scoreboard</h1>
          <p className="mt-5 text-lg leading-8 text-zinc-300">
            A live home for CGS competition scoring. When a round is active, scores
            update here as the admin board is updated.
          </p>
        </div>

        {feed.warningMessage ? (
          <div className="mx-auto mt-8 max-w-3xl rounded-[1.4rem] border border-[var(--tan)]/30 bg-[rgba(202,147,103,0.12)] px-5 py-4 text-sm leading-7 text-zinc-200">
            {feed.warningMessage}
          </div>
        ) : null}

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
                  <div className="rounded-[1.25rem] border border-white/8 bg-black/18 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Round
                    </p>
                    <p className="mt-2 text-white">
                      {competition.roundLabel ?? "Competition"}
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] border border-white/8 bg-black/18 px-4 py-4">
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
                      className="rounded-[1.2rem] border border-white/8 bg-black/16 px-4 py-4"
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
      </section>
    </main>
  );
}
