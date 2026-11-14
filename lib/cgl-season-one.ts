export const CGL_TIME_ZONE = "Australia/Brisbane";

export type CglSeasonPhase = "qualification" | "championship";
export type CglCourseSegment = "front_9" | "back_9" | null;

export type CglCourseProposal = {
  name: string;
  segment: CglCourseSegment;
  sgtCourseId: string | null;
  verified: boolean;
};

export type CglRoundConditions = {
  wind: "Calm" | "Breezy" | "Gusty";
  fairwayFirmness: "Soft" | "Medium" | "Firm";
  greenFirmness: "Soft" | "Medium" | "Firm";
  greenSpeed: 9 | 10 | 11;
  teeCategory: "Forward-Regular" | "Regular" | "Regular+" | "Back";
};

export type CglRoundProposal = {
  weekNumber: number;
  phase: CglSeasonPhase;
  phaseRound: number;
  openingDate: string;
  closingDate: string | null;
  courses: readonly [CglCourseProposal, CglCourseProposal];
  conditions: CglRoundConditions | null;
};

const course = (name: string): CglCourseProposal => ({
  name,
  segment: null,
  sgtCourseId: null,
  verified: false,
});

const qualificationRounds: readonly CglRoundProposal[] = [
  {
    weekNumber: 1,
    phase: "qualification",
    phaseRound: 1,
    openingDate: "2027-02-08",
    closingDate: null,
    courses: [course("Assiniboine"), course("Club Sports Belvédère")],
    conditions: null,
  },
  {
    weekNumber: 2,
    phase: "qualification",
    phaseRound: 2,
    openingDate: "2027-02-15",
    closingDate: null,
    courses: [course("Trail Creek"), course("Fessenden")],
    conditions: null,
  },
  {
    weekNumber: 3,
    phase: "qualification",
    phaseRound: 3,
    openingDate: "2027-02-22",
    closingDate: null,
    courses: [course("Gilbert Plains"), course("Dixie")],
    conditions: null,
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
    closingDate: null,
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
    if (round.closingDate !== null)
      errors.push(`Week ${round.weekNumber} has an unapproved closing date.`);
    if (new Set(round.courses.map((item) => item.name)).size !== 2)
      errors.push(`Week ${round.weekNumber} must use two different courses.`);
    for (const item of round.courses) {
      if (item.verified || item.sgtCourseId || item.segment)
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
      starts_at: null,
      ends_at: null,
      qualification_ends_at: null,
      status: "draft",
      config: {
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
      opens_at: null,
      closes_at: null,
      status: "draft",
      course_name: round.courses[0].name,
      second_course_name: round.courses[1].name,
      sgt_tournament_id: null,
      sgt_tour_id: null,
      conditions: round.conditions ?? {},
      config: {
        planned_open_date: round.openingDate,
        planned_close_date: null,
        course_a: round.courses[0],
        course_b: round.courses[1],
        course_verification: "required",
        conditions_verification:
          round.phase === "championship" ? "required" : "not_configured",
      },
    })),
  };
}
