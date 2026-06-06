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
  const leaderEntry = competition.entries[0] ?? null;
  const visibleEntries = competition.entries.slice(0, 6);
  const primaryTitle = competition.roundLabel ?? competition.title;
  const secondaryTitle =
    competition.location ?? competition.formatLabel ?? competition.statusLabel;

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
              width={72}
              height={72}
              priority
            />
            <div>
              <p className="stream-label">CGS live scoreboard</p>
              <strong>{competition.title}</strong>
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

        <div className="stream-board-body">
          <div className="stream-leader">
            <p className="stream-label">
              {competition.roundLabel ?? competition.formatLabel ?? "Competition"}
            </p>
            <h1 className="stream-title">{primaryTitle}</h1>
            <p className="stream-subtitle">{secondaryTitle}</p>

            {leaderEntry ? (
              <div className="stream-leader-line">
                <h2 className="stream-leader-name">
                  <MemberMark entry={leaderEntry} />
                  {leaderEntry.playerName}
                </h2>
                <span className="stream-leader-score">{leaderEntry.grossLabel}</span>
              </div>
            ) : (
              <div className="stream-leader-line">
                <h2 className="stream-leader-name">Waiting for scores</h2>
                <span className="stream-leader-score">--</span>
              </div>
            )}
          </div>

          {visibleEntries.length > 0 ? (
            <div className="stream-rows">
              {visibleEntries.map((entry) => (
                <div key={entry.id} className="stream-row">
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
