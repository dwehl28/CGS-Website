"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardList,
  Flag,
  RefreshCw,
  Trophy,
} from "lucide-react";
import styles from "./CglSgtViewer.module.css";

type View = "tournament" | "league" | "scorecard";
type Scorecard = { username: string; url: string };

export default function CglSgtViewer({
  scorecards,
}: {
  scorecards: Scorecard[];
}) {
  const [view, setView] = useState<View>("tournament");
  const [format, setFormat] = useState<"gross" | "net">("gross");
  const [selectedPlayer, setSelectedPlayer] = useState(
    scorecards[0]?.username ?? "",
  );
  const [refresh, setRefresh] = useState(0);
  const card =
    scorecards.find((entry) => entry.username === selectedPlayer) ??
    scorecards[0];
  const source =
    view === "league"
      ? "https://simulatorgolftour.com/embed/tour/3982/standings/net?theme=dark"
      : view === "scorecard"
        ? card?.url
        : `https://simulatorgolftour.com/embed/tournament/80736/standings/${format}?theme=dark`;
  const sourcePage =
    view === "tournament"
      ? "https://simulatorgolftour.com/tournament/80736"
      : source;
  const title =
    view === "league"
      ? "SGT tour standings"
      : view === "scorecard"
        ? `${card?.username ?? "Player"} scorecard and statistics`
        : `TestComp1 ${format} tournament standings`;

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>CGL · TRIAL LEAGUE</p>
          <h1>
            Your trial league<span>.</span>
          </h1>
          <p className={styles.intro}>
            The real field and the real results, together with your SGT
            scorecards.
          </p>
        </div>
        <Link href="/cgl/rounds/r3" className={styles.previewLink}>
          Explore the round centre design <ArrowUpRight size={16} />
        </Link>
      </header>
      <div className={styles.context}>
        <Flag size={18} />
        <span>
          <strong>TestComp1</strong> SGT tournament 80736
        </span>
        <span className={styles.sourceLabel}>Results supplied by SGT</span>
      </div>
      <div className={styles.viewer}>
        <div
          className={styles.viewButtons}
          role="group"
          aria-label="Trial league results view"
        >
          <button
            type="button"
            aria-pressed={view === "tournament"}
            onClick={() => setView("tournament")}
          >
            <Flag size={16} />
            Tournament results
          </button>
          <button
            type="button"
            aria-pressed={view === "league"}
            onClick={() => setView("league")}
          >
            <Trophy size={16} />
            League standings
          </button>
          <button
            type="button"
            aria-pressed={view === "scorecard"}
            onClick={() => setView("scorecard")}
          >
            <ClipboardList size={16} />
            Player scorecard
          </button>
        </div>
        <div className={styles.toolbar}>
          <div className={styles.viewContext}>
            {view === "tournament" && (
              <div
                className={styles.scoreToggle}
                role="group"
                aria-label="SGT tournament scoring"
              >
                <button
                  type="button"
                  aria-pressed={format === "gross"}
                  onClick={() => setFormat("gross")}
                >
                  Gross
                </button>
                <button
                  type="button"
                  aria-pressed={format === "net"}
                  onClick={() => setFormat("net")}
                >
                  Net
                </button>
              </div>
            )}
            {view === "league" && <p>SGT tour 3982 · Net standings</p>}
            {view === "scorecard" && card && (
              <label>
                Player{" "}
                <select
                  value={card.username}
                  onChange={(event) => setSelectedPlayer(event.target.value)}
                >
                  {scorecards.map((entry) => (
                    <option value={entry.username} key={entry.username}>
                      {entry.username}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className={styles.tools}>
            <button
              type="button"
              onClick={() => setRefresh((value) => value + 1)}
            >
              <RefreshCw size={14} />
              Refresh view
            </button>
            {sourcePage && (
              <a href={sourcePage} target="_blank" rel="noopener noreferrer">
                Open in SGT <ArrowUpRight size={15} />
                <span className={styles.srOnly}> — opens in a new tab</span>
              </a>
            )}
          </div>
        </div>
        {source ? (
          <iframe
            key={`${source}-${refresh}`}
            className={styles.frame}
            title={title}
            src={source}
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div className={styles.empty}>
            <ClipboardList size={30} />
            <h2>Your next round belongs here.</h2>
            <p>
              A scorecard will be available once its CGL link has been added.
            </p>
          </div>
        )}
        <p className={styles.frameNote}>
          {view === "scorecard"
            ? "Open Statistics inside the scorecard for driving, fairways, greens and putting. Swipe across the card on smaller screens."
            : "These are the standings recorded by SGT. Use the player scorecard view for detailed round statistics."}
        </p>
      </div>
      <section
        className={styles.next}
        aria-labelledby="trial-round-centre-title"
      >
        <div>
          <span className={styles.eyebrow}>THE NEXT LAYER</span>
          <h2 id="trial-round-centre-title">
            Give the great rounds their moment.
          </h2>
          <p>
            Explore the presentation for round achievements, the overall
            scoreboard and the season race. It uses labelled sample results
            while the CGL results import is being established.
          </p>
        </div>
        <Link href="/cgl/rounds/r3">
          Preview achievements & scoreboards <ArrowRight size={17} />
        </Link>
      </section>
    </div>
  );
}
