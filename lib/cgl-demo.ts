/**
 * Fictional CGL prototype data. This module never contacts SGT or reads account data.
 * Dates describe an illustrative snapshot, so the preview does not change over time.
 */
export type CglScoring = "net" | "gross";

export type CglPlayer = {
  username: string;
  division: string;
  handicap: number;
  initials: string;
  color: string;
};

export type CglRound = {
  id: string;
  number: number;
  course: string;
  par: number;
  opensLabel: string;
  status: "open" | "upcoming";
  location: string;
};

export type CglCard = {
  player: string;
  roundId: string;
  gross: number;
  net: number;
  handicap: number;
  drive: number;
  longestDrive: number;
  fairwaysHit: number;
  fairwaysPossible: number;
  greensHit: number;
  putts: number;
  puttingDistance: number;
  ctp: number;
  holes: { par: number; score: number; putts: number }[];
};

export type CglStanding = {
  player: CglPlayer;
  rank: number;
  tied: boolean;
  points: number;
  played: number;
  roundPoints: Record<string, number>;
};

export type CglRoundResult = {
  player: CglPlayer;
  card: CglCard;
  rank: number;
  tied: boolean;
  points: number;
  toPar: number;
  birdies: number;
  fairwaysPercentage: number;
  greensPercentage: number;
};

export type CglRoundAchievement = {
  id: "net" | "gross" | "drive" | "fairways" | "greens" | "putts" | "putting-distance" | "ctp" | "birdies";
  label: string;
  value: number;
  unit: "strokes" | "m" | "%" | "putts" | "birdies";
  direction: "lower" | "higher";
  winners: { player: CglPlayer; card: CglCard; value: number }[];
  detail: string;
};

export const cglSeason = {
  name: "Founding Season",
  year: 2027,
  totalRounds: 6,
  releasedRounds: 3,
  closeLabel: "14 March 2027",
  snapshotLabel: "17 February 2027",
};

export const cglPlayers: CglPlayer[] = [
  { username: "FairwayFox", division: "Division 2", handicap: 12, initials: "FF", color: "#bd8d43" },
  { username: "PinSeeker", division: "Division 1", handicap: 7, initials: "PS", color: "#4f817c" },
  { username: "BunkerBandit", division: "Division 3", handicap: 18, initials: "BB", color: "#8b738f" },
  { username: "TheMulligan", division: "Division 1", handicap: 9, initials: "TM", color: "#8b7654" },
  { username: "KoalaFade", division: "Division 2", handicap: 14, initials: "KF", color: "#7c8c62" },
  { username: "Sandgroper", division: "Division 3", handicap: 21, initials: "SG", color: "#a87861" },
  { username: "BirdieBruce", division: "Division 1", handicap: 5, initials: "BR", color: "#657e9a" },
  { username: "WedgeWizard", division: "Division 2", handicap: 11, initials: "WW", color: "#8d806e" },
  { username: "ParTeeTime", division: "Division 3", handicap: 24, initials: "PT", color: "#7c739e" },
  { username: "GreenMachine", division: "Division 2", handicap: 16, initials: "GM", color: "#5e8875" },
];

// Course names and locations are fictional, illustrative season content.
export const cglRounds: CglRound[] = [
  { id: "r1", number: 1, course: "Coastal Dunes", par: 72, opensLabel: "1 February 2027", status: "open", location: "Tasmania, Australia" },
  { id: "r2", number: 2, course: "Southern Pines", par: 72, opensLabel: "8 February 2027", status: "open", location: "Victoria, Australia" },
  { id: "r3", number: 3, course: "Cape Links", par: 72, opensLabel: "15 February 2027", status: "open", location: "South Australia, Australia" },
  { id: "r4", number: 4, course: "Harbour Hills", par: 72, opensLabel: "22 February 2027", status: "upcoming", location: "Auckland, New Zealand" },
  { id: "r5", number: 5, course: "Red Gum Valley", par: 72, opensLabel: "1 March 2027", status: "upcoming", location: "Queensland, Australia" },
  { id: "r6", number: 6, course: "Ocean Ridge", par: 72, opensLabel: "8 March 2027", status: "upcoming", location: "Western Australia, Australia" },
];

const holePars = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 5, 3, 4, 4, 3, 5, 4, 4];

function makeCard(playerIndex: number, roundNumber: number, net: number): CglCard {
  const player = cglPlayers[playerIndex];
  const gross = net + player.handicap;
  const seed = playerIndex * 5 + roundNumber * 7;
  const holes = holePars.map((par) => ({ par, score: par, putts: 1 }));

  // Include birdies, then spread the remaining strokes across other holes. The
  // original gross totals are preserved while the achievement examples include
  // scoring variety. No real player's performance is represented by these cards.
  const birdieCount = Math.max(1, 4 - Math.floor(player.handicap / 7)) + ((seed + roundNumber) % 2);
  const birdieHoles = new Set<number>();
  for (let index = 0; index < birdieCount; index += 1) {
    const holeIndex = (seed + index * 5) % holes.length;
    birdieHoles.add(holeIndex);
    holes[holeIndex].score -= 1;
  }
  const remainingHoles = holes.map((_, index) => (seed + index * 7) % holes.length)
    .filter((index) => !birdieHoles.has(index));
  for (let stroke = 0; stroke < gross - 72 + birdieCount; stroke += 1) {
    holes[remainingHoles[stroke % remainingHoles.length]].score += 1;
  }
  const targetPutts = 27 + ((playerIndex * 3 + roundNumber * 2) % 9);
  let puttsAdded = 0;
  for (let attempt = 0; puttsAdded < targetPutts - 18; attempt += 1) {
    const hole = holes[(seed + attempt * 5) % holes.length];
    // Leave at least one stroke to reach the green and cap putting at three.
    if (hole.putts < Math.min(3, hole.score - 1)) {
      hole.putts += 1;
      puttsAdded += 1;
    }
  }

  const drive = 211 + ((playerIndex * 13 + roundNumber * 9) % 58);
  return {
    player: player.username,
    roundId: `r${roundNumber}`,
    gross: holes.reduce((sum, hole) => sum + hole.score, 0),
    net,
    handicap: player.handicap,
    drive,
    longestDrive: drive + 18 + ((seed * 3) % 17),
    fairwaysHit: 6 + ((playerIndex + roundNumber * 2) % 6),
    fairwaysPossible: 14,
    greensHit: holes.filter((hole) => hole.score - hole.putts <= hole.par - 2).length,
    putts: holes.reduce((sum, hole) => sum + hole.putts, 0),
    puttingDistance: Math.round((13.4 + ((seed * 7) % 206) / 10) * 10) / 10,
    ctp: Math.round((0.7 + ((seed * 3) % 84) / 10) * 10) / 10,
    holes,
  };
}

// Indexes match cglPlayers. Null means the player has not completed that round.
// These deliberate ties and missing rounds exercise the real points calculation.
const netScores: (number | null)[][] = [
  [69, 71, 69, 74, 72, 73, 75, 71, 76, 74],
  [68, 70, 71, 72, 73, 76, 69, 72, null, null],
  [70, 69, 72, null, 71, null, 73, null, null, 74],
];

export const cglCards: CglCard[] = netScores.flatMap((scores, roundIndex) =>
  scores.flatMap((net, playerIndex) => net === null ? [] : [makeCard(playerIndex, roundIndex + 1, net)]),
);

// Proposed FedExCup-style scale, extended to twenty places for this prototype.
// It is a CGL design proposal, not a claim of a sanctioned PGA TOUR competition.
const finishPoints = [500, 300, 190, 135, 110, 100, 90, 85, 80, 75, 70, 65, 60, 57, 55, 53, 51, 49, 47, 45];

function roundResults(roundId: string, scoring: CglScoring) {
  const cards = cglCards
    .filter((card) => card.roundId === roundId && card.holes.length === 18)
    .slice()
    .sort((a, b) => a[scoring] - b[scoring] || a.player.localeCompare(b.player));
  const results = new Map<string, { points: number; rank: number; tied: boolean }>();

  for (let start = 0; start < cards.length;) {
    let end = start + 1;
    while (end < cards.length && cards[end][scoring] === cards[start][scoring]) end += 1;
    const points = cards.slice(start, end).reduce((sum, _, offset) => sum + (finishPoints[start + offset] ?? 0), 0) / (end - start);
    for (let index = start; index < end; index += 1) {
      results.set(cards[index].player, { points, rank: start + 1, tied: end - start > 1 });
    }
    start = end;
  }
  return results;
}

/**
 * Compute against the whole field before any presentation-level division filter.
 * A round view returns unplayed players last with rank 0, points 0 and played 0.
 * Season ties use equal total points and competition ranking (1, 2, 2, 4).
 */
export function getCglStandings(scoring: CglScoring = "net", roundId?: string): CglStanding[] {
  const rounds = roundId ? cglRounds.filter((round) => round.id === roundId) : cglRounds;
  const resultsByRound = new Map(rounds.map((round) => [round.id, roundResults(round.id, scoring)]));
  const standings: CglStanding[] = cglPlayers.map((player) => {
    const roundPoints: Record<string, number> = {};
    let points = 0;
    let played = 0;
    for (const round of rounds) {
      const result = resultsByRound.get(round.id)?.get(player.username);
      roundPoints[round.id] = result?.points ?? 0;
      if (result) {
        played += 1;
        points += result.points;
      }
    }
    const result = roundId ? resultsByRound.get(roundId)?.get(player.username) : undefined;
    return { player, rank: result?.rank ?? 0, tied: result?.tied ?? false, points, played, roundPoints };
  }).sort((a, b) => b.points - a.points || b.played - a.played || a.player.username.localeCompare(b.player.username));

  if (!roundId) {
    standings.forEach((standing, index) => {
      if (standing.played === 0) return;
      const previous = standings[index - 1];
      standing.rank = previous && previous.points === standing.points ? previous.rank : index + 1;
      standing.tied = standings.some((other, otherIndex) => otherIndex !== index && other.played > 0 && other.points === standing.points);
    });
  }
  return standings;
}

export function getCglPlayer(username: string): CglPlayer | undefined {
  return cglPlayers.find((player) => player.username.toLowerCase() === username.trim().toLowerCase());
}

/** Returns completed cards in season order, from the earliest round to the latest. */
export function getCglPlayerCards(username: string): CglCard[] {
  const player = getCglPlayer(username);
  return player ? cglCards.filter((card) => card.player === player.username) : [];
}

export function getCglRoundPoints(username: string, roundId: string, scoring: CglScoring = "net"): number {
  const player = getCglPlayer(username);
  return player ? roundResults(roundId, scoring).get(player.username)?.points ?? 0 : 0;
}

/**
 * Round scores always use whole-field positions and points. Division filters may
 * hide rows after this calculation; they must never change a player's position.
 * Every distance in the fictional cards is in metres, including putts holed.
 */
export function getCglRoundResults(roundId: string, scoring: CglScoring = "net"): CglRoundResult[] {
  const results = roundResults(roundId, scoring);
  const round = cglRounds.find((candidate) => candidate.id === roundId);
  if (!round) return [];

  return cglCards.filter((card) => card.roundId === roundId && card.holes.length === 18)
    .flatMap((card) => {
      const player = getCglPlayer(card.player);
      const result = results.get(card.player);
      if (!player || !result) return [];
      return [{
        player,
        card,
        ...result,
        toPar: card[scoring] - round.par,
        birdies: card.holes.filter((hole) => hole.score === hole.par - 1).length,
        fairwaysPercentage: card.fairwaysPossible > 0 ? card.fairwaysHit / card.fairwaysPossible * 100 : 0,
        greensPercentage: card.greensHit / card.holes.length * 100,
      }];
    })
    .sort((a, b) => a.card[scoring] - b.card[scoring] || a.player.username.localeCompare(b.player.username));
}

/** All equal leaders share an achievement; alphabetical order is presentation only. */
export function getCglRoundAchievements(roundId: string): CglRoundAchievement[] {
  const rows = getCglRoundResults(roundId);
  if (rows.length === 0) return [];

  type Definition = Pick<CglRoundAchievement, "id" | "label" | "unit" | "direction"> & {
    metric: (row: CglRoundResult) => number;
    detail: (row: CglRoundResult) => string;
  };
  const scoreDetail = (score: number) => {
    const par = cglRounds.find((round) => round.id === roundId)?.par ?? 72;
    const difference = score - par;
    return difference === 0 ? "Level par" : `${Math.abs(difference)} ${difference < 0 ? "under" : "over"} par`;
  };
  const definitions: Definition[] = [
    { id: "net", label: "Best net", unit: "strokes", direction: "lower", metric: ({ card }) => card.net, detail: ({ card }) => scoreDetail(card.net) },
    { id: "gross", label: "Best gross", unit: "strokes", direction: "lower", metric: ({ card }) => card.gross, detail: ({ card }) => scoreDetail(card.gross) },
    { id: "drive", label: "Longest drive", unit: "m", direction: "higher", metric: ({ card }) => card.longestDrive, detail: () => "Longest recorded drive" },
    { id: "fairways", label: "Most fairways", unit: "%", direction: "higher", metric: (row) => row.fairwaysPercentage, detail: ({ card }) => `${card.fairwaysHit} of ${card.fairwaysPossible} fairways hit` },
    { id: "greens", label: "Most greens", unit: "%", direction: "higher", metric: (row) => row.greensPercentage, detail: ({ card }) => `${card.greensHit} of ${card.holes.length} greens in regulation` },
    { id: "putts", label: "Fewest putts", unit: "putts", direction: "lower", metric: ({ card }) => card.putts, detail: () => "18-hole putting total" },
    { id: "putting-distance", label: "Putts holed distance", unit: "m", direction: "higher", metric: ({ card }) => card.puttingDistance, detail: () => "Combined distance of putts holed" },
    { id: "ctp", label: "Closest to pin", unit: "m", direction: "lower", metric: ({ card }) => card.ctp, detail: () => "Closest qualifying approach" },
    { id: "birdies", label: "Most birdies", unit: "birdies", direction: "higher", metric: (row) => row.birdies, detail: () => "Holes scored one under par" },
  ];

  return definitions.flatMap((definition) => {
    const eligible = rows.filter((row) => Number.isFinite(definition.metric(row)));
    if (eligible.length === 0) return [];
    const values = eligible.map(definition.metric);
    const value = definition.direction === "lower" ? Math.min(...values) : Math.max(...values);
    const winners = eligible.filter((row) => definition.metric(row) === value)
      .sort((a, b) => a.player.username.localeCompare(b.player.username));
    return [{
      id: definition.id,
      label: definition.label,
      unit: definition.unit,
      direction: definition.direction,
      value,
      winners: winners.map(({ player, card }) => ({ player, card, value })),
      detail: definition.detail(winners[0]),
    }];
  });
}

export function formatCglRank(rank: number, tied = false): string {
  return rank > 0 ? `${tied ? "T" : ""}${rank}` : "—";
}
