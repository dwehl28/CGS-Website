import Link from "next/link";
import { ArrowUpRight, ClipboardList, Users } from "lucide-react";
import type { CglTrialRoster } from "@/lib/cgl-roster";
import styles from "./CglTrialPlayers.module.css";

export default function CglTrialPlayers({
  roster,
}: {
  roster: CglTrialRoster;
}) {
  return (
    <section
      className={styles.section}
      id="trial-players"
      aria-labelledby="cgl-trial-players-title"
    >
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>THE FIRST FIELD</span>
          <h2 id="cgl-trial-players-title">Trial players</h2>
        </div>
        {roster.status === "available" && roster.players.length > 0 && (
          <span className={styles.count}>
            <Users size={15} aria-hidden="true" />
            {roster.players.length} players
          </span>
        )}
      </div>
      <p className={styles.description}>
        Find your SGT profile and open your linked CGL scorecard.
      </p>

      {roster.status === "unavailable" ? (
        <div className={styles.empty}>
          <Users size={23} aria-hidden="true" />
          <div>
            <h3>Player list temporarily unavailable</h3>
            <p>Please try again shortly.</p>
          </div>
        </div>
      ) : roster.players.length === 0 ? (
        <div className={styles.empty}>
          <Users size={23} aria-hidden="true" />
          <div>
            <h3>The trial field is taking shape</h3>
            <p>Players will appear here when their SGT details are linked.</p>
          </div>
        </div>
      ) : (
        <ul className={styles.grid}>
          {roster.players.map((player) => (
            <li className={styles.card} key={player.username}>
              <div className={styles.identity}>
                <span className={styles.avatar} aria-hidden="true">
                  {player.username.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <span className={styles.identityLabel}>SGT PLAYER</span>
                  <h3>
                    <Link
                      href={`/cgl/players/${encodeURIComponent(player.username)}`}
                    >
                      {player.username}
                    </Link>
                  </h3>
                </div>
              </div>
              <div className={styles.links}>
                <a
                  href={player.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.profileLink}
                >
                  SGT profile <ArrowUpRight size={15} aria-hidden="true" />
                  <span className={styles.srOnly}>
                    {" "}
                    for {player.username}, opens in a new tab
                  </span>
                </a>
                {player.scorecardUrl ? (
                  <Link
                    href={`/cgl/players/${encodeURIComponent(player.username)}#scorecards`}
                    className={styles.scorecardLink}
                  >
                    <ClipboardList size={15} aria-hidden="true" />
                    View scorecard
                    <ArrowUpRight size={15} aria-hidden="true" />
                    <span className={styles.srOnly}>
                      {" "}
                      for {player.username}
                    </span>
                  </Link>
                ) : (
                  <p className={styles.pending}>No CGL scorecard linked yet</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
