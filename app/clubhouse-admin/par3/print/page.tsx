import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import Par3PrintButton from "@/components/par3/Par3PrintButton";
import Par3MatchScorecard from "@/components/par3/Par3MatchScorecard";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminPar3Snapshot } from "@/lib/par3-showdown";
import {
  buildPar3Pools,
  getKnockoutParticipantName,
  getPar3CtpContestants,
  getPar3CtpStage,
  getPar3CtpQualifiers,
  getPar3KnockoutRounds,
  getPar3FinalsStages,
  getPar3QualificationPlan,
  isPar3PoolComplete,
  getPar3SimulatorQueues,
  getPoolStage,
  resolvePar3BracketSlot,
} from "@/lib/par3-showdown-types";
import {
  getPar3DisplayCourseStages,
  getPar3DisplayFinalsTemplate,
  getPar3DisplayFinalistCount,
  getPar3DisplayByePlayer,
  getPar3ByeAdvanceLabel,
  getPar3DisplayMatchRound,
  getPar3DisplayPoolSize,
  getPar3DisplayPoolStages,
  getPar3DisplayQualification,
  getPar3QualificationDescription,
  getPar3StageHoleLabel,
  getPar3PrizeCtpContestants,
  par3Ordinal,
  splitPar3DisplayPages,
} from "@/lib/par3-display";

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
  "scorecards",
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
      <div className="par3-print-body">{children}</div>
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
  const plan = getPar3DisplayQualification(snapshot);
  const ctpPrizeContestants = getPar3PrizeCtpContestants(snapshot);
  const ctpQualifiers = getPar3CtpQualifiers(snapshot);
  const finalsTemplate = getPar3DisplayFinalsTemplate(snapshot);
  const finalsStages = getPar3FinalsStages(snapshot.event);
  const ctpStage = getPar3CtpStage();
  const poolsLocked = getPar3QualificationPlan(snapshot).errors.length === 0 && pools.every(isPar3PoolComplete);
  const poolStages = getPar3DisplayPoolStages(snapshot);
  const knockoutRounds = getPar3KnockoutRounds(snapshot.event.knockoutData, snapshot.event);
  const include = (candidate: Sheet) => sheet === "pack" || sheet === candidate;
  const simulatorPanels = simulatorQueues.flatMap((queue) => {
    const pages = splitPar3DisplayPages(queue.queued, 4);
    return (pages.length ? pages : [[]]).map((matches, pageIndex) => ({
      simulatorNumber: queue.simulatorNumber,
      current: pageIndex === 0 ? queue.current : null,
      matches,
      pageIndex,
      pageCount: Math.max(1, pages.length),
    }));
  });
  const courseStages = getPar3DisplayCourseStages(snapshot);

  return (
    <main className="par3-print-centre">
      <div className="par3-print-toolbar">
        <div>
          <span>Championship II</span>
          <strong>{sheet === "pack" ? "Complete event pack" : sheet === "round-of-16" ? finalsStages[0]?.label ?? "Opening finals" : sheet.replaceAll("-", " ")}</strong>
        </div>
        <Link href="/clubhouse-admin/par3">Back to admin</Link>
        <a href="/par3/par3-match-scorecard.pdf" download>Download blank scorecard PDF</a>
        <Par3PrintButton />
      </div>

      {include("pools")
        ? pools.flatMap((pool) => (splitPar3DisplayPages(pool.matches, 6).length ? splitPar3DisplayPages(pool.matches, 6) : [[]]).map((matches, pageIndex) => (
            <PrintSheet
              key={`${pool.number}-${pageIndex}`}
              kicker="Pool sheet"
              title={`${pool.label}${pool.matches.length > 6 ? ` / sheet ${pageIndex + 1}` : ""}`}
            >
              {pageIndex === 0 ? <div className="par3-print-player-list">
                {pool.players.map((player, index) => (
                  <div key={player.id}>
                    <b>{index + 1}</b>
                    <strong>{player.name}</strong>
                    <span>Mobile: {playersById.get(player.id)?.phone || "________________"}</span>
                  </div>
                ))}
              </div> : <p className="par3-print-note">Continued pool fixtures. Player contact details are on this pool’s first sheet.</p>}
              <table className="par3-print-table">
                <thead>
                  <tr><th>Round</th><th>Course</th><th>Fixture</th><th>Simulator</th><th>Winner</th></tr>
                </thead>
                <tbody>
                  {matches.map((match) => {
                    const stage = getPoolStage(match.matchNumber, getPar3DisplayPoolSize(snapshot, pool.number));
                    return (
                      <tr key={match.id}>
                        <td>{getPar3DisplayMatchRound(snapshot, match)}</td>
                        <td>{stage?.shortCourse}{stage ? <><br /><small>{getPar3StageHoleLabel(stage)}</small></> : null}</td>
                        <td><MatchNames first={playersById.get(match.player1Id)?.name ?? "TBD"} second={playersById.get(match.player2Id)?.name ?? "TBD"} /></td>
                        <td>{match.bayNumber ?? "____"}</td>
                        <td>{match.winnerId ? playersById.get(match.winnerId)?.name : "________________"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </PrintSheet>
          )))
        : null}

      {include("standings") ? splitPar3DisplayPages(pools, 4).map((poolPage, pageIndex) => (
        <PrintSheet key={`standings-${pageIndex}`} kicker="Live standings" title={`Pool tables${pools.length > 4 ? ` / sheet ${pageIndex + 1}` : ""}`} landscape>
          <div className="par3-print-standings-grid">
            {poolPage.map((pool) => (
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
          <div className="par3-print-note">{getPar3QualificationDescription(snapshot)}</div>
        </PrintSheet>
      )) : null}

      {include("schedule") ? poolStages.flatMap((stage, index) => {
        const matches = snapshot.poolMatches.filter((match) => getPar3DisplayMatchRound(snapshot, match) === index + 1);
        const chunks = splitPar3DisplayPages(matches, 6);
        return (chunks.length ? chunks : [[]]).map((matchPage, pageIndex) => (
        <PrintSheet key={`${stage.key}-${pageIndex}`} kicker="Match schedule" title={`${stage.label}${chunks.length > 1 ? ` / sheet ${pageIndex + 1}` : ""}`} landscape>
            <section className="par3-print-round-block">
              <h2><span>{stage.label}</span>{stage.course} / {getPar3StageHoleLabel(stage)}</h2>
              <div className="par3-print-schedule-grid">
                {matchPage.map((match) => (
                    <article key={match.id}>
                      <span>Pool {String.fromCharCode(64 + match.poolNumber)} / Match {match.matchNumber}</span>
                      <MatchNames first={playersById.get(match.player1Id)?.name ?? "TBD"} second={playersById.get(match.player2Id)?.name ?? "TBD"} />
                      <b>Simulator {match.bayNumber ?? "____"}</b>
                    </article>
                  ))}
              </div>
            </section>
        </PrintSheet>
        ));
      }) : null}

      {include("simulators") ? splitPar3DisplayPages(simulatorPanels, 2).map((panelPage, pageIndex) => (
        <PrintSheet key={`simulators-${pageIndex}`} kicker="Simulator allocation" title={`Now playing / Up next${simulatorPanels.length > 2 ? ` / sheet ${pageIndex + 1}` : ""}`} landscape>
          <div className="par3-print-simulator-grid">
            {panelPage.map((panel) => (
              <article key={`${panel.simulatorNumber}-${panel.pageIndex}`}>
                <h2>Simulator {panel.simulatorNumber}{panel.pageIndex > 0 ? " / continued" : ""}</h2>
                {panel.pageCount > 1 ? <p className="par3-print-note">Queue sheet {panel.pageIndex + 1} of {panel.pageCount}. Read this simulator’s sheets in order.</p> : null}
                {panel.pageIndex === 0 ? <div><span>Now playing</span>{panel.current ? <MatchNames first={playersById.get(panel.current.player1Id)?.name ?? "TBD"} second={playersById.get(panel.current.player2Id)?.name ?? "TBD"} /> : <strong>Available</strong>}</div> : null}
                {panel.matches.length ? panel.matches.map((match, index) => (
                  <div key={match.id} className={panel.pageIndex === 0 && index === 0 ? "is-next" : undefined}><span>{panel.pageIndex === 0 && index === 0 ? "Up next" : `Queue ${panel.pageIndex * 4 + index + 1}`} · Pool {String.fromCharCode(64 + match.poolNumber)} · Match {match.matchNumber}</span><MatchNames first={playersById.get(match.player1Id)?.name ?? "TBD"} second={playersById.get(match.player2Id)?.name ?? "TBD"} /></div>
                )) : <div><span>Up next</span><strong>To be allocated</strong></div>}
              </article>
            ))}
          </div>
        </PrintSheet>
      )) : null}

      {include("courses") ? splitPar3DisplayPages(courseStages, 6).map((stagePage, pageIndex) => (
        <PrintSheet key={`courses-${pageIndex}`} kicker="Course allocation" title={`${courseStages.length} stages / course allocation${courseStages.length > 6 ? ` / sheet ${pageIndex + 1}` : ""}`}>
          <div className="par3-print-course-list">
            {stagePage.map((stage, index) => (
              <article key={stage.key}>
                <b>{stage.stageNumber ? `R${stage.stageNumber}` : String(pageIndex * 6 + index + 1).padStart(2, "0")}</b>
                <span>{stage.label}</span>
                <strong>{stage.course}</strong>
                <i>{getPar3StageHoleLabel(stage)} / Confirmed ______</i>
              </article>
            ))}
          </div>
        </PrintSheet>
      )) : null}

      {include("ctp") ? [
        { key: "bracket", title: plan.ctpPurpose === "bye" ? "Pool winners / finals bye CTP" : "Bracket CTP", detail: plan.ctpPurpose === "bye" ? `Pool winners contest CTP. The winner receives a bye to the ${finalsStages[1]?.label ?? "next round"}; everyone advances to finals.` : plan.ctpQualifierCount ? `${plan.ctpAllRemaining ? "Remaining pool players" : `${par3Ordinal(plan.ctpPoolPosition)}-place players`} / top ${plan.ctpQualifierCount} advance` : "No bracket CTP required", contestants: ctpContestants },
        { key: "prize", title: "Prize CTP", detail: plan.allPlayersAdvance ? "Last-place pool finishers / closest shot wins" : "Last-place players outside automatic qualification / closest shot wins", contestants: ctpPrizeContestants },
      ].flatMap((contest) => {
        const pages = splitPar3DisplayPages(contest.contestants, 8);
        return (pages.length ? pages : [[]]).map((contestants, pageIndex) => (
          <PrintSheet key={`${contest.key}-${pageIndex}`} kicker="Closest-to-pin records" title={`${contest.title}${pages.length > 1 ? ` / sheet ${pageIndex + 1}` : ""}`} landscape>
            <div className="par3-print-ctp-grid"><article><h2>{contest.title}</h2><p>{contest.detail}{!poolsLocked ? " Provisional pool positions until pool play is confirmed." : ""}</p>
              <table className="par3-print-table">
                <thead><tr><th>Pool</th><th>Player</th><th>Distance</th><th>Rank</th></tr></thead>
                <tbody>{contestants.map((standing) => (
                  <tr key={standing.player.id}>
                    <td>{String.fromCharCode(64 + (standing.player.poolNumber ?? 1))}</td>
                    <td>{standing.player.name}</td>
                    <td>{standing.player.ctpDistanceCm !== null ? `${standing.player.ctpDistanceCm} cm` : "________ cm"}</td>
                    <td>{standing.player.ctpRank ?? "____"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </article></div>
            <div className="par3-print-note">Course: {ctpStage.course} / {getPar3StageHoleLabel(ctpStage)}. Record every distance in centimetres, then rank closest to furthest.</div>
          </PrintSheet>
        ));
      }) : null}

      {include("round-of-16") ? splitPar3DisplayPages(finalsTemplate, 4).map((pairingPage, pageIndex) => (
        <PrintSheet key={`opening-finals-${pageIndex}`} kicker="Finals draw" title={`${finalsStages[0]?.label ?? "Finals"}${finalsTemplate.length > 4 ? ` / sheet ${pageIndex + 1}` : ""}`} landscape>
          <p className="par3-print-note">{finalsStages[0]?.course}{finalsStages[0] ? ` / ${getPar3StageHoleLabel(finalsStages[0])}` : ""}</p>
          <div className="par3-print-r16-grid">
            {pairingPage.map((pairing) => {
              const first = resolvePar3BracketSlot(snapshot, pairing.first);
              const second = resolvePar3BracketSlot(snapshot, pairing.second);
              const isBye = pairing.first.isBye || pairing.second.isBye;
              const byeName = pairing.first.isBye ? (poolsLocked && second ? second.name : pairing.second.label) : (poolsLocked && first ? first.name : pairing.first.label);
              return (
                <article key={pairing.matchNumber}>
                  <span>Lane {pairing.lane} / {isBye ? "CTP bye" : `Match ${pairing.matchNumber}`}</span>
                  {isBye ? <><p>{byeName}</p><p>{getPar3ByeAdvanceLabel(snapshot)}</p></> : <>
                  <p>{poolsLocked && first ? first.name : pairing.first.label}</p>
                  <i>vs</i>
                  <p>{poolsLocked && second ? second.name : pairing.second.label}</p>
                  <b>Winner ____________________</b>
                  </>}
                </article>
              );
            })}
          </div>
          <div className="par3-print-note">{plan.ctpPurpose === "bye" ? "Confirmed CTP bye winner" : "Confirmed CTP qualifiers"}: {ctpQualifiers.length ? ctpQualifiers.map((player) => `${player.ctpRank}. ${player.name}`).join(" / ") : "Pending"}. {plan.allPlayersAdvance ? `${plan.requiredPlayerCount} players advance; ${plan.openingMatchCount} opening matches and one bye.` : ""}</div>
        </PrintSheet>
      )) : null}

      {include("finals") ? (knockoutRounds.length ? knockoutRounds : finalsStages.map((stage, index) => ({
        id: stage.key,
        number: index + 1,
        label: stage.label,
        matches: Array.from({ length: plan.finalsSize / 2 ** (index + 1) }, (_, matchIndex) => ({ id: `${stage.key}-${matchIndex}`, number: matchIndex + 1, opponent1: null, opponent2: null })),
      }))).flatMap((round) => splitPar3DisplayPages<(typeof round.matches)[number]>(round.matches, 4).map((matchPage, pageIndex) => (
        <PrintSheet key={`finals-${round.id}-${pageIndex}`} kicker="Single elimination" title={`${round.label}${round.matches.length > 4 ? ` / sheet ${pageIndex + 1}` : ""}`} landscape>
          <p className="par3-print-note">{finalsStages[round.number - 1]?.course}{finalsStages[round.number - 1] ? ` / ${getPar3StageHoleLabel(finalsStages[round.number - 1])}` : ""}</p>
          <div className="par3-print-r16-grid">
            {matchPage.map((match) => {
              const byePlayer = getPar3DisplayByePlayer(snapshot, round.number, match);
              const previewPairing = !snapshot.event.knockoutData && round.number === 1 ? finalsTemplate.find((pairing) => pairing.matchNumber === match.number) : null;
              const isBye = Boolean(byePlayer || previewPairing?.first.isBye || previewPairing?.second.isBye);
              const byeName = byePlayer ?? (previewPairing?.first.isBye ? previewPairing.second.label : previewPairing?.first.label) ?? "CTP winner";
              return (
              <article key={String(match.id)}>
                <span>{isBye ? "CTP bye" : `Match ${match.number}`}</span>
                {isBye ? <><p>{byeName}</p><p>{getPar3ByeAdvanceLabel(snapshot)}</p></> : <>
                <p>{snapshot.event.knockoutData ? getKnockoutParticipantName(snapshot.event.knockoutData, match.opponent1?.id) : "________________"}</p>
                <i>vs</i>
                <p>{snapshot.event.knockoutData ? getKnockoutParticipantName(snapshot.event.knockoutData, match.opponent2?.id) : "________________"}</p>
                <b>Winner ____________________</b>
                </>}
              </article>
            );})}
          </div>
        </PrintSheet>
      ))) : null}

      {include("reporting") ? (
        <PrintSheet kicker="Organiser workflow" title="Clear reporting process">
          <ol className="par3-print-reporting">
            <li><b>1</b><div><strong>Call the match</strong><p>Use the simulator desk to announce NOW PLAYING and UP NEXT. Confirm both players are present.</p></div></li>
            <li><b>2</b><div><strong>Start the fixture</strong><p>Choose the simulator in Pool Play and select Start on simulator. The public displays update immediately.</p></div></li>
            <li><b>3</b><div><strong>Collect the result card</strong><p>Confirm Player A, Player B and Winner &amp; Score, then hand the card to the results desk. Confirm the opponent and record the winner once only.</p></div></li>
            <li><b>4</b><div><strong>Check the table</strong><p>Verify played matches and wins. Use a manual seed only when a head-to-head tie still needs an organiser ruling.</p></div></li>
            <li><b>5</b><div><strong>Record CTP distances</strong><p>{plan.ctpPurpose === "bye" ? "Record the pool winners’ CTP distances in centimetres and confirm the winner of the finals bye." : plan.ctpQualifierCount ? `Enter every shot in centimetres and confirm ${plan.ctpQualifierCount} bracket CTP qualifier${plan.ctpQualifierCount === 1 ? "" : "s"}.` : "The nominated format has no bracket CTP."} Record any separate prize contest.</p></div></li>
            <li><b>6</b><div><strong>Generate the bracket</strong><p>Generate the {getPar3DisplayFinalistCount(snapshot)}-player finals after all pools and the required CTP outcome are confirmed. {plan.ctpPurpose === "bye" ? `The CTP winner advances automatically; report only the ${plan.openingMatchCount} opening matches actually played.` : "Then start and report each finals match."}</p></div></li>
          </ol>
          <div className="par3-print-signoff"><span>Event director ____________________</span><span>Results checked ____________________</span><span>Time ________</span></div>
        </PrintSheet>
      ) : null}

      {include("scorecards") ? (
        <PrintSheet kicker="Player handout / one match per A4 sheet" title="Match scorecard">
          <div className="par3-print-scorecards">
            <Par3MatchScorecard number={1} />
          </div>
        </PrintSheet>
      ) : null}
    </main>
  );
}
