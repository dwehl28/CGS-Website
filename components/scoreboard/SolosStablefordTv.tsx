"use client";

import Image from "next/image";
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";

import SolosMotionBackground from "@/components/scoreboard/SolosMotionBackground";
import { useAnimatedRankOrder } from "@/components/scoreboard/useAnimatedRankOrder";
import type {
  CompetitionScoreboard,
  CompetitionScoreEntry,
} from "@/lib/scoreboards";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type SolosStablefordTvProps = {
  initialCompetition: CompetitionScoreboard;
};

type LiveSyncState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "unavailable";

const TV_ROWS_PER_PAGE = 10;
const TV_PAGE_DURATION_MS = 9000;

function getSyncLabel(syncState: LiveSyncState) {
  switch (syncState) {
    case "connected":
      return "Live data linked";
    case "connecting":
      return "Linking live data";
    case "reconnecting":
      return "Reconnecting";
    case "unavailable":
      return "Static display";
    default:
      return "Display ready";
  }
}

function formatTvTime(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Updated now";
  }

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
}

function TvMemberMark({ entry }: { entry: CompetitionScoreEntry }) {
  if (!entry.isCgsMember) {
    return null;
  }

  return (
    <Image
      src="/cgs-logo.png"
      alt=""
      width={34}
      height={34}
      className="solos-tv-member-mark"
      aria-hidden="true"
    />
  );
}

export default function SolosStablefordTv({
  initialCompetition,
}: SolosStablefordTvProps) {
  const [competition, setCompetition] = useState(initialCompetition);
  const [syncState, setSyncState] = useState<LiveSyncState>("idle");
  const [pageIndex, setPageIndex] = useState(0);
  const pageCount = Math.max(
    1,
    Math.ceil(competition.entries.length / TV_ROWS_PER_PAGE)
  );
  const activePageIndex = pageIndex % pageCount;
  const pageEntries = useMemo(
    () =>
      competition.entries.slice(
        activePageIndex * TV_ROWS_PER_PAGE,
        activePageIndex * TV_ROWS_PER_PAGE + TV_ROWS_PER_PAGE
      ),
    [activePageIndex, competition.entries]
  );
  const leaderEntry = competition.entries[0] ?? null;
  const leaderCount = leaderEntry
    ? competition.entries.filter(
        (entry) => entry.scoreValue === leaderEntry.scoreValue
      ).length
    : 0;
  const playersInTheHunt = leaderEntry?.scoreValue === null || !leaderEntry
    ? 0
    : competition.entries.filter(
        (entry) =>
          entry.scoreValue !== null &&
          entry.scoreValue >= (leaderEntry.scoreValue ?? 0) - 3
      ).length;
  const registerRankRow = useAnimatedRankOrder(
    pageEntries.map((entry) => entry.id)
  );

  async function refreshCompetition(slug: string) {
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
      console.error("Solos TV scoreboard refresh error:", error);
    }
  }

  const handleRealtimeRefresh = useEffectEvent(async () => {
    await refreshCompetition(initialCompetition.slug);
  });

  useEffect(() => {
    if (pageCount <= 1) {
      return;
    }

    const pageTimer = window.setInterval(() => {
      setPageIndex((currentPage) => (currentPage + 1) % pageCount);
    }, TV_PAGE_DURATION_MS);

    return () => window.clearInterval(pageTimer);
  }, [pageCount]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      const unavailableTimer = window.setTimeout(() => {
        setSyncState("unavailable");
      }, 0);

      return () => window.clearTimeout(unavailableTimer);
    }

    const connectingTimer = window.setTimeout(() => {
      setSyncState("connecting");
    }, 0);

    const channel = supabase
      .channel(`solos-tv-scoreboard:${competition.id}`)
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
      window.clearTimeout(connectingTimer);
      void supabase.removeChannel(channel);
    };
  }, [competition.id]);

  return (
    <section
      className="solos-tv-canvas"
      aria-label={`${competition.title} full field TV leaderboard`}
    >
      <div className="solos-tv-atmosphere" aria-hidden="true" />
      <SolosMotionBackground variant="tv" />

      <header className="solos-tv-header">
        <div className="solos-tv-brand">
          <Image
            src="/cgs-logo.png"
            alt="Crossodog Golf Society"
            width={104}
            height={104}
            priority
          />
          <div>
            <p>The Tee Lounge presents</p>
            <h1>Solos Stableford</h1>
            <span>{competition.roundLabel ?? competition.title}</span>
          </div>
        </div>

        <div className="solos-tv-status">
          <span className={`is-${syncState}`}>
            <i />
            {competition.isLive ? "Live leaderboard" : competition.statusLabel}
          </span>
          <strong>{formatTvTime(competition.updatedAt)}</strong>
        </div>
      </header>

      <div className="solos-tv-main">
        <section className="solos-tv-board" aria-label="Leaderboard standings">
          <div className="solos-tv-board-heading">
            <div>
              <span>Full field standings</span>
              <strong>
                Positions {activePageIndex * TV_ROWS_PER_PAGE + 1}-
                {Math.min(
                  (activePageIndex + 1) * TV_ROWS_PER_PAGE,
                  competition.entries.length || TV_ROWS_PER_PAGE
                )}
              </strong>
            </div>
            <p>
              Page {activePageIndex + 1} / {pageCount}
            </p>
          </div>

          <div className="solos-tv-table-head" aria-hidden="true">
            <span>Position</span>
            <span>Player</span>
            <span>Through</span>
            <span>Stableford</span>
          </div>

          <div className="solos-tv-standings-page" key={activePageIndex}>
            {pageEntries.length > 0 ? (
              pageEntries.map((entry) => (
                <article
                  key={entry.id}
                  ref={(node) => registerRankRow(entry.id, node)}
                  className={`solos-tv-row ${
                    entry.position === 1 ? "is-leading" : ""
                  }`}
                >
                  <span className="solos-tv-position" key={entry.position}>
                    {entry.position}
                  </span>
                  <span className="solos-tv-player">
                    <TvMemberMark entry={entry} />
                    <strong>{entry.playerName}</strong>
                  </span>
                  <span className="solos-tv-thru">
                    {entry.thruLabel ?? "Not started"}
                  </span>
                  <strong className="solos-tv-score">{entry.scoreLabel}</strong>
                </article>
              ))
            ) : (
              <div className="solos-tv-empty">
                <strong>Leaderboard ready</strong>
                Scores will populate as the field is entered.
              </div>
            )}
          </div>

          <div className="solos-tv-pagination" aria-hidden="true">
            <div className="solos-tv-page-dots">
              {Array.from({ length: pageCount }, (_, index) => (
                <span
                  key={index}
                  className={index === activePageIndex ? "is-active" : ""}
                />
              ))}
            </div>
            {pageCount > 1 ? (
              <span className="solos-tv-page-progress" key={activePageIndex} />
            ) : null}
          </div>
        </section>

        <aside className="solos-tv-insights" aria-label="Competition facts">
          <div className="solos-tv-leader-card">
            <span>Current leader</span>
            <strong>{leaderEntry?.playerName ?? "Field loading"}</strong>
            <b>{leaderEntry?.scoreLabel ?? "--"}</b>
            <small>{leaderEntry?.thruLabel ?? "Awaiting scores"}</small>
          </div>

          <div className="solos-tv-fact-grid">
            <div>
              <span>Field</span>
              <strong>{competition.entries.length}</strong>
              <small>players tracked</small>
            </div>
            <div>
              <span>At the top</span>
              <strong>{leaderCount || "--"}</strong>
              <small>{leaderCount === 1 ? "outright leader" : "players tied"}</small>
            </div>
            <div>
              <span>In the hunt</span>
              <strong>{playersInTheHunt || "--"}</strong>
              <small>within three points</small>
            </div>
            <div>
              <span>Scoring</span>
              <strong>1 pt</strong>
              <small>per Stableford point</small>
            </div>
          </div>

          <div className="solos-tv-venue-card">
            <span>Playing at</span>
            <strong>{competition.location ?? "The Tee Lounge"}</strong>
            <small>{competition.formatLabel ?? "Individual Stableford"}</small>
          </div>
        </aside>
      </div>

      <footer className="solos-tv-footer">
        <span>{getSyncLabel(syncState)}</span>
        <p>
          Higher points lead <i /> Live standings roll through the complete field
        </p>
        <strong>CGS Golf</strong>
      </footer>
    </section>
  );
}
