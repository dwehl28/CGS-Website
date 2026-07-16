"use client";

import Image from "next/image";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

import type { AmbroseEvent, AmbroseTeam } from "@/lib/ambrose-events";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type StreamAmbroseLeaderboardProps = {
  initialEvent: AmbroseEvent;
};

type LiveSyncState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "unavailable";

type TeamStanding = {
  team: AmbroseTeam;
  position: number;
  scoreToPar: number | null;
  scoreLabel: string;
  holesComplete: number;
  thruLabel: string;
};

function formatScore(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  if (value === 0) {
    return "E";
  }

  return `${value > 0 ? "+" : "-"}${Math.abs(value)}`;
}

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

function buildStandings(event: AmbroseEvent) {
  const standings = event.teams.map((team) => {
    const completeEntries = event.entries.filter(
      (entry) =>
        entry.teamId === team.id &&
        entry.grossStrokes !== null &&
        entry.scoreToPar !== null
    );
    const scoreToPar =
      completeEntries.length > 0
        ? completeEntries.reduce((total, entry) => total + (entry.scoreToPar ?? 0), 0)
        : null;

    return {
      team,
      position: 99,
      scoreToPar,
      scoreLabel: formatScore(scoreToPar),
      holesComplete: completeEntries.length,
      thruLabel: `Thru ${completeEntries.length}/${event.holes.length || event.holeCount}`,
    };
  });

  standings.sort((left, right) => {
    if (left.scoreToPar === null && right.scoreToPar !== null) {
      return 1;
    }

    if (left.scoreToPar !== null && right.scoreToPar === null) {
      return -1;
    }

    if (
      left.scoreToPar !== null &&
      right.scoreToPar !== null &&
      left.scoreToPar !== right.scoreToPar
    ) {
      return left.scoreToPar - right.scoreToPar;
    }

    if (left.holesComplete !== right.holesComplete) {
      return right.holesComplete - left.holesComplete;
    }

    return left.team.displayOrder - right.team.displayOrder;
  });

  let previousScore: number | null = null;
  let previousPosition = 0;

  return standings.map((standing, index) => {
    let position = index + 1;

    if (
      standing.scoreToPar !== null &&
      previousScore !== null &&
      standing.scoreToPar === previousScore
    ) {
      position = previousPosition;
    }

    previousScore = standing.scoreToPar;
    previousPosition = position;

    return {
      ...standing,
      position,
    };
  }) satisfies TeamStanding[];
}

function getTeamPlayerLabel(team: AmbroseTeam) {
  if (team.members.length === 0) {
    return "Players TBC";
  }

  return team.members
    .map((member) =>
      member.profile
        ? member.profile.nickname ||
          member.profile.displayName ||
          member.profile.handle
        : "Player"
    )
    .join(" / ");
}

export default function StreamAmbroseLeaderboard({
  initialEvent,
}: StreamAmbroseLeaderboardProps) {
  const [event, setEvent] = useState(initialEvent);
  const [syncState, setSyncState] = useState<LiveSyncState>("idle");
  const standings = buildStandings(event).slice(0, 6);
  const leader = standings[0] ?? null;

  async function refreshEvent(slug: string) {
    try {
      const response = await fetch(`/api/ambrose/${slug}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const nextEvent = (await response.json()) as AmbroseEvent;

      startTransition(() => {
        setEvent(nextEvent);
      });
    } catch (error) {
      console.error("Stream Ambrose leaderboard refresh error:", error);
    }
  }

  const handleRealtimeRefresh = useEffectEvent(async () => {
    await refreshEvent(initialEvent.slug);
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
      .channel(`stream-ambrose:${event.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cgs_ambrose_events",
          filter: `id=eq.${event.id}`,
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
          table: "cgs_ambrose_teams",
          filter: `event_id=eq.${event.id}`,
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
          table: "cgs_ambrose_team_members",
          filter: `event_id=eq.${event.id}`,
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
          table: "cgs_ambrose_entries",
          filter: `event_id=eq.${event.id}`,
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
  }, [event.id]);

  return (
    <section className="stream-canvas" aria-label={`${event.title} Ambrose leaderboard`}>
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
              <p className="stream-label">CGS Ambrose live</p>
              <strong>{event.title}</strong>
              <span>{event.courseName}</span>
            </div>
          </div>

          <div className="stream-meta">
            <span className="stream-pill">{event.isLive ? "Live" : event.statusLabel}</span>
            <span className="stream-pill">{getSyncLabel(syncState)}</span>
            <span className="stream-pill">{formatOverlayTime(event.updatedAt)}</span>
          </div>
        </div>

        <div className="stream-score-flash">
          <div>
            <span>{event.seasonLabel}</span>
            <strong>{leader ? leader.team.name : "Waiting for scores"}</strong>
          </div>
          {leader ? (
            <div className="stream-leader-chip">
              <span>Leader</span>
              <strong>{leader.scoreLabel}</strong>
            </div>
          ) : null}
        </div>

        <div className="stream-board-body">
          {standings.length > 0 ? (
            <div className="stream-rows">
              {standings.map((standing, index) => (
                <div
                  key={standing.team.id}
                  className={`stream-row ${index === 0 ? "stream-row-leading" : ""}`}
                >
                  <span className="stream-row-position">{standing.position}</span>
                  <span className="stream-row-player">
                    <span className="stream-row-player-name">
                      {standing.team.name}
                    </span>
                  </span>
                  <span className="stream-row-score">{standing.scoreLabel}</span>
                  <span className="stream-row-thru">
                    {standing.thruLabel} | {standing.team.bayLabel} |{" "}
                    {getTeamPlayerLabel(standing.team)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="stream-empty">Ambrose scores will appear here</div>
          )}
        </div>
      </div>
    </section>
  );
}
