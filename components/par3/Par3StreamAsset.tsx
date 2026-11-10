"use client";

import Image from "next/image";
import { startTransition, useEffect, useEffectEvent, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  MonitorPlay,
  Radio,
  Target,
  Trophy,
} from "lucide-react";

import {
  PAR3_MATCH_COMPLETED,
  PAR3_MATCH_READY,
  PAR3_MATCH_RUNNING,
  buildPar3Pools,
  getKnockoutParticipantName,
  getPar3Champion,
  getPar3CtpContestants,
  getPar3CtpStage,
  getPar3CtpWinner,
  getPar3KnockoutRounds,
  getPar3FinalsStages,
  getPar3QualificationPlan,
  isPar3PoolComplete,
  getPar3SimulatorQueues,
  getPoolStage,
  resolvePar3BracketSlot,
  type Par3PoolMatch,
  type Par3KnockoutRound,
  type Par3PoolView,
  type Par3Snapshot,
  type Par3StreamView,
} from "@/lib/par3-showdown-types";
import {
  getPar3DisplayFinalsTemplate,
  getPar3DisplayFinalistCount,
  getPar3DisplayByePlayer,
  getPar3ByeAdvanceLabel,
  isPar3DisplayPoolOrderConfirmed,
  getPar3DisplayCourseStages,
  getPar3DisplayQualification,
  getPar3DisplayMatchRound,
  getPar3DisplayPoolStages,
  getPar3QualificationDescription,
  getPar3StageHoleLabel,
  PAR3_COURSE_POSTER_URL,
  splitPar3DisplayPages,
} from "@/lib/par3-display";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type AssetProps = { initialSnapshot: Par3Snapshot; view: Par3StreamView };
type PlayerMap = Map<number, Par3Snapshot["players"][number]>;

const TV_SLIDES = [
  "live",
  "up-next",
  "standings",
  "fixtures",
  "results",
  "bracket",
  "road",
  "sponsors",
] as const;

function sortPoolMatchesByPlayOrder(matches: Par3PoolMatch[], snapshot: Par3Snapshot) {
  return matches.slice().sort((first, second) => {
    const roundDifference = getPar3DisplayMatchRound(snapshot, first) - getPar3DisplayMatchRound(snapshot, second);
    if (roundDifference !== 0) return roundDifference;
    if (first.poolNumber !== second.poolNumber) return first.poolNumber - second.poolNumber;
    return first.matchNumber - second.matchNumber;
  });
}

function TeeLoungeMark() {
  return (
    <div className="par3-tee-lounge-mark" aria-label="The Tee Lounge">
      <span>The</span><strong>Tee Lounge</strong>
    </div>
  );
}

function BroadcastHeader({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <header className="par3-broadcast-header">
      <div className="par3-broadcast-event-mark">
        <div className="par3-broadcast-logo-v2">
          <i aria-hidden="true">II</i>
          <Image src="/par3/par3-logo.png" alt="CGS Par 3" width={118} height={118} priority />
        </div>
        <div><span>{eyebrow}</span><h1>{title}</h1><p>{detail}</p></div>
      </div>
      <TeeLoungeMark />
    </header>
  );
}

function MatchCard({ match, playersById, compact = false }: { match: Par3PoolMatch; playersById: PlayerMap; compact?: boolean }) {
  const first = playersById.get(match.player1Id)?.name ?? "TBD";
  const second = playersById.get(match.player2Id)?.name ?? "TBD";
  const winner = match.winnerId ? playersById.get(match.winnerId)?.name : null;
  const poolSize = [...playersById.values()].filter((player) => !player.isWithdrawn && player.poolNumber === match.poolNumber).length;
  const stage = getPoolStage(match.matchNumber, Math.max(2, poolSize));

  return (
    <article className={`par3-broadcast-match ${compact ? "is-compact" : ""} is-${match.status}`}>
      <div><span>Pool {String.fromCharCode(64 + match.poolNumber)}</span><small>{match.status === "live" ? "Live now" : stage?.shortCourse ?? `Match ${match.matchNumber}`}</small></div>
      <p className={winner === first ? "is-winner" : ""}><strong>{first}</strong>{winner === first ? <Check /> : null}</p>
      <i>vs</i>
      <p className={winner === second ? "is-winner" : ""}><strong>{second}</strong>{winner === second ? <Check /> : null}</p>
    </article>
  );
}

function StandingsBoard({
  pools,
  snapshot,
  pageIndex = 0,
}: {
  pools: Par3PoolView[];
  snapshot: Par3Snapshot;
  pageIndex?: number;
}) {
  const plan = getPar3DisplayQualification(snapshot);
  const pages = splitPar3DisplayPages(pools, 6);
  const page = pageIndex % Math.max(1, pages.length);
  const visiblePools = pages[page] ?? [];

  return (
    <section className="par3-broadcast-standings" style={{ "--par3-pool-columns": Math.max(1, visiblePools.length) } as CSSProperties} aria-label={`Pool tables, page ${page + 1} of ${Math.max(1, pages.length)}`}>
      {pages.length > 1 ? <span className="par3-broadcast-page-caption">Pool tables / {page + 1} of {pages.length} / rotates automatically</span> : null}
      {visiblePools.map((pool) => (
        <article key={pool.number} style={{ "--par3-player-rows": Math.max(1, pool.standings.length) } as CSSProperties}>
          <div className="par3-broadcast-pool-title"><span>Pool</span><strong>{String.fromCharCode(64 + pool.number)}</strong></div>
          <div className="par3-broadcast-standing-head"><span>Pos</span><span>Player</span><span>P</span><span>W</span></div>
          {pool.standings.map((standing) => (
            <div key={standing.player.id} className={`par3-broadcast-standing-row ${standing.position <= plan.automaticPlaces ? "is-qualified" : plan.ctpQualifierCount > 0 && (plan.ctpAllRemaining || standing.position === plan.ctpPoolPosition) ? "is-ctp" : ""}`}>
              <span>{standing.position}</span><strong>{standing.player.name}</strong><span>{standing.played}</span><b>{standing.wins}</b>
            </div>
          ))}
          <footer><span>{plan.allPlayersAdvance ? "All players advance" : plan.automaticPlaces ? `Top ${plan.automaticPlaces} qualify` : "CTP qualification"}</span><span>{plan.ctpPurpose === "bye" ? "Winner to bye CTP" : plan.ctpQualifierCount ? (plan.ctpAllRemaining ? "Others to CTP" : `${ordinal(plan.ctpPoolPosition)} to CTP`) : "No bracket CTP"}</span></footer>
        </article>
      ))}
    </section>
  );
}

function FixturesBoard({ snapshot, playersById, pageIndex = 0 }: { snapshot: Par3Snapshot; playersById: PlayerMap; pageIndex?: number }) {
  const panels = getPar3DisplayPoolStages(snapshot).flatMap((stage, index) => {
    const matches = snapshot.poolMatches.filter((match) => getPar3DisplayMatchRound(snapshot, match) === index + 1);
    const chunks = splitPar3DisplayPages(matches, 6);
    return (chunks.length ? chunks : [[]]).map((chunk, chunkIndex) => ({ stage, matches: chunk, allMatches: matches, chunkIndex, chunkCount: chunks.length || 1 }));
  });
  const pages = splitPar3DisplayPages(panels, 3);
  const visiblePanels = pages[pageIndex % Math.max(1, pages.length)] ?? [];
  return (
    <section className="par3-broadcast-fixture-rounds" style={{ gridTemplateColumns: `repeat(${Math.max(1, visiblePanels.length)}, minmax(0, 1fr))` }}>
      {pages.length > 1 ? <span className="par3-broadcast-page-caption">Fixtures / {pageIndex % pages.length + 1} of {pages.length} / rotates automatically</span> : null}
      {visiblePanels.map(({ stage, matches, allMatches, chunkIndex, chunkCount }) => {
        return (
          <article key={`${stage.key}-${chunkIndex}`}>
            <div className="par3-broadcast-round-title"><span>{stage.label}{chunkCount > 1 ? ` / ${chunkIndex + 1} of ${chunkCount}` : ""} / {getPar3StageHoleLabel(stage)}</span><strong>{stage.course}</strong><small>{allMatches.filter((match) => match.status === "complete").length}/{allMatches.length} complete</small></div>
            <div>{matches.map((match) => <MatchCard key={match.id} match={match} playersById={playersById} compact />)}</div>
          </article>
        );
      })}
    </section>
  );
}

function ResultsBoard({ snapshot, playersById }: { snapshot: Par3Snapshot; playersById: PlayerMap }) {
  const completed = snapshot.poolMatches
    .filter((match) => match.status === "complete" && match.winnerId !== null)
    .slice()
    .sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt));
  const upcoming = sortPoolMatchesByPlayOrder(snapshot.poolMatches.filter((match) => match.status !== "complete"), snapshot).slice(0, 6);
  const plan = getPar3DisplayQualification(snapshot);
  return (
    <section className="par3-broadcast-results">
      <div><span className="par3-broadcast-section-kicker">{completed.length ? "Latest results" : "Results open at tee-off"}</span><div className="par3-broadcast-result-grid">{(completed.length ? completed.slice(0, 12) : upcoming).map((match) => <MatchCard key={match.id} match={match} playersById={playersById} />)}</div></div>
      <aside><Target /><span>{plan.ctpPurpose === "bye" ? "Finals path" : "Qualification path"}</span><strong>{getPar3DisplayFinalistCount(snapshot)} finalists</strong><p>{getPar3QualificationDescription(snapshot)}</p></aside>
    </section>
  );
}

function BracketBoard({ snapshot, pools, pageIndex = 0 }: { snapshot: Par3Snapshot; pools: Par3PoolView[]; pageIndex?: number }) {
  const rounds = getPar3KnockoutRounds(snapshot.event.knockoutData, snapshot.event);
  const bracketTemplate = getPar3DisplayFinalsTemplate(snapshot);
  const poolsLocked = getPar3QualificationPlan(snapshot).errors.length === 0 && pools.every(isPar3PoolComplete);
  const stages = getPar3FinalsStages(snapshot.event);

  if (rounds.length && snapshot.event.knockoutData) {
    const panels = rounds.flatMap((round) => splitPar3DisplayPages(round.matches, 8).map((matches, index) => ({ round, matches, index })));
    const pages = splitPar3DisplayPages(panels, 4);
    const visiblePanels = pages[pageIndex % Math.max(1, pages.length)] ?? [];
    return (
      <section className="par3-broadcast-bracket" style={{ gridTemplateColumns: `repeat(${Math.max(1, visiblePanels.length)}, minmax(0, 1fr))` }}>
        {pages.length > 1 ? <span className="par3-broadcast-page-caption">Finals draw / {pageIndex % pages.length + 1} of {pages.length} / rotates automatically</span> : null}
        {visiblePanels.map(({ round, matches, index }) => (
          <article key={`${String(round.id)}-${index}`}><h2>{round.label}{round.matches.length > 8 ? ` / ${index + 1}` : ""}</h2><small className="par3-course-holes">{stages[round.number - 1]?.shortCourse} / {getPar3StageHoleLabel(stages[round.number - 1])}</small><div>{matches.map((match) => {
            const byePlayer = getPar3DisplayByePlayer(snapshot, round.number, match);
            return <div key={String(match.id)} className={`par3-broadcast-bracket-match${byePlayer ? " is-bye" : ""}`}>{byePlayer ? <><p className="is-winner">{byePlayer}</p><p>{getPar3ByeAdvanceLabel(snapshot)}</p></> : <><p className={match.opponent1?.result === "win" ? "is-winner" : ""}>{getKnockoutParticipantName(snapshot.event.knockoutData!, match.opponent1?.id)}</p><p className={match.opponent2?.result === "win" ? "is-winner" : ""}>{getKnockoutParticipantName(snapshot.event.knockoutData!, match.opponent2?.id)}</p></>}</div>;
          })}</div></article>
        ))}
      </section>
    );
  }

  const firstPanels = splitPar3DisplayPages(bracketTemplate, 8).map((pairings, index) => ({ label: stages[0]?.label ?? "Finals", stage: stages[0], pairings, count: 0, index }));
  const laterPanels = stages.slice(1).flatMap((stage, stageIndex) => {
    const count = getPar3DisplayQualification(snapshot).finalsSize / 2 ** (stageIndex + 2);
    return splitPar3DisplayPages(Array.from({ length: count }), 8).map((chunk, index) => ({ label: stage.label, stage, pairings: [], count: chunk.length, index }));
  });
  const panels = [...firstPanels, ...laterPanels];
  const pages = splitPar3DisplayPages(panels, 4);
  const visiblePanels = pages[pageIndex % Math.max(1, pages.length)] ?? [];
  return (
    <section className="par3-broadcast-bracket is-preview" style={{ gridTemplateColumns: `repeat(${Math.max(1, visiblePanels.length)}, minmax(0, 1fr))` }}>
      {pages.length > 1 ? <span className="par3-broadcast-page-caption">Finals draw / {pageIndex % pages.length + 1} of {pages.length} / rotates automatically</span> : null}
      {visiblePanels.map((panel) => <article key={`${panel.label}-${panel.index}`}><h2>{panel.label}{panel.index ? ` / ${panel.index + 1}` : ""}</h2><small className="par3-course-holes">{panel.stage?.shortCourse} / {getPar3StageHoleLabel(panel.stage)}</small><div>{panel.pairings.map((pairing) => {
        const first = resolvePar3BracketSlot(snapshot, pairing.first);
        const second = resolvePar3BracketSlot(snapshot, pairing.second);
        const isBye = pairing.first.isBye || pairing.second.isBye;
        const byeName = pairing.first.isBye ? (poolsLocked && second ? second.name : pairing.second.label) : (poolsLocked && first ? first.name : pairing.first.label);
        return <div key={pairing.matchNumber} className={`par3-broadcast-bracket-match${isBye ? " is-bye" : ""}`}><span>{isBye ? "Bye" : `M${pairing.matchNumber}`}</span>{isBye ? <><p>{byeName}</p><p>{getPar3ByeAdvanceLabel(snapshot)}</p></> : <><p>{poolsLocked && first ? first.name : pairing.first.label}</p><p>{poolsLocked && second ? second.name : pairing.second.label}</p></>}</div>;
      })}{Array.from({ length: panel.count }, (_, index) => <div key={`waiting-${index}`} className="par3-broadcast-bracket-match is-tbd"><p>Winner TBD</p><p>Winner TBD</p></div>)}</div></article>)}
    </section>
  );
}

type FinalsDisplayMatch = {
  id: string;
  roundNumber: number;
  roundLabel: string;
  course: string;
  matchNumber: number;
  firstName: string;
  secondName: string;
  winnerName: string | null;
  status: "live" | "ready" | "waiting" | "complete" | "bye";
};

function getFinalsCourse(snapshot: Par3Snapshot, roundNumber: number) {
  const stage = getPar3FinalsStages(snapshot.event)[roundNumber - 1];
  return stage ? `${stage.shortCourse} / ${getPar3StageHoleLabel(stage)}` : "Championship course";
}

function normalizeFinalsMatch(
  data: NonNullable<Par3Snapshot["event"]["knockoutData"]>,
  round: Par3KnockoutRound,
  match: Par3KnockoutRound["matches"][number],
  snapshot: Par3Snapshot
): FinalsDisplayMatch {
  const byePlayer = getPar3DisplayByePlayer(snapshot, round.number, match);
  const firstName = getKnockoutParticipantName(data, match.opponent1?.id);
  const secondName = getKnockoutParticipantName(data, match.opponent2?.id);
  const winnerName =
    match.opponent1?.result === "win"
      ? firstName
      : match.opponent2?.result === "win"
        ? secondName
        : null;

  return {
    id: String(match.id),
    roundNumber: round.number,
    roundLabel: round.label,
    course: getFinalsCourse(snapshot, round.number),
    matchNumber: match.number,
    firstName: byePlayer ?? firstName,
    secondName: byePlayer ? getPar3ByeAdvanceLabel(snapshot) : secondName,
    winnerName: byePlayer ? null : winnerName,
    status: byePlayer ? "bye" : winnerName || match.status === PAR3_MATCH_COMPLETED
      ? "complete"
      : match.status === PAR3_MATCH_RUNNING
        ? "live"
        : match.status === PAR3_MATCH_READY
          ? "ready"
          : "waiting",
  };
}

function getFinalsDisplayMatches(snapshot: Par3Snapshot, pools: Par3PoolView[]) {
  const rounds = getPar3KnockoutRounds(snapshot.event.knockoutData, snapshot.event);
  const data = snapshot.event.knockoutData;

  if (rounds.length && data) {
    return rounds.flatMap((round) =>
      round.matches.map((match) => normalizeFinalsMatch(data, round, match, snapshot))
    );
  }

  const poolsLocked = getPar3QualificationPlan(snapshot).errors.length === 0 && pools.every(isPar3PoolComplete);

  return getPar3DisplayFinalsTemplate(snapshot).map((pairing) => {
    const first = resolvePar3BracketSlot(snapshot, pairing.first);
    const second = resolvePar3BracketSlot(snapshot, pairing.second);
    const participantsReady = poolsLocked && first && second;
    const isBye = pairing.first.isBye || pairing.second.isBye;

    return {
      id: `preview-${pairing.matchNumber}`,
      roundNumber: 1,
      roundLabel: getPar3FinalsStages(snapshot.event)[0]?.label ?? "Finals",
      course: getFinalsCourse(snapshot, 1),
      matchNumber: pairing.matchNumber,
      firstName: pairing.first.isBye ? (poolsLocked && second ? second.name : pairing.second.label) : (poolsLocked && first ? first.name : pairing.first.label),
      secondName: isBye ? getPar3ByeAdvanceLabel(snapshot) : poolsLocked && second ? second.name : pairing.second.label,
      winnerName: null,
      status: isBye ? "bye" : participantsReady ? "ready" : "waiting",
    } satisfies FinalsDisplayMatch;
  });
}

function FinalsFeaturedMatch({ match }: { match: FinalsDisplayMatch }) {
  return (
    <article className={`par3-finals-featured-match is-${match.status}`}>
      <header>
        <span>{match.roundLabel}</span>
        <strong>Match {match.matchNumber}</strong>
      </header>
      <div className="par3-finals-featured-players">
        <p>{match.firstName}</p>
        <i>vs</i>
        <p>{match.secondName}</p>
      </div>
      <footer>
        <span>{match.course}</span>
        <strong>{match.status === "live" ? "Live now" : match.status === "ready" ? "Ready to start" : "Draw preview"}</strong>
      </footer>
    </article>
  );
}

function FinalsCentreBoard({ snapshot, pools }: { snapshot: Par3Snapshot; pools: Par3PoolView[] }) {
  const matches = getFinalsDisplayMatches(snapshot, pools);
  const byeMatches = matches.filter((match) => match.status === "bye");
  const liveMatches = matches.filter((match) => match.status === "live");
  const readyMatches = matches.filter((match) => match.status === "ready");
  const waitingMatches = matches.filter((match) => match.status === "waiting");
  const completedMatches = matches
    .filter((match) => match.status === "complete")
    .sort((first, second) => second.roundNumber - first.roundNumber || second.matchNumber - first.matchNumber);
  const featuredMatches = (
    liveMatches.length
      ? liveMatches
      : readyMatches.length
        ? readyMatches
        : waitingMatches
  ).slice(0, liveMatches.length ? 2 : 1);
  const featuredIds = new Set(featuredMatches.map((match) => match.id));
  const upcomingMatches = [...readyMatches, ...waitingMatches]
    .filter((match) => !featuredIds.has(match.id))
    .slice(0, byeMatches.length ? 3 : 4);
  const champion = getPar3Champion(snapshot.event.knockoutData);
  const activeRoundNumber = featuredMatches[0]?.roundNumber ?? completedMatches[0]?.roundNumber ?? 1;
  const stages = getPar3FinalsStages(snapshot.event);
  const plan = getPar3DisplayQualification(snapshot);
  const roundTotals = stages.map((_, index) => index === 0 && plan.ctpPurpose === "bye" ? plan.openingMatchCount : plan.finalsSize / 2 ** (index + 1));
  const headline = liveMatches.length
    ? "Playing now"
    : champion
      ? "Champion crowned"
      : readyMatches.length
        ? "Next match ready"
        : "Finals draw preview";

  return (
    <section className="par3-finals-centre">
      <div className={`par3-finals-progress${stages.length > 4 ? " has-many-rounds" : ""}`} aria-label="Finals progress" style={{ gridTemplateColumns: `repeat(${Math.max(1, stages.length)}, minmax(0, 1fr))` }}>
        {stages.map((stage, index) => {
          const roundNumber = index + 1;
          const completed = matches.filter(
            (match) => match.roundNumber === roundNumber && match.status === "complete"
          ).length;
          const isComplete = completed === roundTotals[index];
          const isActive = roundNumber === activeRoundNumber && !champion;

          return (
            <div key={stage.key} className={isComplete || champion ? "is-complete" : isActive ? "is-active" : ""}>
              <span>{stage.stageNumber ? `R${stage.stageNumber}` : String(roundNumber).padStart(2, "0")}</span>
              <p><strong>{stage.label}</strong><small>{stage.shortCourse} / {getPar3StageHoleLabel(stage)}</small></p>
              <b>{isComplete || champion ? "Complete" : isActive ? "Current round" : `${completed}/${roundTotals[index]}`}</b>
            </div>
          );
        })}
      </div>

      <div className="par3-finals-grid">
        <section className="par3-finals-now">
          <div className="par3-finals-panel-heading">
            <span><i className={liveMatches.length ? "is-live" : ""} /> Finals centre</span>
            <h2>{headline}</h2>
            <p>{featuredMatches[0]?.course ?? "The road to one champion"}</p>
          </div>
          {featuredMatches.length ? (
            <div className={`par3-finals-featured-grid ${featuredMatches.length > 1 ? "has-multiple" : ""}`}>
              {featuredMatches.map((match) => <FinalsFeaturedMatch key={match.id} match={match} />)}
            </div>
          ) : champion ? (
            <div className="par3-finals-champion"><Trophy /><span>2026 champion</span><strong>{champion}</strong></div>
          ) : (
            <div className="par3-finals-empty"><Trophy /><strong>Finals bracket is being prepared</strong><span>The draw will appear here automatically.</span></div>
          )}
        </section>

        <aside className="par3-finals-sidebar">
          <section className="par3-finals-list">
            <div className="par3-finals-list-heading"><span>Up next</span><strong>{upcomingMatches.length} fixtures</strong></div>
            <div>
              {byeMatches.map((match) => <article key={`bye-${match.id}`}><header><span>CTP bye</span><b>Automatic advance</b></header><p><strong>{match.firstName}</strong></p><p>{match.secondName}</p></article>)}
              {upcomingMatches.length ? upcomingMatches.map((match) => (
                <article key={match.id}>
                  <header><span>{match.roundLabel}</span><b>M{match.matchNumber}</b></header>
                  <p><strong>{match.firstName}</strong><i>vs</i><strong>{match.secondName}</strong></p>
                </article>
              )) : <p className="par3-finals-list-empty">No further fixtures. The title is on the line.</p>}
            </div>
          </section>

          <section className="par3-finals-list is-results">
            <div className="par3-finals-list-heading"><span>Previous results</span><strong>{completedMatches.length} complete</strong></div>
            <div>
              {completedMatches.length ? completedMatches.slice(0, 4).map((match) => {
                const loserName = match.winnerName === match.firstName ? match.secondName : match.firstName;
                return (
                  <article key={match.id}>
                    <header><span>{match.roundLabel}</span><b>M{match.matchNumber}</b></header>
                    <p><strong className="is-winner"><Check />{match.winnerName}</strong><i>def.</i><strong>{loserName}</strong></p>
                  </article>
                );
              }) : <p className="par3-finals-list-empty">Results will stack here as winners are entered.</p>}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function CourseRoadBoard({ snapshot, pageIndex = 0 }: { snapshot: Par3Snapshot; pageIndex?: number }) {
  const stages = getPar3DisplayCourseStages(snapshot);
  const pages = splitPar3DisplayPages(stages, 8);
  const page = pageIndex % Math.max(1, pages.length);
  const visibleStages = pages[page] ?? [];

  return (
    <section className="par3-broadcast-road">
      {pages.length > 1 ? <span className="par3-broadcast-page-caption">Course stages / {page + 1} of {pages.length} / rotates automatically</span> : null}
      {visibleStages.map((stage, index) => (
        <article key={stage.key}>
          <div className="par3-broadcast-road-photo" aria-hidden="true">
            <Image src={PAR3_COURSE_POSTER_URL} alt="" width={1122} height={1402} loading="eager" />
          </div>
          <span>{stage.stageNumber ? `R${stage.stageNumber}` : String(page * 8 + index + 1).padStart(2, "0")}</span>
          <div className="par3-broadcast-road-copy"><small>{stage.label}</small><strong>{stage.course}</strong><small>{getPar3StageHoleLabel(stage)}</small></div>
          {index < stages.length - 1 ? <ArrowRight /> : <Trophy />}
        </article>
      ))}
    </section>
  );
}

function LiveBoard({ snapshot, pools, playersById }: { snapshot: Par3Snapshot; pools: Par3PoolView[]; playersById: PlayerMap }) {
  const live = sortPoolMatchesByPlayOrder(snapshot.poolMatches.filter((match) => match.status === "live"), snapshot);
  const scheduled = sortPoolMatchesByPlayOrder(snapshot.poolMatches.filter((match) => match.status === "scheduled"), snapshot);
  const featured = (live.length ? live : scheduled).slice(0, 6);
  const ctpContestants = getPar3CtpContestants(snapshot);
  const poolOrderConfirmed = isPar3DisplayPoolOrderConfirmed(snapshot);
  const ctpWinner = poolOrderConfirmed ? getPar3CtpWinner(snapshot) : null;
  const plan = getPar3DisplayQualification(snapshot);
  return (
    <section className="par3-broadcast-live-board">
      <div><span className="par3-broadcast-section-kicker">{live.length ? "On course now" : "Next fixtures"}</span><div className="par3-broadcast-live-grid">{featured.map((match) => <MatchCard key={match.id} match={match} playersById={playersById} />)}</div></div>
      <aside><Target /><span>{plan.ctpPurpose === "bye" ? "Pool winners / CTP bye" : plan.ctpQualifierCount ? "CTP field" : "Qualification"}</span><strong>{ctpWinner?.name ?? (plan.ctpQualifierCount ? `${ctpContestants.length || pools.length} players` : `${plan.finalsSize} finalists`)}</strong><p>{ctpWinner ? (plan.ctpPurpose === "bye" ? getPar3ByeAdvanceLabel(snapshot) : "Top CTP qualifier") : getPar3QualificationDescription(snapshot)}{!poolOrderConfirmed && plan.ctpQualifierCount ? " CTP field provisional until pool results are confirmed." : ""}</p></aside>
    </section>
  );
}

function SimulatorBoard({
  snapshot,
  playersById,
}: {
  snapshot: Par3Snapshot;
  playersById: PlayerMap;
}) {
  const queues = getPar3SimulatorQueues(snapshot);

  return (
    <section className="par3-broadcast-simulators">
      {queues.map((queue) => (
        <article key={queue.simulatorNumber}>
          <header>
            <span>Simulator</span>
            <strong>{queue.simulatorNumber}</strong>
          </header>
          <BroadcastSimulatorCall
            label="Now playing"
            match={queue.current}
            playersById={playersById}
            current
          />
          <BroadcastSimulatorCall
            label="Up next"
            match={queue.upNext}
            playersById={playersById}
          />
          <footer>
            <MonitorPlay />
            {queue.queued.length > 1
              ? `${queue.queued.length - 1} further fixtures queued`
              : "No further fixtures queued"}
          </footer>
        </article>
      ))}
    </section>
  );
}

function BroadcastSimulatorCall({
  label,
  match,
  playersById,
  current = false,
}: {
  label: string;
  match: Par3PoolMatch | null;
  playersById: PlayerMap;
  current?: boolean;
}) {
  const stage = match
    ? getPoolStage(match.matchNumber, Math.max(2, [...playersById.values()].filter((player) => !player.isWithdrawn && player.poolNumber === match.poolNumber).length))
    : null;

  return (
    <div className={`par3-broadcast-simulator-call${current ? " is-current" : ""}`}>
      <span>{label}</span>
      {match ? (
        <>
          <p>{playersById.get(match.player1Id)?.name ?? "TBD"}</p>
          <i>vs</i>
          <p>{playersById.get(match.player2Id)?.name ?? "TBD"}</p>
          <small>
            Pool {String.fromCharCode(64 + match.poolNumber)} / {stage?.shortCourse}{stage ? ` / ${getPar3StageHoleLabel(stage)}` : ""}
          </small>
        </>
      ) : (
        <strong>Awaiting allocation</strong>
      )}
    </div>
  );
}

function ChampionshipStage({
  snapshot,
  mode,
}: {
  snapshot: Par3Snapshot;
  mode: "thumbnail" | "starting";
}) {
  const activePlayers = snapshot.players.filter(
    (player) => !player.isWithdrawn
  ).length;
  const remaining = Math.max(0, snapshot.event.maxPlayers - activePlayers);

  return (
    <section className={`par3-championship-stage is-${mode}`}>
      <div className="par3-stage-shine" aria-hidden="true" />
      <div className="par3-stage-brand">
        <div className="par3-stage-logo">
          <b aria-hidden="true">II</b>
          <Image
            src="/par3/par3-logo.png"
            alt="CGS Par 3"
            width={330}
            height={330}
            priority
          />
        </div>
        <span>CGS Par 3</span>
        <h1>Championship <i>II</i></h1>
        <p>{mode === "starting" ? "Starting soon" : "Live championship coverage"}</p>
      </div>
      <div className="par3-stage-details">
        <span><CalendarDays /> Saturday 7 November</span>
        <span><Clock3 /> 5:00pm start</span>
        <span><MapPin /> The Tee Lounge</span>
      </div>
      <div className="par3-stage-format">
        <strong>{snapshot.event.maxPlayers} players</strong><i />
        <strong>{snapshot.event.poolCount} pools</strong><i />
        <strong>1 champion</strong>
      </div>
      {mode === "starting" ? (
        <div className="par3-stage-live-cue"><Radio /> The stream will begin shortly</div>
      ) : (
        <div className="par3-stage-live-cue">
          <Radio /> {remaining === 0 ? "Field locked" : `${remaining} places remaining`}
        </div>
      )}
      <TeeLoungeMark />
    </section>
  );
}

function SponsorBoard() {
  const sponsors = [
    {
      name: "The Tee Lounge",
      role: "Host venue",
      detail: "Premium golf simulators / Underwood",
      src: "/scoreboard/tee-lounge-logo.png",
      width: 520,
      height: 260,
      type: "host",
    },
    {
      name: "Crossodog Golf Society",
      role: "Presented live by",
      detail: "Good players. Great company.",
      src: "/cgs-logo.png",
      width: 360,
      height: 360,
      type: "broadcast",
    },
    {
      name: "Royal & Awesome",
      role: "Prize sponsor",
      detail: "Championship II prize partner",
      src: "/par3/sponsors/royal-and-awesome.jpg",
      width: 556,
      height: 235,
      type: "prize",
    },
    {
      name: "Range Ratz",
      role: "Prize sponsor",
      detail: "Championship II prize partner",
      src: "/par3/sponsors/range-ratz.jpg",
      width: 872,
      height: 1307,
      type: "prize",
    },
  ] as const;

  return (
    <section className="par3-broadcast-sponsors">
      <div className="par3-broadcast-sponsor-intro">
        <span>Championship II partners</span>
        <strong>Hosted. Broadcast. Prizes.</strong>
        <p>Thank you to the partners backing the championship.</p>
      </div>
      <div className="par3-broadcast-sponsor-grid">
        {sponsors.map((sponsor) => (
          <article
            key={sponsor.name}
            className={`par3-broadcast-sponsor-card is-${sponsor.type}`}
          >
            <span>{sponsor.role}</span>
            <div className="par3-broadcast-sponsor-logo">
              <Image
                src={sponsor.src}
                alt={sponsor.name}
                width={sponsor.width}
                height={sponsor.height}
              />
            </div>
            <h3>{sponsor.name}</h3>
            <p>{sponsor.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function WinnerBoard({ champion }: { champion: string | null }) {
  return (
    <section className="par3-broadcast-winner">
      <Trophy />
      <span>CGS Par 3 Championship II</span>
      <h2>{champion ?? "Champion to be crowned"}</h2>
      <p>{champion ? "2026 champion" : "The road to the title starts Saturday 7 November"}</p>
      <div><strong>One field.</strong><strong>One final.</strong><strong>One champion.</strong></div>
    </section>
  );
}

function BroadcastFooter({ snapshot, slide, total }: { snapshot: Par3Snapshot; slide?: number; total?: number }) {
  return <footer className="par3-broadcast-footer"><span><i className={snapshot.event.isLive ? "is-live" : ""} /> {snapshot.event.statusLabel}</span><strong>Small course. Bigger competition.</strong>{typeof slide === "number" && total ? <div>{Array.from({ length: total }, (_, index) => <i key={index} className={index === slide ? "is-active" : ""} />)}</div> : <span>crossodoggolf.com</span>}</footer>;
}

export default function Par3StreamAsset({ initialSnapshot, view }: AssetProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [slideIndex, setSlideIndex] = useState(0);
  const playersById = new Map(snapshot.players.map((player) => [player.id, player]));
  const pools = buildPar3Pools(snapshot);
  const champion = getPar3Champion(snapshot.event.knockoutData);

  async function refresh() {
    try {
      const response = await fetch("/api/par3-showdown", { cache: "no-store" });
      if (!response.ok) return;
      const next = (await response.json()) as Par3Snapshot;
      startTransition(() => setSnapshot(next));
    } catch (error) {
      console.error("Par 3 stream refresh error:", error);
    }
  }

  const handleRefresh = useEffectEvent(async () => refresh());

  useEffect(() => {
    const pollingInterval = window.setInterval(() => void handleRefresh(), 5_000);
    const supabase = getSupabaseBrowserClient();
    if (!supabase || snapshot.event.id === 0) return () => window.clearInterval(pollingInterval);
    const channel = supabase.channel(`par3-broadcast:${snapshot.event.id}:${view}`).on("postgres_changes", { event: "*", schema: "public", table: "cgs_par3_events", filter: `id=eq.${snapshot.event.id}` }, () => void handleRefresh()).on("postgres_changes", { event: "*", schema: "public", table: "cgs_par3_players", filter: `event_id=eq.${snapshot.event.id}` }, () => void handleRefresh()).on("postgres_changes", { event: "*", schema: "public", table: "cgs_par3_pool_matches", filter: `event_id=eq.${snapshot.event.id}` }, () => void handleRefresh()).subscribe();
    return () => { window.clearInterval(pollingInterval); void supabase.removeChannel(channel); };
  }, [snapshot.event.id, view]);

  useEffect(() => {
    if (["banner", "thumbnail", "starting"].includes(view)) return;
    const interval = window.setInterval(() => setSlideIndex((current) => current + 1), view === "tv" ? 10_000 : 8_000);
    return () => window.clearInterval(interval);
  }, [view]);

  if (view === "thumbnail" || view === "starting") {
    return <ChampionshipStage snapshot={snapshot} mode={view} />;
  }

  if (view === "banner") {
    const live = sortPoolMatchesByPlayOrder(snapshot.poolMatches.filter((match) => match.status === "live"), snapshot);
    const scheduled = sortPoolMatchesByPlayOrder(snapshot.poolMatches.filter((match) => match.status === "scheduled"), snapshot);
    return <section className="par3-broadcast-banner"><div className="par3-broadcast-banner-brand"><div className="par3-broadcast-logo-v2"><i aria-hidden="true">II</i><Image src="/par3/par3-logo.png" alt="CGS Par 3" width={112} height={112} priority /></div><div><span>CGS Championship II</span><strong>Par 3 Live</strong></div></div><div className="par3-broadcast-banner-fixtures">{(live.length ? live : scheduled).slice(0, 3).map((match) => <MatchCard key={match.id} match={match} playersById={playersById} compact />)}</div><div className="par3-broadcast-banner-end"><TeeLoungeMark /><span><i className={snapshot.event.isLive ? "is-live" : ""} /> {snapshot.event.statusLabel}</span></div></section>;
  }

  if (view === "portrait") {
    const ctpContestants = getPar3CtpContestants(snapshot);
    const ctpPages = splitPar3DisplayPages(ctpContestants, 8);
    const plan = getPar3DisplayQualification(snapshot);
    const ctpStage = getPar3CtpStage();
    const slides = ["up-next", "live", ...pools.map((pool) => `pool-${pool.number}`), ...ctpPages.map((_, index) => `ctp-${index}`), "bracket", "sponsors"];
    const normalized = slideIndex % slides.length;
    const active = slides[normalized];
    const activePool = active.startsWith("pool-") ? pools.find((pool) => `pool-${pool.number}` === active) : null;
    return <section className="par3-broadcast-portrait"><BroadcastHeader eyebrow="CGS live" title="Par 3 Championship II" detail={snapshot.event.statusLabel} /><div className="par3-broadcast-portrait-body" key={active}>{active === "up-next" ? <SimulatorBoard snapshot={snapshot} playersById={playersById} /> : null}{active === "live" ? <LiveBoard snapshot={snapshot} pools={pools} playersById={playersById} /> : null}{activePool ? <StandingsBoard pools={[activePool]} snapshot={snapshot} /> : null}{active.startsWith("ctp-") ? <section className="par3-broadcast-portrait-ctp"><Target /><span>{plan.ctpPurpose === "bye" ? "Pool winners / finals bye CTP" : "Closest to pin"}</span><h2>{ctpStage.course} / {getPar3StageHoleLabel(ctpStage)}</h2>{!isPar3DisplayPoolOrderConfirmed(snapshot) ? <p><strong>Provisional pool positions</strong></p> : null}{(ctpPages[Number(active.slice(4))] ?? []).map((standing) => <p key={standing.player.id}><strong>{standing.player.name}</strong><small>Pool {String.fromCharCode(64 + (standing.player.poolNumber ?? 1))}{standing.player.ctpDistanceCm !== null ? ` / ${formatDistance(standing.player.ctpDistanceCm)}` : ""}</small></p>)}</section> : null}{active === "bracket" ? <section className="par3-broadcast-portrait-final"><Trophy /><span>Road to the title</span><h2>{champion ?? `${getPar3DisplayFinalistCount(snapshot)} enter. One remains.`}</h2><p>{getPar3FinalsStages(snapshot.event).map((stage) => stage.label).join(" · ")}</p></section> : null}{active === "sponsors" ? <SponsorBoard /> : null}</div><BroadcastFooter snapshot={snapshot} slide={normalized} total={slides.length} /></section>;
  }

  const activeTvSlide = TV_SLIDES[slideIndex % TV_SLIDES.length];
  const resolvedView = view === "tv" ? activeTvSlide : view;
  const titles: Record<string, [string, string, string]> = {
    live: ["Tournament centre", "Live fixtures", getPar3DisplayQualification(snapshot).ctpPurpose === "bye" ? "Everyone advances · pool winners contest the finals bye" : "Current matches and the road to qualification"],
    "up-next": ["Simulator desk", "Up next", "Now playing and the next call for every simulator"],
    standings: ["Pool stage", "Table positions", getPar3QualificationDescription(snapshot)],
    pools: ["Pool stage", "Current standings", `${snapshot.event.poolCount} pools · ${snapshot.event.maxPlayers} places`],
    fixtures: ["Pool draw", "Every fixture", `${getPar3DisplayPoolStages(snapshot).length} rounds · ${snapshot.event.poolCount} pools · ${snapshot.poolMatches.length} fixtures`],
    results: ["Match centre", "Latest results", "Winners, completed fixtures, and what comes next"],
    bracket: ["Road to the title", "Finals bracket", `${getPar3DisplayFinalistCount(snapshot)} players · single elimination · one champion`],
    finals: ["Knockout stage", "Finals live centre", "Playing now · previous results · upcoming fixtures"],
    road: ["Course draw", `${getPar3DisplayCourseStages(snapshot).length} stages`, "Course allocation for every round"],
    sponsors: ["Championship partners", "Proudly supported by", "Host venue, broadcast partner and official prize sponsors"],
    winner: ["Championship II", "Winner", "One field · one final · one champion"],
  };
  const pageIndex = view === "tv" ? Math.floor(slideIndex / TV_SLIDES.length) : slideIndex;
  const [eyebrow, title, detail] = titles[resolvedView] ?? titles.live;

  return (
    <section className={`par3-broadcast-canvas is-${view}`}>
      {view === "tv" ? <Image className="par3-broadcast-course-preload" src={PAR3_COURSE_POSTER_URL} alt="" width={1122} height={1402} loading="eager" /> : null}
      <BroadcastHeader eyebrow={eyebrow} title={title} detail={detail} />
      <main className="par3-broadcast-body" key={resolvedView}>
        {resolvedView === "live" ? <LiveBoard snapshot={snapshot} pools={pools} playersById={playersById} /> : null}
        {resolvedView === "up-next" ? <SimulatorBoard snapshot={snapshot} playersById={playersById} /> : null}
        {resolvedView === "standings" || resolvedView === "pools" ? <StandingsBoard pools={pools} snapshot={snapshot} pageIndex={pageIndex} /> : null}
        {resolvedView === "fixtures" ? <FixturesBoard snapshot={snapshot} playersById={playersById} pageIndex={pageIndex} /> : null}
        {resolvedView === "results" ? <ResultsBoard snapshot={snapshot} playersById={playersById} /> : null}
        {resolvedView === "bracket" ? <BracketBoard snapshot={snapshot} pools={pools} pageIndex={pageIndex} /> : null}
        {resolvedView === "finals" ? <FinalsCentreBoard snapshot={snapshot} pools={pools} /> : null}
        {resolvedView === "road" ? <CourseRoadBoard snapshot={snapshot} pageIndex={pageIndex} /> : null}
        {resolvedView === "sponsors" ? <SponsorBoard /> : null}
        {resolvedView === "winner" ? <WinnerBoard champion={champion} /> : null}
      </main>
      <BroadcastFooter snapshot={snapshot} slide={view === "tv" ? slideIndex % TV_SLIDES.length : undefined} total={view === "tv" ? TV_SLIDES.length : undefined} />
    </section>
  );
}

function ordinal(position: number) {
  if (position === 1) return "1st";
  if (position === 2) return "2nd";
  if (position === 3) return "3rd";
  return `${position}th`;
}

function formatDistance(distanceCm: number) {
  if (distanceCm < 100) {
    return `${distanceCm}cm`;
  }

  return `${(distanceCm / 100).toFixed(2)}m`;
}
