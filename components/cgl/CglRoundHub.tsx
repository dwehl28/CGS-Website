"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  Flag,
  Info,
  LockKeyhole,
  MapPin,
  Medal,
  Search,
  Target,
  Trophy,
  Wind,
  X,
} from "lucide-react";
import {
  cglPlayers,
  cglRounds,
  cglSeason,
  formatCglRank,
  getCglRoundAchievements,
  getCglRoundResults,
  getCglStandings,
  type CglScoring,
} from "@/lib/cgl-demo";
import styles from "./CglRoundHub.module.css";

const number = (value: number, digits = 1) =>
  value.toLocaleString("en-AU", { maximumFractionDigits: digits });
const scoreToPar = (value: number) =>
  value === 0 ? "E" : value > 0 ? `+${value}` : String(value);
const scorecardHref = (username: string, roundId: string) =>
  `/cgl/players/${encodeURIComponent(username)}#card-${roundId}`;

function AchievementIcon({ id }: { id: string }) {
  if (id === "net" || id === "gross")
    return <Trophy size={17} aria-hidden="true" />;
  if (id === "drive") return <Wind size={18} aria-hidden="true" />;
  if (id === "ctp") return <Target size={18} aria-hidden="true" />;
  if (id === "fairways" || id === "greens")
    return <Flag size={17} aria-hidden="true" />;
  return <Medal size={18} aria-hidden="true" />;
}

export default function CglRoundHub({ roundId }: { roundId: string }) {
  const [scoring, setScoring] = useState<CglScoring>("net");
  const [division, setDivision] = useState("all");
  const [query, setQuery] = useState("");
  const round = cglRounds.find((entry) => entry.id === roundId);
  const results = getCglRoundResults(roundId, scoring);
  const achievements = getCglRoundAchievements(roundId);
  const mainAchievements = achievements.filter(
    (achievement) => achievement.id !== "birdies",
  );
  const birdies = achievements.find(
    (achievement) => achievement.id === "birdies",
  );
  const seasonStandings = getCglStandings("net");
  const filteredResults = results.filter(
    ({ player }) =>
      (division === "all" || player.division === division) &&
      player.username.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const waitingPlayers = cglPlayers.filter(
    (player) =>
      !results.some((result) => result.player.username === player.username),
  );

  if (!round) return null;

  return (
    <div className={styles.page}>
      <div className={styles.topline}>
        <Link href="/cgl" className={styles.backLink}>
          League home <ChevronRight size={13} aria-hidden="true" />
          <span>Round centre</span>
        </Link>
        <span className={styles.sampleLabel}>
          Design preview · Sample results
        </span>
      </div>

      <header className={styles.hero}>
        <div className={styles.roundEmblem} aria-hidden="true">
          <span>ROUND</span>
          <strong>{String(round.number).padStart(2, "0")}</strong>
          <Flag size={17} strokeWidth={1.5} />
        </div>
        <div className={styles.heroTitle}>
          <p className={styles.eyebrow}>
            {cglSeason.name} / {cglSeason.year}
          </p>
          <h1>{round.course}</h1>
          <div className={styles.courseMeta}>
            <span>
              <MapPin size={13} aria-hidden="true" />
              {round.location}
            </span>
            <span>18 holes · Par {round.par}</span>
            <span>Actual putting</span>
          </div>
        </div>
        <div className={styles.roundStatus}>
          <span className={styles.openBadge}>
            <span aria-hidden="true" /> Open for play
          </span>
          <p>
            {results.length} of {cglPlayers.length} cards completed
          </p>
          <span className={styles.progressTrack} aria-hidden="true">
            <span
              style={{
                width: `${(results.length / cglPlayers.length) * 100}%`,
              }}
            />
          </span>
        </div>
      </header>

      <nav className={styles.roundNav} aria-label="Choose a CGL round">
        {cglRounds.map((entry) =>
          entry.status === "open" ? (
            <Link
              key={entry.id}
              href={`/cgl/rounds/${entry.id}`}
              aria-current={entry.id === roundId ? "page" : undefined}
            >
              <span className={styles.roundNavNumber}>
                R{entry.number}
                <Check size={12} aria-hidden="true" />
              </span>
              <span>{entry.course}</span>
              <small>
                {entry.id === roundId ? "Viewing round" : "Open for play"}
              </small>
            </Link>
          ) : (
            <span
              key={entry.id}
              className={styles.lockedRound}
              aria-disabled="true"
            >
              <span className={styles.roundNavNumber}>
                R{entry.number}
                <LockKeyhole size={11} aria-hidden="true" />
              </span>
              <span>{entry.course}</span>
              <small>
                Opens{" "}
                {entry.opensLabel.replace(String(cglSeason.year), "").trim()}
              </small>
            </span>
          ),
        )}
      </nav>

      <div className={styles.pageJumps} aria-label="Round centre sections">
        <a href="#round-achievements">Achievements</a>
        <a href="#round-scoreboard">Round scoreboard</a>
        <a href="#league-snapshot">League standings</a>
      </div>

      <section
        id="round-achievements"
        className={styles.achievements}
        aria-labelledby="achievement-heading"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>The round in numbers</p>
            <h2 id="achievement-heading">
              Standout performances<span>.</span>
            </h2>
          </div>
          <span className={styles.provisionalBadge}>Provisional leaders</span>
        </div>
        <p className={styles.sectionCopy}>
          The best of the field, with every joint leader recognised. Open a
          player’s card to see the round behind the result.
        </p>
        <div className={styles.achievementGrid}>
          {mainAchievements.map((achievement) => (
            <article
              key={achievement.id}
              className={`${styles.achievementCard} ${achievement.id === "net" ? styles.netCard : ""} ${achievement.id === "gross" ? styles.grossCard : ""}`}
            >
              <div className={styles.achievementTop}>
                <h3>{achievement.label}</h3>
                <span className={styles.achievementIcon}>
                  <AchievementIcon id={achievement.id} />
                </span>
              </div>
              <p className={styles.achievementValue}>
                {number(achievement.value)}
                <span>{achievement.unit}</span>
              </p>
              <div className={styles.achievementLeaders}>
                {achievement.winners.map(({ player }) => (
                  <Link
                    key={player.username}
                    href={scorecardHref(player.username, roundId)}
                  >
                    <span>{player.username}</span>
                    <ArrowUpRight size={13} aria-hidden="true" />
                    <span className={styles.srOnly}>
                      {" "}
                      — round {round.number} scorecard
                    </span>
                  </Link>
                ))}
              </div>
              <p className={styles.achievementDetail}>
                {achievement.winners.length > 1
                  ? `${achievement.winners.length} joint leaders · `
                  : ""}
                {achievement.detail}
              </p>
            </article>
          ))}
        </div>
        {birdies && (
          <div className={styles.birdieRibbon}>
            <span className={styles.birdieIcon}>
              <Flag size={19} aria-hidden="true" />
            </span>
            <div>
              <h3>{birdies.label}</h3>
              <p>
                {birdies.winners.length > 1 ? "Joint leaders · " : ""}
                {birdies.winners.map(({ player }, index) => (
                  <span key={player.username}>
                    {index > 0 && <span> &amp; </span>}
                    <Link href={scorecardHref(player.username, roundId)}>
                      {player.username}
                      <span className={styles.srOnly}>
                        {" "}
                        — round {round.number} scorecard
                      </span>
                    </Link>
                  </span>
                ))}
              </p>
            </div>
            <strong>
              {number(birdies.value, 0)}
              <span> {birdies.unit}</span>
            </strong>
            <span className={styles.birdieDetail}>
              On a completed 18-hole card
            </span>
          </div>
        )}
        <p className={styles.achievementNote}>
          <Info size={13} aria-hidden="true" />
          Completed 18-hole cards only. Leaders can change while this round
          stays open.
        </p>
      </section>

      <div className={styles.resultsGrid}>
        <section
          className={styles.scoreboard}
          id="round-scoreboard"
          aria-labelledby="scoreboard-heading"
        >
          <div className={styles.boardHeading}>
            <div>
              <p className={styles.eyebrow}>Every player. Every finish.</p>
              <h2 id="scoreboard-heading">Round scoreboard</h2>
            </div>
            <div
              className={styles.scoringToggle}
              role="group"
              aria-label="Round scoring format"
            >
              {(["net", "gross"] as const).map((format) => (
                <button
                  key={format}
                  type="button"
                  aria-pressed={scoring === format}
                  onClick={() => setScoring(format)}
                >
                  {format === "net" ? "Net" : "Gross"}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.toolbar}>
            <label className={styles.divisionSelect}>
              <span>Division</span>
              <select
                value={division}
                onChange={(event) => setDivision(event.target.value)}
              >
                <option value="all">All divisions</option>
                {["Division 1", "Division 2", "Division 3"].map((entry) => (
                  <option value={entry} key={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.searchControl}>
              <span>Find a player</span>
              <span className={styles.searchWrap}>
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="SGT username"
                />
              </span>
            </label>
            {(query || division !== "all") && (
              <button
                className={styles.clearFilters}
                type="button"
                onClick={() => {
                  setQuery("");
                  setDivision("all");
                }}
              >
                <X size={13} aria-hidden="true" />
                Clear
              </button>
            )}
          </div>
          <div className={styles.tableMeta}>
            <p aria-live="polite">
              <strong>{filteredResults.length}</strong>{" "}
              {filteredResults.length === 1
                ? "completed card"
                : "completed cards"}
              {division !== "all" ? ` · ${division}` : " · All divisions"}
            </p>
            <span>
              {scoring === "net" ? "Net" : "Gross"}{" "}
              <ArrowDown size={11} aria-hidden="true" /> Lowest first
            </span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>
                Round {round.number} {scoring} results. All positions and points
                are calculated against the whole field before filtering. Scores
                and points remain provisional.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={styles.rankColumn}>
                    Pos
                  </th>
                  <th scope="col" className={styles.playerColumn}>
                    Player
                  </th>
                  <th scope="col" className={styles.hcpColumn}>
                    <abbr title="Round handicap">HCP</abbr>
                  </th>
                  <th scope="col" className={styles.secondaryScore}>
                    {scoring === "net" ? "Gross" : "Net"}
                  </th>
                  <th scope="col" className={styles.scoreColumn}>
                    {scoring === "net" ? "Net" : "Gross"}
                  </th>
                  <th scope="col" className={styles.parColumn}>
                    To par
                  </th>
                  <th scope="col" className={styles.pointsColumn}>
                    Points
                  </th>
                  <th scope="col" className={styles.cardColumn}>
                    <span className={styles.srOnly}>Scorecard</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map(
                  ({ player, card, rank, tied, points, toPar }) => (
                    <tr
                      key={player.username}
                      className={rank === 1 ? styles.leaderRow : undefined}
                    >
                      <td className={styles.rankColumn}>
                        <strong
                          className={
                            rank === 1 ? styles.leadingRank : undefined
                          }
                        >
                          {formatCglRank(rank, tied)}
                        </strong>
                      </td>
                      <th scope="row" className={styles.playerColumn}>
                        <Link href={scorecardHref(player.username, roundId)}>
                          <span
                            className={styles.avatar}
                            style={{ backgroundColor: `${player.color}25` }}
                            aria-hidden="true"
                          >
                            {player.initials}
                          </span>
                          <span className={styles.playerInfo}>
                            <strong>{player.username}</strong>
                            <small>
                              {player.division} <span>· 18 holes</span>
                            </small>
                          </span>
                        </Link>
                      </th>
                      <td className={styles.hcpColumn}>
                        {number(card.handicap)}
                      </td>
                      <td className={styles.secondaryScore}>
                        {scoring === "net" ? card.gross : card.net}
                      </td>
                      <td className={styles.scoreColumn}>
                        <strong>{card[scoring]}</strong>
                        <span className={styles.mobilePar}>
                          <span className={styles.srOnly}>To par </span>
                          {scoreToPar(toPar)}
                        </span>
                      </td>
                      <td className={styles.parColumn}>
                        <span
                          className={toPar < 0 ? styles.underPar : undefined}
                        >
                          {scoreToPar(toPar)}
                        </span>
                      </td>
                      <td className={styles.pointsColumn}>{number(points)}</td>
                      <td className={styles.cardColumn}>
                        <Link
                          href={scorecardHref(player.username, roundId)}
                          aria-label={`Open ${player.username} round ${round.number} scorecard`}
                        >
                          <ArrowUpRight size={17} aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            {filteredResults.length === 0 && (
              <div className={styles.emptyResults}>
                <Search size={24} aria-hidden="true" />
                <h3>No matching completed cards</h3>
                <p>Try another username or show all divisions.</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setDivision("all");
                  }}
                >
                  Show all completed cards
                </button>
              </div>
            )}
          </div>
          <p className={styles.boardFoot}>
            <Info size={14} aria-hidden="true" />
            <span>
              Division filters retain whole-field ranks and points. Tied
              finishes share points for the places occupied.
            </span>
          </p>
          {waitingPlayers.length > 0 && (
            <details className={styles.waitingPlayers}>
              <summary>
                <span>
                  <span className={styles.waitingDot} aria-hidden="true" />
                  {waitingPlayers.length}{" "}
                  {waitingPlayers.length === 1 ? "player" : "players"} still to
                  post a card
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </summary>
              <div>
                {waitingPlayers.map((player) => (
                  <Link
                    key={player.username}
                    href={`/cgl/players/${encodeURIComponent(player.username)}`}
                  >
                    <span>{player.username}</span>
                    <small>{player.division}</small>
                  </Link>
                ))}
                <p>
                  Unplayed rounds earn no points. Players can catch up until the
                  season closes.
                </p>
              </div>
            </details>
          )}
        </section>

        <aside
          className={styles.leagueSnapshot}
          id="league-snapshot"
          aria-labelledby="league-heading"
        >
          <div className={styles.leagueHeading}>
            <Trophy size={19} aria-hidden="true" />
            <span>Beyond this round</span>
          </div>
          <h2 id="league-heading">
            The league picture<span>.</span>
          </h2>
          <p className={styles.leagueIntro}>
            Net season points · All divisions
            <br />
            Every completed CGL round counts.
          </p>
          <ol className={styles.seasonList}>
            {seasonStandings
              .slice(0, 5)
              .map(({ player, rank, tied, points, played }) => (
                <li key={player.username}>
                  <span className={styles.seasonRank}>
                    {formatCglRank(rank, tied)}
                  </span>
                  <Link
                    href={`/cgl/players/${encodeURIComponent(player.username)}`}
                  >
                    <strong>{player.username}</strong>
                    <small>{played} rounds played</small>
                  </Link>
                  <span className={styles.seasonPoints}>
                    {number(points)}
                    <small>pts</small>
                  </span>
                </li>
              ))}
          </ol>
          <Link className={styles.fullLeagueLink} href="/cgl/leaderboard">
            Full league standings <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
          <p className={styles.leagueNote}>
            Provisional. Catch-up rounds can change season positions.
          </p>
          <div className={styles.deadline}>
            <CalendarDays size={18} aria-hidden="true" />
            <div>
              <span>Season closes</span>
              <strong>{cglSeason.closeLabel}</strong>
              <p>All released rounds stay available.</p>
            </div>
          </div>
        </aside>
      </div>

      <div className={styles.previewFootnote}>
        <span>About this preview</span>
        <p>
          Fictional players, courses and results show how the round centre will
          work. These achievements are sample results; live SGT statistics are
          not connected to this page.
        </p>
      </div>
    </div>
  );
}
