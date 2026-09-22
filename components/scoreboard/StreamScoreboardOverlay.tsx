"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

import SolosMotionBackground from "@/components/scoreboard/SolosMotionBackground";
import ScoreChangeSpotlight from "@/components/scoreboard/ScoreChangeSpotlight";
import TeeLoungeLogo from "@/components/scoreboard/TeeLoungeLogo";
import { useAnimatedRankOrder } from "@/components/scoreboard/useAnimatedRankOrder";
import { useScoreChangeSpotlight } from "@/components/scoreboard/useScoreChangeSpotlight";
import type { ScoreboardDisplayTheme } from "@/lib/scoreboard-display-theme";
import type { CompetitionScoreboard } from "@/lib/scoreboards";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type StreamScoreboardOverlayProps = {
  initialCompetition: CompetitionScoreboard;
  theme?: ScoreboardDisplayTheme;
};

type LiveSyncState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "unavailable";

const PORTRAIT_ROWS_PER_PAGE = 10;
const PORTRAIT_PLAYER_LIMIT = 20;
const PORTRAIT_PAGE_DURATION_MS = 8000;

function getSyncLabel(syncState: LiveSyncState) {
  switch (syncState) {
    case "connected":
      return "Live linked";
    case "connecting":
      return "Linking";
    case "reconnecting":
      return "Reconnecting";
    case "unavailable":
      return "Static";
    default:
      return "Ready";
  }
}

function formatOverlayTime(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Updated now";
  }

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
}

export default function StreamScoreboardOverlay({
  initialCompetition,
  theme = "cgs",
}: StreamScoreboardOverlayProps) {
  const [competition, setCompetition] = useState(initialCompetition);
  const [syncState, setSyncState] = useState<LiveSyncState>("idle");
  const [pageIndex, setPageIndex] = useState(0);
  const portraitEntries = competition.entries.slice(0, PORTRAIT_PLAYER_LIMIT);
  const pageCount = Math.max(
    1,
    Math.ceil(portraitEntries.length / PORTRAIT_ROWS_PER_PAGE)
  );
  const activePageIndex = pageIndex % pageCount;
  const firstVisiblePosition = activePageIndex * PORTRAIT_ROWS_PER_PAGE;
  const visibleEntries = portraitEntries.slice(
    firstVisiblePosition,
    firstVisiblePosition + PORTRAIT_ROWS_PER_PAGE
  );
  const leaderEntry = competition.entries[0] ?? null;
  const leaderCount = leaderEntry
    ? competition.entries.filter(
        (entry) => entry.scoreValue === leaderEntry.scoreValue
      ).length
    : 0;
  const secondaryTitle =
    competition.roundLabel ?? competition.formatLabel ?? competition.statusLabel;
  const registerRankRow = useAnimatedRankOrder(
    visibleEntries.map((entry) => entry.id)
  );
  const isTeeLounge = theme === "tee-lounge";
  const { spotlight, observeCompetition } =
    useScoreChangeSpotlight(initialCompetition);

  async function refreshCompetition(slug: string) {
    try {
      const response = await fetch(`/api/scoreboard/${slug}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const nextCompetition = (await response.json()) as CompetitionScoreboard;
      const liveChange = observeCompetition(nextCompetition);

      if (liveChange) {
        const changedEntryIndex = nextCompetition.entries
          .slice(0, PORTRAIT_PLAYER_LIMIT)
          .findIndex((entry) => entry.id === liveChange.entryId);

        if (changedEntryIndex >= 0) {
          setPageIndex(Math.floor(changedEntryIndex / PORTRAIT_ROWS_PER_PAGE));
        }
      }

      startTransition(() => {
        setCompetition(nextCompetition);
      });
    } catch (error) {
      console.error("Stream scoreboard refresh error:", error);
    }
  }

  const handleRealtimeRefresh = useEffectEvent(async () => {
    await refreshCompetition(initialCompetition.slug);
  });

  useEffect(() => {
    if (pageCount <= 1 || spotlight) {
      return;
    }

    const pageTimer = window.setInterval(() => {
      setPageIndex((currentPage) => (currentPage + 1) % pageCount);
    }, PORTRAIT_PAGE_DURATION_MS);

    return () => window.clearInterval(pageTimer);
  }, [pageCount, spotlight]);

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
      .channel(`stream-scoreboard:${competition.id}`)
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
      className={`stream-canvas solos-ladder-canvas ${
        isTeeLounge ? "is-tee-lounge" : "is-cgs"
      }`}
      aria-label={`${competition.title} ${
        isTeeLounge ? "Tee Lounge" : "CGS"
      } portrait leaderboard`}
    >
      <div
        className={`solos-ladder-board ${
          isTeeLounge ? "is-tee-lounge" : "is-cgs"
        }`}
      >
          <SolosMotionBackground variant="portrait" />

          <header className="solos-ladder-header">
            {isTeeLounge ? (
              <TeeLoungeLogo className="is-portrait" />
            ) : (
              <Image
                src="/cgs-logo.png"
                alt="Crossodog Golf Society"
                width={76}
                height={76}
                priority
              />
            )}
            <div className="solos-ladder-title">
              <p>{isTeeLounge ? "Live competition" : "CGS Top Dog League"}</p>
              <strong>{competition.title}</strong>
              <span>
                {isTeeLounge ? secondaryTitle : `Season 4 | ${secondaryTitle}`}
              </span>
            </div>
            <div className={`solos-live-light is-${syncState}`} aria-label={getSyncLabel(syncState)}>
              <span />
              {competition.isLive ? "Live" : competition.statusLabel}
            </div>
          </header>

          <div className="solos-ladder-ribbon">
            <span>{isTeeLounge ? "Tee Lounge live" : "Season 4 live"}</span>
            <strong>{competition.location ?? "The Tee Lounge"}</strong>
          </div>

          <div className="solos-ladder-facts">
            <div>
              <span>Field</span>
              <strong>{competition.entries.length}</strong>
            </div>
            <div>
              <span>Lead score</span>
              <strong>{leaderEntry?.scoreLabel ?? "--"}</strong>
            </div>
            <div>
              <span>Leaders</span>
              <strong>{leaderCount || "--"}</strong>
            </div>
          </div>

          <div className="solos-ladder-table-head" aria-hidden="true">
            <span>Pos</span>
            <span>Player</span>
            <span>Pts</span>
          </div>

          <div
            className={`solos-ladder-rows ${
              activePageIndex > 0 ? "is-continuation" : ""
            }`}
            key={activePageIndex}
            style={
              isTeeLounge
                ? ({
                    "--tee-lounge-portrait-rows": Math.max(
                      6,
                      visibleEntries.length
                    ),
                  } as CSSProperties)
                : undefined
            }
          >
            {visibleEntries.length > 0 ? (
              visibleEntries.map((entry) => (
                <article
                  key={entry.id}
                  ref={(node) => registerRankRow(entry.id, node)}
                  className={`solos-ladder-row ${
                    entry.position === 1 ? "is-leading" : ""
                  }`}
                >
                  <span className="solos-ladder-position" key={entry.position}>
                    {entry.position}
                  </span>
                  <span className="solos-ladder-player">
                    <span>
                      <strong>{entry.playerName}</strong>
                      <small>{entry.thruLabel ?? "Awaiting first round"}</small>
                    </span>
                  </span>
                  <strong className="solos-ladder-score">{entry.scoreLabel}</strong>
                </article>
              ))
            ) : (
              <div className="solos-ladder-empty">
                <span>Field loading</span>
                Player scores will appear here
              </div>
            )}
          </div>

          <footer className="solos-ladder-footer">
            <span>{getSyncLabel(syncState)}</span>
            <strong>
              Page {activePageIndex + 1} / {pageCount}
            </strong>
            <span>
              {portraitEntries.length > 0
                ? `${firstVisiblePosition + 1}-${Math.min(
                    firstVisiblePosition + PORTRAIT_ROWS_PER_PAGE,
                    portraitEntries.length
                  )} of ${portraitEntries.length}`
                : formatOverlayTime(competition.updatedAt)}
            </span>
          </footer>

          {spotlight ? (
            <ScoreChangeSpotlight
              key={spotlight.key}
              spotlight={spotlight}
              theme={theme}
              variant="portrait"
            />
          ) : null}
      </div>
    </section>
  );
}
