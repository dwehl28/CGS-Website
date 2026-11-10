import type { Database } from "brackets-manager";

export type Par3Phase =
  | "registrations"
  | "pools"
  | "ctp"
  | "knockout"
  | "complete";

export type Par3TeeCategory = "championship" | "ladies" | "junior";
export type Par3FinalsFormat = "standard" | "pool_winners_ctp_bye";

export type Par3Event = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  startsAt: string;
  warmupAt: string;
  venueName: string;
  venueAddress: string;
  registrationUrl: string;
  youtubeUrl: string;
  statusLabel: string;
  publicMessage: string;
  currentPhase: Par3Phase;
  maxPlayers: number;
  poolCount: number;
  poolSize: number;
  poolSizes?: number[];
  finalsSize?: number;
  finalsFormat?: Par3FinalsFormat;
  isPublished: boolean;
  isLive: boolean;
  registrationsOpen: boolean;
  entryFeeCents: number;
  knockoutData: Database | null;
  knockoutGeneratedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

export type Par3Player = {
  id: number;
  eventId: number;
  displayOrder: number;
  name: string;
  teeCategory: Par3TeeCategory;
  poolNumber: number | null;
  poolRankOverride: number | null;
  ctpRank: number | null;
  ctpDistanceCm: number | null;
  isWithdrawn: boolean;
  updatedAt: string;
  createdAt: string;
};

export type AdminPar3Player = Par3Player & {
  phone: string;
  consent: boolean;
};

export type Par3PoolMatch = {
  id: number;
  eventId: number;
  poolNumber: number;
  matchNumber: number;
  player1Id: number;
  player2Id: number;
  winnerId: number | null;
  status: "scheduled" | "live" | "complete";
  bayNumber: number | null;
  updatedAt: string;
  createdAt: string;
};

export type Par3Snapshot = {
  event: Par3Event;
  players: Par3Player[];
  poolMatches: Par3PoolMatch[];
  source: "database" | "fallback";
  warningMessage: string | null;
};

export type AdminPar3Snapshot = Omit<Par3Snapshot, "players"> & {
  players: AdminPar3Player[];
};

export type Par3Standing = {
  player: Par3Player;
  position: number;
  played: number;
  wins: number;
  losses: number;
  miniLeagueWins: number;
  tieBreakLabel: string;
};

export type Par3PoolView = {
  number: number;
  label: string;
  capacity?: number;
  players: Par3Player[];
  matches: Par3PoolMatch[];
  standings: Par3Standing[];
};

export type Par3KnockoutRound = {
  id: number | string;
  number: number;
  label: string;
  matches: Database["match"];
};

export type Par3StreamView =
  | "banner"
  | "portrait"
  | "thumbnail"
  | "starting"
  | "pools"
  | "fixtures"
  | "results"
  | "standings"
  | "up-next"
  | "bracket"
  | "finals"
  | "sponsors"
  | "winner"
  | "road"
  | "tv";

export type Par3CourseStage = {
  key: string;
  label: string;
  course: string;
  shortCourse: string;
  holes?: number[];
  stageNumber?: number;
};

export type Par3BracketSlot = {
  key: string;
  label: string;
  poolNumber?: number;
  position?: number;
  isCtp?: boolean;
  ctpRank?: number;
  isBye?: boolean;
  remainingPoolWinnerIndex?: number;
};

export type Par3BracketPairing = {
  matchNumber: number;
  lane: number;
  first: Par3BracketSlot;
  second: Par3BracketSlot;
};

export const PAR3_EVENT_SLUG = "par-3-championship-ii-2026";
export const PAR3_MATCH_READY = 2;
export const PAR3_MATCH_RUNNING = 3;
export const PAR3_MATCH_COMPLETED = 4;

export const PAR3_POOL_STAGES: Par3CourseStage[] = [
  { key: "pool-1", label: "Round 1", course: "Gailes Golf Course", shortCourse: "Gailes", holes: [3, 6, 12], stageNumber: 1 },
  { key: "pool-2", label: "Round 2", course: "Royal Canberra Golf Club", shortCourse: "Royal Canberra", holes: [8, 13, 17], stageNumber: 2 },
  { key: "pool-3", label: "Round 3", course: "Royal Hobart Golf Club", shortCourse: "Royal Hobart", holes: [8, 11, 15], stageNumber: 3 },
];

export const PAR3_FINALS_STAGES: Par3CourseStage[] = [
  { key: "ctp", label: "CTP contest", course: "Augusta National Golf Club", shortCourse: "Augusta National", holes: [12], stageNumber: 4 },
  { key: "round-of-16", label: "Round of 16", course: "Royal Adelaide Golf Club", shortCourse: "Royal Adelaide", holes: [7, 12, 16], stageNumber: 5 },
  { key: "quarter-finals", label: "Quarter Finals", course: "New South Wales Golf Club", shortCourse: "New South Wales", holes: [2, 6, 17], stageNumber: 6 },
  { key: "semi-finals", label: "Semi Finals", course: "The Australian Golf Club", shortCourse: "The Australian", holes: [2, 4, 11], stageNumber: 7 },
  { key: "grand-final", label: "Grand Final", course: "The National Golf Club (Old Course)", shortCourse: "National (Old)", holes: [4, 7, 13], stageNumber: 8 },
];

export function getPar3CtpStage(): Par3CourseStage {
  const stage = PAR3_FINALS_STAGES[0];
  return { ...stage, holes: stage.holes?.slice() };
}

const slot = (
  poolNumber: number,
  position: number
): Par3BracketSlot => ({
  key: `${getPoolLabel(poolNumber)}-${position}`,
  label: `${getPoolLabel(poolNumber)} ${position}${position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th"}`,
  poolNumber,
  position,
});

const ctpSlot = (rank = 1): Par3BracketSlot => ({
  key: `ctp-${rank}`,
  label: rank === 1 ? "CTP winner" : `CTP qualifier ${rank}`,
  isCtp: true,
  ctpRank: rank,
});

export const PAR3_ROUND_OF_16_TEMPLATE: Par3BracketPairing[] = [
  { matchNumber: 1, lane: 1, first: slot(1, 1), second: ctpSlot() },
  { matchNumber: 2, lane: 1, first: slot(2, 1), second: slot(1, 3) },
  { matchNumber: 3, lane: 2, first: slot(3, 1), second: slot(2, 3) },
  { matchNumber: 4, lane: 2, first: slot(4, 2), second: slot(5, 2) },
  { matchNumber: 5, lane: 3, first: slot(4, 1), second: slot(3, 3) },
  { matchNumber: 6, lane: 3, first: slot(1, 2), second: slot(2, 2) },
  { matchNumber: 7, lane: 4, first: slot(5, 1), second: slot(4, 3) },
  { matchNumber: 8, lane: 4, first: slot(3, 2), second: slot(5, 3) },
];

export const PAR3_SIX_POOL_ROUND_OF_16_TEMPLATE: Par3BracketPairing[] = [
  { matchNumber: 1, lane: 1, first: slot(1, 1), second: ctpSlot(4) },
  { matchNumber: 2, lane: 1, first: slot(4, 2), second: slot(5, 2) },
  { matchNumber: 3, lane: 2, first: slot(2, 1), second: ctpSlot(3) },
  { matchNumber: 4, lane: 2, first: slot(6, 1), second: slot(1, 2) },
  { matchNumber: 5, lane: 3, first: slot(3, 1), second: ctpSlot(2) },
  { matchNumber: 6, lane: 3, first: slot(2, 2), second: slot(6, 2) },
  { matchNumber: 7, lane: 4, first: slot(4, 1), second: ctpSlot(1) },
  { matchNumber: 8, lane: 4, first: slot(5, 1), second: slot(3, 2) },
];

export type Par3FormatInput = { poolSizes: number[]; finalsSize: number; finalsFormat?: Par3FinalsFormat };
export type Par3FormatEvent = Pick<Par3Event, "poolCount" | "poolSize" | "poolSizes" | "finalsSize" | "finalsFormat">;
type Par3QualificationSource = number | Par3FormatEvent | Par3Snapshot | AdminPar3Snapshot;

function getFormatEvent(source: Par3QualificationSource): Par3FormatEvent {
  if (typeof source === "number") return { poolCount: source, poolSize: 4 };
  return "event" in source ? source.event : source;
}

export function getPar3PoolSizes(event: Par3FormatEvent) {
  return event.poolSizes?.length
    ? event.poolSizes.slice()
    : Array.from({ length: event.poolCount }, () => event.poolSize);
}

export function getPar3PoolCapacity(event: Par3FormatEvent, poolNumber: number) {
  return getPar3PoolSizes(event)[poolNumber - 1] ?? 0;
}

export function getPar3FinalsSize(event: Pick<Par3Event, "finalsSize">) {
  return event.finalsSize ?? 16;
}

export function getPar3FinalsFormat(event: Pick<Par3Event, "finalsFormat">): Par3FinalsFormat {
  return event.finalsFormat ?? "standard";
}

export function validatePar3Format(input: Par3FormatInput) {
  if (!Array.isArray(input.poolSizes) || input.poolSizes.length < 1 || input.poolSizes.length > 16) {
    throw new Error("Choose between 1 and 16 pools.");
  }
  if (input.poolSizes.some((size) => !Number.isInteger(size) || size < 2 || size > 8)) {
    throw new Error("Each pool must have between 2 and 8 places.");
  }
  const maxPlayers = input.poolSizes.reduce((total, size) => total + size, 0);
  if (maxPlayers > 64) throw new Error("The tournament can have a maximum of 64 places.");
  const finalsFormat = input.finalsFormat ?? "standard";
  if (finalsFormat !== "standard" && finalsFormat !== "pool_winners_ctp_bye") {
    throw new Error("Choose a supported finals format.");
  }
  const requiredPlayerCount = input.finalsSize - (finalsFormat === "pool_winners_ctp_bye" ? 1 : 0);
  if (![2, 4, 8, 16, 32, 64].includes(input.finalsSize) || requiredPlayerCount > maxPlayers) {
    throw new Error(finalsFormat === "pool_winners_ctp_bye"
      ? "Choose a finals draw of 2, 4, 8, 16, 32 or 64 with capacity for exactly one fewer player."
      : "Choose a finals draw of 2, 4, 8, 16, 32 or 64, no larger than the player capacity.");
  }
  if (finalsFormat === "pool_winners_ctp_bye" && requiredPlayerCount < input.poolSizes.length * 2) {
    throw new Error("The one-bye format needs room for at least two players in every pool.");
  }
  return {
    poolSizes: input.poolSizes.slice(),
    poolCount: input.poolSizes.length,
    poolSize: Math.max(...input.poolSizes),
    maxPlayers,
    finalsSize: input.finalsSize,
    finalsFormat,
  };
}

export const validatePar3TournamentFormat = validatePar3Format;

export type Par3RoundRobinPair = { firstIndex: number; secondIndex: number; round: number; matchNumber: number };

export function buildPar3RoundRobinPairs(playerCount: number): Par3RoundRobinPair[] {
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 8) {
    throw new Error("Round-robin pools need between 2 and 8 players.");
  }
  const rotation = Array.from({ length: playerCount }, (_, index) => index);
  if (playerCount % 2 !== 0) rotation.push(-1);
  const pairs: Par3RoundRobinPair[] = [];
  for (let round = 1; round < rotation.length; round += 1) {
    for (let index = 0; index < rotation.length / 2; index += 1) {
      const firstIndex = rotation[index];
      const secondIndex = rotation[rotation.length - 1 - index];
      if (firstIndex !== -1 && secondIndex !== -1) {
        pairs.push({ firstIndex, secondIndex, round, matchNumber: pairs.length + 1 });
      }
    }
    rotation.splice(1, 0, rotation.pop()!);
  }
  return pairs;
}

export const getPar3PoolFixturePairs = buildPar3RoundRobinPairs;

function getByePreviewPoolSizes(capacities: number[], requiredPlayerCount: number) {
  const counts = capacities.map(() => 0);
  let assigned = 0;
  let reverse = false;
  while (assigned < requiredPlayerCount) {
    let progress = false;
    const indexes = capacities.map((_, index) => index);
    if (reverse) indexes.reverse();
    for (const index of indexes) {
      if (assigned === requiredPlayerCount) break;
      if (counts[index] >= capacities[index]) continue;
      counts[index] += 1;
      assigned += 1;
      progress = true;
    }
    if (!progress) return capacities;
    reverse = !reverse;
  }
  return counts;
}

export function getPar3QualificationPlan(source: Par3QualificationSource) {
  const event = getFormatEvent(source);
  const capacities = getPar3PoolSizes(event);
  const finalsSize = getPar3FinalsSize(event);
  const finalsFormat = getPar3FinalsFormat(event);
  const isByeFormat = finalsFormat === "pool_winners_ctp_bye";
  const requiredPlayerCount = finalsSize - (isByeFormat ? 1 : 0);
  const errors: string[] = [];
  try { validatePar3Format({ poolSizes: capacities, finalsSize, finalsFormat }); }
  catch (error) { errors.push(error instanceof Error ? error.message : "The tournament format is invalid."); }
  if (capacities.length !== event.poolCount) errors.push("The pool count must match the nominated pool sizes.");
  const snapshot = typeof source !== "number" && "event" in source ? source : null;
  if (snapshot) {
    const activePlayers = snapshot.players.filter((player) => !player.isWithdrawn);
    if (activePlayers.some((player) => player.poolNumber === null || !Number.isInteger(player.poolNumber)
      || player.poolNumber < 1 || player.poolNumber > capacities.length)) {
      errors.push("Assign every active player to a nominated pool before generating the finals draw.");
    }
    if (new Set(activePlayers.map((player) => player.id)).size !== activePlayers.length) {
      errors.push("Each player can only appear once in the tournament draw.");
    }
  }
  const poolSizes = snapshot
    ? capacities.map((_, index) => snapshot.players.filter((player) => !player.isWithdrawn && player.poolNumber === index + 1).length)
    : isByeFormat ? getByePreviewPoolSizes(capacities, requiredPlayerCount) : capacities;
  for (let index = 0; index < poolSizes.length; index += 1) {
    if (poolSizes[index] < 2) errors.push(`${getPoolLabel(index + 1)} needs at least two players.`);
    if (poolSizes[index] > capacities[index]) errors.push(`${getPoolLabel(index + 1)} is over capacity.`);
  }
  const totalPlayers = poolSizes.reduce((total, size) => total + size, 0);
  if (isByeFormat) {
    if (totalPlayers !== requiredPlayerCount) errors.push(`The one-bye format needs exactly ${requiredPlayerCount} active players across the nominated pools.`);
    return {
      automaticPlaces: 0,
      ctpPoolPosition: 1,
      ctpQualifierCount: 1,
      ctpAllRemaining: false,
      ctpContestantCount: poolSizes.filter((size) => size > 0).length,
      finalsSize,
      finalsFormat,
      ctpPurpose: "bye" as const,
      byeCount: 1,
      requiredPlayerCount,
      allPlayersAdvance: true,
      openingMatchCount: finalsSize / 2 - 1,
      errors,
    };
  }
  if (totalPlayers < finalsSize) errors.push(`Assign at least ${finalsSize} players before generating the finals draw.`);
  const automaticPlaces = poolSizes.length
    ? Math.min(Math.floor(finalsSize / poolSizes.length), ...poolSizes)
    : 0;
  const ctpQualifierCount = Math.max(0, finalsSize - automaticPlaces * poolSizes.length);
  const ctpPoolPosition = automaticPlaces + 1;
  const nextPlaceCandidates = poolSizes.filter((size) => size > automaticPlaces).length;
  const ctpAllRemaining = ctpQualifierCount > nextPlaceCandidates;
  const ctpContestantCount = ctpQualifierCount === 0 ? 0 : ctpAllRemaining
    ? poolSizes.reduce((total, size) => total + Math.max(0, size - automaticPlaces), 0)
    : nextPlaceCandidates;
  return {
    automaticPlaces, ctpPoolPosition, ctpQualifierCount, ctpAllRemaining, ctpContestantCount, finalsSize,
    finalsFormat, ctpPurpose: "qualification" as const, byeCount: 0, requiredPlayerCount,
    allPlayersAdvance: false, openingMatchCount: finalsSize / 2, errors,
  };
}

export function getPar3AutomaticQualifyingPlaces(source: Par3QualificationSource) {
  return getPar3QualificationPlan(source).automaticPlaces;
}

export function getPar3CtpPoolPosition(source: Par3QualificationSource) {
  return getPar3QualificationPlan(source).ctpPoolPosition;
}

export function getPar3CtpQualifierCount(source: Par3QualificationSource) {
  return getPar3QualificationPlan(source).ctpQualifierCount;
}

function getSeedOrder(size: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const nextSize = seeds.length * 2;
    seeds = seeds.flatMap((seed) => [seed, nextSize + 1 - seed]);
  }
  return seeds;
}

export function getPar3FinalsTemplate(source: Par3QualificationSource): Par3BracketPairing[] {
  const event = getFormatEvent(source);
  const plan = getPar3QualificationPlan(source);
  if (plan.errors.length) return [];
  if (!plan.allPlayersAdvance && plan.finalsSize === 16 && plan.automaticPlaces === 3 && event.poolCount === 5 && plan.ctpQualifierCount === 1) {
    return PAR3_ROUND_OF_16_TEMPLATE;
  }
  if (!plan.allPlayersAdvance && plan.finalsSize === 16 && plan.automaticPlaces === 2 && event.poolCount === 6 && plan.ctpQualifierCount === 4) {
    return PAR3_SIX_POOL_ROUND_OF_16_TEMPLATE;
  }
  const qualifiers: Par3BracketSlot[] = [];
  const snapshot = typeof source !== "number" && "event" in source ? source : null;
  if (plan.allPlayersAdvance) {
    qualifiers.push(ctpSlot(1));
    for (let index = 1; index < event.poolCount; index += 1) {
      qualifiers.push({ key: `remaining-pool-winner-${index}`, label: `Remaining pool winner ${index}`, remainingPoolWinnerIndex: index });
    }
    const poolSizes = snapshot
      ? buildPar3Pools(snapshot).map((pool) => pool.players.length)
      : getByePreviewPoolSizes(getPar3PoolSizes(event), plan.requiredPlayerCount);
    for (let position = 2; position <= Math.max(...poolSizes); position += 1) {
      const poolNumbers = Array.from({ length: event.poolCount }, (_, index) => index + 1);
      if (position % 2 === 0) poolNumbers.reverse();
      for (const poolNumber of poolNumbers) {
        if (position <= poolSizes[poolNumber - 1]) qualifiers.push(slot(poolNumber, position));
      }
    }
    qualifiers.push({ key: "bye-1", label: "Bye", isBye: true });
  } else {
    for (let position = 1; position <= plan.automaticPlaces; position += 1) {
      const poolNumbers = Array.from({ length: event.poolCount }, (_, index) => index + 1);
      if (position % 2 === 0) poolNumbers.reverse();
      for (const poolNumber of poolNumbers) qualifiers.push(slot(poolNumber, position));
    }
    for (let rank = 1; rank <= plan.ctpQualifierCount; rank += 1) qualifiers.push(ctpSlot(rank));
  }
  const seeded = getSeedOrder(plan.finalsSize).map((seed) => qualifiers[seed - 1]);
  const firsts = seeded.filter((_, index) => index % 2 === 0);
  const seconds = seeded.filter((_, index) => index % 2 !== 0);
  const ctpPoolByRank = new Map<number, number>();
  if (snapshot) {
    for (const player of getPar3CtpQualifiers(snapshot)) {
      if (player.ctpRank !== null && player.poolNumber !== null) ctpPoolByRank.set(player.ctpRank, player.poolNumber);
    }
  }
  const slotPool = (bracketSlot: Par3BracketSlot) => bracketSlot.isCtp
    ? ctpPoolByRank.get(bracketSlot.ctpRank ?? 1)
    : bracketSlot.remainingPoolWinnerIndex && snapshot
      ? resolvePar3BracketSlot(snapshot, bracketSlot)?.poolNumber
      : bracketSlot.poolNumber;
  // Keep the seed lanes while finding as many different-pool opening matches as possible.
  const owners = new Map<number, number>();
  const assigned = new Map<number, number>();
  for (let index = 0; index < firsts.length; index += 1) {
    if (firsts[index].isBye || seconds[index].isBye) {
      assigned.set(index, index);
      owners.set(index, index);
    }
  }
  const findOpponent = (firstIndex: number, visited: Set<number>): boolean => {
    for (const secondIndex of [firstIndex, ...seconds.map((_, index) => index).filter((index) => index !== firstIndex)]) {
      if (visited.has(secondIndex)) continue;
      const first = firsts[firstIndex];
      const second = seconds[secondIndex];
      if (second.isBye || first.isBye) continue;
      const firstPool = slotPool(first);
      if (firstPool !== undefined && firstPool === slotPool(second)) continue;
      visited.add(secondIndex);
      const owner = owners.get(secondIndex);
      if (owner === undefined || findOpponent(owner, visited)) {
        owners.set(secondIndex, firstIndex);
        assigned.set(firstIndex, secondIndex);
        return true;
      }
    }
    return false;
  };
  for (let index = 0; index < firsts.length; index += 1) {
    if (!assigned.has(index)) findOpponent(index, new Set());
  }
  const remaining = seconds.map((_, index) => index).filter((index) => !owners.has(index));
  return firsts.map((first, index) => ({
    matchNumber: index + 1,
    lane: Math.floor(index / 2) + 1,
    first,
    second: seconds[assigned.get(index) ?? remaining.shift()!],
  }));
}

export function getPar3RoundOf16Template(source: Par3QualificationSource) {
  return getPar3FinalsTemplate(source);
}

export function getPoolLabel(poolNumber: number) {
  return `Pool ${String.fromCharCode(64 + poolNumber)}`;
}

export function getPoolMatchRound(matchNumber: number, playerCount = 4) {
  return Math.ceil(matchNumber / Math.max(1, Math.floor(playerCount / 2)));
}

export function getPar3PoolStages(playerCount = 4): Par3CourseStage[] {
  const roundCount = playerCount < 2 ? 0 : playerCount % 2 === 0 ? playerCount - 1 : playerCount;
  return Array.from({ length: roundCount }, (_, index) => ({
    ...PAR3_POOL_STAGES[index % PAR3_POOL_STAGES.length],
    key: `pool-${index + 1}`,
    label: `Round ${index + 1}`,
    holes: PAR3_POOL_STAGES[index % PAR3_POOL_STAGES.length].holes?.slice(),
    stageNumber: index < PAR3_POOL_STAGES.length ? index + 1 : undefined,
  }));
}

export function getPoolStage(matchNumber: number, playerCount = 4) {
  return getPar3PoolStages(playerCount)[getPoolMatchRound(matchNumber, playerCount) - 1] ?? null;
}

export function getPar3FinalsStages(source: number | Par3FormatEvent): Par3CourseStage[] {
  const finalsSize = typeof source === "number" ? source : getPar3FinalsSize(source);
  const byeFormat = typeof source !== "number" && getPar3FinalsFormat(source) === "pool_winners_ctp_bye";
  if (![2, 4, 8, 16, 32, 64].includes(finalsSize)) return [];
  return Array.from({ length: Math.log2(finalsSize) }, (_, index) => {
    const remaining = finalsSize / 2 ** index;
    const stage = PAR3_FINALS_STAGES[remaining >= 16 ? 1 : remaining === 8 ? 2 : remaining === 4 ? 3 : 4];
    return {
      ...stage,
      key: remaining >= 16 ? `round-of-${remaining}` : stage.key,
      label: byeFormat && index === 0 ? "Opening round" : remaining >= 16 ? `Round of ${remaining}` : stage.label,
      holes: stage.holes?.slice(),
      stageNumber: finalsSize === 16 ? stage.stageNumber : undefined,
    };
  });
}

export function getPar3ActivePlayers(
  snapshot: Par3Snapshot | AdminPar3Snapshot
) {
  return snapshot.players.filter((player) => !player.isWithdrawn);
}

export function getPar3RemainingSpots(
  snapshot: Par3Snapshot | AdminPar3Snapshot
) {
  return Math.max(
    0,
    snapshot.event.maxPlayers - getPar3ActivePlayers(snapshot).length
  );
}

export function sortPar3PoolMatches(matches: Par3PoolMatch[], snapshot?: Par3Snapshot | AdminPar3Snapshot) {
  const playerCount = (poolNumber: number) => snapshot
    ? snapshot.players.filter((player) => !player.isWithdrawn && player.poolNumber === poolNumber).length
    : 4;
  return matches.slice().sort((first, second) => {
    const roundDifference =
      getPoolMatchRound(first.matchNumber, playerCount(first.poolNumber)) - getPoolMatchRound(second.matchNumber, playerCount(second.poolNumber));

    if (roundDifference !== 0) {
      return roundDifference;
    }

    if (first.poolNumber !== second.poolNumber) {
      return first.poolNumber - second.poolNumber;
    }

    return first.matchNumber - second.matchNumber;
  });
}

export type Par3SimulatorQueue = {
  simulatorNumber: number;
  current: Par3PoolMatch | null;
  upNext: Par3PoolMatch | null;
  queued: Par3PoolMatch[];
};

export function getPar3SimulatorQueues(
  snapshot: Par3Snapshot | AdminPar3Snapshot,
  simulatorCount = 3
) {
  return Array.from({ length: simulatorCount }, (_, index) => {
    const simulatorNumber = index + 1;
    const matches = sortPar3PoolMatches(
      snapshot.poolMatches.filter(
        (match) => match.bayNumber === simulatorNumber
      ), snapshot
    );
    const queued = matches.filter((match) => match.status === "scheduled");

    return {
      simulatorNumber,
      current: matches.find((match) => match.status === "live") ?? null,
      upNext: queued[0] ?? null,
      queued,
    } satisfies Par3SimulatorQueue;
  });
}

export function getTeeCategoryLabel(category: Par3TeeCategory) {
  if (category === "ladies") {
    return "Ladies - red tees";
  }

  if (category === "junior") {
    return "Junior - front tees";
  }

  return "Championship tees";
}

function buildStanding(
  player: Par3Player,
  matches: Par3PoolMatch[]
): Omit<Par3Standing, "position" | "miniLeagueWins" | "tieBreakLabel"> {
  const playerMatches = matches.filter(
    (match) => match.player1Id === player.id || match.player2Id === player.id
  );
  const completeMatches = playerMatches.filter((match) => match.winnerId !== null);
  const wins = completeMatches.filter((match) => match.winnerId === player.id).length;

  return {
    player,
    played: completeMatches.length,
    wins,
    losses: completeMatches.length - wins,
  };
}

function rankTiedStandings(
  standings: Array<ReturnType<typeof buildStanding>>,
  matches: Par3PoolMatch[]
) {
  const tiedPlayerIds = new Set(standings.map((standing) => standing.player.id));
  const miniLeagueMatches = matches.filter(
    (match) =>
      match.winnerId !== null &&
      tiedPlayerIds.has(match.player1Id) &&
      tiedPlayerIds.has(match.player2Id)
  );

  return standings
    .map((standing) => ({
      ...standing,
      miniLeagueWins: miniLeagueMatches.filter(
        (match) => match.winnerId === standing.player.id
      ).length,
    }))
    .sort((left, right) => {
      if (right.miniLeagueWins !== left.miniLeagueWins) {
        return right.miniLeagueWins - left.miniLeagueWins;
      }

      return left.player.displayOrder - right.player.displayOrder;
    });
}

function hasCompleteManualPoolRanks(players: Par3Player[]) {
  const ranks = players.map((player) => player.poolRankOverride);
  return players.length > 0
    && ranks.every((rank) => rank !== null && Number.isInteger(rank) && rank >= 1 && rank <= players.length)
    && new Set(ranks).size === players.length;
}

export function buildPoolStandings(
  players: Par3Player[],
  matches: Par3PoolMatch[]
) {
  const baseStandings = players
    .filter((player) => !player.isWithdrawn)
    .map((player) => buildStanding(player, matches));
  const winsGroups = new Map<number, typeof baseStandings>();

  for (const standing of baseStandings) {
    const group = winsGroups.get(standing.wins) ?? [];
    group.push(standing);
    winsGroups.set(standing.wins, group);
  }

  const rankedByResults = [...winsGroups.entries()]
    .sort(([leftWins], [rightWins]) => rightWins - leftWins)
    .flatMap(([, tiedStandings]) => rankTiedStandings(tiedStandings, matches));

  const hasManualRanks = hasCompleteManualPoolRanks(rankedByResults.map((standing) => standing.player));
  const ranked = hasManualRanks
    ? rankedByResults.slice().sort((left, right) => {
        const leftRank = left.player.poolRankOverride ?? 99;
        const rightRank = right.player.poolRankOverride ?? 99;

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        if (right.wins !== left.wins) {
          return right.wins - left.wins;
        }

        return left.player.displayOrder - right.player.displayOrder;
      })
    : rankedByResults;

  return ranked.map((standing, index) => ({
    ...standing,
    position: index + 1,
    tieBreakLabel:
      hasManualRanks
        ? "Admin seed"
        : standing.miniLeagueWins > 0
          ? "Head-to-head"
          : "",
  })) satisfies Par3Standing[];
}

export function buildPar3Pools(snapshot: Par3Snapshot | AdminPar3Snapshot) {
  return Array.from({ length: snapshot.event.poolCount }, (_, index) => {
    const number = index + 1;
    const players = snapshot.players.filter(
      (player) => player.poolNumber === number && !player.isWithdrawn
    );
    const matches = snapshot.poolMatches
      .filter((match) => match.poolNumber === number)
      .sort((left, right) => left.matchNumber - right.matchNumber);

    return {
      number,
      label: getPoolLabel(number),
      capacity: getPar3PoolCapacity(snapshot.event, number),
      players,
      matches,
      standings: buildPoolStandings(players, matches),
    };
  }) satisfies Par3PoolView[];
}

export function isPar3PoolComplete(pool: Par3PoolView) {
  const players = pool.players.filter((player) => !player.isWithdrawn);
  if (players.length < 2 || (pool.capacity !== undefined && players.length > pool.capacity)) return false;
  const playerIds = new Set(players.map((player) => player.id));
  if (playerIds.size !== players.length) return false;
  if (players.some((player) => player.poolRankOverride !== null)) {
    return hasCompleteManualPoolRanks(players);
  }
  if (pool.matches.length !== players.length * (players.length - 1) / 2) return false;
  const pairings = new Set<string>();
  for (const match of pool.matches) {
    if (match.poolNumber !== pool.number || match.status !== "complete" || match.winnerId === null
      || !playerIds.has(match.player1Id) || !playerIds.has(match.player2Id)
      || match.player1Id === match.player2Id
      || (match.winnerId !== match.player1Id && match.winnerId !== match.player2Id)) return false;
    const key = [match.player1Id, match.player2Id].sort((first, second) => first - second).join(":");
    if (pairings.has(key)) return false;
    pairings.add(key);
  }
  return true;
}

export function getPar3CtpContestants(
  snapshot: Par3Snapshot | AdminPar3Snapshot
) {
  const plan = getPar3QualificationPlan(snapshot);
  if (plan.errors.length || plan.ctpQualifierCount === 0) return [];
  return buildPar3Pools(snapshot)
    .flatMap((pool) => pool.standings.filter((standing) => plan.ctpAllRemaining
      ? standing.position > plan.automaticPlaces
      : standing.position === plan.ctpPoolPosition));
}

export function getPar3CtpQualifiers(
  snapshot: Par3Snapshot | AdminPar3Snapshot
) {
  const qualifierCount = getPar3CtpQualifierCount(snapshot);
  const contestants = getPar3CtpContestants(snapshot).map((standing) => standing.player);
  const rankCounts = new Map<number, number>();
  for (const player of contestants) {
    if (player.ctpRank !== null) rankCounts.set(player.ctpRank, (rankCounts.get(player.ctpRank) ?? 0) + 1);
  }
  return contestants
    .filter(
      (player) =>
        !player.isWithdrawn &&
        player.ctpRank !== null &&
        Number.isInteger(player.ctpRank) && player.ctpRank >= 1 &&
        player.ctpRank <= qualifierCount && rankCounts.get(player.ctpRank) === 1
    )
    .sort((left, right) => (left.ctpRank ?? 99) - (right.ctpRank ?? 99));
}

export function getPar3CtpWinner(
  snapshot: Par3Snapshot | AdminPar3Snapshot
) {
  return getPar3CtpQualifiers(snapshot).find((player) => player.ctpRank === 1) ?? null;
}

export function resolvePar3BracketSlot(
  snapshot: Par3Snapshot | AdminPar3Snapshot,
  bracketSlot: Par3BracketSlot
) {
  if (bracketSlot.isBye) return null;
  if (bracketSlot.remainingPoolWinnerIndex !== undefined) {
    const winner = getPar3CtpWinner(snapshot);
    if (!winner || getPar3FinalsFormat(snapshot.event) !== "pool_winners_ctp_bye") return null;
    return buildPar3Pools(snapshot)
      .map((pool) => pool.standings[0]?.player)
      .filter((player): player is Par3Player => Boolean(player && player.id !== winner.id))
      [bracketSlot.remainingPoolWinnerIndex - 1] ?? null;
  }
  if (bracketSlot.isCtp) {
    const rank = bracketSlot.ctpRank ?? 1;
    return getPar3CtpQualifiers(snapshot).find((player) => player.ctpRank === rank) ?? null;
  }

  if (!bracketSlot.poolNumber || !bracketSlot.position) {
    return null;
  }

  return buildPar3Pools(snapshot)
    .find((pool) => pool.number === bracketSlot.poolNumber)
    ?.standings.find((standing) => standing.position === bracketSlot.position)
    ?.player ?? null;
}

export function getKnockoutParticipantName(
  data: Database,
  participantId: number | string | null | undefined
) {
  if (participantId === null || participantId === undefined) {
    return "TBD";
  }

  return (
    data.participant.find(
      (participant) => String(participant.id) === String(participantId)
    )?.name || "TBD"
  );
}

export function isPar3KnockoutBye(match: Database["match"][number]) {
  return (match.opponent1 === null && match.opponent2?.id !== null && match.opponent2?.id !== undefined)
    || (match.opponent2 === null && match.opponent1?.id !== null && match.opponent1?.id !== undefined);
}

export function getPar3KnockoutRounds(data: Database | null, event?: Par3FormatEvent) {
  if (!data) {
    return [];
  }

  const group = data.group.find((candidate) => candidate.number === 1);

  if (!group) {
    return [];
  }

  const rounds = data.round
    .filter((round) => String(round.group_id) === String(group.id))
    .sort((left, right) => left.number - right.number);
  const stages = getPar3FinalsStages({ poolCount: 1, poolSize: 4, ...event, finalsSize: 2 ** rounds.length });
  return rounds.map((round, index) => ({
    id: round.id,
    number: round.number,
    label: stages[index]?.label ?? `Round ${round.number}`,
    matches: data.match
      .filter((match) => String(match.round_id) === String(round.id))
      .sort((left, right) => left.number - right.number),
  })) satisfies Par3KnockoutRound[];
}

export function getPar3Champion(data: Database | null) {
  const finalRound = getPar3KnockoutRounds(data).at(-1);
  const finalMatch = finalRound?.matches[0];

  if (!data || !finalMatch) {
    return null;
  }

  const winnerId =
    finalMatch.opponent1?.result === "win"
      ? finalMatch.opponent1.id
      : finalMatch.opponent2?.result === "win"
        ? finalMatch.opponent2.id
        : null;

  return winnerId === null
    ? null
    : getKnockoutParticipantName(data, winnerId);
}
