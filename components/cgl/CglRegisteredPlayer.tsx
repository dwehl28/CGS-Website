import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  ClipboardList,
  Flag,
  UserRound,
} from "lucide-react";
import type { CglTrialPlayer } from "@/lib/cgl-roster";
import styles from "./CglRegisteredPlayer.module.css";

export default function CglRegisteredPlayer({
  player,
}: {
  player: CglTrialPlayer;
}) {
  return (
    <div className={styles.page}>
      <Link href="/cgl/trial#trial-players" className={styles.back}>
        <ArrowLeft size={15} aria-hidden="true" />
        All trial players
      </Link>

      <header className={styles.hero}>
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">
            {player.username.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <span className={styles.eyebrow}>CGL PLAYER PROFILE</span>
            <h1>{player.username}</h1>
            <span className={styles.badge}>
              <Flag size={12} aria-hidden="true" />
              Registered · Trial
            </span>
          </div>
        </div>
        <a
          href={player.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.sgtLink}
        >
          SGT profile
          <ArrowUpRight size={16} aria-hidden="true" />
          <span className={styles.srOnly}>
            {" "}
            for {player.username}, opens in a new tab
          </span>
        </a>
      </header>

      <section
        className={styles.history}
        id="scorecards"
        aria-labelledby="cgl-player-scorecards-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>EVERY SHOT HAS A STORY</span>
            <h2 id="cgl-player-scorecards-title">CGL scorecards & stats</h2>
          </div>
          <span className={styles.historyLabel}>CGL rounds only</span>
        </div>

        {player.scorecardUrl ? (
          <>
            <p className={styles.description}>
              Explore your holes, statistics and shots in the SGT scorecard
              below.
            </p>
            <article
              className={styles.scorecard}
              aria-labelledby="cgl-linked-scorecard-title"
            >
              <div className={styles.cardHeading}>
                <div>
                  <ClipboardList size={19} aria-hidden="true" />
                  <div>
                    <span>CGL TRIAL · TEST COMP 1</span>
                    <h3 id="cgl-linked-scorecard-title">Hamilton scorecard</h3>
                  </div>
                </div>
                <a
                  href={player.scorecardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in SGT
                  <ArrowUpRight size={15} aria-hidden="true" />
                  <span className={styles.srOnly}>, opens in a new tab</span>
                </a>
              </div>
              <iframe
                src={player.scorecardUrl}
                title={`${player.username} CGL scorecard, statistics and shot data from SGT`}
                className={styles.embed}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <p className={styles.embedNote}>
                On smaller screens, scroll within the scorecard to see every
                hole. If the view does not load, use{" "}
                <a
                  href={player.scorecardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in SGT
                  <span className={styles.srOnly}>, opens in a new tab</span>
                </a>
                .
              </p>
            </article>
          </>
        ) : (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>
              <ClipboardList size={25} aria-hidden="true" />
            </span>
            <div>
              <h3>No CGL scorecard linked yet</h3>
              <p>
                Your linked CGL scorecards will appear here, with access to hole
                scores, putting and other SGT statistics.
              </p>
              <a
                href={player.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Visit your SGT profile
                <ArrowUpRight size={15} aria-hidden="true" />
                <span className={styles.srOnly}>, opens in a new tab</span>
              </a>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export function CglRegisteredPlayerUnavailable() {
  return (
    <div className={styles.page}>
      <Link href="/cgl/trial" className={styles.back}>
        <ArrowLeft size={15} aria-hidden="true" />
        Back to the trial hub
      </Link>
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>
          <UserRound size={25} aria-hidden="true" />
        </span>
        <div>
          <h1 className={styles.unavailableTitle}>
            Player profile temporarily unavailable
          </h1>
          <p>Please try again shortly.</p>
        </div>
      </div>
    </div>
  );
}
