"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  Flag,
  Target,
  Trophy,
} from "lucide-react";
import {
  cglPlayers,
  cglRounds,
  cglSeason,
  formatCglRank,
  getCglPlayer,
  getCglPlayerCards,
  getCglRoundPoints,
  getCglStandings,
} from "@/lib/cgl-demo";
import styles from "./CglPlayerProfile.module.css";

const number = (value: number, decimals = 0) =>
  value.toLocaleString("en-AU", { maximumFractionDigits: decimals });

function Stat({
  label,
  value,
  suffix,
  detail,
  children,
}: {
  label: string;
  value: string;
  suffix?: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.stat}>
      <h3>{label}</h3>
      <p className={styles.statValue}>
        {value}
        {suffix && <span>{suffix}</span>}
      </p>
      {children}
      <p className={styles.statDetail}>{detail}</p>
    </div>
  );
}

export default function CglPlayerProfile({ username }: { username: string }) {
  const router = useRouter();
  const [scope, setScope] = useState("season");
  useEffect(() => {
    const openLinkedScorecard = () => {
      const cardId = window.location.hash.slice(1);
      if (!/^card-r[1-6]$/.test(cardId)) return;
      const card = document.getElementById(cardId);
      if (card instanceof HTMLDetailsElement) {
        card.open = true;
        requestAnimationFrame(() => card.scrollIntoView({ block: "start" }));
      }
    };
    openLinkedScorecard();
    window.addEventListener("hashchange", openLinkedScorecard);
    return () => window.removeEventListener("hashchange", openLinkedScorecard);
  }, [username]);
  const player = getCglPlayer(username);
  const cards = getCglPlayerCards(username);
  const standings = getCglStandings("net");
  const standing = standings.find(
    (entry) => entry.player.username === player?.username,
  );

  if (!player) return null;

  const selectedCards =
    scope === "season" ? cards : cards.filter((card) => card.roundId === scope);
  const roundCount = selectedCards.length;
  const total = (
    key:
      | "drive"
      | "fairwaysHit"
      | "fairwaysPossible"
      | "greensHit"
      | "putts"
      | "puttingDistance",
  ) => selectedCards.reduce((sum, card) => sum + card[key], 0);
  const fairwaysHit = total("fairwaysHit");
  const fairwaysPossible = total("fairwaysPossible");
  const greensHit = total("greensHit");
  const holesPlayed = selectedCards.reduce(
    (sum, card) => sum + card.holes.length,
    0,
  );
  const fairwaysPercentage = fairwaysPossible
    ? Math.round((fairwaysHit / fairwaysPossible) * 100)
    : 0;
  const greensPercentage = holesPlayed
    ? Math.round((greensHit / holesPlayed) * 100)
    : 0;
  const longestDrive = Math.max(
    0,
    ...selectedCards.map((card) => card.longestDrive),
  );
  const closestPin = selectedCards.length
    ? Math.min(...selectedCards.map((card) => card.ctp))
    : 0;
  const bestNet = cards.length
    ? Math.min(...cards.map((card) => card.net))
    : null;
  const openRounds = cglRounds.filter((round) => round.status === "open");
  const scopeRound = cglRounds.find((round) => round.id === scope);
  const scopeLabel = scopeRound
    ? `Round ${scopeRound.number} · ${scopeRound.course}`
    : `${cglSeason.name} · ${cards.length} completed ${cards.length === 1 ? "round" : "rounds"}`;
  const netMaximum = Math.max(85, ...cards.map((card) => card.net + 5));

  return (
    <div className={styles.profile}>
      <div className={styles.topline}>
        <Link href="/cgl/leaderboard" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden="true" /> All leaderboards
        </Link>
        <label className={styles.playerSelect}>
          <span>View player</span>
          <select
            value={player.username}
            onChange={(event) =>
              router.push(
                `/cgl/players/${encodeURIComponent(event.target.value)}`,
              )
            }
          >
            {cglPlayers.map((entry) => (
              <option key={entry.username} value={entry.username}>
                {entry.username}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section
        className={styles.playerHeader}
        aria-labelledby="cgl-player-heading"
      >
        <div className={styles.identity}>
          <div
            className={styles.avatar}
            style={{ backgroundColor: player.color }}
            aria-hidden="true"
          >
            {player.initials}
          </div>
          <div>
            <p className={styles.eyebrow}>
              Player stats <span> / {cglSeason.year}</span>
            </p>
            <h1 id="cgl-player-heading">{player.username}</h1>
            <div className={styles.playerMeta}>
              <span>{player.division}</span>
              <span>SGT username</span>
              <span>Public profile</span>
            </div>
          </div>
        </div>
        <div className={styles.handicap}>
          <span>SGT handicap · sample</span>
          <strong>{player.handicap.toFixed(1)}</strong>
          <small>Managed through SGT</small>
        </div>
      </section>

      <div className={styles.seasonSummary}>
        <div>
          <Trophy size={20} aria-hidden="true" />
          <span>Overall Net position</span>
          <strong>
            {standing ? formatCglRank(standing.rank, standing.tied) : "—"}
            <small> / {standings.length}</small>
          </strong>
        </div>
        <div>
          <span>Season points</span>
          <strong>
            {number(standing?.points ?? 0, 1)}
            <small> pts</small>
          </strong>
        </div>
        <div>
          <span>Rounds completed</span>
          <strong>
            {cards.length}
            <small> / {cglSeason.releasedRounds} open</small>
          </strong>
        </div>
        <div>
          <span>Best Net round</span>
          <strong>
            {bestNet ?? "—"}
            <small> strokes</small>
          </strong>
        </div>
      </div>
      <p className={styles.summaryNote}>
        Provisional standings. Points are earned against the whole field and
        also count within {player.division}.
      </p>

      <section
        aria-labelledby="performance-heading"
        className={styles.performance}
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>The details behind the score</p>
            <h2 id="performance-heading">Performance at a glance.</h2>
          </div>
          <label className={styles.roundSelect}>
            <span>Stats period</span>
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value)}
            >
              <option value="season">Full season</option>
              {openRounds.map((round) => (
                <option key={round.id} value={round.id}>
                  Round {round.number} · {round.course}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className={styles.periodLabel} aria-live="polite">
          {scopeLabel}
        </p>
        {roundCount > 0 ? (
          <div
            className={styles.statsGrid}
            aria-live="polite"
            aria-atomic="true"
          >
            <Stat
              label="Average drive"
              value={number(total("drive") / roundCount, 1)}
              suffix="m"
              detail={`Longest drive ${number(longestDrive)} m`}
            />
            <Stat
              label="Fairways in regulation"
              value={number(fairwaysPercentage)}
              suffix="%"
              detail={`${fairwaysHit} of ${fairwaysPossible} fairways hit`}
            >
              <div className={styles.meter} aria-hidden="true">
                <span style={{ width: `${fairwaysPercentage}%` }} />
              </div>
            </Stat>
            <Stat
              label="Greens in regulation"
              value={number(greensPercentage)}
              suffix="%"
              detail={`${greensHit} of ${holesPlayed} greens hit`}
            >
              <div className={styles.meter} aria-hidden="true">
                <span style={{ width: `${greensPercentage}%` }} />
              </div>
            </Stat>
            <Stat
              label="Number of putts"
              value={number(total("putts"))}
              detail={`${number(total("putts") / roundCount, 1)} putts per round`}
            />
            <Stat
              label="Total putting distance"
              value={number(total("puttingDistance"), 1)}
              suffix="m"
              detail="Combined distance of putts holed"
            />
            <Stat
              label="Closest to the pin"
              value={number(closestPin, 2)}
              suffix="m"
              detail={
                scope === "season"
                  ? "Best CTP across completed rounds"
                  : "CTP on the nominated hole"
              }
            >
              <Target
                size={22}
                className={styles.statIcon}
                aria-hidden="true"
              />
            </Stat>
          </div>
        ) : (
          <div className={styles.empty}>
            <Flag size={25} aria-hidden="true" />
            <h3>This round is waiting.</h3>
            <p>
              {player.username} has not played this round yet. It remains
              available until the season closes.
            </p>
          </div>
        )}
        <p className={styles.dataNote}>
          CGL rounds only. These are sample statistics; availability through SGT
          embeds is still being confirmed.
        </p>
      </section>

      <section
        className={styles.formPanel}
        aria-labelledby="round-form-heading"
      >
        <div className={styles.formIntro}>
          <p className={styles.eyebrow}>Round by round</p>
          <h2 id="round-form-heading">Finding a rhythm.</h2>
          <p>Net scores from completed CGL rounds. Lower is better.</p>
          <span className={styles.formKey}>
            <i aria-hidden="true" /> Net strokes
          </span>
        </div>
        <div
          className={styles.chart}
          role="img"
          aria-label={`Net scores: ${cards.map((card) => `round ${cglRounds.find((round) => round.id === card.roundId)?.number}, ${card.net} strokes`).join("; ") || "no completed rounds"}. Lower scores are better.`}
        >
          {openRounds.map((round) => {
            const card = cards.find((entry) => entry.roundId === round.id);
            return (
              <div className={styles.chartColumn} key={round.id}>
                <span className={styles.chartNumber}>{card?.net ?? "—"}</span>
                <div className={styles.chartTrack}>
                  {card && (
                    <div
                      className={styles.chartBar}
                      style={{
                        height: `${Math.max(12, (card.net / netMaximum) * 100)}%`,
                      }}
                    />
                  )}
                  {!card && (
                    <span className={styles.chartPending}>Not played</span>
                  )}
                </div>
                <span className={styles.chartLabel}>R{round.number}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section
        className={styles.history}
        aria-labelledby="round-history-heading"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Every shot. Every round.</p>
            <h2 id="round-history-heading">CGL round history.</h2>
          </div>
          <span className={styles.historyCount}>
            {cards.length} completed / {cglSeason.releasedRounds} open
          </span>
        </div>
        <p className={styles.historyIntro}>
          Open a completed round for the hole-by-hole scorecard. All released
          rounds stay open until the season deadline.
        </p>
        <div className={styles.roundList}>
          {openRounds.map((round) => {
            const card = cards.find((entry) => entry.roundId === round.id);
            if (!card)
              return (
                <div className={styles.unplayedRound} key={round.id}>
                  <span className={styles.roundNumber}>R{round.number}</span>
                  <div>
                    <h3>{round.course}</h3>
                    <p>
                      {round.location} · Par {round.par}
                    </p>
                  </div>
                  <span className={styles.unplayedLabel}>
                    Not played <small>Open for catch-up</small>
                  </span>
                </div>
              );
            return (
              <details
                className={styles.roundDetails}
                id={`card-${round.id}`}
                tabIndex={-1}
                key={round.id}
              >
                <summary>
                  <span className={styles.roundNumber}>R{round.number}</span>
                  <span className={styles.roundCourse}>
                    <strong>{round.course}</strong>
                    <small>
                      {round.location} · Par {round.par}
                    </small>
                  </span>
                  <span className={styles.roundScore}>
                    <small>Gross</small>
                    <strong>{card.gross}</strong>
                  </span>
                  <span className={styles.roundScore}>
                    <small>Net</small>
                    <strong>{card.net}</strong>
                  </span>
                  <span className={styles.roundPoints}>
                    <small>Points</small>
                    <strong>
                      {number(
                        getCglRoundPoints(player.username, round.id, "net"),
                        1,
                      )}
                    </strong>
                  </span>
                  <span className={styles.scorecardLabel}>
                    Scorecard <ChevronDown size={17} aria-hidden="true" />
                  </span>
                </summary>
                <div className={styles.scorecard}>
                  <p className={styles.scorecardNote}>
                    Round handicap {card.handicap.toFixed(1)} · Actual putting ·
                    One attempt · Points provisional
                  </p>
                  {[0, 9].map((start) => {
                    const nine = card.holes.slice(start, start + 9);
                    return (
                      <div
                        className={styles.scorecardScroll}
                        tabIndex={0}
                        role="region"
                        aria-label={`Round ${round.number} ${start === 0 ? "front" : "back"} nine scorecard, scroll horizontally if needed`}
                        key={start}
                      >
                        <table>
                          <caption>
                            {start === 0 ? "Front nine" : "Back nine"}
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">Hole</th>
                              {nine.map((_, index) => (
                                <th scope="col" key={index}>
                                  {start + index + 1}
                                </th>
                              ))}
                              <th scope="col">{start === 0 ? "Out" : "In"}</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <th scope="row">Par</th>
                              {nine.map((hole, index) => (
                                <td key={index}>{hole.par}</td>
                              ))}
                              <td>
                                {nine.reduce((sum, hole) => sum + hole.par, 0)}
                              </td>
                            </tr>
                            <tr className={styles.grossRow}>
                              <th scope="row">Gross</th>
                              {nine.map((hole, index) => (
                                <td key={index}>{hole.score}</td>
                              ))}
                              <td>
                                {nine.reduce(
                                  (sum, hole) => sum + hole.score,
                                  0,
                                )}
                              </td>
                            </tr>
                            <tr>
                              <th scope="row">Putts</th>
                              {nine.map((hole, index) => (
                                <td key={index}>{hole.putts}</td>
                              ))}
                              <td>
                                {nine.reduce(
                                  (sum, hole) => sum + hole.putts,
                                  0,
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                  <div className={styles.scorecardTotals}>
                    <span>18-hole totals</span>
                    <span>
                      Par{" "}
                      <strong>
                        {card.holes.reduce((sum, hole) => sum + hole.par, 0)}
                      </strong>
                    </span>
                    <span>
                      Gross <strong>{card.gross}</strong>
                    </span>
                    <span>
                      Net <strong>{card.net}</strong>
                    </span>
                    <span>
                      Putts <strong>{card.putts}</strong>
                    </span>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <div className={styles.profileFooter}>
        <div>
          <strong>The season is still in play.</strong>
          <p>
            Catch-up rounds can change positions and points until the season
            closes.
          </p>
        </div>
        <Link href="/cgl/leaderboard">
          Explore the standings <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
