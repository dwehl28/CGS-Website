"use client";

import Image from "next/image";
import { startTransition, useEffect, useEffectEvent, useState } from "react";
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
  PAR3_FINALS_STAGES,
  PAR3_MATCH_COMPLETED,
  PAR3_MATCH_READY,
  PAR3_MATCH_RUNNING,
  PAR3_POOL_STAGES,
  buildPar3Pools,
  getPar3AutomaticQualifyingPlaces,
  getKnockoutParticipantName,
  getPar3Champion,
  getPar3CtpContestants,
  getPar3CtpPoolPosition,
  getPar3CtpQualifierCount,
  getPar3CtpWinner,
  getPar3KnockoutRounds,
  getPar3RoundOf16Template,
  getPar3SimulatorQueues,
  getPoolMatchRound,
  resolvePar3BracketSlot,
  type Par3PoolMatch,
  type Par3KnockoutRound,
  type Par3PoolView,
  type Par3Snapshot,
  type Par3StreamView,
} from "@/lib/par3-showdown-types";
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

function sortPoolMatchesByPlayOrder(matches: Par3PoolMatch[]) {
  return matches.slice().sort((first, second) => {
    const roundDifference = getPoolMatchRound(first.matchNumber) - getPoolMatchRound(second.matchNumber);
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
  const stage = PAR3_POOL_STAGES[getPoolMatchRound(match.matchNumber) - 1];

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
  poolCount,
}: {
  pools: Par3PoolView[];
  poolCount: number;
}) {
  const automaticPlaces = getPar3AutomaticQualifyingPlaces(poolCount);
  const ctpPosition = getPar3CtpPoolPosition(poolCount);

  return (
    <section className="par3-broadcast-standings">
      {pools.map((pool) => (
        <article key={pool.number}>
          <div className="par3-broadcast-pool-title"><span>Pool</span><strong>{String.fromCharCode(64 + pool.number)}</strong></div>
          <div className="par3-broadcast-standing-head"><span>Pos</span><span>Player</span><span>P</span><span>W</span></div>
          {pool.standings.map((standing) => (
            <div key={standing.player.id} className={`par3-broadcast-standing-row ${standing.position <= automaticPlaces ? "is-qualified" : standing.position === ctpPosition ? "is-ctp" : ""}`}>
              <span>{standing.position}</span><strong>{standing.player.name}</strong><span>{standing.played}</span><b>{standing.wins}</b>
            </div>
          ))}
          <footer><span>Top {automaticPlaces} qualify</span><span>{ordinal(ctpPosition)} to CTP</span></footer>
        </article>
      ))}
    </section>
  );
}

function FixturesBoard({ snapshot, playersById }: { snapshot: Par3Snapshot; playersById: PlayerMap }) {
  return (
    <section className="par3-broadcast-fixture-rounds">
      {PAR3_POOL_STAGES.map((stage, index) => {
        const matches = snapshot.poolMatches.filter((match) => getPoolMatchRound(match.matchNumber) === index + 1);
        return (
          <article key={stage.key}>
            <div className="par3-broadcast-round-title"><span>{stage.label}</span><strong>{stage.course}</strong><small>{matches.filter((match) => match.status === "complete").length}/{matches.length || snapshot.event.poolCount * 2} complete</small></div>
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
  const upcoming = sortPoolMatchesByPlayOrder(snapshot.poolMatches.filter((match) => match.status !== "complete")).slice(0, 6);
  const automaticPlaces = getPar3AutomaticQualifyingPlaces(snapshot.event.poolCount);
  const ctpPosition = getPar3CtpPoolPosition(snapshot.event.poolCount);
  const ctpPlaces = getPar3CtpQualifierCount(snapshot.event.poolCount);
  return (
    <section className="par3-broadcast-results">
      <div><span className="par3-broadcast-section-kicker">{completed.length ? "Latest results" : "Results open at tee-off"}</span><div className="par3-broadcast-result-grid">{(completed.length ? completed.slice(0, 12) : upcoming).map((match) => <MatchCard key={match.id} match={match} playersById={playersById} />)}</div></div>
      <aside><Target /><span>Qualification path</span><strong>{automaticPlaces * snapshot.event.poolCount} + {ctpPlaces}</strong><p>Top {automaticPlaces} in every pool qualify. All {ordinal(ctpPosition)}-place players fight for {ctpPlaces} final bracket spots.</p></aside>
    </section>
  );
}

function BracketBoard({ snapshot, pools }: { snapshot: Par3Snapshot; pools: Par3PoolView[] }) {
  const rounds = getPar3KnockoutRounds(snapshot.event.knockoutData);
  const bracketTemplate = getPar3RoundOf16Template(snapshot.event.poolCount);
  const poolsLocked = pools.every((pool) => pool.matches.filter((match) => match.winnerId !== null).length === 6 || pool.standings.every((standing) => standing.player.poolRankOverride !== null));

  if (rounds.length && snapshot.event.knockoutData) {
    return (
      <section className="par3-broadcast-bracket">
        {rounds.map((round) => (
          <article key={String(round.id)}><h2>{round.label}</h2><div>{round.matches.map((match) => (
            <div key={String(match.id)} className="par3-broadcast-bracket-match"><p className={match.opponent1?.result === "win" ? "is-winner" : ""}>{getKnockoutParticipantName(snapshot.event.knockoutData!, match.opponent1?.id)}</p><p className={match.opponent2?.result === "win" ? "is-winner" : ""}>{getKnockoutParticipantName(snapshot.event.knockoutData!, match.opponent2?.id)}</p></div>
          ))}</div></article>
        ))}
      </section>
    );
  }

  return (
    <section className="par3-broadcast-bracket is-preview">
      <article><h2>Round of 16</h2><div>{bracketTemplate.map((pairing) => {
        const first = resolvePar3BracketSlot(snapshot, pairing.first);
        const second = resolvePar3BracketSlot(snapshot, pairing.second);
        return <div key={pairing.matchNumber} className="par3-broadcast-bracket-match"><span>M{pairing.matchNumber}</span><p>{poolsLocked && first ? first.name : pairing.first.label}</p><p>{poolsLocked && second ? second.name : pairing.second.label}</p></div>;
      })}</div></article>
      {["Quarter Finals", "Semi Finals", "Grand Final"].map((label, index) => <article key={label}><h2>{label}</h2><div>{Array.from({ length: 4 / 2 ** index }, (_, matchIndex) => <div key={matchIndex} className="par3-broadcast-bracket-match is-tbd"><p>Winner TBD</p><p>Winner TBD</p></div>)}</div></article>)}
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
  status: "live" | "ready" | "waiting" | "complete";
};

function getFinalsCourse(roundNumber: number) {
  return PAR3_FINALS_STAGES[roundNumber]?.shortCourse ?? "Championship course";
}

function normalizeFinalsMatch(
  data: NonNullable<Par3Snapshot["event"]["knockoutData"]>,
  round: Par3KnockoutRound,
  match: Par3KnockoutRound["matches"][number]
): FinalsDisplayMatch {
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
    course: getFinalsCourse(round.number),
    matchNumber: match.number,
    firstName,
    secondName,
    winnerName,
    status: winnerName || match.status === PAR3_MATCH_COMPLETED
      ? "complete"
      : match.status === PAR3_MATCH_RUNNING
        ? "live"
        : match.status === PAR3_MATCH_READY
          ? "ready"
          : "waiting",
  };
}

function getFinalsDisplayMatches(snapshot: Par3Snapshot, pools: Par3PoolView[]) {
  const rounds = getPar3KnockoutRounds(snapshot.event.knockoutData);
  const data = snapshot.event.knockoutData;

  if (rounds.length && data) {
    return rounds.flatMap((round) =>
      round.matches.map((match) => normalizeFinalsMatch(data, round, match))
    );
  }

  const poolsLocked = pools.every(
    (pool) =>
      pool.matches.filter((match) => match.winnerId !== null).length === 6 ||
      pool.standings.every((standing) => standing.player.poolRankOverride !== null)
  );

  return getPar3RoundOf16Template(snapshot.event.poolCount).map((pairing) => {
    const first = resolvePar3BracketSlot(snapshot, pairing.first);
    const second = resolvePar3BracketSlot(snapshot, pairing.second);
    const participantsReady = poolsLocked && first && second;

    return {
      id: `preview-${pairing.matchNumber}`,
      roundNumber: 1,
      roundLabel: "Round of 16",
      course: getFinalsCourse(1),
      matchNumber: pairing.matchNumber,
      firstName: poolsLocked && first ? first.name : pairing.first.label,
      secondName: poolsLocked && second ? second.name : pairing.second.label,
      winnerName: null,
      status: participantsReady ? "ready" : "waiting",
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
    .slice(0, 4);
  const champion = getPar3Champion(snapshot.event.knockoutData);
  const activeRoundNumber = featuredMatches[0]?.roundNumber ?? completedMatches[0]?.roundNumber ?? 1;
  const roundTotals = [8, 4, 2, 1];
  const headline = liveMatches.length
    ? "Playing now"
    : champion
      ? "Champion crowned"
      : readyMatches.length
        ? "Next match ready"
        : "Finals draw preview";

  return (
    <section className="par3-finals-centre">
      <div className="par3-finals-progress" aria-label="Finals progress">
        {PAR3_FINALS_STAGES.slice(1).map((stage, index) => {
          const roundNumber = index + 1;
          const completed = matches.filter(
            (match) => match.roundNumber === roundNumber && match.status === "complete"
          ).length;
          const isComplete = completed === roundTotals[index];
          const isActive = roundNumber === activeRoundNumber && !champion;

          return (
            <div key={stage.key} className={isComplete || champion ? "is-complete" : isActive ? "is-active" : ""}>
              <span>{String(roundNumber).padStart(2, "0")}</span>
              <p><strong>{stage.label}</strong><small>{stage.shortCourse}</small></p>
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

function CourseRoadBoard() {
  const stages = [...PAR3_POOL_STAGES, ...PAR3_FINALS_STAGES];

  return (
    <section className="par3-broadcast-road">
      {stages.map((stage, index) => (
        <article key={stage.key}>
          <div className="par3-broadcast-road-photo" aria-hidden="true">
            <Image src="/par3/par3-course-draw.png" alt="" width={1122} height={1402} loading="eager" />
          </div>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div className="par3-broadcast-road-copy"><small>{stage.label}</small><strong>{stage.course}</strong></div>
          {index < stages.length - 1 ? <ArrowRight /> : <Trophy />}
        </article>
      ))}
    </section>
  );
}

function LiveBoard({ snapshot, pools, playersById }: { snapshot: Par3Snapshot; pools: Par3PoolView[]; playersById: PlayerMap }) {
  const live = sortPoolMatchesByPlayOrder(snapshot.poolMatches.filter((match) => match.status === "live"));
  const scheduled = sortPoolMatchesByPlayOrder(snapshot.poolMatches.filter((match) => match.status === "scheduled"));
  const featured = (live.length ? live : scheduled).slice(0, 6);
  const ctpContestants = getPar3CtpContestants(snapshot);
  const ctpWinner = getPar3CtpWinner(snapshot);
  const ctpPosition = getPar3CtpPoolPosition(snapshot.event.poolCount);
  const ctpPlaces = getPar3CtpQualifierCount(snapshot.event.poolCount);
  return (
    <section className="par3-broadcast-live-board">
      <div><span className="par3-broadcast-section-kicker">{live.length ? "On course now" : "Next fixtures"}</span><div className="par3-broadcast-live-grid">{featured.map((match) => <MatchCard key={match.id} match={match} playersById={playersById} />)}</div></div>
      <aside><Target /><span>CTP field</span><strong>{ctpWinner?.name ?? `${ctpContestants.length || pools.length} players`}</strong><p>{ctpWinner ? "Top CTP qualifier" : `${ordinal(ctpPosition)}-place players compete for ${ctpPlaces} bracket spots`}</p></aside>
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
    ? PAR3_POOL_STAGES[getPoolMatchRound(match.matchNumber) - 1]
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
            Pool {String.fromCharCode(64 + match.poolNumber)} / {stage?.shortCourse}
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
        <strong>24 players</strong><i />
        <strong>6 pools</strong><i />
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
  return (
    <section className="par3-broadcast-sponsors">
      <div>
        <span>Championship II is proudly hosted by</span>
        <Image
          src="/scoreboard/tee-lounge-logo.png"
          alt="The Tee Lounge"
          width={520}
          height={260}
        />
        <p>Premium golf simulators / Underwood</p>
      </div>
      <i aria-hidden="true">+</i>
      <div>
        <span>Presented live by</span>
        <Image
          src="/cgs-logo.png"
          alt="Crossodog Golf Society"
          width={360}
          height={360}
        />
        <p>Good players. Great company.</p>
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
    if (view !== "tv" && view !== "portrait") return;
    const interval = window.setInterval(() => setSlideIndex((current) => current + 1), view === "tv" ? 10_000 : 8_000);
    return () => window.clearInterval(interval);
  }, [view]);

  if (view === "thumbnail" || view === "starting") {
    return <ChampionshipStage snapshot={snapshot} mode={view} />;
  }

  if (view === "banner") {
    const live = sortPoolMatchesByPlayOrder(snapshot.poolMatches.filter((match) => match.status === "live"));
    const scheduled = sortPoolMatchesByPlayOrder(snapshot.poolMatches.filter((match) => match.status === "scheduled"));
    return <section className="par3-broadcast-banner"><div className="par3-broadcast-banner-brand"><div className="par3-broadcast-logo-v2"><i aria-hidden="true">II</i><Image src="/par3/par3-logo.png" alt="CGS Par 3" width={112} height={112} priority /></div><div><span>CGS Championship II</span><strong>Par 3 Live</strong></div></div><div className="par3-broadcast-banner-fixtures">{(live.length ? live : scheduled).slice(0, 3).map((match) => <MatchCard key={match.id} match={match} playersById={playersById} compact />)}</div><div className="par3-broadcast-banner-end"><TeeLoungeMark /><span><i className={snapshot.event.isLive ? "is-live" : ""} /> {snapshot.event.statusLabel}</span></div></section>;
  }

  if (view === "portrait") {
    const slides = ["up-next", "live", ...pools.map((pool) => `pool-${pool.number}`), "ctp", "bracket", "sponsors"];
    const normalized = slideIndex % slides.length;
    const active = slides[normalized];
    const activePool = active.startsWith("pool-") ? pools.find((pool) => `pool-${pool.number}` === active) : null;
    const ctpContestants = getPar3CtpContestants(snapshot);
    return <section className="par3-broadcast-portrait"><BroadcastHeader eyebrow="CGS live" title="Par 3 Championship II" detail={snapshot.event.statusLabel} /><div className="par3-broadcast-portrait-body" key={active}>{active === "up-next" ? <SimulatorBoard snapshot={snapshot} playersById={playersById} /> : null}{active === "live" ? <LiveBoard snapshot={snapshot} pools={pools} playersById={playersById} /> : null}{activePool ? <StandingsBoard pools={[activePool]} poolCount={snapshot.event.poolCount} /> : null}{active === "ctp" ? <section className="par3-broadcast-portrait-ctp"><Target /><span>Closest to pin</span><h2>Pebble Beach 7</h2>{ctpContestants.map((standing) => <p key={standing.player.id}><strong>{standing.player.name}</strong><small>Pool {String.fromCharCode(64 + (standing.player.poolNumber ?? 1))}{standing.player.ctpDistanceCm !== null ? ` / ${formatDistance(standing.player.ctpDistanceCm)}` : ""}</small></p>)}</section> : null}{active === "bracket" ? <section className="par3-broadcast-portrait-final"><Trophy /><span>Road to the title</span><h2>{champion ?? "16 enter. One remains."}</h2><p>Round of 16 · Quarter Finals · Semi Finals · Grand Final</p></section> : null}{active === "sponsors" ? <SponsorBoard /> : null}</div><BroadcastFooter snapshot={snapshot} slide={normalized} total={slides.length} /></section>;
  }

  const activeTvSlide = TV_SLIDES[slideIndex % TV_SLIDES.length];
  const resolvedView = view === "tv" ? activeTvSlide : view;
  const titles: Record<string, [string, string, string]> = {
    live: ["Tournament centre", "Live fixtures", "Current matches and the road to qualification"],
    "up-next": ["Simulator desk", "Up next", "Now playing and the next call for every simulator"],
    standings: ["Pool stage", "Table positions", "Top two qualify · third heads to the CTP playoff"],
    pools: ["Pool stage", "Current standings", "Six pools · four players · two automatic qualifiers"],
    fixtures: ["Pool draw", "Every fixture", "Three rounds · six pools · thirty-six matches"],
    results: ["Match centre", "Latest results", "Winners, completed fixtures, and what comes next"],
    bracket: ["Road to the title", "Finals bracket", "Sixteen players · single elimination · one champion"],
    finals: ["Knockout stage", "Finals live centre", "Playing now · previous results · upcoming fixtures"],
    road: ["Course draw", "Eight stages", "A new virtual course test in every round"],
    sponsors: ["Championship partners", "Proudly presented by", "The Tee Lounge and Crossodog Golf Society"],
    winner: ["Championship II", "Winner", "One field · one final · one champion"],
  };
  const [eyebrow, title, detail] = titles[resolvedView] ?? titles.live;

  return (
    <section className={`par3-broadcast-canvas is-${view}`}>
      {view === "tv" ? <Image className="par3-broadcast-course-preload" src="/par3/par3-course-draw.png" alt="" width={1122} height={1402} loading="eager" /> : null}
      <BroadcastHeader eyebrow={eyebrow} title={title} detail={detail} />
      <main className="par3-broadcast-body" key={resolvedView}>
        {resolvedView === "live" ? <LiveBoard snapshot={snapshot} pools={pools} playersById={playersById} /> : null}
        {resolvedView === "up-next" ? <SimulatorBoard snapshot={snapshot} playersById={playersById} /> : null}
        {resolvedView === "standings" || resolvedView === "pools" ? <StandingsBoard pools={pools} poolCount={snapshot.event.poolCount} /> : null}
        {resolvedView === "fixtures" ? <FixturesBoard snapshot={snapshot} playersById={playersById} /> : null}
        {resolvedView === "results" ? <ResultsBoard snapshot={snapshot} playersById={playersById} /> : null}
        {resolvedView === "bracket" ? <BracketBoard snapshot={snapshot} pools={pools} /> : null}
        {resolvedView === "finals" ? <FinalsCentreBoard snapshot={snapshot} pools={pools} /> : null}
        {resolvedView === "road" ? <CourseRoadBoard /> : null}
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
