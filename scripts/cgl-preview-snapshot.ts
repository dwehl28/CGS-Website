/** Read-only, fictional presentation data. Never used by the live CGL APIs. */
import { createCglDevelopmentFixture } from "./cgl-development-fixture";
import {
  CGL_DEFAULT_PLANS,
  calculateDivisionPoints,
  bestEightOfTen,
  selectWeeklyAwards,
  type CalculatedPointsRow,
} from "../lib/cgl-engine";

export function createCglPreviewSnapshot() {
  const fixture = createCglDevelopmentFixture();
  const seasonId = "fixture-season-2027-1";
  const members = new Map(fixture.members.map((member) => [member.id, member]));
  const publishedWeeks = fixture.weeks.filter(
    (week) => week.kind === "championship" && week.status === "closed",
  );
  const calculations = new Map<string, CalculatedPointsRow[]>();
  const prizes: Record<string, unknown>[] = [];
  for (const week of publishedWeeks) {
    const field = fixture.weeklyResults.filter(
      (result) => result.weekId === week.id,
    );
    calculations.set(week.id, calculateDivisionPoints(field).rows);
    const awards = selectWeeklyAwards(field, {
      verified: true,
      published: true,
      weekId: week.id,
    });
    if (!awards.manualReview)
      for (const award of awards.awards)
        prizes.push({
          id: award.key,
          week_id: week.id,
          season_id: seasonId,
          category: award.category,
          kind: "credits",
          amount: award.credits,
          state: "awarded",
          sgt_username: members.get(award.playerId)?.username,
        });
  }
  const results = fixture.weeklyResults
    .filter(
      (result) =>
        publishedWeeks.some((week) => week.id === result.weekId) &&
        result.verified &&
        result.eligible,
    )
    .map((result, index) => {
      const player = members.get(result.playerId)!;
      const points = calculations
        .get(result.weekId)
        ?.find((point) => point.playerId === result.playerId);
      return {
        id: result.id,
        week_id: result.weekId,
        season_id: seasonId,
        week_name: `Championship week ${result.championshipWeek}`,
        sgt_username: player.username,
        division: player.division,
        handicap: player.handicap,
        gross: result.gross,
        net: result.net,
        position: points?.position ?? null,
        points: points?.points ?? null,
        scorecard_url: null,
        source_url: null,
        holes: result.holes,
        played_at: fixture.weeks.find((week) => week.id === result.weekId)
          ?.closesAt,
        stats: {
          longest_drive_metres: 250 + (index % 23) * 2,
          gir: Math.round(((8 + (index % 7)) / 18) * 100),
          fir: Math.round(((6 + (index % 6)) / 14) * 100),
          total_putts: 27 + (index % 10),
          putting_distance_metres: 12 + (index % 15) * 1.4,
          birdies: index % 5,
          ctp_metres: result.ctpMetres,
        },
      };
    });
  const standings = fixture.members
    .filter(
      (member) =>
        member.division &&
        results.some((result) => result.sgt_username === member.username),
    )
    .map((member) => {
      const weekly = publishedWeeks.map((week) => ({
        week: week.championshipWeek!,
        points:
          calculations
            .get(week.id)
            ?.find((point) => point.playerId === member.id)?.points ??
          (fixture.weeklyResults.some(
            (r) => r.playerId === member.id && r.weekId === week.id,
          )
            ? null
            : 0),
      }));
      const best = bestEightOfTen(weekly);
      return {
        sgt_username: member.username,
        season_id: seasonId,
        division: member.division,
        handicap: member.handicap,
        total_points: best.total,
        rounds_counted: best.roundsCounted,
        counted: best.counted,
        discarded: best.discarded,
        missing_weeks: best.missingWeeks,
        pending: best.hasPending,
        position: 0,
      };
    });
  for (const standing of standings)
    standing.position =
      1 +
      standings.filter(
        (other) =>
          other.division === standing.division &&
          other.total_points > standing.total_points,
      ).length;
  return {
    status: "ready",
    preview: true,
    message:
      "Fictional 2027 development fixture. No live players, payments or awards.",
    seasons: [
      {
        id: seasonId,
        name: "2027 Aggregate Championship · Sample",
        slug: "sample-2027-aggregate",
        year: 2027,
        season_number: 1,
        format: "aggregate",
        status: "active",
        starts_at: fixture.weeks[0].opensAt,
        ends_at: fixture.weeks[12].closesAt,
      },
    ],
    weeks: fixture.weeks.map((week) => ({
      id: week.id,
      season_id: seasonId,
      week_number: week.seasonWeek,
      championship_week: week.championshipWeek,
      name:
        week.kind === "qualification"
          ? `Qualification week ${week.seasonWeek}`
          : `Championship week ${week.championshipWeek}`,
      phase: week.kind,
      opens_at: week.opensAt,
      closes_at: week.closesAt,
      status: week.status === "upcoming" ? "draft" : week.status,
      results_published: publishedWeeks.some((item) => item.id === week.id),
      course_name: "Fictional development course",
    })),
    results,
    standings,
    prizes,
    players: fixture.members.map((member) => ({
      sgt_username: member.username,
      handicap: member.handicap,
    })),
    annual: standings.map((standing) => ({
      year: 2027,
      sgt_username: standing.sgt_username,
      status: "pending_approval",
      points: null,
    })),
    plans: CGL_DEFAULT_PLANS.map((plan) => ({
      code: plan.id,
      name: plan.name,
      price_cents: plan.priceCents,
      auto_renew: plan.recurring,
      active: true,
    })),
    catalogue: [],
    settings: {
      divisions: { c_grade_enabled: false },
      annual_formula: { approved: false },
      rewards: {
        full: { net: 20, gross: 20, ctp: 10 },
        casual: { net: 10, gross: 10, ctp: 5 },
        credit_expiry_months: 18,
      },
      legal: { approved: false },
    },
  };
}
