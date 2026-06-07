"use client";

import Image from "next/image";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

import type {
  CompetitionScoreboard,
  CompetitionScoreEntry,
} from "@/lib/scoreboards";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type StreamScoreboardOverlayProps = {
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

function formatOverlayTime(value: string) {
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
      className="stream-member-mark"
      aria-hidden="true"
    />
  );
}

export default function StreamScoreboardOverlay({
  initialCompetition,
}: StreamScoreboardOverlayProps) {
  const [competition, setCompetition] = useState(initialCompetition);
  const [syncState, setSyncState] = useState<LiveSyncState>("idle");
  const visibleEntries = competition.entries.slice(0, 6);
  const leaderEntry = visibleEntries[0] ?? null;
  const primaryTitle = competition.title;
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
      console.error("Stream scoreboard refresh error:", error);
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
    <section className="stream-canvas" aria-label={`${competition.title} stream scoreboard`}>
      <div className="stream-board">
        <div className="stream-board-header">
          <div className="stream-brand">
            <Image
              src="/cgs-logo.png"
              alt="Crossodog Golf Society"
              width={64}
              height={64}
              priority
            />
            <div>
              <p className="stream-label">CGS stream scoreboard</p>
              <strong>{competition.title}</strong>
              <span>{secondaryTitle}</span>
            </div>
          </div>

          <div className="stream-meta">
            <span className="stream-pill">
              {competition.isLive ? "Live" : competition.statusLabel}
            </span>
            <span className="stream-pill">{getSyncLabel(syncState)}</span>
            <span className="stream-pill">{formatOverlayTime(competition.updatedAt)}</span>
          </div>
        </div>

        <div className="stream-score-flash">
          <div>
            <span>{competition.location ?? "Weekly CGS stream"}</span>
            <strong>{primaryTitle}</strong>
          </div>
          {leaderEntry ? (
            <div className="stream-leader-chip">
              <span>Leader</span>
              <strong>{leaderEntry.grossLabel}</strong>
            </div>
          ) : null}
        </div>

        <div className="stream-board-body">
          {visibleEntries.length > 0 ? (
            <div className="stream-rows">
              {visibleEntries.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`stream-row ${index === 0 ? "stream-row-leading" : ""}`}
                >
                  <span className="stream-row-position">{entry.position}</span>
                  <span className="stream-row-player">
                    <MemberMark entry={entry} />
                    <span className="stream-row-player-name">{entry.playerName}</span>
                  </span>
                  <span className="stream-row-score">{entry.grossLabel}</span>
                  <span className="stream-row-thru">{entry.thruLabel ?? "Thru --"}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="stream-empty">Scores will appear here</div>
          )}
        </div>
      </div>
    </section>
  );
}
