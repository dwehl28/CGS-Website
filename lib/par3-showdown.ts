import "server-only";

import { BracketsManager, type Database } from "brackets-manager";
import { InMemoryDatabase } from "brackets-memory-db";

import {
  PAR3_EVENT_SLUG,
  PAR3_MATCH_RUNNING,
  PAR3_ROUND_OF_16_TEMPLATE,
  buildPar3Pools,
  getPar3CtpContestants,
  resolvePar3BracketSlot,
  type AdminPar3Snapshot,
  type Par3Event,
  type Par3Phase,
  type Par3Player,
  type Par3PoolMatch,
  type Par3Snapshot,
  type Par3TeeCategory,
} from "@/lib/par3-showdown-types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type EventRow = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  starts_at: string;
  warmup_at: string;
  venue_name: string;
  venue_address: string;
  registration_url: string;
  youtube_url: string;
  status_label: string;
  public_message: string;
  current_phase: Par3Phase;
  max_players: number;
  pool_count: number;
  pool_size: number;
  is_published: boolean;
  is_live: boolean;
  registrations_open: boolean;
  knockout_data: Database | null;
  knockout_generated_at: string | null;
  updated_at: string;
  created_at: string;
};

type PlayerRow = {
  id: number;
  event_id: number;
  display_order: number;
  name: string;
  tee_category: Par3TeeCategory;
  pool_number: number | null;
  pool_rank_override: number | null;
  ctp_rank: number | null;
  is_withdrawn: boolean;
  updated_at: string;
  created_at: string;
};

type PrivatePlayerRow = {
  player_id: number;
  phone: string;
  consent: boolean;
};

type PoolMatchRow = {
  id: number;
  event_id: number;
  pool_number: number;
  match_number: number;
  player1_id: number;
  player2_id: number;
  winner_id: number | null;
  status: "scheduled" | "live" | "complete";
  bay_number: number | null;
  updated_at: string;
  created_at: string;
};

export type Par3EventSettingsInput = {
  statusLabel: string;
  publicMessage: string;
  currentPhase: Par3Phase;
  youtubeUrl: string;
  isLive: boolean;
  registrationsOpen: boolean;
};

export type Par3PlayerInput = {
  eventId: number;
  name: string;
  phone: string;
  teeCategory: Par3TeeCategory;
  poolNumber: number | null;
  poolRankOverride: number | null;
  displayOrder: number;
  consent: boolean;
  isWithdrawn: boolean;
};

const fallbackEvent: Par3Event = {
  id: 0,
  slug: PAR3_EVENT_SLUG,
  title: "CGS Par 3 Championship",
  summary:
    "A 20-player match-play championship with five pools, a closest-to-pin playoff, and a single-elimination Round of 16.",
  startsAt: "2026-09-12T08:00:00.000Z",
  warmupAt: "2026-09-12T07:30:00.000Z",
  venueName: "The Tee Lounge",
  venueAddress: "2892-2896 Logan Rd, Underwood QLD 4119",
  registrationUrl: "https://crossodoggolfs-shop.bigcartel.com",
  youtubeUrl: "https://www.youtube.com/@CrossodogGolfSociety",
  statusLabel: "Pool draw locked",
  publicMessage:
    "The draw is locked. Follow fixtures, tables, results, the CTP playoff, and every finals matchup live.",
  currentPhase: "pools",
  maxPlayers: 20,
  poolCount: 5,
  poolSize: 4,
  isPublished: true,
  isLive: false,
  registrationsOpen: false,
  knockoutData: null,
  knockoutGeneratedAt: null,
  updatedAt: "",
  createdAt: "",
};

const fallbackPoolNames = [
  ["Wade", "Dan", "Blake", "Ryobi"],
  ["Jayden", "Crossdog", "Wombat", "Ben D"],
  ["Jarrad", "Ricky", "Butters", "Penguin"],
  ["Macka", "Harry", "Caity", "Chipper"],
  ["Hitman", "Dylan", "Ben W", "Mystery Player"],
];

const fallbackPlayers: Par3Player[] = fallbackPoolNames.flatMap(
  (names, poolIndex) =>
    names.map((name, playerIndex) => {
      const id = poolIndex * 4 + playerIndex + 1;

      return {
        id,
        eventId: 0,
        displayOrder: id,
        name,
        teeCategory: "championship",
        poolNumber: poolIndex + 1,
        poolRankOverride: null,
        ctpRank: null,
        isWithdrawn: false,
        updatedAt: "",
        createdAt: "",
      };
    })
);

const fixtureSeedPairs = [
  [0, 3],
  [1, 2],
  [0, 2],
  [3, 1],
  [0, 1],
  [2, 3],
] as const;

const fallbackPoolMatches: Par3PoolMatch[] = fallbackPoolNames.flatMap(
  (_, poolIndex) => {
    const poolPlayers = fallbackPlayers.filter(
      (player) => player.poolNumber === poolIndex + 1
    );

    return fixtureSeedPairs.map(([firstIndex, secondIndex], matchIndex) => {
      const ids = [poolPlayers[firstIndex].id, poolPlayers[secondIndex].id].sort(
        (left, right) => left - right
      );

      return {
        id: poolIndex * 6 + matchIndex + 1,
        eventId: 0,
        poolNumber: poolIndex + 1,
        matchNumber: matchIndex + 1,
        player1Id: ids[0],
        player2Id: ids[1],
        winnerId: null,
        status: "scheduled",
        bayNumber: null,
        updatedAt: "",
        createdAt: "",
      };
    });
  }
);

function mapEvent(row: EventRow): Par3Event {
  return {
    id: Number(row.id),
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    startsAt: row.starts_at,
    warmupAt: row.warmup_at,
    venueName: row.venue_name,
    venueAddress: row.venue_address,
    registrationUrl: row.registration_url,
    youtubeUrl: row.youtube_url,
    statusLabel: row.status_label,
    publicMessage: row.public_message,
    currentPhase: row.current_phase,
    maxPlayers: Number(row.max_players),
    poolCount: Number(row.pool_count),
    poolSize: Number(row.pool_size),
    isPublished: Boolean(row.is_published),
    isLive: Boolean(row.is_live),
    registrationsOpen: Boolean(row.registrations_open),
    knockoutData: row.knockout_data,
    knockoutGeneratedAt: row.knockout_generated_at,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

function mapPlayer(row: PlayerRow): Par3Player {
  return {
    id: Number(row.id),
    eventId: Number(row.event_id),
    displayOrder: Number(row.display_order),
    name: row.name,
    teeCategory: row.tee_category,
    poolNumber: row.pool_number === null ? null : Number(row.pool_number),
    poolRankOverride:
      row.pool_rank_override === null ? null : Number(row.pool_rank_override),
    ctpRank: row.ctp_rank === null ? null : Number(row.ctp_rank),
    isWithdrawn: Boolean(row.is_withdrawn),
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

function mapPoolMatch(row: PoolMatchRow): Par3PoolMatch {
  return {
    id: Number(row.id),
    eventId: Number(row.event_id),
    poolNumber: Number(row.pool_number),
    matchNumber: Number(row.match_number),
    player1Id: Number(row.player1_id),
    player2Id: Number(row.player2_id),
    winnerId: row.winner_id === null ? null : Number(row.winner_id),
    status: row.status,
    bayNumber: row.bay_number === null ? null : Number(row.bay_number),
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

function isMissingPar3TableError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  return error.code === "42P01" || error.code === "PGRST205";
}

async function loadSnapshot(includePrivate: boolean) {
  const supabase = getSupabaseAdmin();
  const { data: eventData, error: eventError } = await supabase
    .from("cgs_par3_events")
    .select("*")
    .eq("slug", PAR3_EVENT_SLUG)
    .maybeSingle();

  if (eventError) {
    throw eventError;
  }

  if (!eventData) {
    return null;
  }

  const event = mapEvent(eventData as EventRow);
  const [{ data: playerData, error: playerError }, { data: matchData, error: matchError }] =
    await Promise.all([
      supabase
        .from("cgs_par3_players")
        .select("*")
        .eq("event_id", event.id)
        .order("display_order", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("cgs_par3_pool_matches")
        .select("*")
        .eq("event_id", event.id)
        .order("pool_number", { ascending: true })
        .order("match_number", { ascending: true }),
    ]);

  if (playerError) {
    throw playerError;
  }

  if (matchError) {
    throw matchError;
  }

  const players = ((playerData ?? []) as PlayerRow[]).map(mapPlayer);
  const poolMatches = ((matchData ?? []) as PoolMatchRow[]).map(mapPoolMatch);

  if (!includePrivate) {
    return {
      event,
      players,
      poolMatches,
      source: "database",
      warningMessage: null,
    } satisfies Par3Snapshot;
  }

  const { data: privateData, error: privateError } = await supabase
    .from("cgs_par3_player_private")
    .select("player_id, phone, consent")
    .in("player_id", players.map((player) => player.id).length > 0 ? players.map((player) => player.id) : [-1]);

  if (privateError) {
    throw privateError;
  }

  const privateByPlayerId = new Map(
    ((privateData ?? []) as PrivatePlayerRow[]).map((record) => [
      Number(record.player_id),
      record,
    ])
  );

  return {
    event,
    players: players.map((player) => {
      const privateRecord = privateByPlayerId.get(player.id);

      return {
        ...player,
        phone: privateRecord?.phone ?? "",
        consent: privateRecord?.consent ?? false,
      };
    }),
    poolMatches,
    source: "database",
    warningMessage: null,
  } satisfies AdminPar3Snapshot;
}

export async function getPublicPar3Snapshot(): Promise<Par3Snapshot> {
  try {
    const snapshot = await loadSnapshot(false);

    if (snapshot) {
      return snapshot as Par3Snapshot;
    }
  } catch (error) {
    if (!isMissingPar3TableError(error)) {
      console.error("Load public Par 3 snapshot error:", error);
    }
  }

  return {
    event: fallbackEvent,
    players: fallbackPlayers,
    poolMatches: fallbackPoolMatches,
    source: "fallback",
    warningMessage: "Live tournament data is being prepared.",
  };
}

export async function getAdminPar3Snapshot(): Promise<AdminPar3Snapshot> {
  const snapshot = await loadSnapshot(true);

  if (!snapshot) {
    throw new Error("Par 3 event not found.");
  }

  return snapshot as AdminPar3Snapshot;
}

export async function updatePar3EventSettings(
  eventId: number,
  input: Par3EventSettingsInput
) {
  const { error } = await getSupabaseAdmin()
    .from("cgs_par3_events")
    .update({
      status_label: input.statusLabel,
      public_message: input.publicMessage,
      current_phase: input.currentPhase,
      youtube_url: input.youtubeUrl,
      is_live: input.isLive,
      registrations_open: input.registrationsOpen,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (error) {
    throw error;
  }
}

export async function createPar3Player(input: Par3PlayerInput) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("cgs_par3_players")
    .insert({
      event_id: input.eventId,
      display_order: input.displayOrder,
      name: input.name,
      tee_category: input.teeCategory,
      pool_number: input.poolNumber,
      pool_rank_override: input.poolRankOverride,
      is_withdrawn: input.isWithdrawn,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  const playerId = Number(data.id);
  const { error: privateError } = await supabase
    .from("cgs_par3_player_private")
    .insert({
      player_id: playerId,
      phone: input.phone,
      consent: input.consent,
      updated_at: new Date().toISOString(),
    });

  if (privateError) {
    await supabase.from("cgs_par3_players").delete().eq("id", playerId);
    throw privateError;
  }

  return playerId;
}

export async function updatePar3Player(
  playerId: number,
  input: Par3PlayerInput
) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const [{ error: playerError }, { error: privateError }] = await Promise.all([
    supabase
      .from("cgs_par3_players")
      .update({
        display_order: input.displayOrder,
        name: input.name,
        tee_category: input.teeCategory,
        pool_number: input.poolNumber,
        pool_rank_override: input.poolRankOverride,
        is_withdrawn: input.isWithdrawn,
        updated_at: now,
      })
      .eq("id", playerId)
      .eq("event_id", input.eventId),
    supabase.from("cgs_par3_player_private").upsert({
      player_id: playerId,
      phone: input.phone,
      consent: input.consent,
      updated_at: now,
    }),
  ]);

  if (playerError) {
    throw playerError;
  }

  if (privateError) {
    throw privateError;
  }
}

export async function generatePar3PoolFixtures(eventId: number) {
  const snapshot = await getAdminPar3Snapshot();

  if (snapshot.event.id !== eventId) {
    throw new Error("Par 3 event not found.");
  }

  if (snapshot.poolMatches.some((match) => match.winnerId !== null)) {
    throw new Error("Pool fixtures cannot be rebuilt after results are recorded.");
  }

  const rows: Array<{
    event_id: number;
    pool_number: number;
    match_number: number;
    player1_id: number;
    player2_id: number;
    status: "scheduled";
  }> = [];

  for (let poolNumber = 1; poolNumber <= snapshot.event.poolCount; poolNumber += 1) {
    const players = snapshot.players
      .filter(
        (player) => player.poolNumber === poolNumber && !player.isWithdrawn
      )
      .sort((left, right) => left.displayOrder - right.displayOrder);

    if (players.length !== snapshot.event.poolSize) {
      throw new Error(
        `Pool ${poolNumber} requires exactly ${snapshot.event.poolSize} active players.`
      );
    }

    for (const [matchIndex, [firstIndex, secondIndex]] of fixtureSeedPairs.entries()) {
      const ids = [players[firstIndex].id, players[secondIndex].id].sort(
        (left, right) => left - right
      );
      rows.push({
        event_id: eventId,
        pool_number: poolNumber,
        match_number: matchIndex + 1,
        player1_id: ids[0],
        player2_id: ids[1],
        status: "scheduled",
      });
    }
  }

  const supabase = getSupabaseAdmin();
  const { error: deleteError } = await supabase
    .from("cgs_par3_pool_matches")
    .delete()
    .eq("event_id", eventId);

  if (deleteError) {
    throw deleteError;
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("cgs_par3_pool_matches")
      .insert(rows);

    if (insertError) {
      throw insertError;
    }
  }
}

export async function updatePar3CtpWinner(
  eventId: number,
  playerId: number | null
) {
  const snapshot = await getAdminPar3Snapshot();

  if (snapshot.event.id !== eventId) {
    throw new Error("Par 3 event not found.");
  }

  if (playerId !== null) {
    const pools = buildPar3Pools(snapshot);
    const poolsLocked = pools.every(
      (pool) =>
        pool.matches.filter((match) => match.winnerId !== null).length === 6 ||
        pool.standings.every(
          (standing) => standing.player.poolRankOverride !== null
        )
    );

    if (!poolsLocked) {
      throw new Error("Complete or manually seed every pool before the CTP playoff.");
    }

    const eligibleIds = new Set(
      getPar3CtpContestants(snapshot).map((standing) => standing.player.id)
    );

    if (!eligibleIds.has(playerId)) {
      throw new Error("The CTP winner must be a fourth-place pool finisher.");
    }
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error: clearError } = await supabase
    .from("cgs_par3_players")
    .update({ ctp_rank: null, updated_at: now })
    .eq("event_id", eventId);

  if (clearError) {
    throw clearError;
  }

  if (playerId !== null) {
    const { error: winnerError } = await supabase
      .from("cgs_par3_players")
      .update({ ctp_rank: 1, updated_at: now })
      .eq("event_id", eventId)
      .eq("id", playerId);

    if (winnerError) {
      throw winnerError;
    }
  }
}

export async function updatePar3PoolMatch(
  matchId: number,
  winnerId: number | null,
  bayNumber: number | null
) {
  const { data: match, error: matchError } = await getSupabaseAdmin()
    .from("cgs_par3_pool_matches")
    .select("player1_id, player2_id")
    .eq("id", matchId)
    .single();

  if (matchError) {
    throw matchError;
  }

  if (
    winnerId !== null &&
    winnerId !== Number(match.player1_id) &&
    winnerId !== Number(match.player2_id)
  ) {
    throw new Error("Winner must be one of the players in the match.");
  }

  const { error } = await getSupabaseAdmin()
    .from("cgs_par3_pool_matches")
    .update({
      winner_id: winnerId,
      bay_number: bayNumber,
      status: winnerId === null ? (bayNumber === null ? "scheduled" : "live") : "complete",
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (error) {
    throw error;
  }
}

function getRequiredPoolQualifier(
  pools: ReturnType<typeof buildPar3Pools>,
  poolNumber: number,
  position: number
) {
  const standing = pools.find((pool) => pool.number === poolNumber)?.standings.find(
    (candidate) => candidate.position === position
  );

  if (!standing) {
    throw new Error(`Pool ${poolNumber} seed ${position} is not available.`);
  }

  return standing.player;
}

export async function generatePar3Knockout(eventId: number) {
  const snapshot = await getAdminPar3Snapshot();

  if (snapshot.event.id !== eventId) {
    throw new Error("Par 3 event not found.");
  }

  const pools = buildPar3Pools(snapshot);
  if (snapshot.event.poolCount !== 5) {
    throw new Error("The championship requires five completed pools.");
  }

  for (const pool of pools) {
    const completed = pool.matches.filter((match) => match.winnerId !== null).length;
    const manuallyRanked = pool.standings.every(
      (standing) => standing.player.poolRankOverride !== null
    );

    if (completed !== 6 && !manuallyRanked) {
      throw new Error(`${pool.label} must be complete or manually seeded.`);
    }

    getRequiredPoolQualifier(pools, pool.number, 3);
  }

  const roundOf16Slots = PAR3_ROUND_OF_16_TEMPLATE.flatMap((pairing) => [
    resolvePar3BracketSlot(snapshot, pairing.first),
    resolvePar3BracketSlot(snapshot, pairing.second),
  ]);

  if (roundOf16Slots.some((player) => !player)) {
    throw new Error("Select the CTP winner before generating the Round of 16.");
  }
  const storage = new InMemoryDatabase();
  const manager = new BracketsManager(storage);

  await manager.create.stage({
    tournamentId: 0,
    name: "CGS Par 3 Championship Finals",
    type: "single_elimination",
    seeding: roundOf16Slots.map((player) => player!.name),
    settings: {
      size: 16,
      seedOrdering: ["natural"],
    },
  });

  const knockoutData = await manager.get.tournamentData(0);
  const { error } = await getSupabaseAdmin()
    .from("cgs_par3_events")
    .update({
      knockout_data: knockoutData,
      knockout_generated_at: new Date().toISOString(),
      current_phase: "knockout",
      status_label: "Round of 16",
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (error) {
    throw error;
  }
}

async function loadKnockoutManager(eventId: number) {
  const { data, error } = await getSupabaseAdmin()
    .from("cgs_par3_events")
    .select("knockout_data")
    .eq("id", eventId)
    .single();

  if (error) {
    throw error;
  }

  if (!data.knockout_data) {
    throw new Error("The Round of 16 has not been generated.");
  }

  const storage = new InMemoryDatabase();
  await storage.setData(structuredClone(data.knockout_data) as Database);

  return new BracketsManager(storage);
}

async function saveKnockoutData(eventId: number, manager: BracketsManager) {
  const knockoutData = await manager.get.tournamentData(0);
  const { error } = await getSupabaseAdmin()
    .from("cgs_par3_events")
    .update({
      knockout_data: knockoutData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (error) {
    throw error;
  }
}

export async function startPar3KnockoutMatch(
  eventId: number,
  matchId: number
) {
  const manager = await loadKnockoutManager(eventId);

  await manager.update.match({
    id: matchId,
    status: PAR3_MATCH_RUNNING,
  });

  await saveKnockoutData(eventId, manager);
}

export async function recordPar3KnockoutWinner(
  eventId: number,
  matchId: number,
  winnerSide: 1 | 2
) {
  const manager = await loadKnockoutManager(eventId);

  await manager.update.match({
    id: matchId,
    opponent1: { result: winnerSide === 1 ? "win" : "loss" },
    opponent2: { result: winnerSide === 2 ? "win" : "loss" },
  });

  await saveKnockoutData(eventId, manager);
}

export async function resetPar3KnockoutMatch(
  eventId: number,
  matchId: number
) {
  const manager = await loadKnockoutManager(eventId);
  await manager.reset.matchResults(matchId);
  await saveKnockoutData(eventId, manager);
}
