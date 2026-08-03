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
type StreamBracketView =
  | "overview"
  | "upper"
  | "lower"
  | "live"
  | "banner"
  | "portrait";

type StreamMatchContext = {
  match: DoubleEliminationMatch;
  sectionLabel: string;
  roundLabel: string;
};

const streamViewLabels: Record<StreamBracketView, string> = {
  overview: "Full bracket",
  upper: "Upper bracket",
  lower: "Lower bracket",
  live: "Matches now",
  banner: "Lower third",
  portrait: "Portrait roll",
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

function getMatchContext(sections: BracketSectionView[]) {
  return sections.flatMap((section) =>
    section.rounds.flatMap((round) =>
      round.matches.map((match) => ({
        match,
        sectionLabel: section.label,
        roundLabel: round.label,
      }))
    )
  );
}

function getBracketProgress(matchContext: StreamMatchContext[]) {
  const decidedMatches = matchContext.filter(
    ({ match }) => getMatchWinnerId(match) !== null
  ).length;
  const totalMatches = matchContext.length;

  return {
    decidedMatches,
    totalMatches,
    percentage:
      totalMatches > 0
        ? Math.round((decidedMatches / totalMatches) * 100)
        : 0,
  };
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
  const matchContext = getMatchContext(sections);
  const readyMatches = matchContext.filter(({ match }) =>
    isActionableMatch(match)
  );
  const { decidedMatches, totalMatches, percentage } =
    getBracketProgress(matchContext);

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
          <strong>{percentage}%</strong>
        </div>
        <div className="de-stream-progress-track">
          <span style={{ width: `${percentage}%` }} />
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

function BannerMatch({
  bracket,
  context,
  index,
}: {
  bracket: DoubleEliminationBracket;
  context: StreamMatchContext;
  index: number;
}) {
  const opponents = [context.match.opponent1, context.match.opponent2];

  return (
    <article className="de-banner-match">
      <div className="de-banner-match-label">
        <span>Next {index + 1}</span>
        <strong>{context.roundLabel}</strong>
      </div>
      <div className="de-banner-matchup">
        {opponents.map((opponent, opponentIndex) => (
          <div key={`${String(context.match.id)}-${opponentIndex}`}>
            <span>
              {getParticipantSeed(bracket.bracketData, opponent?.id) ?? "-"}
            </span>
            <strong>
              {getParticipantName(bracket.bracketData, opponent?.id)}
            </strong>
          </div>
        ))}
        <small>VS</small>
      </div>
    </article>
  );
}

function StreamBracketBanner({
  bracket,
  sections,
  champion,
  syncState,
}: {
  bracket: DoubleEliminationBracket;
  sections: BracketSectionView[];
  champion: string | null;
  syncState: SyncState;
}) {
  const matchContext = getMatchContext(sections);
  const readyMatches = matchContext.filter(({ match }) =>
    isActionableMatch(match)
  );
  const { percentage } = getBracketProgress(matchContext);

  return (
    <div className="de-banner-frame">
      <section className="de-banner-brand">
        <Image
          src="/cgs-logo.png"
          alt="Crossodog Golf Society"
          width={74}
          height={74}
          priority
        />
        <div>
          <span>CGS double elimination</span>
          <h1>{bracket.title}</h1>
          <strong>{bracket.isLive ? "Live now" : bracket.statusLabel}</strong>
        </div>
      </section>

      <div className="de-banner-matches">
        {readyMatches.length > 0 ? (
          readyMatches.slice(0, 3).map((context, index) => (
            <BannerMatch
              key={String(context.match.id)}
              bracket={bracket}
              context={context}
              index={index}
            />
          ))
        ) : (
          <div className="de-banner-waiting">
            <span>{champion ? "Champion" : "Bracket update"}</span>
            <strong>{champion || "Waiting for the next match"}</strong>
          </div>
        )}
      </div>

      <aside className="de-banner-status">
        <span>{getSyncLabel(syncState)}</span>
        <strong>{percentage}%</strong>
        <small>Bracket complete</small>
      </aside>
    </div>
  );
}

function PortraitMatchSlide({
  bracket,
  context,
  position,
  total,
}: {
  bracket: DoubleEliminationBracket;
  context: StreamMatchContext;
  position: number;
  total: number;
}) {
  const opponents = [context.match.opponent1, context.match.opponent2];

  return (
    <div className="de-portrait-slide de-portrait-match-slide">
      <div className="de-portrait-slide-title">
        <span>
          Ready match {position} of {total}
        </span>
        <h2>{context.roundLabel}</h2>
        <strong>{context.sectionLabel}</strong>
      </div>

      <div className="de-portrait-matchup">
        {opponents.map((opponent, opponentIndex) => (
          <div key={`${String(context.match.id)}-${opponentIndex}`}>
            <span>
              Seed {getParticipantSeed(bracket.bracketData, opponent?.id) ?? "-"}
            </span>
            <strong>
              {getParticipantName(bracket.bracketData, opponent?.id)}
            </strong>
          </div>
        ))}
        <small>VS</small>
      </div>
    </div>
  );
}

function PortraitSummarySlide({
  matchContext,
  champion,
}: {
  matchContext: StreamMatchContext[];
  champion: string | null;
}) {
  const { decidedMatches, totalMatches, percentage } =
    getBracketProgress(matchContext);
  const sectionProgress = ["Upper bracket", "Lower bracket", "Finals"].map(
    (sectionLabel) => {
      const matches = matchContext.filter(
        (context) => context.sectionLabel === sectionLabel
      );
      return {
        label: sectionLabel,
        decided: matches.filter(
          ({ match }) => getMatchWinnerId(match) !== null
        ).length,
        total: matches.length,
      };
    }
  );

  return (
    <div className="de-portrait-slide de-portrait-summary-slide">
      <div className="de-portrait-slide-title">
        <span>Competition progress</span>
        <h2>{champion ? "Champion decided" : `${percentage}% complete`}</h2>
        <strong>
          {decidedMatches} of {totalMatches} results recorded
        </strong>
      </div>

      <div className="de-portrait-progress-track">
        <span style={{ height: `${percentage}%` }} />
      </div>

      <div className="de-portrait-section-progress">
        {sectionProgress.map((section) => (
          <div key={section.label}>
            <span>{section.label}</span>
            <strong>
              {section.decided}/{section.total}
            </strong>
          </div>
        ))}
      </div>

      <div className={`de-portrait-champion${champion ? " is-decided" : ""}`}>
        <span>{champion ? "Champion" : "Format"}</span>
        <strong>{champion || "Two losses to exit"}</strong>
      </div>
    </div>
  );
}

function StreamBracketPortrait({
  bracket,
  sections,
  champion,
  syncState,
  slideIndex,
}: {
  bracket: DoubleEliminationBracket;
  sections: BracketSectionView[];
  champion: string | null;
  syncState: SyncState;
  slideIndex: number;
}) {
  const matchContext = getMatchContext(sections);
  const readyMatches = matchContext.filter(({ match }) =>
    isActionableMatch(match)
  );
  const slideCount = readyMatches.length + 1;
  const normalizedSlideIndex = slideIndex % slideCount;
  const activeMatch = readyMatches[normalizedSlideIndex] ?? null;

  return (
    <div className="de-portrait-frame">
      <header className="de-portrait-header">
        <Image
          src="/cgs-logo.png"
          alt="Crossodog Golf Society"
          width={68}
          height={68}
          priority
        />
        <div>
          <span>CGS live bracket</span>
          <h1>{bracket.title}</h1>
        </div>
        <strong>{bracket.isLive ? "Live" : "Ready"}</strong>
      </header>

      <div className="de-portrait-stage" key={normalizedSlideIndex}>
        {activeMatch ? (
          <PortraitMatchSlide
            bracket={bracket}
            context={activeMatch}
            position={normalizedSlideIndex + 1}
            total={readyMatches.length}
          />
        ) : (
          <PortraitSummarySlide
            matchContext={matchContext}
            champion={champion}
          />
        )}
      </div>

      <footer className="de-portrait-footer">
        <div>
          {Array.from({ length: slideCount }, (_, index) => (
            <span
              className={index === normalizedSlideIndex ? "is-active" : ""}
              key={index}
            />
          ))}
        </div>
        <strong>{getSyncLabel(syncState)}</strong>
      </footer>
    </div>
  );
}

export default function StreamDoubleEliminationBracket({
  initialBracket,
  initialView,
}: StreamDoubleEliminationBracketProps) {
  const [bracket, setBracket] = useState(initialBracket);
  const [syncState, setSyncState] = useState<SyncState>("connecting");
  const [portraitSlideIndex, setPortraitSlideIndex] = useState(0);
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
  const portraitSlideCount =
    getMatchContext(sections).filter(({ match }) => isActionableMatch(match))
      .length + 1;

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

  useEffect(() => {
    if (initialView !== "portrait" || portraitSlideCount <= 1) {
      return;
    }

    const slideTimer = window.setInterval(() => {
      setPortraitSlideIndex(
        (currentIndex) => (currentIndex + 1) % portraitSlideCount
      );
    }, 7000);

    return () => window.clearInterval(slideTimer);
  }, [initialView, portraitSlideCount]);

  if (!upperSection || !lowerSection || !finalSection) {
    return null;
  }

  return (
    <section
      className={`de-stream-canvas is-${initialView}`}
      aria-label={`${bracket.title} double-elimination bracket`}
    >
      {initialView === "banner" ? (
        <StreamBracketBanner
          bracket={bracket}
          sections={sections}
          champion={champion}
          syncState={syncState}
        />
      ) : initialView === "portrait" ? (
        <StreamBracketPortrait
          bracket={bracket}
          sections={sections}
          champion={champion}
          syncState={syncState}
          slideIndex={portraitSlideIndex}
        />
      ) : (
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
      )}
    </section>
  );
}
