"use client";

import Image from "next/image";
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { CalendarClock, CircleDot, Trophy, Wifi, WifiOff } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type {
  TopDogFixture,
  TopDogSnapshot,
  TopDogStanding,
} from "@/lib/top-dog";

type BannerSlide =
  | {
      id: string;
      type: "fixtures" | "results";
      eyebrow: string;
      title: string;
      fixtures: TopDogFixture[];
    }
  | {
      id: string;
      type: "ladder";
      eyebrow: string;
      title: string;
      standings: TopDogStanding[];
    };

const ROTATION_MS = 8000;

function chunk<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size)
  );
}

function formatScore(fixture: TopDogFixture, side: "home" | "away") {
  const confirmed =
    side === "home" ? fixture.homeScoreConfirmed : fixture.awayScoreConfirmed;
  const score = side === "home" ? fixture.homeScore : fixture.awayScore;
  return confirmed ? String(score) : "TBC";
}

function formatFixtureMeta(fixture: TopDogFixture) {
  if (fixture.status === "final") {
    return "Final";
  }

  if (fixture.homeScoreConfirmed !== fixture.awayScoreConfirmed) {
    return "Result pending";
  }

  if (fixture.status === "live") {
    return fixture.currentHole > 0
      ? `Hole ${fixture.currentHole} / ${fixture.holesTotal}`
      : "Live";
  }

  const time = fixture.scheduledAt
    ? new Intl.DateTimeFormat("en-AU", {
        timeZone: "Australia/Brisbane",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(fixture.scheduledAt))
    : "Time TBC";

  return `${time} | ${fixture.simulatorBay || "Bay TBC"}`;
}

function buildSlides(snapshot: TopDogSnapshot): BannerSlide[] {
  const slides: BannerSlide[] = [];
  const currentRound = snapshot.selectedRound;
  const fixtureGroups = chunk(snapshot.fixtures, 3);

  fixtureGroups.forEach((fixtures, index) => {
    slides.push({
      id: `fixtures-${currentRound?.id ?? "none"}-${index}`,
      type: "fixtures",
      eyebrow: currentRound
        ? `Round ${currentRound.roundNumber} | ${currentRound.courseName || currentRound.name}`
        : "League Night",
      title: "Current Fixtures",
      fixtures,
    });
  });

  if (snapshot.officialLadder.length > 0) {
    chunk(snapshot.officialLadder.slice(0, 6), 3).forEach((standings, index) => {
      slides.push({
        id: `official-ladder-${index}`,
        type: "ladder",
        eyebrow: index === 0 ? "Direct finals positions" : "Wildcard race",
        title: "Official Ladder",
        standings,
      });
    });
  }

  const previousRound = [...snapshot.rounds]
    .filter(
      (round) =>
        round.roundNumber < (currentRound?.roundNumber ?? Number.POSITIVE_INFINITY) &&
        snapshot.allFixtures.some(
          (fixture) => fixture.roundId === round.id && fixture.status === "final"
        )
    )
    .sort((left, right) => right.roundNumber - left.roundNumber)[0];

  if (previousRound) {
    const resultGroups = chunk(
      snapshot.allFixtures.filter(
        (fixture) => fixture.roundId === previousRound.id && fixture.status === "final"
      ),
      3
    );

    resultGroups.forEach((fixtures, index) => {
      slides.push({
        id: `results-${previousRound.id}-${index}`,
        type: "results",
        eyebrow: `Round ${previousRound.roundNumber} | ${previousRound.courseName || previousRound.name}`,
        title: "Last Round Results",
        fixtures,
      });
    });
  }

  if (slides.length === 0) {
    slides.push({
      id: "fixtures-empty",
      type: "fixtures",
      eyebrow: snapshot.season.seasonLabel,
      title: "Fixtures Coming Soon",
      fixtures: [],
    });
  }

  return slides;
}

function FixtureSlide({ fixtures }: { fixtures: TopDogFixture[] }) {
  if (fixtures.length === 0) {
    return (
      <div className="td-league-banner-empty">
        <strong>The draw is being prepared</strong>
        <span>Stay tuned for the next Top Dog matchup</span>
      </div>
    );
  }

  return (
    <div className="td-league-banner-fixtures">
      {fixtures.map((fixture) => (
        <article key={fixture.id}>
          <div>
            <span>{fixture.homeTeam.name}</span>
            <strong>{formatScore(fixture, "home")}</strong>
          </div>
          <i>vs</i>
          <div className="is-away">
            <span>{fixture.awayTeam.name}</span>
            <strong>{formatScore(fixture, "away")}</strong>
          </div>
          <small>{formatFixtureMeta(fixture)}</small>
        </article>
      ))}
    </div>
  );
}

function LadderSlide({ standings }: { standings: TopDogStanding[] }) {
  return (
    <div className="td-league-banner-ladder">
      {standings.map((standing) => (
        <article key={standing.team.id} className={`is-${standing.qualification}`}>
          <b>{standing.position}</b>
          <div>
            <strong>{standing.team.name}{standing.pointsAdjustment !== 0 ? "*" : ""}</strong>
            <span>{standing.played} played | {standing.differential > 0 ? "+" : ""}{standing.differential}</span>
          </div>
          <em>{standing.points}<small>pts</small></em>
        </article>
      ))}
    </div>
  );
}

export default function TopDogLeagueBanner({
  initialSnapshot,
}: {
  initialSnapshot: TopDogSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [activeIndex, setActiveIndex] = useState(0);
  const [connected, setConnected] = useState(false);
  const selectedRoundId = snapshot.selectedRound?.id ?? null;
  const slides = buildSlides(snapshot);
  const safeIndex = activeIndex % slides.length;
  const activeSlide = slides[safeIndex];

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
      console.error("Top Dog rotating banner refresh error:", error);
      setConnected(false);
    }
  }

  const handleRealtimeRefresh = useEffectEvent(() => {
    void refreshSnapshot();
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, ROTATION_MS);

    return () => window.clearInterval(interval);
  }, [slides.length]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    let channel = supabase
      .channel(`top-dog-banner:${snapshot.season.id}:${selectedRoundId ?? "all"}`)
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

    channel.subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [snapshot.season.id, selectedRoundId]);

  const handleFallbackRefresh = useEffectEvent(() => {
    void refreshSnapshot();
  });

  useEffect(() => {
    const interval = window.setInterval(handleFallbackRefresh, 10000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="td-league-banner-canvas" aria-label="CGS Top Dog rotating stream banner">
      <div className="td-league-banner-shell">
        <header className="td-league-banner-brand">
          <Image src="/cgs-logo.png" alt="Crossodog Golf Society" width={92} height={92} priority />
          <div>
            <span>CGS Top Dog League</span>
            <strong>{snapshot.season.seasonLabel}</strong>
            <small>Same fairways. Bigger rivals.</small>
          </div>
        </header>

        <div className="td-league-banner-content" key={activeSlide.id}>
          <div className="td-league-banner-title">
            <span>{activeSlide.eyebrow}</span>
            <strong>{activeSlide.title}</strong>
          </div>
          {activeSlide.type === "ladder" ? (
            <LadderSlide standings={activeSlide.standings} />
          ) : (
            <FixtureSlide fixtures={activeSlide.fixtures} />
          )}
        </div>

        <aside className="td-league-banner-status">
          {activeSlide.type === "ladder" ? <Trophy aria-hidden="true" /> : <CalendarClock aria-hidden="true" />}
          <span>{activeSlide.type === "results" ? "Results" : activeSlide.type === "ladder" ? "Ladder" : "Fixtures"}</span>
          <strong>{safeIndex + 1} / {slides.length}</strong>
          <div className={connected ? "is-connected" : ""}>
            {connected ? <Wifi aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
            <small>{connected ? "Live linked" : "Auto syncing"}</small>
          </div>
          <CircleDot className="td-league-banner-live-dot" aria-hidden="true" />
        </aside>
      </div>
    </section>
  );
}
