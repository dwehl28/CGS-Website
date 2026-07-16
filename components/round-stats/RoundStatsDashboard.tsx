import type {
  PlayerContribution,
  RoundStatEntry,
  RoundStatsSnapshot,
  TeamRoundSummary,
} from "@/lib/round-stats";

type RoundStatsDashboardProps = {
  snapshot: RoundStatsSnapshot;
  showAdminHints?: boolean;
};

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return `${Math.round(value * 100)}%`;
}

function formatDecimal(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return value.toFixed(1);
}

function getEntryForTeamAndHole(
  entries: RoundStatEntry[],
  teamId: number,
  holeId: number
) {
  return entries.find((entry) => entry.teamId === teamId && entry.holeId === holeId);
}

function getContributionWidth(
  contribution: PlayerContribution,
  maxContributionCount: number
) {
  if (maxContributionCount <= 0) {
    return "0%";
  }

  return `${Math.max((contribution.totalUses / maxContributionCount) * 100, 8)}%`;
}

function TeamComparisonCard({
  summary,
  totalHoles,
}: {
  summary: TeamRoundSummary;
  totalHoles: number;
}) {
  return (
    <article className="round-stat-team-card">
      <div className="round-stat-team-card-top">
        <div>
          <p className="round-stat-kicker">{summary.currentHoleLabel}</p>
          <h3>{summary.team.name}</h3>
        </div>
        <strong>{summary.scoreLabel}</strong>
      </div>

      <div className="round-stat-metric-grid">
        <div>
          <span>Birdies</span>
          <strong>{summary.birdies + summary.eaglesOrBetter}</strong>
        </div>
        <div>
          <span>Fairways</span>
          <strong>{formatPercent(summary.fairwayRate)}</strong>
        </div>
        <div>
          <span>GIR</span>
          <strong>{formatPercent(summary.girRate)}</strong>
        </div>
        <div>
          <span>Avg putts</span>
          <strong>{formatDecimal(summary.averagePutts)}</strong>
        </div>
      </div>

      <div className="round-stat-team-footer">
        <span>
          {summary.holesComplete}/{totalHoles} holes entered
        </span>
        <span>{summary.penalties} penalties</span>
      </div>
    </article>
  );
}

export default function RoundStatsDashboard({
  snapshot,
  showAdminHints = false,
}: RoundStatsDashboardProps) {
  const { round, leaderboard, playerContributions } = snapshot;
  const leader = leaderboard[0] ?? null;
  const bestFairwayTeam = [...leaderboard]
    .filter((summary) => summary.fairwayRate !== null)
    .sort((left, right) => (right.fairwayRate ?? 0) - (left.fairwayRate ?? 0))[0];
  const bestGirTeam = [...leaderboard]
    .filter((summary) => summary.girRate !== null)
    .sort((left, right) => (right.girRate ?? 0) - (left.girRate ?? 0))[0];
  const bestPuttingTeam = [...leaderboard]
    .filter((summary) => summary.averagePutts !== null)
    .sort(
      (left, right) => (left.averagePutts ?? 99) - (right.averagePutts ?? 99)
    )[0];
  const maxContributionCount = Math.max(
    ...playerContributions.map((contribution) => contribution.totalUses),
    0
  );

  return (
    <div className="round-stat-dashboard">
      <section className="round-stat-hero panel">
        <div>
          <p className="round-stat-kicker">{round.statusLabel}</p>
          <h1>{round.title}</h1>
          <p>{round.summary}</p>
          <div className="round-stat-chip-row">
            <span>{round.courseName}</span>
            <span>{round.formatLabel}</span>
            <span>{round.holesLabel}</span>
            <span>{round.isLive ? "Live tracking" : "Tracking ready"}</span>
          </div>
        </div>

        <div className="round-stat-score-card">
          <span>Current leader</span>
          <strong>{leader?.scoreLabel ?? "--"}</strong>
          <p>{leader?.team.name ?? "Waiting for data"}</p>
          <small>
            {snapshot.completeEntries}/{snapshot.totalEntriesPossible} stat entries
          </small>
        </div>
      </section>

      {showAdminHints ? (
        <section className="round-stat-admin-hint">
          <span>Admin concept</span>
          <p>
            Each saved hole entry updates the leaderboard, team comparison cards,
            player contribution bars, and hole-by-hole grid below.
          </p>
        </section>
      ) : null}

      <section className="round-stat-overview-grid">
        <div className="round-stat-feature-card">
          <span>Completion</span>
          <strong>{formatPercent(snapshot.completionRate)}</strong>
          <p>
            {snapshot.totalTeams} teams x {snapshot.totalHoles} holes available.
          </p>
        </div>
        <div className="round-stat-feature-card">
          <span>Fairway leader</span>
          <strong>{bestFairwayTeam ? formatPercent(bestFairwayTeam.fairwayRate) : "--"}</strong>
          <p>{bestFairwayTeam?.team.name ?? "Not enough data yet"}</p>
        </div>
        <div className="round-stat-feature-card">
          <span>GIR leader</span>
          <strong>{bestGirTeam ? formatPercent(bestGirTeam.girRate) : "--"}</strong>
          <p>{bestGirTeam?.team.name ?? "Not enough data yet"}</p>
        </div>
        <div className="round-stat-feature-card">
          <span>Putting leader</span>
          <strong>
            {bestPuttingTeam ? formatDecimal(bestPuttingTeam.averagePutts) : "--"}
          </strong>
          <p>{bestPuttingTeam?.team.name ?? "Not enough data yet"}</p>
        </div>
      </section>

      <section className="panel round-stat-section">
        <div className="round-stat-section-heading">
          <div>
            <p className="round-stat-kicker">Team leaderboard</p>
            <h2>Score plus context, not just a number.</h2>
          </div>
          <span>Ranked by score to par</span>
        </div>

        <div className="round-stat-table-wrap">
          <table className="round-stat-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Score</th>
                <th>Thru</th>
                <th>Birdies+</th>
                <th>Fairway</th>
                <th>GIR</th>
                <th>Avg putts</th>
                <th>Key contributor</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((summary) => (
                <tr key={summary.team.id}>
                  <td>
                    <div className="round-stat-team-name">
                      <span style={{ background: summary.team.accentColor }} />
                      <strong>{summary.team.name}</strong>
                    </div>
                  </td>
                  <td>{summary.scoreLabel}</td>
                  <td>
                    {summary.holesComplete}/{round.holes.length}
                  </td>
                  <td>{summary.birdies + summary.eaglesOrBetter}</td>
                  <td>{formatPercent(summary.fairwayRate)}</td>
                  <td>{formatPercent(summary.girRate)}</td>
                  <td>{formatDecimal(summary.averagePutts)}</td>
                  <td>{summary.contributionLeader?.playerName ?? "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="round-stat-card-grid">
        {leaderboard.map((summary) => (
          <TeamComparisonCard
            key={summary.team.id}
            summary={summary}
            totalHoles={round.holes.length}
          />
        ))}
      </section>

      <section className="panel round-stat-section">
        <div className="round-stat-section-heading">
          <div>
            <p className="round-stat-kicker">Player impact</p>
            <h2>Who is actually carrying the Ambrose decisions?</h2>
          </div>
          <span>Drive + approach + putt uses</span>
        </div>

        {playerContributions.length > 0 ? (
          <div className="round-stat-contribution-list">
            {playerContributions.map((contribution) => (
              <div
                key={`${contribution.teamId}-${contribution.playerName}`}
                className="round-stat-contribution-row"
              >
                <div>
                  <strong>{contribution.playerName}</strong>
                  <span>{contribution.teamName}</span>
                </div>
                <div className="round-stat-contribution-bar">
                  <span
                    style={{
                      width: getContributionWidth(
                        contribution,
                        maxContributionCount
                      ),
                    }}
                  />
                </div>
                <p>
                  {contribution.totalUses} uses | {contribution.driveUses} drives |{" "}
                  {contribution.approachUses} approaches | {contribution.puttUses} putts
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="round-stat-empty">
            Player contribution data will appear once hole entries are saved.
          </div>
        )}
      </section>

      <section className="panel round-stat-section">
        <div className="round-stat-section-heading">
          <div>
            <p className="round-stat-kicker">Hole-by-hole display</p>
            <h2>A stream-friendly grid of how the round is unfolding.</h2>
          </div>
          <span>{round.holesLabel}</span>
        </div>

        <div className="round-stat-hole-grid">
          <div className="round-stat-hole-grid-head">Team</div>
          {round.holes.map((hole) => (
            <div key={hole.id} className="round-stat-hole-grid-head">
              {hole.holeNumber}
            </div>
          ))}

          {round.teams.map((team) => (
            <div key={team.id} className="contents">
              <div className="round-stat-hole-team">
                <span style={{ background: team.accentColor }} />
                {team.shortName || team.name}
              </div>
              {round.holes.map((hole) => {
                const entry = getEntryForTeamAndHole(round.entries, team.id, hole.id);

                return (
                  <div
                    key={`${team.id}-${hole.id}`}
                    className={`round-stat-hole-cell ${
                      entry?.scoreToPar !== null && entry?.scoreToPar !== undefined
                        ? "round-stat-hole-cell-live"
                        : ""
                    }`}
                  >
                    <strong>{entry?.scoreLabel ?? "--"}</strong>
                    <span>
                      {entry?.putts !== null && entry?.putts !== undefined
                        ? `${entry.putts}p`
                        : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
