import { withTimeout } from "@/lib/async-timeout";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type RoundStatRound = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  courseName: string;
  formatLabel: string;
  holesLabel: string;
  statusLabel: string;
  startsAt: string | null;
  isLive: boolean;
  isPublished: boolean;
  updatedAt: string;
  createdAt: string;
  teams: RoundStatTeam[];
  holes: RoundStatHole[];
  entries: RoundStatEntry[];
};

export type RoundStatTeam = {
  id: number;
  roundId: number;
  displayOrder: number;
  name: string;
  shortName: string;
  accentColor: string;
  players: string[];
  updatedAt: string;
};

export type RoundStatHole = {
  id: number;
  roundId: number;
  displayOrder: number;
  holeNumber: number;
  holeLabel: string;
  parLabel: string;
  updatedAt: string;
};

export type RoundStatEntry = {
  id: number;
  roundId: number;
  teamId: number;
  holeId: number;
  scoreToPar: number | null;
  scoreLabel: string;
  putts: number | null;
  fairwayHit: boolean | null;
  greenInRegulation: boolean | null;
  penalties: number;
  drivePlayer: string | null;
  approachPlayer: string | null;
  puttPlayer: string | null;
  notes: string | null;
  updatedAt: string;
};

export type RoundStatEntryInput = {
  roundId: number;
  teamId: number;
  holeId: number;
  scoreToPar: number | null;
  putts: number | null;
  fairwayHit: boolean | null;
  greenInRegulation: boolean | null;
  penalties: number;
  drivePlayer: string;
  approachPlayer: string;
  puttPlayer: string;
  notes: string;
};

export type RoundStatFeed = {
  rounds: RoundStatRound[];
  source: "database" | "fallback";
  warningMessage: string | null;
};

export type TeamRoundSummary = {
  team: RoundStatTeam;
  entries: RoundStatEntry[];
  holesComplete: number;
  currentHoleLabel: string;
  scoreToPar: number | null;
  scoreLabel: string;
  birdies: number;
  eaglesOrBetter: number;
  pars: number;
  bogeysOrWorse: number;
  fairwaysHit: number;
  fairwayOpportunities: number;
  fairwayRate: number | null;
  greensInRegulation: number;
  girOpportunities: number;
  girRate: number | null;
  totalPutts: number;
  puttEntries: number;
  averagePutts: number | null;
  penalties: number;
  contributionLeader: PlayerContribution | null;
};

export type PlayerContribution = {
  teamId: number;
  teamName: string;
  playerName: string;
  driveUses: number;
  approachUses: number;
  puttUses: number;
  totalUses: number;
};

export type RoundStatsSnapshot = {
  round: RoundStatRound;
  leaderboard: TeamRoundSummary[];
  playerContributions: PlayerContribution[];
  totalTeams: number;
  totalHoles: number;
  completeEntries: number;
  totalEntriesPossible: number;
  completionRate: number;
};

const ROUND_STAT_QUERY_TIMEOUT_MS = 3500;
const missingTableMessage =
  "Round stat tracking is not set up yet. Apply the latest Supabase migration to start using the stat lab.";

function isMissingRoundStatTableError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  return error.code === "42P01" || error.code === "PGRST205";
}

function parseNumericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function parseIntegerValue(value: unknown) {
  const parsedValue = parseNumericValue(value);
  return parsedValue === null ? null : Math.trunc(parsedValue);
}

function parseBooleanValue(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  return null;
}

function formatScoreToPar(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  if (value === 0) {
    return "E";
  }

  const absoluteValue = Math.abs(value);
  const isWholeNumber = Number.isInteger(value);
  const formattedValue = isWholeNumber ? absoluteValue.toString() : absoluteValue.toFixed(1);

  return `${value > 0 ? "+" : "-"}${formattedValue}`;
}

function mapRowToRound(row: Record<string, unknown>): RoundStatRound {
  return {
    id: Number(row.id),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    courseName: String(row.course_name ?? ""),
    formatLabel: String(row.format_label ?? "Team Ambrose"),
    holesLabel: String(row.holes_label ?? ""),
    statusLabel: String(row.status_label ?? "Stats tracking"),
    startsAt:
      typeof row.starts_at === "string" && row.starts_at.trim()
        ? row.starts_at
        : null,
    isLive: Boolean(row.is_live),
    isPublished: Boolean(row.is_published),
    updatedAt: String(row.updated_at ?? ""),
    createdAt: String(row.created_at ?? ""),
    teams: [],
    holes: [],
    entries: [],
  };
}

function mapRowToTeam(row: Record<string, unknown>): RoundStatTeam {
  const players = Array.isArray(row.players)
    ? row.players.filter((player): player is string => typeof player === "string")
    : [];

  return {
    id: Number(row.id),
    roundId: Number(row.round_id),
    displayOrder: Number(row.display_order ?? 99),
    name: String(row.name ?? ""),
    shortName: String(row.short_name ?? ""),
    accentColor: String(row.accent_color ?? "#62d7ff"),
    players,
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapRowToHole(row: Record<string, unknown>): RoundStatHole {
  return {
    id: Number(row.id),
    roundId: Number(row.round_id),
    displayOrder: Number(row.display_order ?? 99),
    holeNumber: Number(row.hole_number ?? 0),
    holeLabel: String(row.hole_label ?? ""),
    parLabel: String(row.par_label ?? "Par TBD"),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapRowToEntry(row: Record<string, unknown>): RoundStatEntry {
  const scoreToPar = parseNumericValue(row.score_to_par);

  return {
    id: Number(row.id),
    roundId: Number(row.round_id),
    teamId: Number(row.team_id),
    holeId: Number(row.hole_id),
    scoreToPar,
    scoreLabel: formatScoreToPar(scoreToPar),
    putts: parseIntegerValue(row.putts),
    fairwayHit: parseBooleanValue(row.fairway_hit),
    greenInRegulation: parseBooleanValue(row.green_in_regulation),
    penalties: parseIntegerValue(row.penalties) ?? 0,
    drivePlayer:
      typeof row.drive_player === "string" && row.drive_player.trim()
        ? row.drive_player
        : null,
    approachPlayer:
      typeof row.approach_player === "string" && row.approach_player.trim()
        ? row.approach_player
        : null,
    puttPlayer:
      typeof row.putt_player === "string" && row.putt_player.trim()
        ? row.putt_player
        : null,
    notes: typeof row.notes === "string" && row.notes.trim() ? row.notes : null,
    updatedAt: String(row.updated_at ?? ""),
  };
}

function attachRoundChildren(
  rounds: RoundStatRound[],
  teamRows: Record<string, unknown>[],
  holeRows: Record<string, unknown>[],
  entryRows: Record<string, unknown>[]
) {
  const teamsByRound = new Map<number, RoundStatTeam[]>();
  const holesByRound = new Map<number, RoundStatHole[]>();
  const entriesByRound = new Map<number, RoundStatEntry[]>();

  teamRows.map(mapRowToTeam).forEach((team) => {
    const currentTeams = teamsByRound.get(team.roundId) ?? [];
    currentTeams.push(team);
    teamsByRound.set(team.roundId, currentTeams);
  });

  holeRows.map(mapRowToHole).forEach((hole) => {
    const currentHoles = holesByRound.get(hole.roundId) ?? [];
    currentHoles.push(hole);
    holesByRound.set(hole.roundId, currentHoles);
  });

  entryRows.map(mapRowToEntry).forEach((entry) => {
    const currentEntries = entriesByRound.get(entry.roundId) ?? [];
    currentEntries.push(entry);
    entriesByRound.set(entry.roundId, currentEntries);
  });

  return rounds.map((round) => ({
    ...round,
    teams: [...(teamsByRound.get(round.id) ?? [])].sort(
      (left, right) => left.displayOrder - right.displayOrder
    ),
    holes: [...(holesByRound.get(round.id) ?? [])].sort(
      (left, right) => left.displayOrder - right.displayOrder
    ),
    entries: entriesByRound.get(round.id) ?? [],
  }));
}

async function loadRoundChildren(roundIds: number[]) {
  if (roundIds.length === 0) {
    return {
      teamRows: [] as Record<string, unknown>[],
      holeRows: [] as Record<string, unknown>[],
      entryRows: [] as Record<string, unknown>[],
    };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const [teamsResponse, holesResponse, entriesResponse] = await Promise.all([
    withTimeout(
      supabaseAdmin
        .from("round_stat_teams")
        .select("*")
        .in("round_id", roundIds)
        .order("display_order", { ascending: true }),
      ROUND_STAT_QUERY_TIMEOUT_MS,
      "Round stat teams query"
    ),
    withTimeout(
      supabaseAdmin
        .from("round_stat_holes")
        .select("*")
        .in("round_id", roundIds)
        .order("display_order", { ascending: true }),
      ROUND_STAT_QUERY_TIMEOUT_MS,
      "Round stat holes query"
    ),
    withTimeout(
      supabaseAdmin
        .from("round_stat_entries")
        .select("*")
        .in("round_id", roundIds)
        .order("updated_at", { ascending: false }),
      ROUND_STAT_QUERY_TIMEOUT_MS,
      "Round stat entries query"
    ),
  ]);

  const firstError =
    teamsResponse.error ?? holesResponse.error ?? entriesResponse.error;

  if (firstError) {
    throw firstError;
  }

  return {
    teamRows: (teamsResponse.data ?? []) as Record<string, unknown>[],
    holeRows: (holesResponse.data ?? []) as Record<string, unknown>[],
    entryRows: (entriesResponse.data ?? []) as Record<string, unknown>[],
  };
}

export function getRoundStatsSnapshot(round: RoundStatRound): RoundStatsSnapshot {
  const entriesByTeam = new Map<number, RoundStatEntry[]>();
  const holesById = new Map(round.holes.map((hole) => [hole.id, hole]));

  round.entries.forEach((entry) => {
    const currentEntries = entriesByTeam.get(entry.teamId) ?? [];
    currentEntries.push(entry);
    entriesByTeam.set(entry.teamId, currentEntries);
  });

  const playerContributionMap = new Map<string, PlayerContribution>();

  const leaderboard = round.teams.map((team) => {
    const teamEntries = [...(entriesByTeam.get(team.id) ?? [])].sort((left, right) => {
      const leftHole = holesById.get(left.holeId);
      const rightHole = holesById.get(right.holeId);
      return (leftHole?.displayOrder ?? 99) - (rightHole?.displayOrder ?? 99);
    });
    const completeEntries = teamEntries.filter((entry) => entry.scoreToPar !== null);
    const scoreToPar =
      completeEntries.length > 0
        ? completeEntries.reduce((total, entry) => total + (entry.scoreToPar ?? 0), 0)
        : null;
    const fairwayEntries = completeEntries.filter(
      (entry) => entry.fairwayHit !== null
    );
    const girEntries = completeEntries.filter(
      (entry) => entry.greenInRegulation !== null
    );
    const puttEntries = completeEntries.filter((entry) => entry.putts !== null);
    const currentHole = completeEntries.at(-1);
    const currentHoleLabel = currentHole
      ? (holesById.get(currentHole.holeId)?.holeLabel ?? "In play")
      : "Not started";

    const ensurePlayerContribution = (playerName: string) => {
      const key = `${team.id}:${playerName}`;
      const currentContribution = playerContributionMap.get(key);

      if (currentContribution) {
        return currentContribution;
      }

      const nextContribution = {
        teamId: team.id,
        teamName: team.name,
        playerName,
        driveUses: 0,
        approachUses: 0,
        puttUses: 0,
        totalUses: 0,
      };

      playerContributionMap.set(key, nextContribution);
      return nextContribution;
    };

    team.players.forEach(ensurePlayerContribution);

    completeEntries.forEach((entry) => {
      if (entry.drivePlayer) {
        const contribution = ensurePlayerContribution(entry.drivePlayer);
        contribution.driveUses += 1;
        contribution.totalUses += 1;
      }

      if (entry.approachPlayer) {
        const contribution = ensurePlayerContribution(entry.approachPlayer);
        contribution.approachUses += 1;
        contribution.totalUses += 1;
      }

      if (entry.puttPlayer) {
        const contribution = ensurePlayerContribution(entry.puttPlayer);
        contribution.puttUses += 1;
        contribution.totalUses += 1;
      }
    });

    const teamContributions = [...playerContributionMap.values()].filter(
      (contribution) => contribution.teamId === team.id
    );
    const contributionLeader =
      teamContributions.sort((left, right) => {
        if (left.totalUses !== right.totalUses) {
          return right.totalUses - left.totalUses;
        }

        return left.playerName.localeCompare(right.playerName, "en-AU");
      })[0] ?? null;
    const totalPutts = puttEntries.reduce(
      (total, entry) => total + (entry.putts ?? 0),
      0
    );

    return {
      team,
      entries: teamEntries,
      holesComplete: completeEntries.length,
      currentHoleLabel,
      scoreToPar,
      scoreLabel: formatScoreToPar(scoreToPar),
      birdies: completeEntries.filter((entry) => entry.scoreToPar === -1).length,
      eaglesOrBetter: completeEntries.filter(
        (entry) => entry.scoreToPar !== null && entry.scoreToPar <= -2
      ).length,
      pars: completeEntries.filter((entry) => entry.scoreToPar === 0).length,
      bogeysOrWorse: completeEntries.filter(
        (entry) => entry.scoreToPar !== null && entry.scoreToPar > 0
      ).length,
      fairwaysHit: fairwayEntries.filter((entry) => entry.fairwayHit).length,
      fairwayOpportunities: fairwayEntries.length,
      fairwayRate:
        fairwayEntries.length > 0
          ? fairwayEntries.filter((entry) => entry.fairwayHit).length /
            fairwayEntries.length
          : null,
      greensInRegulation: girEntries.filter((entry) => entry.greenInRegulation)
        .length,
      girOpportunities: girEntries.length,
      girRate:
        girEntries.length > 0
          ? girEntries.filter((entry) => entry.greenInRegulation).length /
            girEntries.length
          : null,
      totalPutts,
      puttEntries: puttEntries.length,
      averagePutts:
        puttEntries.length > 0 ? totalPutts / puttEntries.length : null,
      penalties: completeEntries.reduce(
        (total, entry) => total + entry.penalties,
        0
      ),
      contributionLeader,
    };
  });

  leaderboard.sort((left, right) => {
    if (left.scoreToPar === null && right.scoreToPar !== null) {
      return 1;
    }

    if (left.scoreToPar !== null && right.scoreToPar === null) {
      return -1;
    }

    if (
      left.scoreToPar !== null &&
      right.scoreToPar !== null &&
      left.scoreToPar !== right.scoreToPar
    ) {
      return left.scoreToPar - right.scoreToPar;
    }

    if (left.holesComplete !== right.holesComplete) {
      return right.holesComplete - left.holesComplete;
    }

    return left.team.displayOrder - right.team.displayOrder;
  });

  const completeEntries = round.entries.filter((entry) => entry.scoreToPar !== null)
    .length;

  return {
    round,
    leaderboard,
    playerContributions: [...playerContributionMap.values()].sort((left, right) => {
      if (left.totalUses !== right.totalUses) {
        return right.totalUses - left.totalUses;
      }

      return left.playerName.localeCompare(right.playerName, "en-AU");
    }),
    totalTeams: round.teams.length,
    totalHoles: round.holes.length,
    completeEntries,
    totalEntriesPossible: round.teams.length * round.holes.length,
    completionRate:
      round.teams.length * round.holes.length > 0
        ? completeEntries / (round.teams.length * round.holes.length)
        : 0,
  };
}

export async function getPublishedRoundStatRounds(
  limit = 12
): Promise<RoundStatFeed> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await withTimeout(
      supabaseAdmin
        .from("round_stat_rounds")
        .select("*")
        .eq("is_published", true)
        .order("is_live", { ascending: false })
        .order("starts_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(limit),
      ROUND_STAT_QUERY_TIMEOUT_MS,
      "Published round stat rounds query"
    );

    if (error) {
      if (isMissingRoundStatTableError(error)) {
        return {
          rounds: [createFallbackRound()],
          source: "fallback",
          warningMessage: missingTableMessage,
        };
      }

      throw error;
    }

    const rounds = (data ?? []).map((row) =>
      mapRowToRound(row as Record<string, unknown>)
    );
    const { teamRows, holeRows, entryRows } = await loadRoundChildren(
      rounds.map((round) => round.id)
    );

    return {
      rounds: attachRoundChildren(rounds, teamRows, holeRows, entryRows),
      source: "database",
      warningMessage: null,
    };
  } catch (error) {
    console.error("Published round stat rounds query error:", error);

    return {
      rounds: [createFallbackRound()],
      source: "fallback",
      warningMessage:
        "Round stat tracking could not be loaded right now, so this page is showing the prototype sample.",
    };
  }
}

export async function getPublishedRoundStatRoundBySlug(slug: string) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await withTimeout(
      supabaseAdmin
        .from("round_stat_rounds")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle(),
      ROUND_STAT_QUERY_TIMEOUT_MS,
      "Published round stat round by slug query"
    );

    if (error) {
      if (isMissingRoundStatTableError(error)) {
        return slug === "cabot-cliff-back-12-ambrose" ? createFallbackRound() : null;
      }

      throw error;
    }

    if (!data) {
      return slug === "cabot-cliff-back-12-ambrose" ? createFallbackRound() : null;
    }

    const round = mapRowToRound(data as Record<string, unknown>);
    const { teamRows, holeRows, entryRows } = await loadRoundChildren([round.id]);
    const [mappedRound] = attachRoundChildren([round], teamRows, holeRows, entryRows);

    return mappedRound;
  } catch (error) {
    console.error("Published round stat round by slug query error:", error);
    return slug === "cabot-cliff-back-12-ambrose" ? createFallbackRound() : null;
  }
}

export async function getAdminRoundStatRounds(
  limit = 20
): Promise<RoundStatFeed> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await withTimeout(
      supabaseAdmin
        .from("round_stat_rounds")
        .select("*")
        .order("is_live", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(limit),
      ROUND_STAT_QUERY_TIMEOUT_MS,
      "Admin round stat rounds query"
    );

    if (error) {
      if (isMissingRoundStatTableError(error)) {
        return {
          rounds: [createFallbackRound()],
          source: "fallback",
          warningMessage: missingTableMessage,
        };
      }

      throw error;
    }

    const rounds = (data ?? []).map((row) =>
      mapRowToRound(row as Record<string, unknown>)
    );
    const { teamRows, holeRows, entryRows } = await loadRoundChildren(
      rounds.map((round) => round.id)
    );

    return {
      rounds: attachRoundChildren(rounds, teamRows, holeRows, entryRows),
      source: "database",
      warningMessage: null,
    };
  } catch (error) {
    console.error("Admin round stat rounds query error:", error);

    return {
      rounds: [createFallbackRound()],
      source: "fallback",
      warningMessage:
        "Round stat tracking could not be loaded right now. Check the migration before entering live data.",
    };
  }
}

export async function updateRoundStatEntry(input: RoundStatEntryInput) {
  const supabaseAdmin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const normalizedPenalties = Math.max(Math.trunc(input.penalties), 0);

  const { error } = await supabaseAdmin.from("round_stat_entries").upsert(
    {
      round_id: input.roundId,
      team_id: input.teamId,
      hole_id: input.holeId,
      score_to_par: input.scoreToPar,
      putts: input.putts,
      fairway_hit: input.fairwayHit,
      green_in_regulation: input.greenInRegulation,
      penalties: normalizedPenalties,
      drive_player: input.drivePlayer || null,
      approach_player: input.approachPlayer || null,
      putt_player: input.puttPlayer || null,
      notes: input.notes || null,
      updated_at: now,
    },
    {
      onConflict: "team_id,hole_id",
    }
  );

  if (error) {
    throw error;
  }

  await touchRoundStatRound(input.roundId);
}

async function touchRoundStatRound(roundId: number) {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("round_stat_rounds")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", roundId);

  if (error) {
    throw error;
  }
}

function createFallbackRound(): RoundStatRound {
  const updatedAt = new Date().toISOString();
  const roundId = 1;
  const teams: RoundStatTeam[] = [
    {
      id: 1,
      roundId,
      displayOrder: 1,
      name: "Ball Fondlers",
      shortName: "BF",
      accentColor: "#b9f24b",
      players: ["Royce", "Jaye", "Crosso"],
      updatedAt,
    },
    {
      id: 2,
      roundId,
      displayOrder: 2,
      name: "Better Than Most",
      shortName: "BTM",
      accentColor: "#62d7ff",
      players: ["Hitman", "Dylan", "Tyrese"],
      updatedAt,
    },
    {
      id: 3,
      roundId,
      displayOrder: 3,
      name: "Home in a Bunker",
      shortName: "HIB",
      accentColor: "#ffbe18",
      players: ["Ben", "Matt", "Travis"],
      updatedAt,
    },
    {
      id: 4,
      roundId,
      displayOrder: 4,
      name: "Pin Seekers",
      shortName: "PS",
      accentColor: "#ff9148",
      players: ["Daniel", "Jarred", "Justin"],
      updatedAt,
    },
    {
      id: 5,
      roundId,
      displayOrder: 5,
      name: "Rough Riders",
      shortName: "RR",
      accentColor: "#d39a6c",
      players: ["Troy", "Andrew", "Matt C"],
      updatedAt,
    },
    {
      id: 6,
      roundId,
      displayOrder: 6,
      name: "Mulligan Menace",
      shortName: "MM",
      accentColor: "#00a7c4",
      players: ["Player A", "Player B", "Player C"],
      updatedAt,
    },
  ];
  const holes: RoundStatHole[] = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    roundId,
    displayOrder: index + 1,
    holeNumber: index + 7,
    holeLabel: `Hole ${index + 7}`,
    parLabel: "Par TBD",
    updatedAt,
  }));
  const entries: RoundStatEntry[] = [
    createFallbackEntry(1, roundId, 1, 1, -1, 1, true, true, 0, "Royce", "Jaye", "Crosso", updatedAt),
    createFallbackEntry(2, roundId, 1, 2, 0, 2, true, false, 0, "Jaye", "Royce", "Royce", updatedAt),
    createFallbackEntry(3, roundId, 2, 1, 0, 2, false, true, 0, "Dylan", "Hitman", "Tyrese", updatedAt),
    createFallbackEntry(4, roundId, 2, 2, -1, 1, true, true, 0, "Tyrese", "Dylan", "Hitman", updatedAt),
    createFallbackEntry(5, roundId, 3, 1, 1, 2, false, false, 1, "Ben", "Travis", "Matt", updatedAt),
    createFallbackEntry(6, roundId, 3, 2, 0, 2, true, true, 0, "Matt", "Ben", "Travis", updatedAt),
    createFallbackEntry(7, roundId, 4, 1, -2, 1, true, true, 0, "Daniel", "Jarred", "Justin", updatedAt),
    createFallbackEntry(8, roundId, 4, 2, 1, 2, false, false, 0, "Justin", "Daniel", "Jarred", updatedAt),
    createFallbackEntry(9, roundId, 5, 1, 0, 2, true, false, 0, "Troy", "Matt C", "Andrew", updatedAt),
    createFallbackEntry(10, roundId, 5, 2, 0, 1, true, true, 0, "Andrew", "Troy", "Matt C", updatedAt),
    createFallbackEntry(11, roundId, 6, 1, 1, 3, false, false, 1, "Player A", "Player C", "Player B", updatedAt),
    createFallbackEntry(12, roundId, 6, 2, -1, 1, true, true, 0, "Player B", "Player A", "Player C", updatedAt),
  ];

  return {
    id: roundId,
    slug: "cabot-cliff-back-12-ambrose",
    title: "Cabot Cliff Back 12 Ambrose",
    summary:
      "Prototype stat-tracked CGS round for the upcoming back-12 Ambrose night.",
    courseName: "Cabot Cliff",
    formatLabel: "Team Ambrose",
    holesLabel: "Back 12 holes",
    statusLabel: "Stats prototype",
    startsAt: null,
    isLive: true,
    isPublished: true,
    updatedAt,
    createdAt: updatedAt,
    teams,
    holes,
    entries,
  };
}

function createFallbackEntry(
  id: number,
  roundId: number,
  teamId: number,
  holeId: number,
  scoreToPar: number,
  putts: number,
  fairwayHit: boolean,
  greenInRegulation: boolean,
  penalties: number,
  drivePlayer: string,
  approachPlayer: string,
  puttPlayer: string,
  updatedAt: string
): RoundStatEntry {
  return {
    id,
    roundId,
    teamId,
    holeId,
    scoreToPar,
    scoreLabel: formatScoreToPar(scoreToPar),
    putts,
    fairwayHit,
    greenInRegulation,
    penalties,
    drivePlayer,
    approachPlayer,
    puttPlayer,
    notes: null,
    updatedAt,
  };
}
