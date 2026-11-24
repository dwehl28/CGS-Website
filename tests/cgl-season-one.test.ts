import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import type * as SeasonOne from "../lib/cgl-season-one";

const seasonUrl = pathToFileURL(
  resolve(process.cwd(), "lib/cgl-season-one.ts"),
).href;
const season: typeof SeasonOne = await import(seasonUrl);

test("Season 1 countdown starts with Qualification 1 in Brisbane and rolls into the championship", () => {
  const kickoff = Date.parse("2027-02-08T00:00:00+10:00");
  const before = season.getCglSeasonCountdown(kickoff - 86_401_000);
  assert.equal(before.title, "Season 1 starts in");
  assert.equal(Date.parse(before.target!), kickoff);
  assert.equal(before.provisional, true);
  assert.deepEqual(season.getCglCountdownParts(before.target!, kickoff - 86_401_000), [1,0,0,1]);
  assert.equal(season.getCglSeasonCountdown(kickoff).title, "Championship starts in");
  assert.deepEqual(season.getCglCountdownParts(before.target!, kickoff + 1000), [0,0,0,0]);
});

test("countdown prefers published times and does not claim unpublished championship play is live", () => {
  const qualifier = "2027-02-08T09:00:00+10:00";
  const before = season.getCglSeasonCountdown(Date.parse("2027-02-08T08:00:00+10:00"), { qualifier });
  assert.equal(before.target, qualifier);
  assert.equal(before.provisional, false);
  const after = season.getCglSeasonCountdown(Date.parse("2027-03-01T12:00:00+10:00"));
  assert.equal(after.target, null);
  assert.equal(after.title, "Season 1 schedule");
});

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
    plan.rounds[0].courses.map((course) => course?.name),
    ["Club Sports Belvédère"],
  );
  assert.deepEqual(
    plan.rounds[12].courses.map((course) => course?.name),
    ["County Louth Golf Club", "Princes Golf Club — Dunes & Shore"],
  );
  assert.deepEqual(season.validateCglSeasonOnePlan(), []);
});

test("course pairings cannot accidentally present draft SGT details as verified", () => {
  for (const round of season.CGL_SEASON_ONE_PLAN.rounds) {
    assert.equal(new Set(round.courses.map((course) => course?.name)).size, round.phase === "qualification" ? 1 : 2);
    assert.ok(round.closingDate && round.closingDate > round.openingDate);
    for (const course of round.courses) {
      assert.ok(course);
      assert.equal(course.verified, false);
      assert.equal(course.sgtCourseId, null);
      assert.equal(course.segment, round.phase === "qualification" ? "full_18" : null);
    }
  }
});

test("the three qualifiers use one complete approved-name course and identical proposed conditions", () => {
  const draft = season.buildCglSeasonOneAdminDraft();
  const qualifiers = draft.weeks.slice(0,3);
  assert.deepEqual(qualifiers.map((week)=>[week.course_name,week.config.course_a.par]),[
    ["Club Sports Belvédère",72],["Trail Creek Golf Course",72],["Gilbert Plains Country Club",71],
  ]);
  assert.equal(qualifiers.every((week)=>week.second_course_name===null && !week.config.course_b && week.config.course_a.segment==="full_18"),true);
  assert.equal(qualifiers.every((week)=>week.conditions===season.CGL_QUALIFIER_CONDITIONS),true);
  assert.ok(draft.weeks.slice(3).every((week)=>week.config.course_a.segment==="front_9" && week.config.course_b?.segment==="back_9"));
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
  assert.equal(draft.season.starts_at, "2027-02-08T00:00:00+10:00");
  assert.equal(draft.season.ends_at, "2027-05-23T23:59:59+10:00");
  assert.equal(draft.season.config.calendar_ends_at, "2027-05-09T23:59:59+10:00");
  assert.equal(draft.season.config.entry_opens_at, "2027-02-01T09:00:00+10:00");
  assert.equal(draft.season.config.schedule_approved, false);
  assert.equal(draft.weeks.length, 13);
  assert.ok(draft.weeks.every((week) => week.status === "draft"));
  assert.ok(draft.weeks.every((week) => Date.parse(week.opens_at) < Date.parse(week.closes_at)));
  assert.equal(draft.weeks[0].closes_at, "2027-02-14T23:59:59+10:00");
  assert.equal(draft.weeks[3].closes_at, "2027-03-21T23:59:59+10:00");
  assert.ok(Date.parse(draft.weeks[4].opens_at) < Date.parse(draft.weeks[3].closes_at));
  assert.equal(draft.weeks[12].closes_at, draft.season.ends_at);
  assert.equal(draft.weeks[3].championship_week, 1);
  assert.equal(draft.weeks[3].config.planned_open_date, "2027-03-01");
  assert.equal(draft.weeks[3].config.course_verification, "required");
});

test("seasonal and annual prize schedules each total A$1000", () => {
  for (const schedule of Object.values(season.CGL_CASH_PRIZE_CENTS))
    assert.equal(Object.values(schedule).flatMap(Object.values).reduce((sum, cents) => sum+cents,0), 100000);
});

test("Season 1 countback compares the second course first and shares fully tied points", async () => {
  const engine: typeof import("../lib/cgl-engine") = await import(pathToFileURL(resolve(process.cwd(),"lib/cgl-engine.ts")).href);
  const holes = [1,2].flatMap((segment) => Array.from({length:9},(_,i) => ({segment,strokeIndex:i+1,gross:4,net:4})));
  const reverse = holes.map((hole) => ({...hole,net:hole.strokeIndex!==1 ? 4 : hole.segment===1 ? 3 : 5}));
  assert.equal(engine.compareTwoNineCountback(holes,reverse).order,-1);
  assert.equal(engine.compareTwoNineCountback(holes.slice(0,8),reverse).order,null);
  const participant = {playerId:"first",division:"A" as const,net:72,gross:72,eligible:true,verified:true,holes};
  const ties = engine.calculateDivisionPoints([participant,{...participant,playerId:"second"}],undefined,undefined,true);
  assert.equal(ties.manualReview,false);
  assert.deepEqual(ties.rows.map((r)=>[r.position,r.points]),[[1,400],[1,400]]);
  const awards = engine.selectWeeklyAwards([
    {...participant,membership:"full",completedAt:"2027-03-10T00:00:00Z"},
    {...participant,playerId:"second",membership:"casual",completedAt:"2027-03-11T00:00:00Z"},
  ],{verified:true,published:true,secondNineFirst:true,weekId:"verified"});
  assert.deepEqual(awards.awards.map((a)=>[a.category,a.playerId,a.credits]),[["net","first",20],["gross","second",10]]);
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
