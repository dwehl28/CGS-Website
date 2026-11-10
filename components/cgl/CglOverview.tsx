import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  Flag,
  Globe2,
  Info,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import {
  cglPlayers,
  cglRounds,
  cglSeason,
  formatCglRank,
  getCglPlayer,
  getCglPlayerCards,
  getCglStandings,
  getCglRoundAchievements,
} from "@/lib/cgl-demo";
import CglCourseMap from "./CglCourseMap";
import styles from "./CglOverview.module.css";

export default function CglOverview({ children }: { children?: ReactNode }) {
  const standings = getCglStandings("net");
  const samplePlayer = getCglPlayer("FairwayFox")!;
  const sampleStanding = standings.find(
    (row) => row.player.username === samplePlayer.username,
  )!;
  const cards = getCglPlayerCards(samplePlayer.username);
  const averageDrive = Math.round(
    cards.reduce((total, card) => total + card.drive, 0) / cards.length,
  );
  const greens = cards.reduce((total, card) => total + card.greensHit, 0);
  const gir = Math.round((greens / (cards.length * 18)) * 100);
  const latestRound = cglRounds
    .filter((round) => round.status === "open")
    .at(-1)!;
  const highlights = getCglRoundAchievements(latestRound.id).filter((award) =>
    ["gross", "drive", "putts", "ctp"].includes(award.id),
  );

  return (
    <div className={styles.page}>
      <div className={styles.kicker}>
        <span className={styles.kickerLine} /> THE CROSSODOG GOLF LEAGUE{" "}
        <span className={styles.year}>EST. 2027</span>
      </div>
      <section className={styles.hero} aria-labelledby="cgl-welcome">
        <div className={styles.heroCopy}>
          <span className={styles.seasonChip}>
            <span /> THE CROSSODOG GOLF LEAGUE
          </span>
          <h1 id="cgl-welcome">
            Every round.
            <br />
            Every <em>standout.</em>
          </h1>
          <p>
            The scores, the season race and the shots worth talking about. Your
            league, all in one place.
          </p>
          <div className={styles.heroActions}>
            <Link
              href={`/cgl/rounds/${latestRound.id}`}
              className={styles.primary}
            >
              Explore the round centre <ArrowUpRight size={18} />
            </Link>
            <Link href="/cgl/trial" className={styles.secondary}>
              Open the SGT trial <ArrowRight size={17} />
            </Link>
          </div>
          <div className={styles.heroFoot}>
            <Globe2 size={15} />
            <span>GSPro simulators · Australia & beyond</span>
          </div>
        </div>
        <div className={styles.heroCourse}>
          <CglCourseMap />
          <div className={styles.courseStamp}>
            <Flag size={15} /> LATEST RELEASE{" "}
            <strong>ROUND {String(latestRound.number).padStart(2, "0")}</strong>
          </div>
          <div className={styles.courseInfo}>
            <span>OPEN IN THE SAMPLE SEASON</span>
            <h2>{latestRound.course}</h2>
            <p>
              18 holes <i /> Par {latestRound.par} <i /> One attempt
            </p>
            <Link href={`/cgl/rounds/${latestRound.id}`}>
              Achievements & round results <ArrowUpRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      <div className={styles.seasonStrip} aria-label="Sample season overview">
        <div>
          <Users size={19} />
          <span>
            <strong>{cglPlayers.length}</strong> founding players
          </span>
        </div>
        <div>
          <Flag size={19} />
          <span>
            <strong>
              {cglSeason.releasedRounds} / {cglSeason.totalRounds}
            </strong>{" "}
            rounds released
          </span>
        </div>
        <div>
          <CalendarDays size={19} />
          <span>
            <strong>{cglSeason.closeLabel}</strong> sample season closes
          </span>
        </div>
        <a href="#format">
          Every round counts <ArrowDownIcon />
        </a>
      </div>

      <section className={styles.spotlight} aria-labelledby="cgl-standouts">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>
              ROUND {latestRound.number} · SAMPLE ACHIEVEMENTS
            </span>
            <h2 id="cgl-standouts">A little well-earned recognition.</h2>
          </div>
          <Link href={`/cgl/rounds/${latestRound.id}#round-achievements`}>
            All round achievements <ArrowRight size={16} />
          </Link>
        </div>
        <div className={styles.spotlightGrid}>
          {highlights.map((award) => (
            <article className={styles.spotlightCard} key={award.id}>
              <span className={styles.spotlightLabel}>{award.label}</span>
              <strong className={styles.spotlightValue}>
                {award.value.toLocaleString("en-AU", {
                  maximumFractionDigits: 1,
                })}
                <small>{award.unit}</small>
              </strong>
              <div className={styles.spotlightWinners}>
                {award.winners.map(({ player }) => (
                  <Link
                    href={`/cgl/players/${encodeURIComponent(player.username)}#card-${latestRound.id}`}
                    key={player.username}
                  >
                    {player.username}
                    <ArrowUpRight size={13} />
                  </Link>
                ))}
              </div>
              <p>
                {award.winners.length > 1
                  ? "Joint round leaders"
                  : "Round leader"}{" "}
                · View scorecard
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.dashboardGrid} aria-label="Season at a glance">
        <div className={styles.standingsPanel}>
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>THE RACE TO THE TOP</span>
              <h2>Season standings</h2>
            </div>
            <span className={styles.status}>
              <span /> Provisional
            </span>
          </div>
          <div className={styles.tableHeading}>
            <span>POS / PLAYER</span>
            <span>PLAYED</span>
            <span>NET POINTS</span>
          </div>
          <ol className={styles.standingsList}>
            {standings.slice(0, 5).map((row) => (
              <li key={row.player.username}>
                <span
                  className={`${styles.rank} ${row.rank === 1 ? styles.first : ""}`}
                >
                  {formatCglRank(row.rank, row.tied)}
                </span>
                <Link
                  href={`/cgl/players/${encodeURIComponent(row.player.username)}`}
                  className={styles.playerName}
                >
                  <span
                    className={styles.avatar}
                    style={{ background: `${row.player.color}22` }}
                    aria-hidden="true"
                  >
                    {row.player.initials}
                  </span>
                  <span>
                    <strong>{row.player.username}</strong>
                    <small>{row.player.division}</small>
                  </span>
                </Link>
                <span className={styles.played}>
                  {row.played}
                  <small> / {cglSeason.releasedRounds}</small>
                </span>
                <strong className={styles.points}>
                  {row.points.toLocaleString("en-AU", {
                    maximumFractionDigits: 1,
                  })}
                </strong>
              </li>
            ))}
          </ol>
          <Link className={styles.panelLink} href="/cgl/leaderboard">
            See all players & divisions <ArrowRight size={17} />
          </Link>
          <p className={styles.panelNote}>
            <Info size={14} /> Catch-up rounds can change positions and points.
          </p>
        </div>

        <div className={styles.profilePanel}>
          <div className={styles.profileTop}>
            <span className={styles.eyebrow}>A CLOSER LOOK AT YOUR GAME</span>
            <Target size={20} />
          </div>
          <div className={styles.profileIdentity}>
            <span
              className={styles.profileAvatar}
              style={{ background: `${samplePlayer.color}33` }}
              aria-hidden="true"
            >
              {samplePlayer.initials}
            </span>
            <div>
              <span className={styles.sampleLabel}>SAMPLE PLAYER PROFILE</span>
              <h2>{samplePlayer.username}</h2>
              <p>
                {samplePlayer.division} <span>·</span> HCP{" "}
                {samplePlayer.handicap}
              </p>
            </div>
          </div>
          <div className={styles.miniStats}>
            <div>
              <span>Season position</span>
              <strong>
                {formatCglRank(sampleStanding.rank, sampleStanding.tied)}
                <small> / {cglPlayers.length}</small>
              </strong>
            </div>
            <div>
              <span>Net points</span>
              <strong>
                {sampleStanding.points.toLocaleString("en-AU", {
                  maximumFractionDigits: 1,
                })}
              </strong>
            </div>
            <div>
              <span>Average drive</span>
              <strong>
                {averageDrive}
                <small> m</small>
              </strong>
            </div>
            <div>
              <span>Greens in regulation</span>
              <strong>
                {gir}
                <small>%</small>
              </strong>
            </div>
          </div>
          <Link href="/cgl/players/FairwayFox" className={styles.profileLink}>
            Explore the full player profile <ArrowUpRight size={19} />
          </Link>
          <p className={styles.profileNote}>
            Round history, scorecards, putting and more.
            <br />
            All from your CGL rounds.
          </p>
        </div>
      </section>

      {children}

      <section className={styles.roundsSection} aria-labelledby="cgl-rounds">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>ONE SEASON. YOUR SCHEDULE.</span>
            <h2 id="cgl-rounds">The road ahead</h2>
          </div>
          <span className={styles.scheduleLabel}>
            Illustrative six-round schedule
          </span>
        </div>
        <p className={styles.sectionDescription}>
          A new round each week. Once released, it stays open until the season
          deadline.
        </p>
        <div className={styles.roundGrid}>
          {cglRounds.map((round) => (
            <article
              key={round.id}
              className={`${styles.roundCard} ${round.status === "upcoming" ? styles.upcoming : ""}`}
            >
              <div className={styles.roundCardTop}>
                <span>ROUND {String(round.number).padStart(2, "0")}</span>
                <span
                  className={
                    round.status === "open"
                      ? styles.openBadge
                      : styles.upcomingBadge
                  }
                >
                  {round.status === "open" ? "Open" : "Upcoming"}
                </span>
              </div>
              <div className={styles.roundMap}>
                <CglCourseMap compact />
              </div>
              <div className={styles.roundCardBody}>
                <span className={styles.roundLocation}>{round.location}</span>
                <h3>{round.course}</h3>
                <p>18 holes · Par {round.par}</p>
                {round.status === "open" ? (
                  <Link href={`/cgl/rounds/${round.id}`}>
                    Round centre <ArrowUpRight size={16} />
                  </Link>
                ) : (
                  <span className={styles.releaseDate}>
                    <CalendarDays size={14} /> Opens {round.opensLabel}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        id="format"
        className={styles.formatSection}
        aria-labelledby="cgl-format-title"
      >
        <div>
          <span className={styles.eyebrow}>PROPER GOLF. LESS FUSS.</span>
          <h2 id="cgl-format-title">
            A league that fits
            <br />
            around <em>your life.</em>
          </h2>
          <p>
            Play from any GSPro setup with actual putting, on your own time.
            Every valid round moves your season forward.
          </p>
        </div>
        <div className={styles.rulesGrid}>
          <div>
            <span>01</span>
            <h3>Play your round</h3>
            <p>
              Solo. 18 holes. One attempt per event. Released rounds stay open
              until the season ends.
            </p>
          </div>
          <div>
            <span>02</span>
            <h3>Earn your points</h3>
            <p>
              Finish against the whole field. The same points count in overall
              and division standings.
            </p>
          </div>
          <div>
            <span>03</span>
            <h3>Follow your game</h3>
            <p>
              Gross and Net results, SGT-managed handicaps and a public history
              of your CGL rounds.
            </p>
          </div>
          <div>
            <span>04</span>
            <h3>Join and catch up</h3>
            <p>
              Joining after the start is welcome. Play earlier rounds before the
              shared season deadline.
            </p>
          </div>
        </div>
      </section>

      <section
        id="join"
        className={styles.joinSection}
        aria-labelledby="cgl-join-title"
      >
        <div className={styles.joinTitle}>
          <Trophy size={27} />
          <div>
            <span className={styles.eyebrow}>THE FIRST SEASON STARTS HERE</span>
            <h2 id="cgl-join-title">Be part of the first chapter.</h2>
          </div>
        </div>
        <p>
          CGL is coming in 2027. Season dates, entry fee and prizes are still
          being finalised.
        </p>
        <div className={styles.joinChecklist}>
          <span>
            <Check size={15} /> CGS account
          </span>
          <span>
            <Check size={15} /> Linked SGT player details
          </span>
          <span>
            <Check size={15} /> One season entry
          </span>
        </div>
        <div className={styles.joinBottom}>
          <span>Registration and payments will open after testing.</span>
          <Link href="/cgl/leaderboard">
            Explore the preview <ChevronRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}

function ArrowDownIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path d="M8 2v11m-4-4 4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
