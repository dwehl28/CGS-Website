import {
  getPar3FinalsStages,
  getPar3CtpStage,
  getPar3FinalsTemplate,
  buildPar3Pools,
  getPar3PoolCapacity,
  getPar3PoolStages,
  getPar3QualificationPlan,
  getKnockoutParticipantName,
  isPar3PoolComplete,
  getPoolMatchRound,
  type Par3PoolMatch,
  type Par3CourseStage,
  type Par3Snapshot,
} from "./par3-showdown-types";

export const PAR3_COURSE_POSTER_URL = "/par3/par3-course-draw.png?v=20261105";

export function getPar3StageHoleLabel(stage: Par3CourseStage | null | undefined) {
  if (!stage?.holes?.length) return "";
  return `${stage.holes.length === 1 ? "Hole" : "Holes"} ${stage.holes.join(" · ")}`;
}

export function splitPar3DisplayPages<T>(items: T[], pageSize: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / pageSize) }, (_, index) =>
    items.slice(index * pageSize, (index + 1) * pageSize)
  );
}

export function getPar3DisplayPoolSize(snapshot: Par3Snapshot, poolNumber: number) {
  const players = snapshot.players.filter(
    (player) => player.poolNumber === poolNumber && !player.isWithdrawn
  ).length;
  return players >= 2 ? players : getPar3PoolCapacity(snapshot.event, poolNumber);
}

export function getPar3DisplayMatchRound(snapshot: Par3Snapshot, match: Par3PoolMatch) {
  return getPoolMatchRound(match.matchNumber, getPar3DisplayPoolSize(snapshot, match.poolNumber));
}

export function getPar3DisplayPoolStages(snapshot: Par3Snapshot) {
  const largestPool = Math.max(
    2,
    ...Array.from({ length: snapshot.event.poolCount }, (_, index) =>
      getPar3DisplayPoolSize(snapshot, index + 1)
    )
  );
  return getPar3PoolStages(largestPool);
}

export function getPar3QualificationDescription(snapshot: Par3Snapshot) {
  const plan = getPar3DisplayQualification(snapshot);
  if (plan.ctpPurpose === "bye") {
    const nextRound = getPar3FinalsStages(snapshot.event)[1]?.label ?? "the next round";
    return `All ${plan.requiredPlayerCount} players advance to the finals. Pool winners contest CTP; the winner receives a bye to the ${nextRound}. The other ${plan.requiredPlayerCount - 1} players play ${plan.openingMatchCount} opening matches.`;
  }
  const automatic = plan.automaticPlaces
    ? `The top ${plan.automaticPlaces} in each pool qualify automatically.`
    : "Finals places are decided by the CTP playoff.";
  if (!plan.ctpQualifierCount) return `${automatic} No bracket CTP is required.`;
  const field = plan.ctpAllRemaining
    ? "Remaining pool players"
    : `Players finishing ${par3Ordinal(plan.ctpPoolPosition)}`;
  return `${automatic} ${field} compete for ${plan.ctpQualifierCount} CTP place${plan.ctpQualifierCount === 1 ? "" : "s"}.`;
}

export function getPar3DisplayFinalistCount(snapshot: Par3Snapshot) {
  const plan = getPar3DisplayQualification(snapshot);
  return plan.allPlayersAdvance ? plan.requiredPlayerCount : plan.finalsSize;
}

export function getPar3ByeAdvanceLabel(snapshot: Par3Snapshot) {
  return `Bye · advances to ${getPar3FinalsStages(snapshot.event)[1]?.label ?? "the next round"}`;
}

type DisplayMatchOpponent = { id: number | string | null } | null | undefined;
export function getPar3DisplayByePlayer(
  snapshot: Par3Snapshot,
  roundNumber: number,
  match: { opponent1?: DisplayMatchOpponent; opponent2?: DisplayMatchOpponent }
) {
  if (getPar3DisplayQualification(snapshot).ctpPurpose !== "bye" || roundNumber !== 1 || !snapshot.event.knockoutData) return null;
  const participantId = match.opponent1?.id !== null && match.opponent1?.id !== undefined && match.opponent2 === null
    ? match.opponent1.id
    : match.opponent2?.id !== null && match.opponent2?.id !== undefined && match.opponent1 === null
      ? match.opponent2.id
      : null;
  return participantId === null ? null : getKnockoutParticipantName(snapshot.event.knockoutData, participantId);
}

export function getPar3DisplayQualification(snapshot: Par3Snapshot) {
  const plan = getPar3QualificationPlan(snapshot);
  return plan.errors.length ? getPar3QualificationPlan(snapshot.event) : plan;
}

export function isPar3DisplayPoolOrderConfirmed(snapshot: Par3Snapshot) {
  return getPar3QualificationPlan(snapshot).errors.length === 0 && buildPar3Pools(snapshot).every(isPar3PoolComplete);
}

export function getPar3DisplayFinalsTemplate(snapshot: Par3Snapshot) {
  const plan = getPar3QualificationPlan(snapshot);
  return getPar3FinalsTemplate(plan.errors.length ? snapshot.event : snapshot);
}

export function getPar3PrizeCtpContestants(snapshot: Par3Snapshot) {
  const plan = getPar3DisplayQualification(snapshot);
  return buildPar3Pools(snapshot).flatMap((pool) => {
    const lastPlace = pool.standings.at(-1);
    return lastPlace && lastPlace.position > plan.automaticPlaces ? [lastPlace] : [];
  });
}

export function getPar3DisplayCourseStages(snapshot: Par3Snapshot) {
  const plan = getPar3DisplayQualification(snapshot);
  return [
    ...getPar3DisplayPoolStages(snapshot),
    ...(plan.ctpQualifierCount
      ? [{ ...getPar3CtpStage(), label: plan.ctpPurpose === "bye" ? "Pool winners CTP" : "CTP contest" }]
      : []),
    ...getPar3FinalsStages(snapshot.event),
  ];
}

export function par3Ordinal(value: number) {
  const remainder = value % 100;
  const suffix = remainder >= 11 && remainder <= 13
    ? "th"
    : value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th";
  return `${value}${suffix}`;
}
