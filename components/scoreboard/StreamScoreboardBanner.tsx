"use client";

import Image from "next/image";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

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
      className="stream-banner-member-mark"
      aria-hidden="true"
    />
  );
}

function BannerTeamCard({ entry }: { entry: CompetitionScoreEntry }) {
  return (
    <article className="stream-banner-team">
      <span className="stream-banner-position">{entry.position}</span>
      <span className="stream-banner-player">
        <MemberMark entry={entry} />
        <span>{entry.playerName}</span>
      </span>
      <strong>{entry.grossLabel}</strong>
      <span className="stream-banner-thru">{entry.thruLabel ?? "Thru --"}</span>
    </article>
  );
}

export default function StreamScoreboardBanner({
  initialCompetition,
}: StreamScoreboardBannerProps) {
  const [competition, setCompetition] = useState(initialCompetition);
  const [syncState, setSyncState] = useState<LiveSyncState>("idle");
  const visibleEntries = competition.entries.slice(0, 6);
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
      className="stream-banner-canvas"
      aria-label={`${competition.title} stream scoreboard banner`}
    >
      <div className="stream-banner-board">
        <div className="stream-banner-brand">
          <Image
            src="/cgs-logo.png"
            alt="Crossodog Golf Society"
            width={76}
            height={76}
            priority
          />
          <div>
            <p>CGS live scores</p>
            <strong>{competition.title}</strong>
            <span>{secondaryTitle}</span>
          </div>
        </div>

        <div className="stream-banner-track">
          {visibleEntries.length > 0 ? (
            <div className="stream-banner-marquee">
              <div className="stream-banner-list">
                {visibleEntries.map((entry) => (
                  <BannerTeamCard key={entry.id} entry={entry} />
                ))}
              </div>
              <div className="stream-banner-list" aria-hidden="true">
                {visibleEntries.map((entry) => (
                  <BannerTeamCard key={`repeat-${entry.id}`} entry={entry} />
                ))}
              </div>
            </div>
          ) : (
            <div className="stream-banner-empty">Scores will roll here</div>
          )}
        </div>

        <div className="stream-banner-live-card">
          <span>{competition.isLive ? "Live" : competition.statusLabel}</span>
          <strong>{leaderEntry ? leaderEntry.grossLabel : "--"}</strong>
          <p>
            {leaderEntry ? `Leader: ${leaderEntry.playerName}` : "Waiting for scores"}
          </p>
          <small>
            {getSyncLabel(syncState)} | {formatBannerTime(competition.updatedAt)}
          </small>
        </div>
      </div>
    </section>
  );
}
