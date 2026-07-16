"use client";

import Image from "next/image";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import type {
  AmbroseEntry,
  AmbroseEvent,
  AmbroseTeam,
  AmbroseTeamMember,
  CgsProfile,
  PublicPlayerProfile,
} from "@/lib/ambrose-events";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type StreamPlayerIntroOverlayProps = {
  handle: string;
  initialEvent: AmbroseEvent;
  initialSeasonStats: PublicPlayerProfile["stats"] | null;
};

type LiveSyncState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "unavailable";

type PlayerAssignment = {
  team: AmbroseTeam;
  member: AmbroseTeamMember;
  profile: CgsProfile;
  teammateNames: string[];
};

function normalizeHandle(value: string) {
  return value.trim().toLowerCase();
}

function findPlayerAssignment(
  event: AmbroseEvent,
  handle: string
): PlayerAssignment | null {
  const normalizedHandle = normalizeHandle(handle);

  for (const team of event.teams) {
    const member = team.members.find(
      (teamMember) =>
        teamMember.profile &&
        normalizeHandle(teamMember.profile.handle) === normalizedHandle
    );

    if (member?.profile) {
      const teammateNames = team.members
        .filter((teamMember) => teamMember.profileId !== member.profileId)
        .map((teamMember) =>
          teamMember.profile
            ? teamMember.profile.nickname ||
              teamMember.profile.displayName ||
              teamMember.profile.handle
            : "Player"
        );

      return {
        team,
        member,
        profile: member.profile,
        teammateNames,
      };
    }
  }

  return null;
}

function formatScore(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  if (value === 0) {
    return "E";
  }

  const absoluteValue = Math.abs(value);
  const formattedValue = Number.isInteger(value)
    ? absoluteValue.toString()
    : absoluteValue.toFixed(1);

  return `${value > 0 ? "+" : "-"}${formattedValue}`;
}

function formatHandicap(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
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

function getTeamEntries(event: AmbroseEvent, teamId: number) {
  return event.entries.filter((entry) => entry.teamId === teamId);
}

function getCompleteTeamEntries(entries: AmbroseEntry[]) {
  return entries.filter(
    (entry) => entry.grossStrokes !== null && entry.scoreToPar !== null
  );
}

function getTeamScoreToPar(entries: AmbroseEntry[]) {
  const completeEntries = getCompleteTeamEntries(entries);

  if (completeEntries.length === 0) {
    return null;
  }

  return completeEntries.reduce(
    (total, entry) => total + (entry.scoreToPar ?? 0),
    0
  );
}

function getContributionStats(entries: AmbroseEntry[], profileId: string) {
  const driveUses = entries.filter(
    (entry) => entry.drivePlayerId === profileId
  ).length;
  const approachUses = entries.filter(
    (entry) => entry.approachPlayerId === profileId
  ).length;
  const puttUses = entries.filter((entry) => entry.puttPlayerId === profileId).length;

  return {
    driveUses,
    approachUses,
    puttUses,
    totalUses: driveUses + approachUses + puttUses,
  };
}

function readProfileStat(
  seasonStats: Record<string, unknown>,
  keys: string[]
) {
  for (const key of keys) {
    const value = seasonStats[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return value.toString();
    }
  }

  return "";
}

function getCssImageUrl(value: string) {
  return `url(${JSON.stringify(value)})`;
}

function getBarWidth(value: number, total: number) {
  if (total <= 0 || value <= 0) {
    return "8%";
  }

  return `${Math.max(12, Math.round((value / total) * 100))}%`;
}

export default function StreamPlayerIntroOverlay({
  handle,
  initialEvent,
  initialSeasonStats,
}: StreamPlayerIntroOverlayProps) {
  const [event, setEvent] = useState(initialEvent);
  const [syncState, setSyncState] = useState<LiveSyncState>("idle");
  const assignment = useMemo(
    () => findPlayerAssignment(event, handle),
    [event, handle]
  );

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
      console.error("Stream player overlay refresh error:", error);
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
      const refreshTimer = window.setInterval(() => {
        void handleRealtimeRefresh();
      }, 15000);

      return () => {
        window.clearTimeout(unavailableTimer);
        window.clearInterval(refreshTimer);
      };
    }

    const connectingTimer = window.setTimeout(() => {
      setSyncState("connecting");
    }, 0);
    const channel = supabase
      .channel(`stream-ambrose-player:${event.id}:${handle}`)
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
      );

    if (assignment?.profile.id) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cgs_profiles",
          filter: `id=eq.${assignment.profile.id}`,
        },
        () => {
          void handleRealtimeRefresh();
        }
      );
    }

    channel.subscribe((status) => {
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
  }, [assignment?.profile.id, event.id, handle]);

  if (!assignment) {
    return (
      <section className="stream-player-canvas" aria-label="CGS player intro">
        <div className="stream-player-empty">
          <Image
            src="/cgs-logo.png"
            alt="Crossodog Golf Society"
            width={96}
            height={96}
            priority
          />
          <strong>Player overlay unavailable</strong>
          <span>{handle}</span>
        </div>
      </section>
    );
  }

  const { profile, team, teammateNames } = assignment;
  const displayName = profile.nickname || profile.displayName || profile.handle;
  const avatarUrl = profile.avatarUrl || "/cgs-logo.png";
  const teamEntries = getTeamEntries(event, team.id);
  const completeEntries = getCompleteTeamEntries(teamEntries);
  const teamScoreToPar = getTeamScoreToPar(teamEntries);
  const eventContributions = getContributionStats(teamEntries, profile.id);
  const totalEventContributions = Math.max(eventContributions.totalUses, 1);
  const seasonStats = profile.seasonStats ?? {};
  const averageDrive = readProfileStat(seasonStats, [
    "averageDrive",
    "average_drive",
    "avgDrive",
    "avg_drive",
    "driveAverage",
    "drivingAverage",
  ]);
  const ironProfile = readProfileStat(seasonStats, [
    "favoriteIron",
    "favouriteIron",
    "goToIron",
    "go_to_iron",
    "bestIron",
    "approachClub",
    "ironProfile",
  ]);
  const bestResult = readProfileStat(seasonStats, [
    "bestResult",
    "best_result",
    "bestResults",
    "best_results",
    "seasonBest",
    "season_best",
  ]);
  const biggestWeakness = readProfileStat(seasonStats, [
    "biggestWeakness",
    "biggest_weakness",
    "weakness",
    "funnyWeakness",
    "funny_weakness",
  ]);
  const bestResultFallback =
    teamScoreToPar === null
      ? `${completeEntries.length}/${event.holes.length || event.holeCount} holes logged`
      : `${formatScore(teamScoreToPar)} team card`;

  return (
    <section
      className="stream-player-canvas"
      aria-label={`${displayName} CGS player intro`}
    >
      <article className="stream-player-card">
        <div className="stream-player-photo-panel">
          <div
            className="stream-player-photo"
            style={{ backgroundImage: getCssImageUrl(avatarUrl) }}
            aria-label={`${displayName} player photo`}
          />
          <div className="stream-player-photo-frame" aria-hidden="true" />
          <div className="stream-player-handle">@{profile.handle}</div>
        </div>

        <div className="stream-player-main">
          <header className="stream-player-header">
            <div className="stream-player-brand">
              <Image
                src="/cgs-logo.png"
                alt="Crossodog Golf Society"
                width={74}
                height={74}
                priority
              />
              <div>
                <p>CGS player introduction</p>
                <strong>{event.title}</strong>
              </div>
            </div>
            <div className="stream-player-live">
              <span>{event.isLive ? "Live" : event.statusLabel}</span>
              <span>{getSyncLabel(syncState)}</span>
            </div>
          </header>

          <div className="stream-player-title-row">
            <div>
              <p className="stream-player-kicker">{team.bayLabel}</p>
              <h1>{displayName}</h1>
            </div>
            <div className="stream-player-handicap">
              <span>Handicap</span>
              <strong>{formatHandicap(profile.handicap)}</strong>
            </div>
          </div>

          <div className="stream-player-team-strip">
            <span>{team.name}</span>
            <strong>{formatScore(teamScoreToPar)}</strong>
            <span>
              Thru {completeEntries.length}/{event.holes.length || event.holeCount}
            </span>
            <span>{event.courseName}</span>
          </div>

          <div className="stream-player-stat-grid">
            <div className="stream-player-stat">
              <span>Average drive</span>
              <strong>{averageDrive || "TBC"}</strong>
              <small>Player profile</small>
            </div>
            <div className="stream-player-stat">
              <span>Go-to irons</span>
              <strong>{ironProfile || "TBC"}</strong>
              <small>Broadcast note</small>
            </div>
            <div className="stream-player-stat">
              <span>Best result</span>
              <strong>{bestResult || bestResultFallback}</strong>
              <small>{bestResult ? "Season highlight" : "Live Ambrose"}</small>
            </div>
            <div className="stream-player-stat stream-player-stat-dark">
              <span>Biggest weakness</span>
              <strong>{biggestWeakness || "Still under review"}</strong>
              <small>CGS scouting report</small>
            </div>
          </div>

          <div className="stream-player-lower">
            <div className="stream-player-shot-profile">
              <div className="stream-player-shot-row">
                <span>Drive</span>
                <div>
                  <i
                    style={{
                      width: getBarWidth(
                        eventContributions.driveUses,
                        totalEventContributions
                      ),
                    }}
                  />
                </div>
                <strong>{eventContributions.driveUses}</strong>
              </div>
              <div className="stream-player-shot-row">
                <span>Iron</span>
                <div>
                  <i
                    style={{
                      width: getBarWidth(
                        eventContributions.approachUses,
                        totalEventContributions
                      ),
                    }}
                  />
                </div>
                <strong>{eventContributions.approachUses}</strong>
              </div>
              <div className="stream-player-shot-row">
                <span>Putt</span>
                <div>
                  <i
                    style={{
                      width: getBarWidth(
                        eventContributions.puttUses,
                        totalEventContributions
                      ),
                    }}
                  />
                </div>
                <strong>{eventContributions.puttUses}</strong>
              </div>
            </div>

            <div className="stream-player-context">
              <span>Team mate</span>
              <strong>{teammateNames.join(" / ") || "TBC"}</strong>
              <small>
                {initialSeasonStats
                  ? `${initialSeasonStats.eventsPlayed} event${initialSeasonStats.eventsPlayed === 1 ? "" : "s"} | ${initialSeasonStats.totalContributionUses} season contributions`
                  : `${eventContributions.totalUses} live contributions`}
              </small>
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}
