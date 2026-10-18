"use client";

import Image from "next/image";
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  CircleDot,
  Clock3,
  Flag,
  Radio,
  Trophy,
  Wifi,
  WifiOff,
} from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type {
  TopDogCentralOverlay,
  TopDogFixture,
  TopDogSnapshot,
  TopDogStanding,
} from "@/lib/top-dog";

type TopDogStreamView = "scorebug" | "match" | "ladder" | "ticker";

type TopDogStreamOverlayProps = {
  initialSnapshot: TopDogSnapshot;
  view: TopDogStreamView;
  allowedOverlays?: TopDogCentralOverlay[];
  preview?: boolean;
  previewOverlay?: TopDogCentralOverlay;
  standaloneLadder?: boolean;
};

function getFixture(snapshot: TopDogSnapshot, purpose: "scorebug" | "featured") {
  const requestedId =
    purpose === "scorebug"
      ? snapshot.streamState.scorebugFixtureId
      : snapshot.streamState.featuredFixtureId;

  return (
    snapshot.fixtures.find((fixture) => fixture.id === requestedId) ??
    snapshot.fixtures.find((fixture) => fixture.isMatchOfNight) ??
    snapshot.fixtures.find((fixture) => fixture.status === "live") ??
    snapshot.fixtures[0] ??
    null
  );
}

function getCentralFixture(
  snapshot: TopDogSnapshot,
  overlay: TopDogCentralOverlay = snapshot.streamState.centralOverlay
) {

  if (overlay === "up_next") {
    return snapshot.fixtures.find((fixture) => fixture.status === "waiting") ?? null;
  }

  if (overlay === "match_result") {
    return [...snapshot.fixtures]
      .reverse()
      .find((fixture) => fixture.status === "final") ?? getFixture(snapshot, "featured");
  }

  return getFixture(snapshot, "featured");
}

function getCentralLabel(overlay: TopDogCentralOverlay) {
  const labels: Partial<Record<TopDogCentralOverlay, string>> = {
    match: "Live Match",
    match_of_night: "Match of the Night",
    live_ladder: "Live Ladder",
    results_hold: "If Results Hold",
    best_team: "Best Performing Team",
    longest_drive: "Longest Drive",
    ctp: "Closest to the Pin",
    bunker_boy: "Bunker Boy",
    one_putt_jackpot: "One-Putt Jackpot",
    sponsor: "Official Partner",
    subscribe: "Join the Society",
    player_interview: "Player Interview",
    up_next: "Up Next",
    match_result: "Match Result",
    shot_of_night: "Shot of the Night",
    doghouse: "The Doghouse",
    butters_board: "Butters' Board",
    night_wrap_up: "Tonight in Top Dog",
    stat_of_week: "Stat of the Week",
  };

  return labels[overlay] ?? "Top Dog League";
}

function getFixtureStatus(fixture: TopDogFixture) {
  if (
    fixture.homeScoreConfirmed !== fixture.awayScoreConfirmed &&
    fixture.status !== "final"
  ) {
    return "Result pending";
  }

  if (fixture.status === "final") {
    return "Final";
  }

  if (fixture.status === "live") {
    return fixture.currentHole > 0
      ? `Hole ${fixture.currentHole} / ${fixture.holesTotal}`
      : "Live";
  }

  return fixture.scheduledAt
    ? new Intl.DateTimeFormat("en-AU", {
        timeZone: "Australia/Brisbane",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(fixture.scheduledAt))
    : "Waiting";
}

function formatFixtureScore(fixture: TopDogFixture, side: "home" | "away") {
  const confirmed =
    side === "home" ? fixture.homeScoreConfirmed : fixture.awayScoreConfirmed;
  const score = side === "home" ? fixture.homeScore : fixture.awayScore;

  return confirmed ? String(score) : "TBC";
}

function TeamMark({ name, color }: { name: string; color: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <span className="td-broadcast-team-mark" style={{ borderColor: color }}>
      {letters || "CG"}
    </span>
  );
}

function Scorebug({ fixture, visible }: { fixture: TopDogFixture | null; visible: boolean }) {
  return (
    <section
      className={`td-scorebug ${visible && fixture ? "is-visible" : "is-hidden"}`}
      aria-hidden={!visible}
    >
      {fixture ? (
        <>
          <header>
            <div className="td-broadcast-brand">
              <Image src="/cgs-logo.png" alt="" width={54} height={54} priority />
              <div>
                <span>CGS Top Dog League</span>
                <strong>{fixture.isMatchOfNight ? "Match of the Night" : "Live Match"}</strong>
              </div>
            </div>
            <div className={`td-scorebug-state is-${fixture.status}`}>
              {fixture.status === "live" ? <CircleDot aria-hidden="true" /> : null}
              {getFixtureStatus(fixture)}
            </div>
          </header>
          <div className="td-scorebug-row">
            <TeamMark name={fixture.homeTeam.name} color={fixture.homeTeam.accentColor} />
            <span>{fixture.homeTeam.name}</span>
            <strong key={`home-${fixture.homeScore}-${fixture.updatedAt}`}>
              {formatFixtureScore(fixture, "home")}
            </strong>
          </div>
          <div className="td-scorebug-row is-away">
            <TeamMark name={fixture.awayTeam.name} color={fixture.awayTeam.accentColor} />
            <span>{fixture.awayTeam.name}</span>
            <strong key={`away-${fixture.awayScore}-${fixture.updatedAt}`}>
              {formatFixtureScore(fixture, "away")}
            </strong>
          </div>
          <footer>
            <span>{fixture.simulatorBay || "Simulator TBC"}</span>
            <i />
            <b>{fixture.holesRemaining} holes remaining</b>
          </footer>
        </>
      ) : null}
    </section>
  );
}

function MatchCard({
  snapshot,
  fixture,
  visible,
  overlay,
}: {
  snapshot: TopDogSnapshot;
  fixture: TopDogFixture | null;
  visible: boolean;
  overlay: TopDogCentralOverlay;
}) {
  const payload = snapshot.streamState.overlayPayload;
  const isFixtureOverlay = ["match", "match_of_night", "up_next", "match_result"].includes(
    overlay
  );

  if (!isFixtureOverlay) {
    const primary = String(payload.primary ?? payload.player ?? payload.team ?? "");
    const value = String(payload.value ?? payload.result ?? payload.prize ?? "");
    const sponsor = String(payload.sponsor ?? "");
    const title = String(payload.title ?? getCentralLabel(overlay));

    if (overlay === "one_putt_jackpot") {
      const jackpotStatus = String(payload.jackpotStatus ?? "idle");

      return (
        <section className={`td-jackpot-broadcast is-${jackpotStatus} ${visible ? "is-visible" : "is-hidden"}`}>
          <div className="td-jackpot-broadcast-glow" />
          <header>
            <Image src="/cgs-logo.png" alt="" width={82} height={82} priority />
            <div>
              <span>CGS Top Dog League</span>
              <h1>One-Putt Jackpot</h1>
            </div>
          </header>
          <div className="td-jackpot-broadcast-copy">
            <span>{title}</span>
            <strong>{value || "$100"}</strong>
            <b>{primary || "Player reveal incoming"}</b>
          </div>
          <footer>One putt. One chance. Take the money.</footer>
        </section>
      );
    }

    if (overlay === "player_interview") {
      return (
        <section className={`td-interview-broadcast ${visible ? "is-visible" : "is-hidden"}`}>
          <Image src="/cgs-logo.png" alt="" width={72} height={72} priority />
          <div>
            <span>{title || "Player Interview"}</span>
            <strong>{primary || "CGS Player"}</strong>
            <b>{value || "Top Dog League"}</b>
          </div>
          <i />
        </section>
      );
    }

    if (overlay === "night_wrap_up") {
      const results = Array.isArray(payload.results)
        ? payload.results.filter((item): item is string => typeof item === "string").slice(0, 4)
        : [];
      const prizes = Array.isArray(payload.prizes)
        ? payload.prizes.filter((item): item is string => typeof item === "string").slice(0, 4)
        : [];

      return (
        <section className={`td-wrap-broadcast ${visible ? "is-visible" : "is-hidden"}`}>
          <header>
            <div className="td-broadcast-brand">
              <Image src="/cgs-logo.png" alt="" width={82} height={82} priority />
              <div><span>CGS League Night Recap</span><h1>Tonight in Top Dog</h1></div>
            </div>
            <Trophy aria-hidden="true" />
          </header>
          <div className="td-wrap-broadcast-grid">
            <div>
              <span>Final results</span>
              {results.length > 0 ? results.map((result) => <strong key={result}>{result}</strong>) : <strong>{primary}</strong>}
            </div>
            <div>
              <span>Tonight&apos;s honours</span>
              {prizes.length > 0 ? prizes.map((prize) => <strong key={prize}>{prize}</strong>) : <strong>{value}</strong>}
            </div>
          </div>
          <footer>{value || "Another Top Dog league night in the books"}</footer>
        </section>
      );
    }

    return (
      <section className={`td-segment-card is-${overlay} ${visible ? "is-visible" : "is-hidden"}`}>
        <div className="td-segment-accent" />
        <header>
          <Image src="/cgs-logo.png" alt="" width={76} height={76} priority />
          <div>
            <span>CGS Top Dog League</span>
            <h1>{title}</h1>
          </div>
        </header>
        {overlay === "subscribe" ? (
          <div className="td-subscribe-copy">
            <strong>Don&apos;t just lurk.</strong>
            <b>Join the society.</b>
            <span>Subscribe now</span>
            <small>Live every league night | YouTube | Instagram | TikTok</small>
          </div>
        ) : (
          <div className="td-segment-copy">
            <strong>{primary || "Update incoming"}</strong>
            {value ? <b>{value}</b> : null}
            <p>
              {sponsor
                ? `Presented by ${sponsor}`
                : overlay === "sponsor" && payload.promoCode
                  ? `Promo code: ${String(payload.promoCode)}`
                  : "CGS League Night"}
            </p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={`td-match-card ${visible && fixture ? "is-visible" : "is-hidden"}`}>
      {fixture ? (
        <>
          <div className="td-match-card-edge" />
          <header>
            <div className="td-broadcast-brand">
              <Image src="/cgs-logo.png" alt="" width={76} height={76} priority />
              <div>
                <span>CGS Top Dog League | {snapshot.season.seasonLabel}</span>
                <h1>{getCentralLabel(overlay)}</h1>
              </div>
            </div>
            <div className={`td-match-card-status is-${fixture.status}`}>
              <Radio aria-hidden="true" /> {getFixtureStatus(fixture)}
            </div>
          </header>
          <div className="td-match-card-teams">
            <div>
              <TeamMark name={fixture.homeTeam.name} color={fixture.homeTeam.accentColor} />
              <span>Team A</span>
              <strong>{fixture.homeTeam.name}</strong>
              <b key={`central-home-${fixture.homeScore}-${fixture.updatedAt}`}>
                {formatFixtureScore(fixture, "home")}
              </b>
            </div>
            <i>vs</i>
            <div className="is-away">
              <TeamMark name={fixture.awayTeam.name} color={fixture.awayTeam.accentColor} />
              <span>Team B</span>
              <strong>{fixture.awayTeam.name}</strong>
              <b key={`central-away-${fixture.awayScore}-${fixture.updatedAt}`}>
                {formatFixtureScore(fixture, "away")}
              </b>
            </div>
          </div>
          <footer>
            <span><Clock3 aria-hidden="true" /> {getFixtureStatus(fixture)}</span>
            <span><Flag aria-hidden="true" /> {fixture.holesRemaining} holes remaining</span>
            <span>{fixture.simulatorBay || "Simulator TBC"}</span>
          </footer>
        </>
      ) : null}
    </section>
  );
}

function LadderRow({ standing }: { standing: TopDogStanding }) {
  return (
    <div className={`td-ladder-row is-${standing.qualification}`}>
      <span>{standing.position}</span>
      <div>
        <i style={{ background: standing.team.accentColor }} />
        <strong>{standing.team.name}{standing.pointsAdjustment !== 0 ? "*" : ""}</strong>
        {standing.movement !== 0 ? (
          <em className={standing.movement > 0 ? "is-up" : "is-down"}>
            {standing.movement > 0 ? <ArrowUp /> : <ArrowDown />}
            {Math.abs(standing.movement)}
          </em>
        ) : null}
      </div>
      <b>{standing.played}</b>
      <b>{standing.wins}</b>
      <b>{standing.draws}</b>
      <b>{standing.losses}</b>
      <b>{standing.differential > 0 ? "+" : ""}{standing.differential}</b>
      <strong>{standing.points}</strong>
    </div>
  );
}

function LadderGraphic({
  snapshot,
  visible,
  projected,
}: {
  snapshot: TopDogSnapshot;
  visible: boolean;
  projected: boolean;
}) {
  const standings = projected ? snapshot.projectedLadder : snapshot.officialLadder;

  return (
    <section className={`td-ladder ${visible ? "is-visible" : "is-hidden"}`}>
      <header>
        <div className="td-broadcast-brand">
          <Image src="/cgs-logo.png" alt="" width={75} height={75} priority />
          <div>
            <span>CGS Top Dog League | {snapshot.season.seasonLabel}</span>
            <h1>{projected ? "If Results Hold" : "Live Ladder"}</h1>
          </div>
        </div>
        <Trophy aria-hidden="true" />
      </header>
      <div className="td-ladder-columns">
        <span>Pos</span><span>Team</span><span>P</span><span>W</span><span>D</span><span>L</span><span>+/-</span><span>Pts</span>
      </div>
      <div className="td-ladder-rows">
        {standings.slice(0, 12).map((standing) => (
          <LadderRow key={standing.team.id} standing={standing} />
        ))}
      </div>
      <footer>
        <span><i /> Top 4 direct finals</span>
        <span><i className="is-gold" /> 5-6 wildcard</span>
        <strong>
          {projected ? "Live scores included" : "Final results only"}
          {standings.some((standing) => standing.pointsAdjustment !== 0)
            ? " | * Bye points included"
            : ""}
        </strong>
      </footer>
    </section>
  );
}

function buildTickerItems(snapshot: TopDogSnapshot) {
  const categories = new Set(snapshot.streamState.tickerCategories);
  const items: string[] = [];
  const manualMessage = snapshot.streamState.tickerManualMessage.trim();

  if (manualMessage) {
    items.push(manualMessage);
  }

  if (categories.has("scores")) {
    snapshot.fixtures
      .filter(
        (fixture) =>
          fixture.status !== "waiting" ||
          fixture.homeScoreConfirmed ||
          fixture.awayScoreConfirmed
      )
      .forEach((fixture) => {
        items.push(
          `${fixture.homeTeam.name} ${formatFixtureScore(fixture, "home")}-${formatFixtureScore(fixture, "away")} ${fixture.awayTeam.name} | ${getFixtureStatus(fixture)}`
        );
      });
  }

  if (categories.has("ladder") && snapshot.projectedLadder.length > 0) {
    items.push(
      `Live ladder: ${snapshot.projectedLadder
        .slice(0, 3)
        .map((standing) => `${standing.position}. ${standing.team.name} ${standing.points}pts`)
        .join(" | ")}`
    );
  }

  if (categories.has("next_match")) {
    const nextFixture = snapshot.fixtures.find((fixture) => fixture.status === "waiting");

    if (nextFixture) {
      items.push(
        `Up next: ${nextFixture.homeTeam.name} vs ${nextFixture.awayTeam.name} | ${nextFixture.simulatorBay || "Bay TBC"}`
      );
    }
  }

  const payload = snapshot.streamState.overlayPayload;
  const categoryPayloads: Array<[string, string]> = [
    ["longest_drive", String(payload.longestDrive ?? "")],
    ["ctp", String(payload.ctp ?? "")],
    ["bunker_boy", String(payload.bunkerBoy ?? "")],
    ["one_putt_jackpot", String(payload.jackpot ?? "")],
    ["sponsor", String(payload.sponsorMessage ?? "")],
  ];

  categoryPayloads.forEach(([category, value]) => {
    if (categories.has(category as never) && value.trim()) {
      items.push(value.trim());
    }
  });

  return items.length > 0 ? items : ["CGS Top Dog League | Live every league night"];
}

function Ticker({ snapshot, visible }: { snapshot: TopDogSnapshot; visible: boolean }) {
  const items = buildTickerItems(snapshot);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (snapshot.streamState.tickerPaused || items.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, snapshot.streamState.tickerIntervalSeconds * 1000);

    return () => clearInterval(interval);
  }, [items.length, snapshot.streamState.tickerIntervalSeconds, snapshot.streamState.tickerPaused]);

  const safeIndex = activeIndex % items.length;

  return (
    <section className={`td-ticker ${visible ? "is-visible" : "is-hidden"}`}>
      <div className="td-ticker-brand">
        <Image src="/cgs-logo.png" alt="" width={64} height={64} priority />
        <div><span>Top Dog</span><strong>Live</strong></div>
      </div>
      <div className="td-ticker-label">
        <span>League Night</span>
        <b>{snapshot.selectedRound?.name ?? snapshot.season.seasonLabel}</b>
      </div>
      <div className="td-ticker-message" key={`${safeIndex}-${items[safeIndex]}`}>
        {items[safeIndex]}
      </div>
      <div className="td-ticker-live"><CircleDot /> Live</div>
    </section>
  );
}

export default function TopDogStreamOverlay({
  initialSnapshot,
  view,
  allowedOverlays,
  preview = false,
  previewOverlay,
  standaloneLadder = false,
}: TopDogStreamOverlayProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [connected, setConnected] = useState(false);
  const [autoHiddenVersion, setAutoHiddenVersion] = useState<string | null>(null);
  const selectedRoundId = snapshot.selectedRound?.id ?? null;
  const {
    centralOverlay: streamCentralOverlay,
    centralOverlayVisible: streamCentralOverlayVisible,
    updatedAt: streamUpdatedAt,
  } = snapshot.streamState;

  async function refreshSnapshot() {
    const params = new URLSearchParams();

    if (selectedRoundId) {
      params.set("round", String(selectedRoundId));
    }

    try {
      const response = await fetch(
        `/api/top-dog/${snapshot.season.slug}${params.size ? `?${params}` : ""}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        return;
      }

      const nextSnapshot = (await response.json()) as TopDogSnapshot;
      startTransition(() => setSnapshot(nextSnapshot));
    } catch (error) {
      console.error("Top Dog OBS refresh error:", error);
      setConnected(false);
    }
  }

  const handleRealtimeRefresh = useEffectEvent(() => {
    void refreshSnapshot();
  });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    let channel = supabase
      .channel(`top-dog-stream:${snapshot.season.id}:${selectedRoundId ?? "all"}:${view}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "top_dog_stream_state",
          filter: `season_id=eq.${snapshot.season.id}`,
        },
        handleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "top_dog_rounds",
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
      setConnected(status === "SUBSCRIBED");
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [snapshot.season.id, selectedRoundId, view]);

  const handleFallbackRefresh = useEffectEvent(() => {
    void refreshSnapshot();
  });

  useEffect(() => {
    const interval = setInterval(handleFallbackRefresh, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (streamCentralOverlay !== "subscribe" || !streamCentralOverlayVisible) {
      return;
    }

    const updatedAt = new Date(streamUpdatedAt).getTime();
    const elapsed = Number.isFinite(updatedAt) ? Date.now() - updatedAt : 0;
    const remaining = Math.max(0, 7500 - elapsed);
    const timer = window.setTimeout(() => {
      setAutoHiddenVersion(streamUpdatedAt);
    }, remaining);

    return () => window.clearTimeout(timer);
  }, [
    streamCentralOverlay,
    streamCentralOverlayVisible,
    streamUpdatedAt,
  ]);

  const scorebugFixture = getFixture(snapshot, "scorebug");
  const centralOverlay = previewOverlay ?? streamCentralOverlay;
  const centralFixture = getCentralFixture(snapshot, centralOverlay);
  const centralAutoHidden =
    centralOverlay === "subscribe" &&
    autoHiddenVersion === snapshot.streamState.updatedAt;
  const centralVisible = preview || snapshot.streamState.centralOverlayVisible;
  const ladderVisible =
    standaloneLadder ||
    (centralVisible &&
      (centralOverlay === "live_ladder" || centralOverlay === "results_hold"));
  const matchVisible =
    centralVisible &&
    centralOverlay !== "none" &&
    centralOverlay !== "live_ladder" &&
    centralOverlay !== "results_hold" &&
    !centralAutoHidden &&
    (!allowedOverlays || allowedOverlays.includes(centralOverlay));

  return (
    <div className={`td-broadcast-stage is-${view}`}>
      {view === "scorebug" ? (
        <Scorebug
          fixture={scorebugFixture}
          visible={preview || snapshot.streamState.scorebugVisible}
        />
      ) : null}
      {view === "match" ? (
        ladderVisible ? (
          <LadderGraphic
            snapshot={snapshot}
            visible
            projected={centralOverlay === "results_hold"}
          />
        ) : (
          <MatchCard
            snapshot={snapshot}
            fixture={centralFixture}
            visible={matchVisible}
            overlay={centralOverlay}
          />
        )
      ) : null}
      {view === "ladder" ? (
        <LadderGraphic
          snapshot={snapshot}
          visible={ladderVisible}
          projected={!standaloneLadder && centralOverlay === "results_hold"}
        />
      ) : null}
      {view === "ticker" ? (
        <Ticker
          snapshot={snapshot}
          visible={preview || snapshot.streamState.tickerVisible}
        />
      ) : null}

      <div className={`td-broadcast-connection ${connected ? "is-connected" : ""}`}>
        {connected ? <Wifi aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
      </div>
    </div>
  );
}
