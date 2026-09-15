import Image from "next/image";

import type { ScoreChangeSpotlightData } from "@/components/scoreboard/useScoreChangeSpotlight";
import type { ScoreboardDisplayTheme } from "@/lib/scoreboard-display-theme";

type ScoreChangeSpotlightProps = {
  spotlight: ScoreChangeSpotlightData;
  theme: ScoreboardDisplayTheme;
  variant: "tv" | "portrait";
};

function getPlayerInitials(playerName: string) {
  return playerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "CGS";
}

export default function ScoreChangeSpotlight({
  spotlight,
  theme,
  variant,
}: ScoreChangeSpotlightProps) {
  const isThroughUpdate = spotlight.kind === "through";

  return (
    <aside
      className={`score-change-spotlight is-${variant} is-${theme} is-${spotlight.kind}`}
      aria-live="polite"
      aria-label={`${spotlight.playerName} ${
        isThroughUpdate ? "hole progress" : "score"
      } changed from ${spotlight.previousValueLabel} to ${spotlight.nextValueLabel}`}
    >
      <div className="score-change-photo">
        {spotlight.photoUrl ? (
          <Image
            src={spotlight.photoUrl}
            alt={`${spotlight.playerName} player photo`}
            fill
            sizes={variant === "tv" ? "300px" : "150px"}
            className="is-player-photo"
            unoptimized
          />
        ) : (
          <span>{getPlayerInitials(spotlight.playerName)}</span>
        )}
        <i aria-hidden="true" />
      </div>

      <div className="score-change-copy">
        <span className="score-change-kicker">
          {isThroughUpdate ? "Hole progress update" : "Live score update"}
        </span>
        <strong className="score-change-player">{spotlight.playerName}</strong>
        <small>
          {spotlight.changeLabel} | {spotlight.contextLabel}
        </small>

        <div className="score-change-values">
          <span>
            <small>Was</small>
            <strong>{spotlight.previousValueLabel}</strong>
          </span>
          <svg viewBox="0 0 48 24" aria-hidden="true">
            <path d="M2 12h40M32 3l10 9-10 9" />
          </svg>
          <span className="is-current">
            <small>Now</small>
            <strong>{spotlight.nextValueLabel}</strong>
          </span>
        </div>
      </div>

      <div className="score-change-progress" aria-hidden="true" />
    </aside>
  );
}
