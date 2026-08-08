import Link from "next/link";

import {
  adjustCompetitionScoreEntryAction,
  updateCompetitionScoreEntryAction,
} from "@/app/clubhouse-admin/scoreboard/actions";
import type {
  CompetitionScoreEntry,
  CompetitionScoreboard,
} from "@/lib/scoreboards";
import { getRankingDescription, getScoreNoun } from "@/lib/scoreboards";

type StreamScoreQuickControlsProps = {
  competition: CompetitionScoreboard;
};

const STREAM_TEAM_LIMIT = 8;

function getScoreInputValue(score: number | null) {
  return score === null ? "" : score.toString();
}

function TeamIdentityFields({
  competition,
  entry,
}: {
  competition: CompetitionScoreboard;
  entry: CompetitionScoreEntry;
}) {
  return (
    <>
      <input type="hidden" name="id" value={entry.id} />
      <input type="hidden" name="competition_id" value={competition.id} />
      <input type="hidden" name="competition_slug" value={competition.slug} />
      <input
        type="hidden"
        name="leaderboard_mode"
        value={competition.leaderboardMode}
      />
    </>
  );
}

function ScoreAdjustForm({
  competition,
  entry,
  delta,
  label,
}: {
  competition: CompetitionScoreboard;
  entry: CompetitionScoreEntry;
  delta: number;
  label: string;
}) {
  return (
    <form action={adjustCompetitionScoreEntryAction}>
      <TeamIdentityFields competition={competition} entry={entry} />
      <input
        type="hidden"
        name="current_score"
        value={getScoreInputValue(entry.grossScore)}
      />
      <input type="hidden" name="score_delta" value={delta} />
      <button type="submit" className="quick-score-button">
        {label}
      </button>
    </form>
  );
}

function ScoreSetForm({
  competition,
  entry,
}: {
  competition: CompetitionScoreboard;
  entry: CompetitionScoreEntry;
}) {
  const scoreInputId = `quick-score-value-${entry.id}`;
  const scoreNoun = getScoreNoun(competition.leaderboardMode);

  return (
    <form action={updateCompetitionScoreEntryAction} className="quick-score-set-form">
      <TeamIdentityFields competition={competition} entry={entry} />
      <input type="hidden" name="player_name" value={entry.playerName} />
      <input type="hidden" name="thru_label" value={entry.thruLabel ?? ""} />
      {entry.isCgsMember ? (
        <input type="hidden" name="is_cgs_member" value="on" />
      ) : null}

      <label className="sr-only" htmlFor={scoreInputId}>
        Set {scoreNoun.toLowerCase()} for {entry.playerName}
      </label>
      <input
        id={scoreInputId}
        type="number"
        step="0.1"
        name="score_value"
        className="quick-score-input"
        defaultValue={getScoreInputValue(entry.grossScore)}
        required
      />
      <button type="submit" className="quick-score-set-button">
        Set
      </button>
    </form>
  );
}

export default function StreamScoreQuickControls({
  competition,
}: StreamScoreQuickControlsProps) {
  const streamEntries = competition.entries.slice(0, STREAM_TEAM_LIMIT);
  const remainingEntryCount = Math.max(
    competition.entries.length - STREAM_TEAM_LIMIT,
    0
  );

  return (
    <section
      id={`scoreboard-${competition.id}`}
      className="stream-control-panel"
      aria-label={`${competition.title} stream controls`}
    >
      <div className="stream-control-header">
        <div>
          <p className="stream-control-kicker">Weekly stream control</p>
          <h3>Live scoreboard controls</h3>
          <p>
            Update scores while the browser sources are live. The portrait ladder
            rotates through up to 20 players, the banner rolls up to 20 names, and
            the TV source rotates through the full field. All are sorted automatically by{" "}
            {getRankingDescription(competition.leaderboardMode)}.
          </p>
        </div>

        <div className="stream-control-actions">
          <Link
            href={`/scoreboard/${competition.slug}/stream`}
            className="btn-primary"
          >
            Open portrait asset
          </Link>
          <Link
            href={`/scoreboard/${competition.slug}/banner`}
            className="btn-secondary"
          >
            Open banner asset
          </Link>
          <Link
            href={`/scoreboard/${competition.slug}/tv`}
            className="btn-secondary"
          >
            Open TV asset
          </Link>
          <Link href={`/scoreboard/${competition.slug}`} className="btn-secondary">
            Public board
          </Link>
        </div>
      </div>

      {streamEntries.length > 0 ? (
        <div className="quick-score-grid">
          {streamEntries.map((entry) => (
            <article key={entry.id} className="quick-score-card">
              <div className="quick-score-card-top">
                <div>
                  <p className="quick-score-position">Position {entry.position}</p>
                  <h4>{entry.playerName}</h4>
                  <span>{entry.thruLabel ?? "Through not set"}</span>
                </div>
                <strong>{entry.scoreLabel}</strong>
              </div>

              <div className="quick-score-actions" aria-label={`Adjust ${entry.playerName}`}>
                <ScoreAdjustForm
                  competition={competition}
                  entry={entry}
                  delta={-1}
                  label="-1"
                />
                <ScoreAdjustForm
                  competition={competition}
                  entry={entry}
                  delta={1}
                  label="+1"
                />
              </div>

              <ScoreSetForm competition={competition} entry={entry} />
            </article>
          ))}
        </div>
      ) : (
        <div className="quick-score-empty">
          Add up to eight player rows below, then this area becomes your live stream
          scoring desk.
        </div>
      )}

      <div className="stream-control-note">
        <span>Stream tip</span>
        <p>
          Keep the portrait OBS source at 407px wide x 1359px high, or use the
          banner source at 1920px wide x 180px high for a top or bottom ticker.
          Both support up to 20 players. The full-field TV source is 1920px x
          1080px and rolls through every player automatically.
          {remainingEntryCount > 0
            ? ` ${remainingEntryCount} extra row${
                remainingEntryCount === 1 ? "" : "s"
              } remain visible across the broadcast assets. Edit them in Current rows below because this quick desk shows the first eight.`
            : ""}
        </p>
      </div>
    </section>
  );
}
