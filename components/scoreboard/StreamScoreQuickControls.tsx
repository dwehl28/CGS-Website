import Link from "next/link";

import {
  adjustCompetitionScoreEntryAction,
  updateCompetitionScoreEntryAction,
  updateCompetitionScoreEntryThroughAction,
} from "@/app/clubhouse-admin/scoreboard/actions";
import type {
  CompetitionScoreEntry,
  CompetitionScoreboard,
} from "@/lib/scoreboards";
import { getRankingDescription, getScoreNoun } from "@/lib/scoreboards";

type StreamScoreQuickControlsProps = {
  competition: CompetitionScoreboard;
};

function getScoreInputValue(score: number | null) {
  return score === null ? "" : score.toString();
}

function getThroughInputValue(thruLabel: string | null) {
  if (!thruLabel) {
    return "";
  }

  if (/^(f|finished|complete)$/i.test(thruLabel.trim())) {
    return "18";
  }

  return thruLabel.match(/\d+/)?.[0] ?? "";
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

function ThroughAdjustForm({
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
    <form action={updateCompetitionScoreEntryThroughAction}>
      <TeamIdentityFields competition={competition} entry={entry} />
      <input type="hidden" name="current_thru" value={entry.thruLabel ?? ""} />
      <input type="hidden" name="thru_delta" value={delta} />
      <button type="submit" className="quick-score-button is-through">
        {label}
      </button>
    </form>
  );
}

function ThroughSetForm({
  competition,
  entry,
}: {
  competition: CompetitionScoreboard;
  entry: CompetitionScoreEntry;
}) {
  const throughInputId = `quick-through-value-${entry.id}`;

  return (
    <form
      action={updateCompetitionScoreEntryThroughAction}
      className="quick-score-set-form"
    >
      <TeamIdentityFields competition={competition} entry={entry} />
      <input type="hidden" name="current_thru" value={entry.thruLabel ?? ""} />
      <label className="sr-only" htmlFor={throughInputId}>
        Set hole through for {entry.playerName}
      </label>
      <input
        id={throughInputId}
        type="number"
        min="0"
        max="99"
        step="1"
        name="thru_value"
        className="quick-score-input"
        defaultValue={getThroughInputValue(entry.thruLabel)}
        placeholder="Hole"
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
  const streamEntries = competition.entries;

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
            Update scores and hole progress for every player while the browser
            sources are live. The portrait ladder rotates through up to 20 players,
            the banner rolls up to 20 names, and the TV source rotates through the
            full field. All are sorted automatically by{" "}
            {getRankingDescription(competition.leaderboardMode)}.
          </p>
        </div>

        <div className="stream-control-actions">
          <Link
            href={`/scoreboard/${competition.slug}/stream`}
            className="btn-primary"
          >
            Open CGS portrait
          </Link>
          <Link
            href={`/scoreboard/${competition.slug}/stream?brand=tee-lounge`}
            className="btn-secondary"
          >
            Open Tee Lounge portrait
          </Link>
          <Link
            href={`/scoreboard/${competition.slug}/banner`}
            className="btn-secondary"
          >
            Open CGS banner
          </Link>
          <Link
            href={`/scoreboard/${competition.slug}/banner?brand=tee-lounge`}
            className="btn-secondary"
          >
            Open Tee Lounge banner
          </Link>
          <Link
            href={`/scoreboard/${competition.slug}/tv`}
            className="btn-secondary"
          >
            Open CGS TV
          </Link>
          <Link
            href={`/scoreboard/${competition.slug}/tv?brand=tee-lounge`}
            className="btn-secondary"
          >
            Open Tee Lounge TV
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

              <div className="quick-score-control-block">
                <p className="quick-score-control-label">Score</p>
                <div
                  className="quick-score-actions"
                  aria-label={`Adjust score for ${entry.playerName}`}
                >
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
              </div>

              <div className="quick-score-control-block">
                <p className="quick-score-control-label">Hole through</p>
                <div
                  className="quick-score-actions"
                  aria-label={`Adjust hole progress for ${entry.playerName}`}
                >
                  <ThroughAdjustForm
                    competition={competition}
                    entry={entry}
                    delta={-1}
                    label="-1 hole"
                  />
                  <ThroughAdjustForm
                    competition={competition}
                    entry={entry}
                    delta={1}
                    label="+1 hole"
                  />
                </div>

                <ThroughSetForm competition={competition} entry={entry} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="quick-score-empty">
          Add player rows below, then this area becomes your live stream scoring
          desk.
        </div>
      )}

      <div className="stream-control-note">
        <span>Stream tip</span>
        <p>
          Keep the portrait OBS source at 407px wide x 1359px high, or use the
          banner source at 1920px wide x 180px high for a top or bottom ticker.
          Both are available in CGS and Tee Lounge styling and support up to 20
          players. The TV sources are 1920px x 1080px and roll through every
          player automatically. This control desk includes every player on the
          scoreboard.
        </p>
      </div>
    </section>
  );
}
