"use client";

import Image from "next/image";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

import SolosMotionBackground from "@/components/scoreboard/SolosMotionBackground";
import type {
  CompetitionScoreboard,
  CompetitionScoreEntry,
} from "@/lib/scoreboards";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type StreamScoreboardBannerProps = {
  initialCompetition: CompetitionScoreboard;
};

type LiveSyncState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "unavailable";

const BANNER_PLAYER_LIMIT = 20;

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

function formatBannerTime(value: string) {
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

function MemberMark({ entry }: { entry: CompetitionScoreEntry }) {
  if (!entry.isCgsMember) {
    return null;
  }

  return (
    <Image
      src="/cgs-logo.png"
      alt=""
      width={28}
      height={28}
      className="survivor-ticker-member-mark"
      aria-hidden="true"
    />
  );
}

function BannerTeamCard({ entry }: { entry: CompetitionScoreEntry }) {
  return (
    <article className="survivor-ticker-entry">
      <span className="survivor-ticker-position">{entry.position}</span>
      <span className="survivor-ticker-player">
        <MemberMark entry={entry} />
        <span>{entry.playerName}</span>
      </span>
      <span className="survivor-ticker-thru">{entry.thruLabel ?? "Thru --"}</span>
      <strong className="survivor-ticker-score">{entry.scoreLabel}</strong>
    </article>
  );
}

export default function StreamScoreboardBanner({
  initialCompetition,
}: StreamScoreboardBannerProps) {
  const [competition, setCompetition] = useState(initialCompetition);
  const [syncState, setSyncState] = useState<LiveSyncState>("idle");
  const visibleEntries = competition.entries.slice(0, BANNER_PLAYER_LIMIT);
  const leaderEntry = visibleEntries[0] ?? null;
  const secondaryTitle =
    competition.roundLabel ?? competition.formatLabel ?? competition.statusLabel;

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
      console.error("Stream scoreboard banner refresh error:", error);
    }
  }

  const handleRealtimeRefresh = useEffectEvent(async () => {
    await refreshCompetition(initialCompetition.slug);
  });

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
      .channel(`stream-scoreboard-banner:${competition.id}`)
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
      className="survivor-ticker-canvas"
      aria-label={`${competition.title} stream scoreboard banner`}
    >
      <div className="survivor-ticker-shell">
        <div className="survivor-ticker-atmosphere" aria-hidden="true" />
        <SolosMotionBackground variant="banner" />

        <header className="survivor-ticker-brand">
          <Image
            src="/cgs-logo.png"
            alt="Crossodog Golf Society"
            width={88}
            height={88}
            priority
          />
          <div>
            <p>The Tee Lounge presents</p>
            <h1>Solos Stableford</h1>
            <span>{secondaryTitle}</span>
          </div>
        </header>

        <div className="survivor-ticker-standings">
          <div className="survivor-ticker-rail-label">
            <span>{competition.isLive ? "Live" : "Standings"}</span>
            <strong>Top 20</strong>
            <small>Higher points lead</small>
          </div>

          <div className="survivor-ticker-window">
            {visibleEntries.length > 0 ? (
              <div
                className="survivor-ticker-marquee"
                style={{
                  animationDuration: `${Math.max(
                    36,
                    visibleEntries.length * 4
                  )}s`,
                }}
              >
                <div className="survivor-ticker-list">
                  {visibleEntries.map((entry) => (
                    <BannerTeamCard key={entry.id} entry={entry} />
                  ))}
                </div>
                <div className="survivor-ticker-list" aria-hidden="true">
                  {visibleEntries.map((entry) => (
                    <BannerTeamCard key={`repeat-${entry.id}`} entry={entry} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="survivor-ticker-empty">
                <span>Field locked in</span>
                <strong>Leaderboard opens at tee off</strong>
              </div>
            )}
          </div>
        </div>

        <aside className="survivor-ticker-leader">
          <span>
            <i aria-hidden="true" /> Current leader
          </span>
          <strong>{leaderEntry ? leaderEntry.scoreLabel : "--"}</strong>
          <p>
            {leaderEntry ? `Leader: ${leaderEntry.playerName}` : "Waiting for scores"}
          </p>
          <small>
            {getSyncLabel(syncState)} | {formatBannerTime(competition.updatedAt)}
          </small>
        </aside>
      </div>
    </section>
  );
}
