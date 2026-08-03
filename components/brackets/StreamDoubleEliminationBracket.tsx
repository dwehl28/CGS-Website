"use client";

import Image from "next/image";
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";

import {
  BRACKET_MATCH_COMPLETED,
  getAutomaticByeParticipantIds,
  getBracketChampion,
  getBracketSections,
  getMatchWinnerId,
  getParticipantName,
  getParticipantSeed,
  isAutomaticByeMatch,
  isActionableMatch,
  type BracketRoundView,
  type BracketSectionView,
  type DoubleEliminationBracket,
  type DoubleEliminationMatch,
} from "@/lib/double-elimination-types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type StreamDoubleEliminationBracketProps = {
  initialBracket: DoubleEliminationBracket;
  initialView: StreamBracketView;
};

type SyncState = "connecting" | "connected" | "polling";
type StreamBracketView = "overview" | "upper" | "lower" | "live";

const streamViewLabels: Record<StreamBracketView, string> = {
  overview: "Full bracket",
  upper: "Upper bracket",
  lower: "Lower bracket",
  live: "Matches now",
};

function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Updated now";
  }

  return `Updated ${new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)}`;
}

function getSyncLabel(syncState: SyncState) {
  if (syncState === "connected") {
    return "Live sync";
  }

  if (syncState === "polling") {
    return "Auto refresh";
  }

  return "Connecting";
}

function BracketMatch({
  bracket,
  match,
}: {
  bracket: DoubleEliminationBracket;
  match: DoubleEliminationMatch;
}) {
  const winnerId = getMatchWinnerId(match);
  const byeParticipantIds = getAutomaticByeParticipantIds(bracket.bracketData);
  const opponents = [match.opponent1, match.opponent2];
  const isReady = isActionableMatch(match);
  const isComplete = match.status === BRACKET_MATCH_COMPLETED;

  return (
    <div
      className={`de-stream-match${isReady ? " is-ready" : ""}${
        isComplete ? " is-complete" : ""
      }`}
    >
      <span className="de-stream-match-number">M{match.number}</span>
      {opponents.map((opponent, index) => {
        const participantName = getParticipantName(
          bracket.bracketData,
          opponent?.id
        );
        const isWinner =
          winnerId !== null && String(winnerId) === String(opponent?.id);
        const participantSeed = getParticipantSeed(
          bracket.bracketData,
          opponent?.id
        );
        const isWaitingAfterBye =
          match.status === 1 &&
          opponent?.id !== null &&
          opponent?.id !== undefined &&
          byeParticipantIds.has(String(opponent.id));

        return (
          <div
            className={`de-stream-player${isWinner ? " is-winner" : ""}`}
            key={`${String(match.id)}-${index}`}
          >
            <span className="de-stream-seed">
              {participantSeed ??
                opponent?.position ??
                (participantName === "TBD" ? "-" : "")}
            </span>
            <strong>{participantName}</strong>
            <span className="de-stream-result">
              {isWinner ? "W" : isWaitingAfterBye ? "BYE" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function BracketRound({
  bracket,
  round,
}: {
  bracket: DoubleEliminationBracket;
  round: BracketRoundView;
}) {
  return (
    <div className="de-stream-round">
      <h3>{round.label}</h3>
      <div
        className="de-stream-round-matches"
        style={{
          gridTemplateRows: `repeat(${Math.max(round.matches.length, 1)}, minmax(0, 1fr))`,
        }}
      >
        {round.matches.map((match) => (
          <BracketMatch
            key={String(match.id)}
            bracket={bracket}
            match={match}
          />
        ))}
      </div>
    </div>
  );
}

function BracketLane({
  bracket,
  section,
}: {
  bracket: DoubleEliminationBracket;
  section: BracketSectionView;
}) {
  return (
    <section className={`de-stream-section de-stream-section-${section.key}`}>
      <div className="de-stream-section-title">
        <span>{section.key === "upper" ? "U" : "L"}</span>
        <h2>{section.label}</h2>
      </div>
      <div
        className="de-stream-rounds"
        style={{
          gridTemplateColumns: `repeat(${Math.max(section.rounds.length, 1)}, minmax(0, 1fr))`,
        }}
      >
        {section.rounds.map((round) => (
          <BracketRound key={String(round.id)} bracket={bracket} round={round} />
        ))}
      </div>
    </section>
  );
}

function FinalsLane({
  bracket,
  section,
  champion,
}: {
  bracket: DoubleEliminationBracket;
  section: BracketSectionView;
  champion: string | null;
}) {
  const matches = section.rounds.flatMap((round) =>
    round.matches.map((match) => ({ match, label: round.label }))
  );

  return (
    <section className="de-stream-finals">
      <div className="de-stream-finals-heading">
        <span>CGS</span>
        <h2>Finals</h2>
      </div>

      <div className="de-stream-finals-matches">
        {matches.map(({ match, label }) => (
          <div key={String(match.id)}>
            <h3>{label}</h3>
            <BracketMatch bracket={bracket} match={match} />
          </div>
        ))}
      </div>

      <div className={`de-stream-champion${champion ? " is-decided" : ""}`}>
        <span>{champion ? "Champion" : "Road to the final"}</span>
        <strong>{champion || "Double elimination"}</strong>
      </div>
    </section>
  );
}

function LiveMatchCard({
  bracket,
  match,
  sectionLabel,
  roundLabel,
  index,
}: {
  bracket: DoubleEliminationBracket;
  match: DoubleEliminationMatch;
  sectionLabel: string;
  roundLabel: string;
  index: number;
}) {
  const opponents = [match.opponent1, match.opponent2];

  return (
    <article className="de-stream-live-match">
      <div className="de-stream-live-match-head">
        <span>Match {index + 1}</span>
        <strong>
          {sectionLabel} · {roundLabel}
        </strong>
      </div>
      <div className="de-stream-live-players">
        {opponents.map((opponent, opponentIndex) => {
          const name = getParticipantName(bracket.bracketData, opponent?.id);
          const seed = getParticipantSeed(bracket.bracketData, opponent?.id);

          return (
            <div key={`${String(match.id)}-${opponentIndex}`}>
              <span>{seed ?? "-"}</span>
              <strong>{name}</strong>
            </div>
          );
        })}
      </div>
      <div className="de-stream-live-versus">VS</div>
    </article>
  );
}

function LiveMatchesView({
  bracket,
  sections,
  champion,
}: {
  bracket: DoubleEliminationBracket;
  sections: BracketSectionView[];
  champion: string | null;
}) {
  const matchContext = sections.flatMap((section) =>
    section.rounds.flatMap((round) =>
      round.matches.map((match) => ({
        match,
        sectionLabel: section.label,
        roundLabel: round.label,
      }))
    )
  );
  const readyMatches = matchContext.filter(({ match }) =>
    isActionableMatch(match)
  );
  const decidedMatches = matchContext.filter(
    ({ match }) => getMatchWinnerId(match) !== null
  ).length;
  const totalMatches = matchContext.length;
  const progress =
    totalMatches > 0 ? Math.round((decidedMatches / totalMatches) * 100) : 0;

  return (
    <div className="de-stream-live-board">
      <section className="de-stream-live-main">
        <div className="de-stream-live-title">
          <div>
            <span>Competition desk</span>
            <h2>{champion ? "Competition complete" : "Ready to play"}</h2>
          </div>
          <strong>
            {readyMatches.length} match{readyMatches.length === 1 ? "" : "es"} ready
          </strong>
        </div>

        <div className="de-stream-live-grid">
          {readyMatches.length > 0 ? (
            readyMatches.slice(0, 3).map((context, index) => (
              <LiveMatchCard
                key={String(context.match.id)}
                bracket={bracket}
                match={context.match}
                sectionLabel={context.sectionLabel}
                roundLabel={context.roundLabel}
                index={index}
              />
            ))
          ) : (
            <div className="de-stream-live-waiting">
              <span>{champion ? "Champion" : "Bracket update"}</span>
              <strong>{champion || "Waiting for the next result"}</strong>
            </div>
          )}
        </div>
      </section>

      <aside className="de-stream-progress">
        <div>
          <span>Bracket progress</span>
          <strong>{progress}%</strong>
        </div>
        <div className="de-stream-progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
        <dl>
          <div>
            <dt>Players</dt>
            <dd>{bracket.participantCount}</dd>
          </div>
          <div>
            <dt>Results in</dt>
            <dd>
              {decidedMatches}/{totalMatches}
            </dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>Double elim</dd>
          </div>
        </dl>
        <div className={`de-stream-progress-champion${champion ? " is-decided" : ""}`}>
          <span>{champion ? "Champion" : "Still alive"}</span>
          <strong>{champion || "Two losses to exit"}</strong>
        </div>
      </aside>
    </div>
  );
}

export default function StreamDoubleEliminationBracket({
  initialBracket,
  initialView,
}: StreamDoubleEliminationBracketProps) {
  const [bracket, setBracket] = useState(initialBracket);
  const [syncState, setSyncState] = useState<SyncState>("connecting");
  const sections = useMemo(
    () =>
      getBracketSections(bracket.bracketData).map((section) => ({
        ...section,
        rounds: section.rounds
          .map((round) => ({
            ...round,
            matches: round.matches.filter(
              (match) => !isAutomaticByeMatch(match)
            ),
          }))
          .filter((round) => round.matches.length > 0),
      })),
    [bracket.bracketData]
  );
  const upperSection = sections.find((section) => section.key === "upper");
  const lowerSection = sections.find((section) => section.key === "lower");
  const finalSection = sections.find((section) => section.key === "final");
  const champion = getBracketChampion(bracket.bracketData);

  async function refreshBracket() {
    try {
      const response = await fetch(`/api/brackets/${initialBracket.slug}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const nextBracket = (await response.json()) as DoubleEliminationBracket;

      startTransition(() => {
        setBracket(nextBracket);
      });
    } catch (error) {
      console.error("Stream bracket refresh error:", error);
    }
  }

  const handleRefresh = useEffectEvent(async () => {
    await refreshBracket();
  });

  useEffect(() => {
    const pollingTimer = window.setInterval(() => {
      void handleRefresh();
    }, 5000);
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      const stateTimer = window.setTimeout(() => setSyncState("polling"), 0);

      return () => {
        window.clearTimeout(stateTimer);
        window.clearInterval(pollingTimer);
      };
    }

    const channel = supabase
      .channel(`stream-double-elimination:${initialBracket.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cgs_double_elimination_brackets",
          filter: `id=eq.${initialBracket.id}`,
        },
        () => {
          void handleRefresh();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setSyncState("connected");
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setSyncState("polling");
        }
      });

    return () => {
      window.clearInterval(pollingTimer);
      void supabase.removeChannel(channel);
    };
  }, [initialBracket.id]);

  if (!upperSection || !lowerSection || !finalSection) {
    return null;
  }

  return (
    <section
      className="de-stream-canvas"
      aria-label={`${bracket.title} double-elimination bracket`}
    >
      <div className={`de-stream-frame is-${initialView}`}>
        <header className="de-stream-header">
          <div className="de-stream-brand">
            <Image
              src="/cgs-logo.png"
              alt="Crossodog Golf Society"
              width={82}
              height={82}
              priority
            />
            <div>
              <p>Crossodog Golf Society</p>
              <h1>{bracket.title}</h1>
              <span>{bracket.subtitle}</span>
            </div>
          </div>

          <div className="de-stream-header-meta">
            <span className="de-stream-view-label">
              {streamViewLabels[initialView]}
            </span>
            <span className={bracket.isLive ? "is-live" : ""}>
              {bracket.isLive ? "Live" : bracket.statusLabel}
            </span>
            <span>{bracket.participantCount} players</span>
            <span>{getSyncLabel(syncState)}</span>
            <small>{formatUpdatedAt(bracket.updatedAt)}</small>
          </div>
        </header>

        {initialView === "live" ? (
          <LiveMatchesView
            bracket={bracket}
            sections={sections}
            champion={champion}
          />
        ) : (
          <div
            className={`de-stream-layout${
              initialView === "overview" ? "" : " is-focus"
            }`}
          >
            {initialView === "overview" || initialView === "upper" ? (
              <BracketLane bracket={bracket} section={upperSection} />
            ) : null}
            {initialView === "overview" || initialView === "lower" ? (
              <BracketLane bracket={bracket} section={lowerSection} />
            ) : null}
            <FinalsLane
              bracket={bracket}
              section={finalSection}
              champion={champion}
            />
          </div>
        )}
      </div>
    </section>
  );
}
