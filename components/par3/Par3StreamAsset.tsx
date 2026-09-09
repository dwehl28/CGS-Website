"use client";

import Image from "next/image";
import { startTransition, useEffect, useEffectEvent, useState } from "react";
import { ArrowRight, Check, Target, Trophy } from "lucide-react";

import {
  PAR3_FINALS_STAGES,
  PAR3_POOL_STAGES,
  PAR3_ROUND_OF_16_TEMPLATE,
  buildPar3Pools,
  getKnockoutParticipantName,
  getPar3Champion,
  getPar3CtpContestants,
  getPar3CtpWinner,
  getPar3KnockoutRounds,
  getPoolMatchRound,
  resolvePar3BracketSlot,
  type Par3PoolMatch,
  type Par3PoolView,
  type Par3Snapshot,
  type Par3StreamView,
} from "@/lib/par3-showdown-types";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type AssetProps = { initialSnapshot: Par3Snapshot; view: Par3StreamView };
type PlayerMap = Map<number, Par3Snapshot["players"][number]>;

const TV_SLIDES = ["live", "standings", "fixtures", "results", "bracket", "road"] as const;

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
        <Image src="/par3/par3-logo.png" alt="CGS Par 3" width={118} height={118} priority />
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

function StandingsBoard({ pools }: { pools: Par3PoolView[] }) {
  return (
    <section className="par3-broadcast-standings">
      {pools.map((pool) => (
        <article key={pool.number}>
          <div className="par3-broadcast-pool-title"><span>Pool</span><strong>{String.fromCharCode(64 + pool.number)}</strong></div>
          <div className="par3-broadcast-standing-head"><span>Pos</span><span>Player</span><span>P</span><span>W</span></div>
          {pool.standings.map((standing) => (
            <div key={standing.player.id} className={`par3-broadcast-standing-row ${standing.position <= 3 ? "is-qualified" : "is-ctp"}`}>
              <span>{standing.position}</span><strong>{standing.player.name}</strong><span>{standing.played}</span><b>{standing.wins}</b>
            </div>
          ))}
          <footer><span>Top 3 qualify</span><span>4th to CTP</span></footer>
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
            <div className="par3-broadcast-round-title"><span>{stage.label}</span><strong>{stage.course}</strong><small>{matches.filter((match) => match.status === "complete").length}/10 complete</small></div>
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
  return (
    <section className="par3-broadcast-results">
      <div><span className="par3-broadcast-section-kicker">{completed.length ? "Latest results" : "Results open at tee-off"}</span><div className="par3-broadcast-result-grid">{(completed.length ? completed.slice(0, 12) : upcoming).map((match) => <MatchCard key={match.id} match={match} playersById={playersById} />)}</div></div>
      <aside><Target /><span>Qualification path</span><strong>15 + 1</strong><p>Top three in every pool qualify. Five fourth-place players fight for the final spot on Pebble Beach&apos;s 7th.</p></aside>
    </section>
  );
}

function BracketBoard({ snapshot, pools }: { snapshot: Par3Snapshot; pools: Par3PoolView[] }) {
  const rounds = getPar3KnockoutRounds(snapshot.event.knockoutData);
  const ctpWinner = getPar3CtpWinner(snapshot);
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
      <article><h2>Round of 16</h2><div>{PAR3_ROUND_OF_16_TEMPLATE.map((pairing) => {
        const first = resolvePar3BracketSlot(snapshot, pairing.first);
        const second = resolvePar3BracketSlot(snapshot, pairing.second);
        return <div key={pairing.matchNumber} className="par3-broadcast-bracket-match"><span>M{pairing.matchNumber}</span><p>{poolsLocked && first ? first.name : pairing.first.label}</p><p>{pairing.second.isCtp && ctpWinner ? ctpWinner.name : poolsLocked && second ? second.name : pairing.second.label}</p></div>;
      })}</div></article>
      {["Quarter Finals", "Semi Finals", "Grand Final"].map((label, index) => <article key={label}><h2>{label}</h2><div>{Array.from({ length: 4 / 2 ** index }, (_, matchIndex) => <div key={matchIndex} className="par3-broadcast-bracket-match is-tbd"><p>Winner TBD</p><p>Winner TBD</p></div>)}</div></article>)}
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
  return (
    <section className="par3-broadcast-live-board">
      <div><span className="par3-broadcast-section-kicker">{live.length ? "On course now" : "Next fixtures"}</span><div className="par3-broadcast-live-grid">{featured.map((match) => <MatchCard key={match.id} match={match} playersById={playersById} />)}</div></div>
      <aside><Target /><span>CTP field</span><strong>{ctpWinner?.name ?? `${ctpContestants.length || pools.length} players`}</strong><p>{ctpWinner ? "Final bracket spot secured" : "Pool fourth-place finishers play Pebble Beach 7"}</p></aside>
    </section>
  );
}

function BroadcastFooter({ snapshot, slide, total }: { snapshot: Par3Snapshot; slide?: number; total?: number }) {
  return <footer className="par3-broadcast-footer"><span><i className={snapshot.event.isLive ? "is-live" : ""} /> {snapshot.event.statusLabel}</span><strong>Small course. Big banter.</strong>{typeof slide === "number" && total ? <div>{Array.from({ length: total }, (_, index) => <i key={index} className={index === slide ? "is-active" : ""} />)}</div> : <span>crossodoggolf.com</span>}</footer>;
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

  if (view === "banner") {
    const live = sortPoolMatchesByPlayOrder(snapshot.poolMatches.filter((match) => match.status === "live"));
    const scheduled = sortPoolMatchesByPlayOrder(snapshot.poolMatches.filter((match) => match.status === "scheduled"));
    return <section className="par3-broadcast-banner"><div className="par3-broadcast-banner-brand"><Image src="/par3/par3-logo.png" alt="CGS Par 3" width={112} height={112} priority /><div><span>CGS Championship</span><strong>Par 3 Live</strong></div></div><div className="par3-broadcast-banner-fixtures">{(live.length ? live : scheduled).slice(0, 3).map((match) => <MatchCard key={match.id} match={match} playersById={playersById} compact />)}</div><div className="par3-broadcast-banner-end"><TeeLoungeMark /><span><i className={snapshot.event.isLive ? "is-live" : ""} /> {snapshot.event.statusLabel}</span></div></section>;
  }

  if (view === "portrait") {
    const slides = ["live", ...pools.map((pool) => `pool-${pool.number}`), "ctp", "bracket"];
    const normalized = slideIndex % slides.length;
    const active = slides[normalized];
    const activePool = active.startsWith("pool-") ? pools.find((pool) => `pool-${pool.number}` === active) : null;
    const ctpContestants = getPar3CtpContestants(snapshot);
    return <section className="par3-broadcast-portrait"><BroadcastHeader eyebrow="CGS live" title="Par 3 Championship" detail={snapshot.event.statusLabel} /><div className="par3-broadcast-portrait-body" key={active}>{active === "live" ? <LiveBoard snapshot={snapshot} pools={pools} playersById={playersById} /> : null}{activePool ? <StandingsBoard pools={[activePool]} /> : null}{active === "ctp" ? <section className="par3-broadcast-portrait-ctp"><Target /><span>Closest to pin</span><h2>Pebble Beach 7</h2>{ctpContestants.map((standing) => <p key={standing.player.id}><strong>{standing.player.name}</strong><small>Pool {String.fromCharCode(64 + (standing.player.poolNumber ?? 1))}</small></p>)}</section> : null}{active === "bracket" ? <section className="par3-broadcast-portrait-final"><Trophy /><span>Road to the title</span><h2>{champion ?? "16 enter. One remains."}</h2><p>Round of 16 · Quarter Finals · Semi Finals · Grand Final</p></section> : null}</div><BroadcastFooter snapshot={snapshot} slide={normalized} total={slides.length} /></section>;
  }

  const activeTvSlide = TV_SLIDES[slideIndex % TV_SLIDES.length];
  const resolvedView = view === "tv" ? activeTvSlide : view;
  const titles: Record<string, [string, string, string]> = {
    live: ["Tournament centre", "Live fixtures", "Current matches and the road to qualification"],
    standings: ["Pool stage", "Table positions", "Top three qualify · fourth heads to the CTP playoff"],
    fixtures: ["Pool draw", "Every fixture", "Three rounds · five pools · thirty matches"],
    results: ["Match centre", "Latest results", "Winners, completed fixtures, and what comes next"],
    bracket: ["Road to the title", "Finals bracket", "Sixteen players · single elimination · one champion"],
    road: ["Course draw", "Eight stages", "A new virtual course test in every round"],
  };
  const [eyebrow, title, detail] = titles[resolvedView] ?? titles.live;

  return (
    <section className={`par3-broadcast-canvas is-${view}`}>
      {view === "tv" ? <Image className="par3-broadcast-course-preload" src="/par3/par3-course-draw.png" alt="" width={1122} height={1402} loading="eager" /> : null}
      <BroadcastHeader eyebrow={eyebrow} title={title} detail={detail} />
      <main className="par3-broadcast-body" key={resolvedView}>
        {resolvedView === "live" ? <LiveBoard snapshot={snapshot} pools={pools} playersById={playersById} /> : null}
        {resolvedView === "standings" ? <StandingsBoard pools={pools} /> : null}
        {resolvedView === "fixtures" ? <FixturesBoard snapshot={snapshot} playersById={playersById} /> : null}
        {resolvedView === "results" ? <ResultsBoard snapshot={snapshot} playersById={playersById} /> : null}
        {resolvedView === "bracket" ? <BracketBoard snapshot={snapshot} pools={pools} /> : null}
        {resolvedView === "road" ? <CourseRoadBoard /> : null}
      </main>
      <BroadcastFooter snapshot={snapshot} slide={view === "tv" ? slideIndex % TV_SLIDES.length : undefined} total={view === "tv" ? TV_SLIDES.length : undefined} />
    </section>
  );
}
