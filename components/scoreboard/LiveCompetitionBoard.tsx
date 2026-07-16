"use client";

import Image from "next/image";
import Link from "next/link";
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useState,
} from "react";

import {
  type CompetitionScoreEntry,
  type CompetitionScoreboard,
  getRankingDescription,
  getScoreNoun,
} from "@/lib/scoreboards";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type LiveCompetitionBoardProps = {
  initialCompetition: CompetitionScoreboard;
};

type LiveSyncState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "unavailable";

function formatBoardTime(value: string | null) {
  if (!value) {
    return "TBC";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "TBC";
  }

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
}

function getSyncLabel(syncState: LiveSyncState) {
  switch (syncState) {
    case "connected":
      return "Live updates connected";
    case "connecting":
      return "Connecting to live updates";
    case "reconnecting":
      return "Reconnecting";
    case "unavailable":
      return "Static view only";
    default:
      return "Waiting for updates";
  }
}

function getPrimaryScoreLabel(entry: CompetitionScoreEntry) {
  return entry.scoreLabel;
}

function MemberMark({ isMember }: { isMember: boolean }) {
  if (!isMember) {
    return null;
  }

  return (
    <Image
      src="/cgs-logo.png"
      alt="CGS member"
      width={28}
      height={28}
      className="h-7 w-7 rounded-full border border-white/12 bg-white/90 p-1"
    />
  );
}

export default function LiveCompetitionBoard({
  initialCompetition,
}: LiveCompetitionBoardProps) {
  const [competition, setCompetition] = useState(initialCompetition);
  const [syncState, setSyncState] = useState<LiveSyncState>("idle");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const leaderEntry = competition.entries[0] ?? null;
  const scoreNoun = getScoreNoun(competition.leaderboardMode);
  const rankingDescription = getRankingDescription(competition.leaderboardMode);

  async function refreshCompetition(slug: string) {
    setIsRefreshing(true);

    try {
      const response = await fetch(`/api/scoreboard/${slug}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const nextCompetition = (await response.json()) as CompetitionScoreboard;

      startTransition(() => {
        setCompetition(nextCompetition);
      });
    } catch (error) {
      console.error("Live scoreboard refresh error:", error);
    } finally {
      setIsRefreshing(false);
    }
  }

  const handleRealtimeRefresh = useEffectEvent(async () => {
    await refreshCompetition(initialCompetition.slug);
  });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setSyncState("unavailable");
      return;
    }

    setSyncState("connecting");

    const channel = supabase
      .channel(`competition-scoreboard:${competition.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "competition_scoreboards",
          filter: `id=eq.${competition.id}`,
        },
        () => {
          void handleRealtimeRefresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "competition_score_entries",
          filter: `competition_id=eq.${competition.id}`,
        },
        () => {
          void handleRealtimeRefresh();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setSyncState("connected");
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setSyncState("reconnecting");
          return;
        }

        if (status === "CLOSED") {
          setSyncState("idle");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [competition.id]);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="panel rounded-[2rem] p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="chip text-zinc-100">{competition.statusLabel}</span>
            <span
              className={`chip text-zinc-100 ${
                competition.isLive ? "border-[var(--line-strong)] bg-[var(--accent-soft)]" : ""
              }`}
            >
              {competition.isLive ? "Live now" : "Scoreboard ready"}
            </span>
            <span className="chip text-zinc-100">{getSyncLabel(syncState)}</span>
          </div>

          <h1 className="mt-5 text-4xl md:text-5xl">{competition.title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-zinc-300 md:text-lg">
            {competition.summary}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="stat-pill rounded-[1.35rem] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Round</p>
              <p className="mt-2 text-lg text-white">
                {competition.roundLabel ?? "Competition"}
              </p>
            </div>
            <div className="stat-pill rounded-[1.35rem] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Format</p>
              <p className="mt-2 text-lg text-white">
                {competition.formatLabel ?? "Live scoring"}
              </p>
            </div>
            <div className="stat-pill rounded-[1.35rem] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Venue</p>
              <p className="mt-2 text-lg text-white">
                {competition.location ?? "CGS competition"}
              </p>
            </div>
            <div className="stat-pill rounded-[1.35rem] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Last updated
              </p>
              <p className="mt-2 text-lg text-white">
                {formatBoardTime(competition.updatedAt)}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-4">
            {competition.ctaLabel && competition.ctaHref ? (
              competition.ctaHref.startsWith("/") ? (
                <Link href={competition.ctaHref} className="btn-primary">
                  {competition.ctaLabel}
                </Link>
              ) : (
                <a
                  href={competition.ctaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                >
                  {competition.ctaLabel}
                </a>
              )
            ) : null}

            <button
              type="button"
              onClick={() => void refreshCompetition(initialCompetition.slug)}
              className="btn-secondary"
              disabled={isRefreshing}
            >
              {isRefreshing ? "Refreshing..." : "Refresh scores"}
            </button>
          </div>
        </div>

        <div className="panel rounded-[2rem] p-6 md:p-8">
          <div className="eyebrow">Current lead</div>
          {leaderEntry ? (
            <>
              <div className="mt-5 flex items-center gap-3">
                <MemberMark isMember={leaderEntry.isCgsMember} />
                <h2 className="text-3xl md:text-4xl">{leaderEntry.playerName}</h2>
              </div>
              <p className="mt-3 text-lg text-[var(--tan)]">
                Position {leaderEntry.position} | {getPrimaryScoreLabel(leaderEntry)}
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.25rem] border border-white/8 bg-black/18 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    {scoreNoun}
                  </p>
                  <p className="mt-2 text-lg text-white">{leaderEntry.scoreLabel}</p>
                </div>
                <div className="rounded-[1.25rem] border border-white/8 bg-black/18 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Through</p>
                  <p className="mt-2 text-lg text-white">{leaderEntry.thruLabel ?? "--"}</p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-7 text-zinc-300">
                Ranking is automatic on this board. As scores change in admin, the lead
                updates here based on {rankingDescription}.
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-5 text-3xl md:text-4xl">Waiting for the first score</h2>
              <p className="mt-4 text-sm leading-7 text-zinc-300">
                Once player rows are added from the admin side, this board updates here
                automatically for everyone watching.
              </p>
            </>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.35rem] border border-white/8 bg-black/18 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Start time
              </p>
              <p className="mt-2 text-lg text-white">{formatBoardTime(competition.startsAt)}</p>
            </div>
            <div className="rounded-[1.35rem] border border-white/8 bg-black/18 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Rows tracked
              </p>
              <p className="mt-2 text-lg text-white">{competition.entries.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="panel rounded-[2rem] p-4 md:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 px-2">
          <div>
            <div className="eyebrow">Live board</div>
            <h2 className="mt-4 text-3xl md:text-4xl">Leaderboard</h2>
          </div>
          <p className="text-sm text-zinc-400">
            {competition.entries.length} player
            {competition.entries.length === 1 ? "" : "s"} on the board | Ranked by{" "}
            {rankingDescription}
          </p>
        </div>

        {competition.entries.length > 0 ? (
          <>
            <div className="hidden overflow-hidden rounded-[1.5rem] border border-white/8 md:block">
              <table className="min-w-full border-collapse text-left">
                <thead className="bg-black/18 text-xs uppercase tracking-[0.2em] text-zinc-500">
                  <tr>
                    <th className="px-4 py-4">Pos</th>
                    <th className="px-4 py-4">Player</th>
                    <th className="px-4 py-4">{scoreNoun}</th>
                    <th className="px-4 py-4">Through</th>
                  </tr>
                </thead>
                <tbody>
                  {competition.entries.map((entry) => (
                    <tr key={entry.id} className="border-t border-white/8 bg-transparent">
                      <td className="px-4 py-4 text-lg font-semibold text-white">
                        {entry.position}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <MemberMark isMember={entry.isCgsMember} />
                          <p className="font-semibold text-white">{entry.playerName}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-lg text-[var(--tan)]">
                        {entry.scoreLabel}
                      </td>
                      <td className="px-4 py-4 text-zinc-300">{entry.thruLabel ?? "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 md:hidden">
              {competition.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[1.4rem] border border-white/8 bg-black/18 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        Position {entry.position}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <MemberMark isMember={entry.isCgsMember} />
                        <h3 className="text-2xl">{entry.playerName}</h3>
                      </div>
                    </div>
                    <span className="chip text-zinc-100">{getPrimaryScoreLabel(entry)}</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1rem] border border-white/8 bg-black/16 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                        {scoreNoun}
                      </p>
                      <p className="mt-2 text-white">{entry.scoreLabel}</p>
                    </div>
                    <div className="rounded-[1rem] border border-white/8 bg-black/16 px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                        Through
                      </p>
                      <p className="mt-2 text-white">{entry.thruLabel ?? "--"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-white/12 bg-black/12 px-5 py-8 text-center">
            <p className="text-lg text-white">No player rows have been added yet.</p>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              The board is ready. As soon as CGS adds player scores from the admin
              side, this table will fill in and update for viewers in real time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
