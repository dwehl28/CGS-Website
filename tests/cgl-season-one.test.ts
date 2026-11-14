import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import type * as SeasonOne from "../lib/cgl-season-one";

const seasonUrl = pathToFileURL(
  resolve(process.cwd(), "lib/cgl-season-one.ts"),
).href;
const season: typeof SeasonOne = await import(seasonUrl);

test("Season 1 proposal contains the agreed three-plus-ten calendar", () => {
  const plan = season.CGL_SEASON_ONE_PLAN;
  assert.equal(plan.rounds.length, 13);
  assert.equal(
    plan.rounds.filter((round) => round.phase === "qualification").length,
    3,
  );
  assert.equal(
    plan.rounds.filter((round) => round.phase === "championship").length,
    10,
  );
  assert.equal(plan.membershipRegistrationDate, "2027-02-01");
  assert.equal(plan.qualificationStartDate, "2027-02-08");
  assert.equal(plan.championshipStartDate, "2027-03-01");
  assert.equal(plan.finalRoundOpeningDate, "2027-05-03");
  assert.deepEqual(
    plan.rounds.map((round) => round.weekNumber),
    Array.from({ length: 13 }, (_, index) => index + 1),
  );
  assert.deepEqual(
    plan.rounds[0].courses.map((course) => course.name),
    ["Assiniboine", "Club Sports Belvédère"],
  );
  assert.deepEqual(
    plan.rounds[12].courses.map((course) => course.name),
    ["County Louth Golf Club", "Princes Golf Club — Dunes & Shore"],
  );
  assert.deepEqual(season.validateCglSeasonOnePlan(), []);
});

test("course pairings cannot accidentally present draft SGT details as verified", () => {
  for (const round of season.CGL_SEASON_ONE_PLAN.rounds) {
    assert.equal(new Set(round.courses.map((course) => course.name)).size, 2);
    assert.equal(round.closingDate, null);
    for (const course of round.courses) {
      assert.equal(course.verified, false);
      assert.equal(course.sgtCourseId, null);
      assert.equal(course.segment, null);
    }
  }
});

test("championship condition progression remains editable proposal data", () => {
  const championship = season.CGL_SEASON_ONE_PLAN.rounds.filter(
    (round) => round.phase === "championship",
  );
  assert.equal(championship[0].conditions?.wind, "Calm");
  assert.equal(championship[3].conditions?.greenSpeed, 11);
  assert.equal(championship[6].conditions?.wind, "Gusty");
  assert.equal(championship[9].conditions?.teeCategory, "Regular");
});

test("admin draft maps to the existing season and week schema without publishing", () => {
  const draft = season.buildCglSeasonOneAdminDraft();
  assert.equal(draft.season.status, "draft");
  assert.equal(draft.season.starts_at, null);
  assert.equal(draft.season.ends_at, null);
  assert.equal(draft.weeks.length, 13);
  assert.ok(draft.weeks.every((week) => week.status === "draft"));
  assert.ok(draft.weeks.every((week) => week.opens_at === null));
  assert.ok(draft.weeks.every((week) => week.closes_at === null));
  assert.equal(draft.weeks[3].championship_week, 1);
  assert.equal(draft.weeks[3].config.planned_open_date, "2027-03-01");
  assert.equal(draft.weeks[3].config.course_verification, "required");
});

test("launch milestone remains useful before, during and after the season", () => {
  assert.deepEqual(
    season.getCglSeasonOneMilestone(new Date("2027-01-31T14:00:00Z")),
    {
      label: "Qualification begins",
      value: "7 days",
      detail: "Monday 8 February 2027",
    },
  );
  assert.equal(
    season.getCglSeasonOneMilestone(new Date("2027-03-14T14:00:00Z")).value,
    "Round 3 of 10",
  );
  assert.equal(
    season.getCglSeasonOneMilestone(new Date("2027-05-03T00:00:00Z")).label,
    "Final round released",
  );
});
