export const CGL_TIME_ZONE = "Australia/Brisbane";
export const CGL_SEASON_ONE_RULES = "hidden-gems-2027-v1";
export const CGL_CASH_PRIZE_CENTS = {
  seasonal: { A: { champion: 50000, runner_up: 20000 }, B: { champion: 20000, runner_up: 10000 } },
  annual: { A: { champion: 50000, runner_up: 10000 }, B: { champion: 30000, runner_up: 10000 } },
} as const;
export const CGL_SEASON_ONE_CREDITS = { full: { net: 20, gross: 20, ctp: 10 }, casual: { net: 10, gross: 10, ctp: 5 } } as const;

export type CglSeasonPhase = "qualification" | "championship";
export type CglCourseSegment = "front_9" | "back_9" | "full_18" | null;

export type CglCourseProposal = {
  name: string;
  segment: CglCourseSegment;
  sgtCourseId: string | null;
  verified: boolean;
  par?: number;
};

export type CglRoundConditions = {
  wind: "Calm" | "Breezy" | "Gusty";
  fairwayFirmness: "Soft" | "Medium" | "Firm";
  greenFirmness: "Soft" | "Medium" | "Firm";
  greenSpeed: 9 | 10 | 11;
  teeCategory: "Forward-Regular" | "Regular" | "Regular+" | "Back";
  format?: string;
  holes?: number;
  targetYards?: readonly [number, number];
  pinDifficulty?: string;
  weather?: string;
  mulligans?: boolean;
  attempts?: number;
};

export const CGL_QUALIFIER_CONDITIONS = {
  format: "Individual stroke play",
  holes: 18,
  teeCategory: "Regular",
  targetYards: [6000, 6300],
  wind: "Calm",
  fairwayFirmness: "Medium",
  greenFirmness: "Medium",
  greenSpeed: 10,
  pinDifficulty: "Standard / medium",
  weather: "Clear",
  mulligans: false,
  attempts: 1,
} as const satisfies CglRoundConditions;

// Public SGT links and observed settings, not CGL event or handicap approval.
export const CGL_QUALIFIER_SGT_TOUR = "4265";
export const CGL_QUALIFIER_SGT_EVENTS = ["85268", "85269", "85270"] as const;
export const CGL_QUALIFIER_SGT_LISTED_SETTINGS = { tee: "Blue", pins: "Saturday", putting: "Normal", gimmies: "6 feet" } as const;

export type CglRoundProposal = {
  weekNumber: number;
  phase: CglSeasonPhase;
  phaseRound: number;
  openingDate: string;
  closingDate: string | null;
  courses: readonly [CglCourseProposal, CglCourseProposal?];
  conditions: CglRoundConditions | null;
};

const course = (name: string): CglCourseProposal => ({
  name,
  segment: null,
  sgtCourseId: null,
  verified: false,
});

const fullCourse = (name: string, par: number): CglCourseProposal => ({
  ...course(name), segment: "full_18", par,
});

function closingDate(openingDate: string, days: number) {
  return new Date(Date.parse(`${openingDate}T00:00:00Z`) + (days - 1) * 86_400_000)
    .toISOString().slice(0, 10);
}

const qualificationRounds: readonly CglRoundProposal[] = [
  {
    weekNumber: 1,
    phase: "qualification",
    phaseRound: 1,
    openingDate: "2027-02-08",
    closingDate: "2027-02-14",
    courses: [fullCourse("Club Sports Belvédère", 72)],
    conditions: CGL_QUALIFIER_CONDITIONS,
  },
  {
    weekNumber: 2,
    phase: "qualification",
    phaseRound: 2,
    openingDate: "2027-02-15",
    closingDate: "2027-02-21",
    courses: [fullCourse("Trail Creek Golf Course", 72)],
    conditions: CGL_QUALIFIER_CONDITIONS,
  },
  {
    weekNumber: 3,
    phase: "qualification",
    phaseRound: 3,
    openingDate: "2027-02-22",
    closingDate: "2027-02-28",
    courses: [fullCourse("Gilbert Plains Country Club", 71)],
    conditions: CGL_QUALIFIER_CONDITIONS,
  },
];

const championshipCourses = [
  ["Coral Cove Golf Club", "Canmore Golf & Curling"],
  ["Fox Meadow Golf Course HD", "Tatum Ranch"],
  ["Dinard Golf Club", "St Annes Golf Club"],
  ["Ironbridge Golf Club", "Currahee Club"],
  ["Peregian Springs", "South Cape Owners Club"],
  ["Aura Golf", "Mjolkerod Golf Course"],
  ["The Creek at Qualchan", "Meadow Gardens"],
  ["Mill River Golf Course", "Glens Falls Country Club HD"],
  ["Glade Springs — Woodhaven HD", "Wedgewood Pines Country Club"],
  ["County Louth Golf Club", "Princes Golf Club — Dunes & Shore"],
] as const;

const championshipConditions: readonly CglRoundConditions[] = [
  {
    wind: "Calm",
    fairwayFirmness: "Medium",
    greenFirmness: "Medium",
    greenSpeed: 10,
    teeCategory: "Regular",
  },
  {
    wind: "Breezy",
    fairwayFirmness: "Medium",
    greenFirmness: "Soft",
    greenSpeed: 10,
    teeCategory: "Regular+",
  },
  {
    wind: "Breezy",
    fairwayFirmness: "Firm",
    greenFirmness: "Medium",
    greenSpeed: 10,
    teeCategory: "Regular",
  },
  {
    wind: "Calm",
    fairwayFirmness: "Medium",
    greenFirmness: "Firm",
    greenSpeed: 11,
    teeCategory: "Back",
  },
  {
    wind: "Breezy",
    fairwayFirmness: "Firm",
    greenFirmness: "Medium",
    greenSpeed: 10,
    teeCategory: "Forward-Regular",
  },
  {
    wind: "Calm",
    fairwayFirmness: "Soft",
    greenFirmness: "Firm",
    greenSpeed: 11,
    teeCategory: "Regular",
  },
  {
    wind: "Gusty",
    fairwayFirmness: "Soft",
    greenFirmness: "Soft",
    greenSpeed: 9,
    teeCategory: "Forward-Regular",
  },
  {
    wind: "Calm",
    fairwayFirmness: "Medium",
    greenFirmness: "Firm",
    greenSpeed: 11,
    teeCategory: "Regular+",
  },
  {
    wind: "Breezy",
    fairwayFirmness: "Firm",
    greenFirmness: "Firm",
    greenSpeed: 11,
    teeCategory: "Regular",
  },
  {
    wind: "Breezy",
    fairwayFirmness: "Firm",
    greenFirmness: "Medium",
    greenSpeed: 10,
    teeCategory: "Regular",
  },
];

const championshipOpeningDates = [
  "2027-03-01",
  "2027-03-08",
  "2027-03-15",
  "2027-03-22",
  "2027-03-29",
  "2027-04-05",
  "2027-04-12",
  "2027-04-19",
  "2027-04-26",
  "2027-05-03",
] as const;

const championshipRounds: readonly CglRoundProposal[] = championshipCourses.map(
  ([courseA, courseB], index) => ({
    weekNumber: index + 4,
    phase: "championship",
    phaseRound: index + 1,
    openingDate: championshipOpeningDates[index],
    closingDate: closingDate(championshipOpeningDates[index], 21),
    courses: [course(courseA), course(courseB)],
    conditions: championshipConditions[index],
  }),
);

export const CGL_SEASON_ONE_PLAN = Object.freeze({
  slug: "hidden-gems-tour-2027",
  name: "Hidden Gems Tour",
  campaignName: "Hidden Gems Tour - Season 1 2027",
  year: 2027,
  seasonNumber: 1,
  status: "proposal" as const,
  timeZone: CGL_TIME_ZONE,
  membershipRegistrationDate: "2027-02-01",
  proposedEntryOpensAt: "2027-02-01T09:00:00+10:00",
  calendarEndsAt: "2027-05-09T23:59:59+10:00",
  submissionEndsAt: "2027-05-23T23:59:59+10:00",
  qualificationStartDate: "2027-02-08",
  championshipStartDate: "2027-03-01",
  finalRoundOpeningDate: "2027-05-03",
  championshipResultsCounted: 8,
  championshipRounds: 10,
  qualificationRounds: 3,
  divisions: ["A", "B"] as const,
  rounds: Object.freeze([...qualificationRounds, ...championshipRounds]),
});

export type CglSeasonOnePlan = typeof CGL_SEASON_ONE_PLAN;

function brisbaneStart(date: string) {
  return new Date(`${date}T00:00:00+10:00`);
}

export function formatCglPlanDate(date: string, short = false) {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: CGL_TIME_ZONE,
    weekday: short ? undefined : "long",
    day: "numeric",
    month: short ? "short" : "long",
    year: short ? undefined : "numeric",
  }).format(brisbaneStart(date));
}

export function getCglSeasonOneMilestone(now = new Date()): {
  label: string;
  value: string;
  detail: string;
} {
  const registration = brisbaneStart(
    CGL_SEASON_ONE_PLAN.membershipRegistrationDate,
  );
  const qualifying = brisbaneStart(CGL_SEASON_ONE_PLAN.qualificationStartDate);
  const championship = brisbaneStart(
    CGL_SEASON_ONE_PLAN.championshipStartDate,
  );
  const finalRound = brisbaneStart(CGL_SEASON_ONE_PLAN.finalRoundOpeningDate);
  const daysUntil = (target: Date) =>
    Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86_400_000));

  if (now < registration)
    return {
      label: "Registration planned",
      value: `${daysUntil(registration)} days`,
      detail: formatCglPlanDate(CGL_SEASON_ONE_PLAN.membershipRegistrationDate),
    };
  if (now < qualifying)
    return {
      label: "Qualification begins",
      value: `${daysUntil(qualifying)} days`,
      detail: formatCglPlanDate(CGL_SEASON_ONE_PLAN.qualificationStartDate),
    };
  if (now < championship) {
    const released = qualificationRounds.filter(
      (round) => brisbaneStart(round.openingDate) <= now,
    ).length;
    return {
      label: "Qualification live",
      value: `${released} of 3 released`,
      detail: `Championship begins ${formatCglPlanDate(CGL_SEASON_ONE_PLAN.championshipStartDate, true)}`,
    };
  }
  if (now < finalRound) {
    const released = championshipRounds.filter(
      (round) => brisbaneStart(round.openingDate) <= now,
    ).length;
    return {
      label: "Championship live",
      value: `Round ${Math.max(1, released)} of 10`,
      detail: "Best eight results count",
    };
  }
  return {
    label: "Final round released",
    value: "Season 1",
    detail: "Standings remain provisional until review and finalisation",
  };
}

export function validateCglSeasonOnePlan(
  plan: CglSeasonOnePlan = CGL_SEASON_ONE_PLAN,
) {
  const errors: string[] = [];
  const qualification = plan.rounds.filter(
    (round) => round.phase === "qualification",
  );
  const championship = plan.rounds.filter(
    (round) => round.phase === "championship",
  );

  if (plan.rounds.length !== 13) errors.push("Season 1 must contain 13 rounds.");
  if (qualification.length !== 3)
    errors.push("Season 1 must contain three qualification rounds.");
  if (championship.length !== 10)
    errors.push("Season 1 must contain ten championship rounds.");

  plan.rounds.forEach((round, index) => {
    if (round.weekNumber !== index + 1)
      errors.push(`Week ${index + 1} is not in sequence.`);
    if (!/^2027-\d{2}-\d{2}$/.test(round.openingDate))
      errors.push(`Week ${round.weekNumber} has an invalid opening date.`);
    if (round.closingDate !== closingDate(round.openingDate, round.phase === "qualification" ? 7 : 21))
      errors.push(`Week ${round.weekNumber} has the wrong proposed submission window.`);
    if (round.phase === "qualification" && (round.courses.length !== 1 || round.courses[0].segment !== "full_18" || !round.courses[0].par))
      errors.push(`Week ${round.weekNumber} must use one complete 18-hole course.`);
    if (round.phase === "championship" && (!round.courses[1] || round.courses[0].name === round.courses[1].name))
      errors.push(`Week ${round.weekNumber} must use two different courses.`);
    for (const item of round.courses) {
      if (item && (item.verified || item.sgtCourseId || (round.phase === "championship" && item.segment)))
        errors.push(
        `Week ${round.weekNumber} course ${item.name} must remain draft until SGT verification.`,
        );
    }
    if (round.phase === "championship" && !round.conditions)
      errors.push(`Championship round ${round.phaseRound} needs conditions.`);
  });

  return errors;
}

export function buildCglSeasonOneAdminDraft() {
  const errors = validateCglSeasonOnePlan();
  if (errors.length) throw new Error(errors.join(" "));

  return {
    season: {
      slug: CGL_SEASON_ONE_PLAN.slug,
      name: CGL_SEASON_ONE_PLAN.name,
      year: CGL_SEASON_ONE_PLAN.year,
      season_number: CGL_SEASON_ONE_PLAN.seasonNumber,
      format: "world_tour",
      starts_at: "2027-02-08T00:00:00+10:00",
      ends_at: CGL_SEASON_ONE_PLAN.submissionEndsAt,
      qualification_ends_at: "2027-02-28T23:59:59+10:00",
      status: "draft",
      config: {
        regulation: CGL_SEASON_ONE_RULES,
        scoring: "individual_stroke_play",
        entry_opens_at: CGL_SEASON_ONE_PLAN.proposedEntryOpensAt,
        calendar_ends_at: CGL_SEASON_ONE_PLAN.calendarEndsAt,
        schedule_approved: false,
        automatic_sgt_enrolment: false,
        proposed_prize_cents: CGL_CASH_PRIZE_CENTS.seasonal,
        campaign_name: CGL_SEASON_ONE_PLAN.campaignName,
        time_zone: CGL_SEASON_ONE_PLAN.timeZone,
        planned_registration_date:
          CGL_SEASON_ONE_PLAN.membershipRegistrationDate,
        planned_qualification_start:
          CGL_SEASON_ONE_PLAN.qualificationStartDate,
        planned_championship_start:
          CGL_SEASON_ONE_PLAN.championshipStartDate,
        best_results_counted:
          CGL_SEASON_ONE_PLAN.championshipResultsCounted,
        approval_state: "proposal",
      },
    },
    weeks: CGL_SEASON_ONE_PLAN.rounds.map((round) => ({
      week_number: round.weekNumber,
      championship_week:
        round.phase === "championship" ? round.phaseRound : null,
      name:
        round.phase === "qualification"
          ? `Qualification ${round.phaseRound}`
          : `Hidden Gems Round ${round.phaseRound}`,
      phase: round.phase,
      opens_at: `${round.openingDate}T00:00:00+10:00`,
      closes_at: `${round.closingDate}T23:59:59+10:00`,
      status: "draft",
      course_name: round.courses[0].name,
      second_course_name: round.courses[1]?.name ?? null,
      sgt_tournament_id: null,
      sgt_tour_id: null,
      conditions: round.conditions ?? {},
      config: {
        planned_open_date: round.openingDate,
        planned_close_date: round.closingDate,
        ...(round.phase === "qualification" ? {
          candidate_sgt_event_id: CGL_QUALIFIER_SGT_EVENTS[round.phaseRound - 1],
          candidate_sgt_tour_id: CGL_QUALIFIER_SGT_TOUR,
        } : {}),
        course_a: { ...round.courses[0], segment: round.phase === "qualification" ? "full_18" : "front_9" },
        ...(round.courses[1] ? { course_b: { ...round.courses[1], segment: "back_9" } } : {}),
        event_approved: false,
        course_verification: "required",
        conditions_verification: "required",
      },
    })),
  };
}
