import type { Database } from "brackets-manager";

export type Par3Phase =
  | "registrations"
  | "pools"
  | "ctp"
  | "knockout"
  | "complete";

export type Par3TeeCategory = "championship" | "ladies" | "junior";

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
  isPublished: boolean;
  isLive: boolean;
  registrationsOpen: boolean;
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

export const PAR3_EVENT_SLUG = "par-3-showdown-2026";
export const PAR3_MATCH_READY = 2;
export const PAR3_MATCH_RUNNING = 3;
export const PAR3_MATCH_COMPLETED = 4;

export function getPoolLabel(poolNumber: number) {
  return `Pool ${String.fromCharCode(64 + poolNumber)}`;
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

  const hasManualRanks = rankedByResults.some(
    (standing) => standing.player.poolRankOverride !== null
  );
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
      standing.player.poolRankOverride !== null
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
      players,
      matches,
      standings: buildPoolStandings(players, matches),
    };
  }) satisfies Par3PoolView[];
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

export function getPar3KnockoutRounds(data: Database | null) {
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
  const labels = ["Round of 16", "Quarter Finals", "Semi Finals", "Grand Final"];

  return rounds.map((round, index) => ({
    id: round.id,
    number: round.number,
    label: labels[index] ?? `Round ${round.number}`,
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
