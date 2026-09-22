import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import Par3PrintButton from "@/components/par3/Par3PrintButton";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminPar3Snapshot } from "@/lib/par3-showdown";
import {
  PAR3_FINALS_STAGES,
  PAR3_POOL_STAGES,
  buildPar3Pools,
  getKnockoutParticipantName,
  getPar3CtpContestants,
  getPar3CtpQualifiers,
  getPar3KnockoutRounds,
  getPar3RoundOf16Template,
  getPar3SimulatorQueues,
  getPoolMatchRound,
  resolvePar3BracketSlot,
} from "@/lib/par3-showdown-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Championship II Print Centre",
  robots: { index: false, follow: false },
};

const validSheets = [
  "pack",
  "pools",
  "standings",
  "schedule",
  "simulators",
  "courses",
  "ctp",
  "round-of-16",
  "finals",
  "reporting",
] as const;

type Sheet = (typeof validSheets)[number];
type PageProps = { searchParams: Promise<{ sheet?: string }> };

function PrintSheet({
  title,
  kicker,
  children,
  landscape = false,
}: {
  title: string;
  kicker: string;
  children: ReactNode;
  landscape?: boolean;
}) {
  return (
    <section className={`par3-print-sheet${landscape ? " is-landscape" : ""}`}>
      <header className="par3-print-header">
        <div>
          <span>{kicker}</span>
          <h1>{title}</h1>
        </div>
        <div className="par3-print-mark">
          <strong>CGS PAR 3</strong>
          <b>II</b>
        </div>
      </header>
      {children}
      <footer>
        <span>Saturday 7 November / 5:00pm / The Tee Lounge</span>
        <span>CGS Par 3 Championship II</span>
      </footer>
    </section>
  );
}

function MatchNames({
  first,
  second,
}: {
  first: string;
  second: string;
}) {
  return (
    <span className="par3-print-match-names">
      <strong>{first}</strong>
      <i>vs</i>
      <strong>{second}</strong>
    </span>
  );
}

export default async function Par3PrintPage({ searchParams }: PageProps) {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    return (
      <main className="par3-print-locked">
        <h1>Admin sign-in required</h1>
        <p>Open the Championship II admin desk first, then return to the print centre.</p>
        <Link href="/clubhouse-admin/par3">Open admin desk</Link>
      </main>
    );
  }

  const { sheet: requestedSheet } = await searchParams;
  const sheet = validSheets.includes(requestedSheet as Sheet)
    ? (requestedSheet as Sheet)
    : "pack";
  const snapshot = await getAdminPar3Snapshot();
  const pools = buildPar3Pools(snapshot);
  const playersById = new Map(
    snapshot.players.map((player) => [player.id, player])
  );
  const simulatorQueues = getPar3SimulatorQueues(snapshot);
  const ctpContestants = getPar3CtpContestants(snapshot);
  const ctpPrizeContestants = pools.flatMap((pool) => {
    const standing = pool.standings.find((candidate) => candidate.position === 4);
    return standing ? [standing] : [];
  });
  const ctpQualifiers = getPar3CtpQualifiers(snapshot);
  const roundOf16 = getPar3RoundOf16Template(snapshot.event.poolCount);
  const knockoutRounds = getPar3KnockoutRounds(snapshot.event.knockoutData);
  const include = (candidate: Sheet) => sheet === "pack" || sheet === candidate;

  return (
    <main className="par3-print-centre">
      <div className="par3-print-toolbar">
        <div>
          <span>Championship II</span>
          <strong>{sheet === "pack" ? "Complete event pack" : sheet.replaceAll("-", " ")}</strong>
        </div>
        <Link href="/clubhouse-admin/par3">Back to admin</Link>
        <Par3PrintButton />
      </div>

      {include("pools")
        ? pools.map((pool) => (
            <PrintSheet
              key={pool.number}
              kicker="Pool sheet"
              title={pool.label}
            >
              <div className="par3-print-player-list">
                {pool.players.map((player, index) => (
                  <div key={player.id}>
                    <b>{index + 1}</b>
                    <strong>{player.name}</strong>
                    <span>Mobile: {playersById.get(player.id)?.phone || "________________"}</span>
                  </div>
                ))}
              </div>
              <table className="par3-print-table">
                <thead>
                  <tr><th>Round</th><th>Course</th><th>Fixture</th><th>Simulator</th><th>Winner</th></tr>
                </thead>
                <tbody>
                  {pool.matches.map((match) => {
                    const stage = PAR3_POOL_STAGES[getPoolMatchRound(match.matchNumber) - 1];
                    return (
                      <tr key={match.id}>
                        <td>{getPoolMatchRound(match.matchNumber)}</td>
                        <td>{stage?.shortCourse}</td>
                        <td><MatchNames first={playersById.get(match.player1Id)?.name ?? "TBD"} second={playersById.get(match.player2Id)?.name ?? "TBD"} /></td>
                        <td>{match.bayNumber ?? "____"}</td>
                        <td>{match.winnerId ? playersById.get(match.winnerId)?.name : "________________"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </PrintSheet>
          ))
        : null}

      {include("standings") ? (
        <PrintSheet kicker="Live standings" title="Pool tables" landscape>
          <div className="par3-print-standings-grid">
            {pools.map((pool) => (
              <article key={pool.number}>
                <h2>{pool.label}</h2>
                <table className="par3-print-table">
                  <thead><tr><th>Pos</th><th>Player</th><th>P</th><th>W</th></tr></thead>
                  <tbody>
                    {pool.standings.map((standing) => (
                      <tr key={standing.player.id}>
                        <td>{standing.position}</td><td>{standing.player.name}</td><td>{standing.played}</td><td>{standing.wins}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            ))}
          </div>
          <div className="par3-print-note">Top two in each pool qualify automatically. Third place enters the four-place bracket CTP. Fourth place enters the prize CTP.</div>
        </PrintSheet>
      ) : null}

      {include("schedule") ? (
        <PrintSheet kicker="Match schedule" title="Pool-stage running order" landscape>
          {PAR3_POOL_STAGES.map((stage, index) => (
            <section key={stage.key} className="par3-print-round-block">
              <h2><span>{stage.label}</span>{stage.course}</h2>
              <div className="par3-print-schedule-grid">
                {snapshot.poolMatches
                  .filter((match) => getPoolMatchRound(match.matchNumber) === index + 1)
                  .map((match) => (
                    <article key={match.id}>
                      <span>Pool {String.fromCharCode(64 + match.poolNumber)} / Match {match.matchNumber}</span>
                      <MatchNames first={playersById.get(match.player1Id)?.name ?? "TBD"} second={playersById.get(match.player2Id)?.name ?? "TBD"} />
                      <b>Simulator {match.bayNumber ?? "____"}</b>
                    </article>
                  ))}
              </div>
            </section>
          ))}
        </PrintSheet>
      ) : null}

      {include("simulators") ? (
        <PrintSheet kicker="Simulator allocation" title="Now playing / Up next" landscape>
          <div className="par3-print-simulator-grid">
            {simulatorQueues.map((queue) => (
              <article key={queue.simulatorNumber}>
                <h2>Simulator {queue.simulatorNumber}</h2>
                <div><span>Now playing</span>{queue.current ? <MatchNames first={playersById.get(queue.current.player1Id)?.name ?? "TBD"} second={playersById.get(queue.current.player2Id)?.name ?? "TBD"} /> : <strong>Available</strong>}</div>
                <div className="is-next"><span>Up next</span>{queue.upNext ? <MatchNames first={playersById.get(queue.upNext.player1Id)?.name ?? "TBD"} second={playersById.get(queue.upNext.player2Id)?.name ?? "TBD"} /> : <strong>To be allocated</strong>}</div>
                {queue.queued.slice(1).map((match, index) => (
                  <div key={match.id}><span>Queue {index + 2}</span><MatchNames first={playersById.get(match.player1Id)?.name ?? "TBD"} second={playersById.get(match.player2Id)?.name ?? "TBD"} /></div>
                ))}
              </article>
            ))}
          </div>
        </PrintSheet>
      ) : null}

      {include("courses") ? (
        <PrintSheet kicker="Course allocation" title="Eight stages / eight tests">
          <div className="par3-print-course-list">
            {[...PAR3_POOL_STAGES, ...PAR3_FINALS_STAGES].map((stage, index) => (
              <article key={stage.key}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <span>{stage.label}</span>
                <strong>{stage.course}</strong>
                <i>Confirmed ______</i>
              </article>
            ))}
          </div>
        </PrintSheet>
      ) : null}

      {include("ctp") ? (
        <PrintSheet kicker="Closest-to-pin records" title="CTP control sheet" landscape>
          <div className="par3-print-ctp-grid">
            {[
              ["Bracket CTP", "Third-place players / top four advance", ctpContestants],
              ["Prize CTP", "Fourth-place players / closest shot wins", ctpPrizeContestants],
            ].map(([title, detail, contestants]) => (
              <article key={String(title)}>
                <h2>{String(title)}</h2><p>{String(detail)}</p>
                <table className="par3-print-table">
                  <thead><tr><th>Pool</th><th>Player</th><th>Distance</th><th>Rank</th></tr></thead>
                  <tbody>
                    {(contestants as typeof ctpContestants).map((standing) => (
                      <tr key={standing.player.id}>
                        <td>{String.fromCharCode(64 + (standing.player.poolNumber ?? 1))}</td>
                        <td>{standing.player.name}</td>
                        <td>{standing.player.ctpDistanceCm !== null ? `${standing.player.ctpDistanceCm} cm` : "________ cm"}</td>
                        <td>{standing.player.ctpRank ?? "____"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            ))}
          </div>
          <div className="par3-print-note">Course: Pebble Beach / 7th hole. Record every distance in centimetres, then rank closest to furthest.</div>
        </PrintSheet>
      ) : null}

      {include("round-of-16") ? (
        <PrintSheet kicker="Finals draw" title="Round of 16 bracket" landscape>
          <div className="par3-print-r16-grid">
            {roundOf16.map((pairing) => {
              const first = resolvePar3BracketSlot(snapshot, pairing.first);
              const second = resolvePar3BracketSlot(snapshot, pairing.second);
              return (
                <article key={pairing.matchNumber}>
                  <span>Lane {pairing.lane} / Match {pairing.matchNumber}</span>
                  <p>{first?.name ?? pairing.first.label}</p>
                  <i>vs</i>
                  <p>{second?.name ?? pairing.second.label}</p>
                  <b>Winner ____________________</b>
                </article>
              );
            })}
          </div>
          <div className="par3-print-note">Confirmed CTP qualifiers: {ctpQualifiers.length ? ctpQualifiers.map((player) => `${player.ctpRank}. ${player.name}`).join(" / ") : "Pending"}</div>
        </PrintSheet>
      ) : null}

      {include("finals") ? (
        <PrintSheet kicker="Single elimination" title="Finals bracket" landscape>
          <div className="par3-print-finals-grid">
            {(knockoutRounds.length ? knockoutRounds : [
              { id: "qf", label: "Quarter Finals", matches: Array.from({ length: 4 }, (_, index) => ({ id: `qf-${index}`, number: index + 1, opponent1: null, opponent2: null })) },
              { id: "sf", label: "Semi Finals", matches: Array.from({ length: 2 }, (_, index) => ({ id: `sf-${index}`, number: index + 1, opponent1: null, opponent2: null })) },
              { id: "gf", label: "Grand Final", matches: [{ id: "gf-1", number: 1, opponent1: null, opponent2: null }] },
            ]).map((round) => (
              <section key={String(round.id)}>
                <h2>{round.label}</h2>
                {round.matches.map((match) => (
                  <article key={String(match.id)}>
                    <span>Match {match.number}</span>
                    <p>{snapshot.event.knockoutData ? getKnockoutParticipantName(snapshot.event.knockoutData, match.opponent1?.id) : "________________"}</p>
                    <p>{snapshot.event.knockoutData ? getKnockoutParticipantName(snapshot.event.knockoutData, match.opponent2?.id) : "________________"}</p>
                  </article>
                ))}
              </section>
            ))}
          </div>
        </PrintSheet>
      ) : null}

      {include("reporting") ? (
        <PrintSheet kicker="Organiser workflow" title="Clear reporting process">
          <ol className="par3-print-reporting">
            <li><b>1</b><div><strong>Call the match</strong><p>Use the simulator desk to announce NOW PLAYING and UP NEXT. Confirm both players are present.</p></div></li>
            <li><b>2</b><div><strong>Start the fixture</strong><p>Choose the simulator in Pool Play and select Start on simulator. The public displays update immediately.</p></div></li>
            <li><b>3</b><div><strong>Report the winner</strong><p>The winning player reports to the desk. Confirm the opponent and select the winner once only.</p></div></li>
            <li><b>4</b><div><strong>Check the table</strong><p>Verify played matches and wins. Use a manual seed only when a head-to-head tie still needs an organiser ruling.</p></div></li>
            <li><b>5</b><div><strong>Record CTP distances</strong><p>Enter every shot in centimetres, rank the bracket CTP top four, and separately identify the fourth-place prize winner.</p></div></li>
            <li><b>6</b><div><strong>Generate the bracket</strong><p>Only generate the Round of 16 after all pools and four CTP qualifiers are confirmed. Then start and report each finals match.</p></div></li>
          </ol>
          <div className="par3-print-signoff"><span>Event director ____________________</span><span>Results checked ____________________</span><span>Time ________</span></div>
        </PrintSheet>
      ) : null}
    </main>
  );
}
