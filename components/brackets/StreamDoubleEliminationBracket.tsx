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
  getBracketChampion,
  getBracketSections,
  getMatchWinnerId,
  getParticipantName,
  isActionableMatch,
  type BracketRoundView,
  type BracketSectionView,
  type DoubleEliminationBracket,
  type DoubleEliminationMatch,
} from "@/lib/double-elimination-types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type StreamDoubleEliminationBracketProps = {
  initialBracket: DoubleEliminationBracket;
};

type SyncState = "connecting" | "connected" | "polling";

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

        return (
          <div
            className={`de-stream-player${isWinner ? " is-winner" : ""}`}
            key={`${String(match.id)}-${index}`}
          >
            <span className="de-stream-seed">
              {opponent?.position ?? (participantName === "TBD" ? "-" : "")}
            </span>
            <strong>{participantName}</strong>
            <span className="de-stream-result">{isWinner ? "W" : ""}</span>
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

export default function StreamDoubleEliminationBracket({
  initialBracket,
}: StreamDoubleEliminationBracketProps) {
  const [bracket, setBracket] = useState(initialBracket);
  const [syncState, setSyncState] = useState<SyncState>("connecting");
  const sections = useMemo(
    () => getBracketSections(bracket.bracketData),
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
      <div className="de-stream-frame">
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
            <span className={bracket.isLive ? "is-live" : ""}>
              {bracket.isLive ? "Live" : bracket.statusLabel}
            </span>
            <span>{bracket.participantCount} players</span>
            <span>{getSyncLabel(syncState)}</span>
            <small>{formatUpdatedAt(bracket.updatedAt)}</small>
          </div>
        </header>

        <div className="de-stream-layout">
          <BracketLane bracket={bracket} section={upperSection} />
          <BracketLane bracket={bracket} section={lowerSection} />
          <FinalsLane
            bracket={bracket}
            section={finalSection}
            champion={champion}
          />
        </div>
      </div>
    </section>
  );
}
