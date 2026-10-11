"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  type FormEvent,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  Flag,
  Gauge,
  Medal,
  Minus,
  MonitorPlay,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Settings2,
  Shield,
  Trophy,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import {
  createTopDogFixtureAction,
  createTopDogRoundAction,
  createTopDogTeamAction,
} from "@/app/clubhouse-admin/top-dog/live/actions";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type {
  TopDogCentralOverlay,
  TopDogFeed,
  TopDogFixture,
  TopDogFixtureCommand,
  TopDogSnapshot,
  TopDogStanding,
} from "@/lib/top-dog";

type SyncState = "connecting" | "connected" | "reconnecting" | "unavailable";

type LeagueNightControlCentreProps = {
  initialSnapshot: TopDogSnapshot;
};

const directorButtons: Array<{
  overlay: TopDogCentralOverlay;
  label: string;
  shortcut?: string;
}> = [
  { overlay: "match", label: "Match Score", shortcut: "1" },
  { overlay: "match_of_night", label: "Match of the Night" },
  { overlay: "live_ladder", label: "Live Ladder", shortcut: "2" },
  { overlay: "results_hold", label: "If Results Hold" },
  { overlay: "best_team", label: "Best Team" },
  { overlay: "longest_drive", label: "Longest Drive", shortcut: "3" },
  { overlay: "ctp", label: "CTP" },
  { overlay: "bunker_boy", label: "Bunker Boy" },
  { overlay: "one_putt_jackpot", label: "One-Putt Jackpot", shortcut: "4" },
  { overlay: "sponsor", label: "Sponsor", shortcut: "5" },
  { overlay: "subscribe", label: "Subscribe", shortcut: "6" },
  { overlay: "player_interview", label: "Player Interview" },
  { overlay: "up_next", label: "Up Next" },
  { overlay: "match_result", label: "Match Result" },
  { overlay: "shot_of_night", label: "Shot of the Night" },
  { overlay: "doghouse", label: "The Doghouse" },
  { overlay: "butters_board", label: "Butters' Board" },
  { overlay: "night_wrap_up", label: "Night Wrap-Up" },
];

const tickerCategoryOptions = [
  ["scores", "Match scores"],
  ["ladder", "Live ladder"],
  ["longest_drive", "Longest drive"],
  ["ctp", "CTP"],
  ["bunker_boy", "Bunker Boy"],
  ["one_putt_jackpot", "One-Putt"],
  ["next_match", "Next match"],
  ["sponsor", "Sponsor"],
] as const;

function formatTime(value: string | null) {
  if (!value) {
    return "Time TBC";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time TBC";
  }

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getStatusLabel(status: TopDogFixture["status"]) {
  if (status === "live") {
    return "Live";
  }

  if (status === "final") {
    return "Final";
  }

  return "Waiting";
}

function getSyncLabel(syncState: SyncState) {
  if (syncState === "connected") {
    return "Realtime connected";
  }

  if (syncState === "reconnecting") {
    return "Realtime reconnecting";
  }

  if (syncState === "unavailable") {
    return "15-second fallback sync";
  }

  return "Connecting live controls";
}

function LadderTable({
  title,
  label,
  standings,
  projected = false,
}: {
  title: string;
  label: string;
  standings: TopDogStanding[];
  projected?: boolean;
}) {
  return (
    <section className={`top-dog-ladder-panel ${projected ? "is-projected" : ""}`}>
      <header>
        <div>
          <span>{label}</span>
          <h3>{title}</h3>
        </div>
        {projected ? <Activity aria-hidden="true" /> : <Trophy aria-hidden="true" />}
      </header>

      <div className="top-dog-ladder-head" aria-hidden="true">
        <span>Pos</span>
        <span>Team</span>
        <span>P</span>
        <span>W</span>
        <span>D</span>
        <span>L</span>
        <span>+/-</span>
        <span>Pts</span>
      </div>

      <div className="top-dog-ladder-body">
        {standings.map((standing) => (
          <div
            key={standing.team.id}
            className={`top-dog-ladder-row is-${standing.qualification}`}
          >
            <span className="top-dog-ladder-position">{standing.position}</span>
            <span className="top-dog-ladder-team">
              <i style={{ background: standing.team.accentColor }} />
              <b>{standing.team.name}</b>
              {projected && standing.movement !== 0 ? (
                <em className={standing.movement > 0 ? "is-up" : "is-down"}>
                  {standing.movement > 0 ? (
                    <ArrowUp aria-hidden="true" />
                  ) : (
                    <ArrowDown aria-hidden="true" />
                  )}
                  {Math.abs(standing.movement)}
                </em>
              ) : null}
            </span>
            <span>{standing.played}</span>
            <span>{standing.wins}</span>
            <span>{standing.draws}</span>
            <span>{standing.losses}</span>
            <span>{standing.differential > 0 ? "+" : ""}{standing.differential}</span>
            <strong>{standing.points}</strong>
          </div>
        ))}

        {standings.length === 0 ? (
          <div className="top-dog-empty-row">Add season teams to build the ladder.</div>
        ) : null}
      </div>

      <footer>
        <span><i className="is-finals" /> Top 4 direct finals</span>
        <span><i className="is-wildcard" /> 5-6 wildcard</span>
      </footer>
    </section>
  );
}

function ScoreButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      className="top-dog-score-step"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      {label.includes("minus") ? <Minus aria-hidden="true" /> : <Plus aria-hidden="true" />}
    </button>
  );
}

function FixtureControlCard({
  fixture,
  pending,
  onCommand,
  onSelectForScorebug,
  scorebugSelected,
}: {
  fixture: TopDogFixture;
  pending: boolean;
  onCommand: (
    fixtureId: number,
    command: TopDogFixtureCommand,
    payload?: Record<string, number>
  ) => Promise<void>;
  onSelectForScorebug: (fixtureId: number) => Promise<void>;
  scorebugSelected: boolean;
}) {
  async function handleSetScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const homeScore = Number(formData.get("home_score"));
    const awayScore = Number(formData.get("away_score"));

    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
      return;
    }

    await onCommand(fixture.id, "set_score", {
      home_score: homeScore,
      away_score: awayScore,
    });
  }

  return (
    <article
      className={`top-dog-fixture-card is-${fixture.status} ${
        fixture.isMatchOfNight ? "is-featured" : ""
      }`}
    >
      <header>
        <div className="top-dog-fixture-status">
          <span>{getStatusLabel(fixture.status)}</span>
          {fixture.isMatchOfNight ? <b>Match of the Night</b> : null}
        </div>
        <div className="top-dog-fixture-meta">
          <span><Clock3 aria-hidden="true" /> {formatTime(fixture.scheduledAt)}</span>
          <span><MonitorPlay aria-hidden="true" /> {fixture.simulatorBay || "Bay TBC"}</span>
        </div>
      </header>

      <div className="top-dog-matchup">
        <div className="top-dog-team-side">
          <i style={{ background: fixture.homeTeam.accentColor }} />
          <span>Team A</span>
          <strong>{fixture.homeTeam.name}</strong>
          <div className="top-dog-score-control">
            <ScoreButton
              label={`${fixture.homeTeam.name} minus one`}
              onClick={() =>
                void onCommand(fixture.id, "adjust_score", { home_delta: -1 })
              }
              disabled={pending}
            />
            <b>{fixture.homeScore}</b>
            <ScoreButton
              label={`${fixture.homeTeam.name} plus one`}
              onClick={() =>
                void onCommand(fixture.id, "adjust_score", { home_delta: 1 })
              }
              disabled={pending}
            />
          </div>
        </div>

        <div className="top-dog-versus">
          <span>vs</span>
          <i />
        </div>

        <div className="top-dog-team-side is-away">
          <i style={{ background: fixture.awayTeam.accentColor }} />
          <span>Team B</span>
          <strong>{fixture.awayTeam.name}</strong>
          <div className="top-dog-score-control">
            <ScoreButton
              label={`${fixture.awayTeam.name} minus one`}
              onClick={() =>
                void onCommand(fixture.id, "adjust_score", { away_delta: -1 })
              }
              disabled={pending}
            />
            <b>{fixture.awayScore}</b>
            <ScoreButton
              label={`${fixture.awayTeam.name} plus one`}
              onClick={() =>
                void onCommand(fixture.id, "adjust_score", { away_delta: 1 })
              }
              disabled={pending}
            />
          </div>
        </div>
      </div>

      <div className="top-dog-hole-control">
        <div>
          <span>Current hole</span>
          <strong>{fixture.currentHole || "-"} <small>/ {fixture.holesTotal}</small></strong>
        </div>
        <div className="top-dog-hole-buttons">
          <button
            type="button"
            onClick={() => void onCommand(fixture.id, "previous_hole")}
            disabled={pending || fixture.currentHole === 0}
          >
            <ChevronLeft aria-hidden="true" /> Previous
          </button>
          <button
            type="button"
            onClick={() => void onCommand(fixture.id, "next_hole")}
            disabled={pending || fixture.currentHole >= fixture.holesTotal}
          >
            Next hole <ChevronRight aria-hidden="true" />
          </button>
        </div>
        <div>
          <span>Remaining</span>
          <strong>{fixture.holesRemaining}</strong>
        </div>
      </div>

      <form className="top-dog-exact-score" onSubmit={handleSetScore}>
        <span>Exact score</span>
        <input
          key={`home-${fixture.id}-${fixture.homeScore}`}
          type="number"
          name="home_score"
          min="-99"
          max="99"
          defaultValue={fixture.homeScore}
          aria-label={`${fixture.homeTeam.name} exact score`}
        />
        <i>-</i>
        <input
          key={`away-${fixture.id}-${fixture.awayScore}`}
          type="number"
          name="away_score"
          min="-99"
          max="99"
          defaultValue={fixture.awayScore}
          aria-label={`${fixture.awayTeam.name} exact score`}
        />
        <button type="submit" disabled={pending}>Update score</button>
      </form>

      <footer className="top-dog-fixture-actions">
        {fixture.status === "waiting" ? (
          <button
            type="button"
            className="is-primary"
            onClick={() => void onCommand(fixture.id, "start")}
            disabled={pending}
          >
            <Play aria-hidden="true" /> Start match
          </button>
        ) : null}
        {fixture.status === "live" ? (
          <button
            type="button"
            className="is-finish"
            onClick={() => void onCommand(fixture.id, "finish")}
            disabled={pending}
          >
            <Check aria-hidden="true" /> Finish match
          </button>
        ) : null}
        {fixture.status === "final" ? (
          <button
            type="button"
            onClick={() => void onCommand(fixture.id, "reopen")}
            disabled={pending}
          >
            <RotateCcw aria-hidden="true" /> Reopen
          </button>
        ) : null}
        <button
          type="button"
          className={fixture.isMatchOfNight ? "is-selected" : ""}
          onClick={() => void onCommand(fixture.id, "match_of_night")}
          disabled={pending || fixture.isMatchOfNight}
        >
          <Medal aria-hidden="true" /> Match of Night
        </button>
        <button
          type="button"
          className={scorebugSelected ? "is-selected" : ""}
          onClick={() => void onSelectForScorebug(fixture.id)}
          disabled={pending || scorebugSelected}
        >
          <MonitorPlay aria-hidden="true" /> Scorebug
        </button>
        <button
          type="button"
          onClick={() => void onCommand(fixture.id, "undo")}
          disabled={pending || !fixture.canUndo}
        >
          <RotateCcw aria-hidden="true" /> Undo
        </button>
      </footer>

      {pending ? <div className="top-dog-saving">Saving live update</div> : null}
    </article>
  );
}

export default function LeagueNightControlCentre({
  initialSnapshot,
}: LeagueNightControlCentreProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [syncState, setSyncState] = useState<SyncState>("connecting");
  const [pendingFixtureIds, setPendingFixtureIds] = useState<Set<number>>(new Set());
  const [streamPending, setStreamPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscribeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentOverlay = useRef(snapshot.streamState.centralOverlay);
  const selectedRoundId = snapshot.selectedRound?.id ?? null;
  const nextRoundNumber =
    Math.max(0, ...snapshot.rounds.map((round) => round.roundNumber)) + 1;

  const applyFeed = (feed: TopDogFeed) => {
    if (!feed.snapshot) {
      setErrorMessage(feed.warningMessage ?? "League Night Control could not refresh.");
      return;
    }

    startTransition(() => {
      setSnapshot(feed.snapshot!);
      setErrorMessage("");
    });
  };

  async function refreshSnapshot() {
    const params = new URLSearchParams({ season: snapshot.season.slug });

    if (selectedRoundId) {
      params.set("round", String(selectedRoundId));
    }

    try {
      const response = await fetch(`/api/admin/top-dog/snapshot?${params}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("League Night Control refresh failed.");
      }

      applyFeed((await response.json()) as TopDogFeed);
    } catch (error) {
      console.error("Top Dog admin refresh error:", error);
      setErrorMessage("Live data is reconnecting. Your last confirmed controls remain on screen.");
    }
  }

  const handleRealtimeRefresh = useEffectEvent(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
    }

    refreshTimer.current = setTimeout(() => {
      void refreshSnapshot();
    }, 180);
  });

  const handleFallbackRefresh = useEffectEvent(() => {
    void refreshSnapshot();
  });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setSyncState("unavailable");
      return;
    }

    setSyncState("connecting");
    let channel = supabase
      .channel(`top-dog-admin:${snapshot.season.id}:${selectedRoundId ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "top_dog_rounds",
          filter: `season_id=eq.${snapshot.season.id}`,
        },
        handleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "top_dog_stream_state",
          filter: `season_id=eq.${snapshot.season.id}`,
        },
        handleRealtimeRefresh
      );

    if (selectedRoundId) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "top_dog_fixtures",
          filter: `round_id=eq.${selectedRoundId}`,
        },
        handleRealtimeRefresh
      );
    }

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setSyncState("connected");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setSyncState("reconnecting");
      }
    });

    return () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [snapshot.season.id, selectedRoundId]);

  useEffect(() => {
    const interval = setInterval(() => {
      handleFallbackRefresh();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  async function runFixtureCommand(
    fixtureId: number,
    command: TopDogFixtureCommand,
    payload?: Record<string, number>
  ) {
    setPendingFixtureIds((current) => new Set(current).add(fixtureId));
    setErrorMessage("");

    try {
      const response = await fetch(`/api/admin/top-dog/fixtures/${fixtureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command,
          payload,
          seasonSlug: snapshot.season.slug,
          roundId: selectedRoundId,
        }),
      });
      const feed = (await response.json()) as TopDogFeed & { message?: string };

      if (!response.ok) {
        throw new Error(feed.message ?? "The fixture update could not be saved.");
      }

      applyFeed(feed);
    } catch (error) {
      console.error("Top Dog fixture control error:", error);
      setErrorMessage(error instanceof Error ? error.message : "The fixture update failed.");
    } finally {
      setPendingFixtureIds((current) => {
        const next = new Set(current);
        next.delete(fixtureId);
        return next;
      });
    }
  }

  async function updateStreamState(
    updates: Record<string, unknown>,
    options?: { quiet?: boolean }
  ) {
    setStreamPending(true);

    try {
      const response = await fetch("/api/admin/top-dog/stream", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasonId: snapshot.season.id,
          seasonSlug: snapshot.season.slug,
          selectedRoundId,
          updates,
        }),
      });
      const feed = (await response.json()) as TopDogFeed & { message?: string };

      if (!response.ok) {
        throw new Error(feed.message ?? "The stream control could not be saved.");
      }

      applyFeed(feed);
    } catch (error) {
      console.error("Top Dog stream control error:", error);
      if (!options?.quiet) {
        setErrorMessage(
          error instanceof Error ? error.message : "The stream control failed."
        );
      }
    } finally {
      setStreamPending(false);
    }
  }

  function getAutomaticOverlayPayload(overlay: TopDogCentralOverlay) {
    if (overlay !== "best_team") {
      return snapshot.streamState.overlayPayload;
    }

    const leader = snapshot.projectedLadder[0];

    if (!leader) {
      return {
        ...snapshot.streamState.overlayPayload,
        title: "Best Performing Team",
        primary: "Standings TBC",
        value: "Awaiting live scores",
      };
    }

    const tiedLeaders = snapshot.projectedLadder.filter(
      (standing) =>
        standing.points === leader.points &&
        standing.differential === leader.differential
    );
    const tied = tiedLeaders.length > 1;

    return {
      ...snapshot.streamState.overlayPayload,
      title: "Best Performing Team",
      primary: tied ? "Tied" : leader.team.name,
      value: tied
        ? tiedLeaders.map((standing) => standing.team.name).join(" | ")
        : `${leader.points} pts | ${leader.differential >= 0 ? "+" : ""}${leader.differential}`,
      bestTeam: tied ? "Tied" : leader.team.name,
    };
  }

  function showDirectorOverlay(overlay: TopDogCentralOverlay, quiet = false) {
    if (subscribeTimer.current) {
      clearTimeout(subscribeTimer.current);
      subscribeTimer.current = null;
    }

    currentOverlay.current = overlay;
    void updateStreamState(
      {
        centralOverlay: overlay,
        centralOverlayVisible: true,
        overlayPayload: getAutomaticOverlayPayload(overlay),
      },
      { quiet }
    );

    if (overlay === "subscribe") {
      subscribeTimer.current = setTimeout(() => {
        if (currentOverlay.current === "subscribe") {
          void updateStreamState({ centralOverlayVisible: false }, { quiet: true });
        }
      }, 7500);
    }
  }

  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;

    if (target?.matches("input, textarea, select, button, [contenteditable='true']")) {
      return;
    }

    if (event.key === "Escape") {
      void updateStreamState({ centralOverlayVisible: false }, { quiet: true });
      return;
    }

    const directorButton = directorButtons.find((button) => button.shortcut === event.key);

    if (directorButton) {
      showDirectorOverlay(directorButton.overlay, true);
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    currentOverlay.current = snapshot.streamState.centralOverlay;

    if (
      snapshot.streamState.centralOverlay !== "subscribe" &&
      subscribeTimer.current
    ) {
      clearTimeout(subscribeTimer.current);
      subscribeTimer.current = null;
    }
  }, [snapshot.streamState.centralOverlay]);

  useEffect(() => {
    return () => {
      if (subscribeTimer.current) {
        clearTimeout(subscribeTimer.current);
      }
    };
  }, []);

  function changeRound(roundId: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("round", String(roundId));
    router.push(`/clubhouse-admin/top-dog/live?${params}`);
  }

  return (
    <div className="top-dog-control-centre">
      <section className="top-dog-command-bar">
        <div className="top-dog-command-round">
          <span>League night</span>
          <select
            value={selectedRoundId ?? ""}
            onChange={(event) => changeRound(Number(event.target.value))}
            disabled={snapshot.rounds.length === 0}
          >
            {snapshot.rounds.length === 0 ? <option value="">No rounds yet</option> : null}
            {snapshot.rounds.map((round) => (
              <option key={round.id} value={round.id}>
                Round {round.roundNumber} - {round.name}
              </option>
            ))}
          </select>
        </div>

        <div className="top-dog-command-facts">
          <div>
            <span>Status</span>
            <strong>{snapshot.selectedRound?.status ?? "Setup"}</strong>
          </div>
          <div>
            <span>Fixtures</span>
            <strong>{snapshot.fixtures.length}</strong>
          </div>
          <div>
            <span>Live now</span>
            <strong>{snapshot.fixtures.filter((fixture) => fixture.status === "live").length}</strong>
          </div>
          <div>
            <span>Complete</span>
            <strong>{snapshot.fixtures.filter((fixture) => fixture.status === "final").length}</strong>
          </div>
        </div>

        <div className={`top-dog-sync-state is-${syncState}`}>
          {syncState === "connected" ? <Wifi aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
          <div>
            <span>Connection</span>
            <strong>{getSyncLabel(syncState)}</strong>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="top-dog-error" role="alert">
          <Shield aria-hidden="true" />
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage("")} aria-label="Dismiss error">
            <X aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <section className="top-dog-operations-grid">
        <div className="top-dog-fixtures-column">
          <header className="top-dog-section-heading">
            <div>
              <span>Live match desk</span>
              <h2>{snapshot.selectedRound?.name ?? "Create the next league round"}</h2>
              <p>
                {snapshot.selectedRound
                  ? `${snapshot.selectedRound.courseName || "Course TBC"} | ${snapshot.selectedRound.venue}`
                  : "Use operations setup below to create the first round."}
              </p>
            </div>
            <Gauge aria-hidden="true" />
          </header>

          <div className="top-dog-fixture-list">
            {snapshot.fixtures.map((fixture) => (
              <FixtureControlCard
                key={fixture.id}
                fixture={fixture}
                pending={pendingFixtureIds.has(fixture.id)}
                onCommand={runFixtureCommand}
                onSelectForScorebug={(fixtureId) =>
                  updateStreamState({ scorebugFixtureId: fixtureId, scorebugVisible: true })
                }
                scorebugSelected={snapshot.streamState.scorebugFixtureId === fixture.id}
              />
            ))}

            {snapshot.fixtures.length === 0 ? (
              <div className="top-dog-no-fixtures">
                <Flag aria-hidden="true" />
                <strong>No head-to-head fixtures in this round yet</strong>
                <p>
                  Existing Top Dog scoreboards have been preserved as historical round results.
                  Add verified fixtures below rather than guessing past matchups.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="top-dog-director">
          <header>
            <div>
              <span>Broadcast control</span>
              <h2>Stream Director</h2>
            </div>
            <Radio aria-hidden="true" />
          </header>

          <div className="top-dog-persistent-controls">
            <div>
              <span>Scorebug</span>
              <strong>{snapshot.streamState.scorebugVisible ? "On air" : "Hidden"}</strong>
              <button
                type="button"
                onClick={() =>
                  void updateStreamState({
                    scorebugVisible: !snapshot.streamState.scorebugVisible,
                  })
                }
                disabled={streamPending}
              >
                {snapshot.streamState.scorebugVisible ? <EyeOff /> : <Eye />}
                {snapshot.streamState.scorebugVisible ? "Hide" : "Show"}
              </button>
            </div>
            <div>
              <span>Live ticker</span>
              <strong>{snapshot.streamState.tickerVisible ? "On air" : "Hidden"}</strong>
              <button
                type="button"
                onClick={() =>
                  void updateStreamState({
                    tickerVisible: !snapshot.streamState.tickerVisible,
                  })
                }
                disabled={streamPending}
              >
                {snapshot.streamState.tickerVisible ? <EyeOff /> : <Eye />}
                {snapshot.streamState.tickerVisible ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="top-dog-hide-central"
            onClick={() => void updateStreamState({ centralOverlayVisible: false })}
            disabled={streamPending || !snapshot.streamState.centralOverlayVisible}
          >
            <EyeOff aria-hidden="true" /> Hide all central graphics <kbd>Esc</kbd>
          </button>

          <div className="top-dog-director-buttons">
            {directorButtons.map((button) => {
              const isLive =
                snapshot.streamState.centralOverlayVisible &&
                snapshot.streamState.centralOverlay === button.overlay;

              return (
                <div key={button.overlay} className={isLive ? "is-live" : ""}>
                  <span>{button.label}</span>
                  {button.shortcut ? <kbd>{button.shortcut}</kbd> : null}
                  <button
                    type="button"
                    onClick={() => showDirectorOverlay(button.overlay)}
                    disabled={streamPending || isLive}
                  >
                    <Eye aria-hidden="true" /> Show
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateStreamState({ centralOverlayVisible: false })}
                    disabled={streamPending || !isLive}
                  >
                    <EyeOff aria-hidden="true" /> Hide
                  </button>
                </div>
              );
            })}
          </div>

          <div className="top-dog-ticker-settings">
            <div>
              <span>Ticker rotation</span>
              <button
                type="button"
                onClick={() =>
                  void updateStreamState({
                    tickerPaused: !snapshot.streamState.tickerPaused,
                  })
                }
                disabled={streamPending}
              >
                {snapshot.streamState.tickerPaused ? <Play /> : <Pause />}
                {snapshot.streamState.tickerPaused ? "Resume" : "Pause"}
              </button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const categories = formData
                  .getAll("categories")
                  .map((value) => String(value));
                void updateStreamState({
                  tickerManualMessage: String(formData.get("message") ?? "").trim(),
                  tickerIntervalSeconds: Number(formData.get("interval")) || 12,
                  tickerCategories: categories.length > 0 ? categories : ["scores"],
                });
              }}
            >
              <input
                type="text"
                name="message"
                maxLength={240}
                defaultValue={snapshot.streamState.tickerManualMessage}
                placeholder="Optional manual ticker message"
              />
              <label>
                <span>Seconds</span>
                <input
                  type="number"
                  name="interval"
                  min="4"
                  max="120"
                  defaultValue={snapshot.streamState.tickerIntervalSeconds}
                />
              </label>
              <button type="submit" disabled={streamPending}>Save ticker</button>
              <fieldset
                key={snapshot.streamState.tickerCategories.join("-")}
                className="top-dog-ticker-categories"
              >
                <legend>Included categories</legend>
                {tickerCategoryOptions.map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="checkbox"
                      name="categories"
                      value={value}
                      defaultChecked={snapshot.streamState.tickerCategories.includes(value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
            </form>
          </div>

          <div className="top-dog-obs-links">
            <span>OBS browser sources</span>
            <Link href={`/stream/top-dog/${snapshot.season.slug}/scorebug`} target="_blank">
              Scorebug
            </Link>
            <Link href={`/stream/top-dog/${snapshot.season.slug}/match`} target="_blank">
              Match card
            </Link>
            <Link href={`/stream/top-dog/${snapshot.season.slug}/ladder`} target="_blank">
              Ladder
            </Link>
            <Link href={`/stream/top-dog/${snapshot.season.slug}/ticker`} target="_blank">
              Ticker
            </Link>
          </div>
        </aside>
      </section>

      <section className="top-dog-ladders-grid">
        <LadderTable
          label="Final results only"
          title="Official Ladder"
          standings={snapshot.officialLadder}
        />
        <LadderTable
          label="Live projection"
          title="If Results Hold"
          standings={snapshot.projectedLadder}
          projected
        />
      </section>

      <details className="top-dog-setup-panel">
        <summary>
          <Settings2 aria-hidden="true" />
          <span>
            <strong>League operations setup</strong>
            Add teams, rounds, and verified fixtures outside the live controls.
          </span>
          <b>{snapshot.seasonTeams.length} teams | {snapshot.rounds.length} rounds</b>
        </summary>

        <div className="top-dog-setup-grid">
          <form action={createTopDogTeamAction}>
            <input type="hidden" name="season_id" value={snapshot.season.id} />
            <span>1 / Team directory</span>
            <h3>Add a team</h3>
            <label>
              Team name
              <input type="text" name="name" maxLength={100} required />
            </label>
            <div className="top-dog-form-split">
              <label>
                Short name
                <input type="text" name="short_name" maxLength={12} />
              </label>
              <label>
                Team colour
                <input type="color" name="accent_color" defaultValue="#20c8ff" />
              </label>
            </div>
            <button type="submit"><Plus aria-hidden="true" /> Add team</button>
          </form>

          <form action={createTopDogRoundAction}>
            <input type="hidden" name="season_id" value={snapshot.season.id} />
            <span>2 / League calendar</span>
            <h3>Create a round</h3>
            <div className="top-dog-form-split">
              <label>
                Round number
                <input type="number" name="round_number" min="1" max="99" defaultValue={nextRoundNumber} required />
              </label>
              <label>
                Round name
                <input type="text" name="name" placeholder={`Round ${nextRoundNumber}`} />
              </label>
            </div>
            <label>
              Start time (Brisbane)
              <input type="datetime-local" name="scheduled_at" />
            </label>
            <div className="top-dog-form-split">
              <label>
                Venue
                <input type="text" name="venue" defaultValue="The Tee Lounge" />
              </label>
              <label>
                Course
                <input type="text" name="course_name" placeholder="GSPro course" />
              </label>
            </div>
            <label className="top-dog-check-field">
              <input type="checkbox" name="is_current" defaultChecked />
              Make this the current league night
            </label>
            <button type="submit"><Plus aria-hidden="true" /> Create round</button>
          </form>

          <form action={createTopDogFixtureAction}>
            <input type="hidden" name="season_id" value={snapshot.season.id} />
            <span>3 / Match draw</span>
            <h3>Add a fixture</h3>
            <label>
              Round
              <select name="round_id" defaultValue={selectedRoundId ?? ""} required>
                <option value="" disabled>Select round</option>
                {snapshot.rounds.map((round) => (
                  <option key={round.id} value={round.id}>Round {round.roundNumber} - {round.name}</option>
                ))}
              </select>
            </label>
            <div className="top-dog-form-split">
              <label>
                Team A
                <select name="home_team_id" defaultValue="" required>
                  <option value="" disabled>Select team</option>
                  {snapshot.seasonTeams.filter((item) => item.isActive).map((item) => (
                    <option key={item.team.id} value={item.team.id}>{item.team.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Team B
                <select name="away_team_id" defaultValue="" required>
                  <option value="" disabled>Select team</option>
                  {snapshot.seasonTeams.filter((item) => item.isActive).map((item) => (
                    <option key={item.team.id} value={item.team.id}>{item.team.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="top-dog-form-split">
              <label>
                Simulator bay
                <input type="text" name="simulator_bay" placeholder="Bay 1" />
              </label>
              <label>
                Holes
                <input type="number" name="holes_total" min="1" max="36" defaultValue={snapshot.season.defaultHoles} />
              </label>
            </div>
            <label>
              Scheduled time (Brisbane)
              <input type="datetime-local" name="scheduled_at" />
            </label>
            <button type="submit"><Plus aria-hidden="true" /> Add fixture</button>
          </form>
        </div>
      </details>
    </div>
  );
}
