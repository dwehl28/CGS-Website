"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  ChevronDown,
  Info,
  Search,
  Trophy,
  X,
} from "lucide-react";
import {
  cglCards,
  cglPlayers,
  cglRounds,
  cglSeason,
  formatCglRank,
  getCglStandings,
  type CglScoring,
} from "@/lib/cgl-demo";
import styles from "./CglLeaderboard.module.css";

const pointsScale = [500, 300, 190, 135, 110, 100, 90, 85, 80, 75];
const number = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 });

export default function CglLeaderboard({
  initialRoundId = "season",
}: {
  initialRoundId?: string;
}) {
  const [scoring, setScoring] = useState<CglScoring>("net");
  const [roundId, setRoundId] = useState(
    cglRounds.some(
      (round) => round.id === initialRoundId && round.status === "open",
    )
      ? initialRoundId
      : "season",
  );
  const [division, setDivision] = useState("all");
  const [query, setQuery] = useState("");

  const releasedRounds = cglRounds.filter((round) => round.status === "open");
  const selectedRound = cglRounds.find((round) => round.id === roundId);
  const standings = getCglStandings(scoring, selectedRound?.id);
  const filteredStandings = standings.filter(
    ({ player }) =>
      (division === "all" || player.division === `Division ${division}`) &&
      player.username.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const leader = standings.find((standing) => standing.played > 0);
  const leaders = leader
    ? standings.filter(
        (standing) => standing.played > 0 && standing.points === leader.points,
      )
    : [];
  const hasJointLeaders = leaders.length > 1;
  const isSeason = !selectedRound;
  const scoringLabel = scoring === "net" ? "Net" : "Gross";
  const clearFilters = () => {
    setDivision("all");
    setQuery("");
  };

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>{cglSeason.year} / Season standings</p>
          <h1>
            The season,
            <br />
            shot by shot<span>.</span>
          </h1>
          <p className={styles.introCopy}>
            One field. Every round counts. Find your place in the league and
            follow the race to the final round.
          </p>
        </div>
        <div className={styles.seasonNote}>
          <span className={styles.status}>
            <span aria-hidden="true" /> Provisional standings
          </span>
          <p>
            Catch-up rounds can change the order.
            <br />
            The final points settle when the season closes.
          </p>
          <a href="#cgl-scoring">
            How the points work <ArrowDown size={14} aria-hidden="true" />
          </a>
        </div>
      </header>

      <div className={styles.summary} aria-label="League snapshot">
        <div className={styles.leaderSummary}>
          <span className={styles.summaryIcon}>
            <Trophy size={19} strokeWidth={1.6} aria-hidden="true" />
          </span>
          <div>
            <span className={styles.summaryLabel}>
              {isSeason
                ? hasJointLeaders
                  ? "Joint season leaders"
                  : "Setting the pace"
                : `Round ${selectedRound.number} ${hasJointLeaders ? "joint leaders" : "leader"}`}
            </span>
            <strong>
              {leaders.length
                ? leaders
                    .map((standing) => standing.player.username)
                    .join(" & ")
                : "Awaiting results"}
            </strong>
          </div>
          {leader && (
            <span className={styles.leaderPoints}>
              {number.format(leader.points)}{" "}
              <span>pts{hasJointLeaders ? " each" : ""}</span>
            </span>
          )}
        </div>
        <div className={styles.summaryMetric}>
          <span className={styles.summaryLabel}>The field</span>
          <strong>
            {cglPlayers.length} <span>players</span>
          </strong>
        </div>
        <div className={styles.summaryMetric}>
          <span className={styles.summaryLabel}>Rounds released</span>
          <strong>
            {releasedRounds.length}
            <span> / {cglSeason.totalRounds}</span>
          </strong>
        </div>
      </div>

      <section className={styles.board} aria-labelledby="standings-title">
        <div className={styles.boardHeading}>
          <div>
            <p className={styles.eyebrow}>The leaderboard</p>
            <h2 id="standings-title">
              {isSeason
                ? "Season points"
                : `Round ${selectedRound.number} results`}
            </h2>
          </div>
          <div
            className={styles.scoringToggle}
            role="group"
            aria-label="Scoring format"
          >
            <button
              type="button"
              aria-pressed={scoring === "net"}
              onClick={() => setScoring("net")}
            >
              Net
            </button>
            <button
              type="button"
              aria-pressed={scoring === "gross"}
              onClick={() => setScoring("gross")}
            >
              Gross
            </button>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.scopeSelect}>
            <label htmlFor="cgl-round">Competition</label>
            <div className={styles.selectWrap}>
              <select
                id="cgl-round"
                value={roundId}
                onChange={(event) => setRoundId(event.target.value)}
              >
                <option value="season">Full season</option>
                {releasedRounds.map((round) => (
                  <option key={round.id} value={round.id}>
                    Round {round.number} · {round.course}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </div>
          </div>
          <div className={styles.divisionControl}>
            <span className={styles.controlLabel} id="cgl-division-label">
              Division
            </span>
            <div
              className={styles.divisionButtons}
              role="group"
              aria-labelledby="cgl-division-label"
            >
              {["all", "1", "2", "3"].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={division === value}
                  aria-label={
                    value === "all" ? "All divisions" : `Division ${value}`
                  }
                  onClick={() => setDivision(value)}
                >
                  {value === "all" ? "All" : `Div ${value}`}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.searchControl}>
            <label htmlFor="cgl-player-search">Find a player</label>
            <div className={styles.searchWrap}>
              <Search size={16} aria-hidden="true" />
              <input
                id="cgl-player-search"
                type="search"
                placeholder="SGT username"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear player search"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={styles.tableMeta}>
          <p aria-live="polite" aria-atomic="true">
            <strong>{filteredStandings.length}</strong>{" "}
            {filteredStandings.length === 1 ? "player" : "players"}
            {division !== "all"
              ? ` in Division ${division}`
              : " across all divisions"}
          </p>
          <span>
            {scoringLabel} ·{" "}
            {isSeason ? "All released rounds" : selectedRound.course}
          </span>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>
              {scoringLabel}{" "}
              {isSeason
                ? "season points standings"
                : `results for round ${selectedRound.number}`}
              . Rankings and points are against the whole field, including when
              filtered by division. All results are provisional.
            </caption>
            <thead>
              <tr>
                <th scope="col" className={styles.rankColumn}>
                  <span className={styles.desktopLabel}>Rank</span>
                  <span className={styles.mobileLabel}>#</span>
                </th>
                <th scope="col" className={styles.playerColumn}>
                  Player
                </th>
                <th scope="col" className={styles.divisionColumn}>
                  <abbr title="Division">Div</abbr>
                </th>
                {isSeason ? (
                  <>
                    {releasedRounds.map((round) => (
                      <th
                        key={round.id}
                        scope="col"
                        className={styles.roundColumn}
                      >
                        <abbr title={`Round ${round.number} points`}>
                          R{round.number}
                        </abbr>
                      </th>
                    ))}
                    <th scope="col" className={styles.playedColumn}>
                      Played
                    </th>
                  </>
                ) : (
                  <th scope="col" className={styles.scoreColumn}>
                    {scoringLabel}
                  </th>
                )}
                <th scope="col" className={styles.pointsColumn}>
                  Points <ArrowDown size={11} aria-hidden="true" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStandings.map((standing) => {
                const { player, rank, tied, points, played, roundPoints } =
                  standing;
                const card = selectedRound
                  ? cglCards.find(
                      (entry) =>
                        entry.player === player.username &&
                        entry.roundId === selectedRound.id,
                    )
                  : undefined;
                return (
                  <tr
                    key={player.username}
                    className={
                      rank === 1 && played > 0 ? styles.firstRow : undefined
                    }
                  >
                    <td className={styles.rankColumn}>
                      <span
                        className={
                          rank <= 3 && played > 0 ? styles.topRank : styles.rank
                        }
                      >
                        {played > 0 ? formatCglRank(rank, tied) : "—"}
                      </span>
                    </td>
                    <th scope="row" className={styles.playerColumn}>
                      <Link
                        href={`/cgl/players/${encodeURIComponent(player.username)}`}
                        className={styles.playerLink}
                      >
                        <span
                          className={styles.avatar}
                          style={{ backgroundColor: `${player.color}22` }}
                          aria-hidden="true"
                        >
                          {player.initials}
                        </span>
                        <span className={styles.playerDetails}>
                          <span>{player.username}</span>
                          <span className={styles.handicap}>
                            HCP {number.format(player.handicap)}
                          </span>
                        </span>
                        <ArrowUpRight
                          className={styles.playerArrow}
                          size={14}
                          aria-hidden="true"
                        />
                      </Link>
                    </th>
                    <td className={styles.divisionColumn}>
                      <span
                        className={styles.divisionBadge}
                        aria-label={player.division}
                      >
                        {player.division.replace("Division ", "")}
                      </span>
                    </td>
                    {isSeason ? (
                      <>
                        {releasedRounds.map((round) => (
                          <td key={round.id} className={styles.roundColumn}>
                            {roundPoints[round.id] !== undefined &&
                            cglCards.some(
                              (entry) =>
                                entry.player === player.username &&
                                entry.roundId === round.id,
                            ) ? (
                              number.format(roundPoints[round.id])
                            ) : (
                              <span
                                className={styles.unplayed}
                                aria-label="Not played"
                              >
                                —
                              </span>
                            )}
                          </td>
                        ))}
                        <td className={styles.playedColumn}>
                          {played}
                          <span className={styles.playedTotal}>
                            /{releasedRounds.length}
                          </span>
                        </td>
                      </>
                    ) : (
                      <td className={styles.scoreColumn}>
                        {card ? (
                          card[scoring]
                        ) : (
                          <span
                            className={styles.unplayed}
                            aria-label="Not played"
                          >
                            —
                          </span>
                        )}
                      </td>
                    )}
                    <td className={styles.pointsColumn}>
                      <strong>{number.format(points)}</strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredStandings.length === 0 && (
            <div className={styles.noResults}>
              <Search size={25} strokeWidth={1.5} aria-hidden="true" />
              <h3>No players found</h3>
              <p>Try a different username or show all divisions.</p>
              <button type="button" onClick={clearFilters}>
                Clear search and division
              </button>
            </div>
          )}
        </div>

        <div className={styles.boardFoot}>
          <Info size={15} aria-hidden="true" />
          <p>
            {division === "all"
              ? "Points are earned against the whole field. Division filters keep the same overall ranks and points."
              : `Showing Division ${division}. Ranks and points stay based on the whole field.`}
          </p>
        </div>
      </section>

      <div className={styles.rulesGrid} id="cgl-scoring">
        <section
          className={styles.provisionalCard}
          aria-labelledby="cgl-provisional-title"
        >
          <span className={styles.eyebrow}>Still in play</span>
          <h2 id="cgl-provisional-title">A season worth catching up on.</h2>
          <p>
            Each released round stays open until the season closes. New players
            can join and catch up, so earlier results and season points can
            move.
          </p>
          <p className={styles.rulesFine}>
            Every round counts. SGT manages handicaps. Net is the main
            championship; Gross gives you another view of the field.
          </p>
        </section>
        <details className={styles.pointsDetails}>
          <summary>
            <span>
              <span className={styles.eyebrow}>The scoring system</span>
              <strong>Every finish has its points.</strong>
              <span className={styles.detailsHint}>
                View the points scale and tie rules
              </span>
            </span>
            <ChevronDown size={19} aria-hidden="true" />
          </summary>
          <div className={styles.detailsContent}>
            <ol className={styles.pointsScale}>
              {pointsScale.map((points, index) => (
                <li key={points}>
                  <span>
                    {index + 1}
                    <span className={styles.srOnly}> place</span>
                  </span>
                  <strong>
                    {points}
                    <span> pts</span>
                  </strong>
                </li>
              ))}
            </ol>
            <p>
              Tied players share the points for the positions they occupy. Two
              players tied second earn (300 + 190) ÷ 2 ={" "}
              <strong>245 points each</strong>.
            </p>
            <p>
              An unplayed round earns zero points. Division standings use the
              same points earned against the whole field.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
