import "server-only";

import { randomInt } from "node:crypto";

import { BracketsManager, type Database } from "brackets-manager";
import { InMemoryDatabase } from "brackets-memory-db";

import {
  PAR3_EVENT_SLUG,
  PAR3_MATCH_RUNNING,
  buildPar3Pools,
  getPar3CtpContestants,
  getPar3CtpQualifiers,
  getPar3FinalsSize,
  getPar3FinalsTemplate,
  getPar3PoolCapacity,
  getPar3PoolFixturePairs,
  getPar3PoolSizes,
  getPar3QualificationPlan,
  isPar3PoolComplete,
  resolvePar3BracketSlot,
  validatePar3TournamentFormat,
  type AdminPar3Snapshot,
  type Par3Event,
  type Par3FinalsFormat,
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
  pool_sizes?: number[] | null;
  finals_size?: number;
  finals_format?: Par3FinalsFormat;
  is_published: boolean;
  is_live: boolean;
  registrations_open: boolean;
  entry_fee_cents?: number;
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
  ctp_distance_cm?: number | null;
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

export type Par3RegistrationInput = {
  name: string;
  phone: string;
  teeCategory: Par3TeeCategory;
  consent: boolean;
};

const fallbackEvent: Par3Event = {
  id: 0,
  slug: PAR3_EVENT_SLUG,
  title: "CGS Par 3 Championship II",
  summary:
    "A 15-player match-play championship with five pools of three. Pool winners contest CTP for one quarter-final bye while the other fourteen players contest seven opening matches.",
  startsAt: "2026-11-07T07:00:00.000Z",
  warmupAt: "2026-11-07T06:30:00.000Z",
  venueName: "The Tee Lounge",
  venueAddress: "2892-2896 Logan Rd, Underwood QLD 4119",
  registrationUrl: "https://crossodoggolf.com/#register",
  youtubeUrl: "https://www.youtube.com/@CrossodogGolfSociety",
  statusLabel: "Registrations open",
  publicMessage:
    "Follow all fifteen players through pool play and the finals. The pool-winners CTP contest awards one quarter-final bye; everyone else plays the opening round.",
  currentPhase: "registrations",
  maxPlayers: 15,
  poolCount: 5,
  poolSize: 3,
  poolSizes: [3, 3, 3, 3, 3],
  finalsSize: 16,
  finalsFormat: "pool_winners_ctp_bye",
  isPublished: true,
  isLive: false,
  registrationsOpen: true,
  entryFeeCents: 3000,
  knockoutData: null,
  knockoutGeneratedAt: null,
  updatedAt: "",
  createdAt: "",
};

const fallbackPlayers: Par3Player[] = [];

const fallbackPoolMatches: Par3PoolMatch[] = [];

function mapEvent(row: EventRow): Par3Event {
  const finalsSize = Number(row.finals_size ?? 16);
  const finalsFormat = row.finals_format ?? "standard";
  const maxPlayers = Number(row.max_players);
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
    statusLabel: finalsFormat === "pool_winners_ctp_bye" && finalsSize === 16 && row.status_label === "Round of 16"
      ? "Opening round"
      : row.status_label,
    publicMessage: /^Secure one of \d+ places, then follow every fixture, simulator call, table, and finals matchup live\.$/.test(row.public_message)
      ? `Secure one of ${maxPlayers} places, then follow every fixture, simulator call, table, and finals matchup live.`
      : row.public_message,
    currentPhase: row.current_phase,
    maxPlayers,
    poolCount: Number(row.pool_count),
    poolSize: Number(row.pool_size),
    poolSizes: Array.isArray(row.pool_sizes) ? row.pool_sizes.map(Number) : undefined,
    finalsSize,
    finalsFormat,
    isPublished: Boolean(row.is_published),
    isLive: Boolean(row.is_live),
    registrationsOpen: Boolean(row.registrations_open),
    entryFeeCents: Number(row.entry_fee_cents ?? 3000),
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
    ctpDistanceCm:
      row.ctp_distance_cm === null || row.ctp_distance_cm === undefined
        ? null
        : Number(row.ctp_distance_cm),
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
  const generatedRegistrationStatus = /^\d+ spots remaining!$/i.test(event.statusLabel)
    || event.statusLabel === "Sold out" || event.statusLabel === "Registrations open";
  if (event.currentPhase === "registrations" && generatedRegistrationStatus) {
    const remainingSpots = Math.max(0, event.maxPlayers - players.filter((player) => !player.isWithdrawn).length);
    event.statusLabel = remainingSpots === 0
      ? "Sold out"
      : event.registrationsOpen
        ? `${remainingSpots} ${remainingSpots === 1 ? "spot" : "spots"} remaining!`
        : "Registrations closed";
  }

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

export async function updatePar3PoolCount(
  eventId: number,
  poolCount: number
) {
  const snapshot = await getAdminPar3Snapshot();
  if (!Number.isInteger(poolCount) || poolCount < 1 || poolCount > 16) {
    throw new Error("Choose between 1 and 16 pools.");
  }
  await updatePar3TournamentFormat(eventId, {
    poolSizes: Array.from({ length: poolCount }, (_, index) =>
      getPar3PoolSizes(snapshot.event)[index] ?? snapshot.event.poolSize),
    finalsSize: getPar3FinalsSize(snapshot.event),
  });
}

export async function updatePar3TournamentFormat(
  eventId: number,
  input: { poolSizes: number[]; finalsSize: number; finalsFormat?: Par3FinalsFormat }
) {
  assertPositiveInteger(eventId, "event");
  let currentFormat = input.finalsFormat;
  if (currentFormat === undefined) {
    const snapshot = await getAdminPar3Snapshot();
    if (snapshot.event.id !== eventId) throw new Error("Par 3 event not found.");
    currentFormat = snapshot.event.finalsFormat ?? "standard";
  }
  const format = validatePar3TournamentFormat({ ...input, finalsFormat: currentFormat });
  const { error } = await getSupabaseAdmin().rpc("cgs_par3_update_format", {
    p_event_id: eventId,
    p_pool_sizes: format.poolSizes,
    p_finals_size: format.finalsSize,
    ...(input.finalsFormat === undefined ? {} : { p_finals_format: input.finalsFormat }),
  });
  throwPar3MutationError(error);
}

function assertPositiveInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Choose a valid ${label}.`);
  }
}

function throwPar3MutationError(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (["PGRST202", "PGRST204", "42703", "42883"].includes(error.code ?? "")) {
    throw new Error("The flexible tournament update needs its database setup before it can be saved.");
  }
  throw new Error(error.message ?? "The tournament update could not be saved.");
}

function assertPar3PoolAssignment(
  snapshot: AdminPar3Snapshot,
  poolNumber: number | null
) {
  if (poolNumber !== null && (!Number.isInteger(poolNumber) || poolNumber < 1 || poolNumber > snapshot.event.poolCount)) {
    throw new Error("Choose an active tournament pool.");
  }
}

function poolHasRecordedResults(snapshot: AdminPar3Snapshot, poolNumber: number) {
  return snapshot.poolMatches.some(
    (match) => match.poolNumber === poolNumber && (match.winnerId !== null || match.status !== "scheduled")
  );
}

function assertPar3PlayerInput(snapshot: AdminPar3Snapshot, input: Par3PlayerInput) {
  assertPositiveInteger(input.eventId, "event");
  assertPositiveInteger(input.displayOrder, "display order");
  assertPar3PoolAssignment(snapshot, input.poolNumber);
  if (input.poolRankOverride !== null && (!Number.isInteger(input.poolRankOverride) || input.poolRankOverride < 1 || input.poolRankOverride > (input.poolNumber === null ? 8 : getPar3PoolCapacity(snapshot.event, input.poolNumber)))) {
    throw new Error("Choose a manual rank within this pool's size.");
  }
}

export async function createPar3Player(input: Par3PlayerInput) {
  const snapshot = await getAdminPar3Snapshot();

  if (snapshot.event.id !== input.eventId) {
    throw new Error("Par 3 event not found.");
  }

  assertPar3PlayerInput(snapshot, input);

  if (!input.isWithdrawn && snapshot.event.knockoutData) {
    throw new Error("Players cannot be added after the finals bracket is generated.");
  }

  const activePlayerCount = snapshot.players.filter(
    (player) => !player.isWithdrawn
  ).length;

  if (!input.isWithdrawn && activePlayerCount >= snapshot.event.maxPlayers) {
    throw new Error("The Championship II field is sold out.");
  }

  if (
    input.poolNumber !== null &&
    !input.isWithdrawn &&
    poolHasRecordedResults(snapshot, input.poolNumber)
  ) {
    throw new Error("Players cannot be added to a pool after a match starts or results are recorded.");
  }

  if (input.poolNumber !== null && !input.isWithdrawn) {
    const activePlayersInPool = snapshot.players.filter(
      (player) => !player.isWithdrawn && player.poolNumber === input.poolNumber
    ).length;

    const capacity = getPar3PoolCapacity(snapshot.event, input.poolNumber);
    if (activePlayersInPool >= capacity) {
      throw new Error(
        `Pool ${input.poolNumber} already has ${capacity} active players.`
      );
    }
  }

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

  if (!input.isWithdrawn && activePlayerCount + 1 >= snapshot.event.maxPlayers) {
    await supabase
      .from("cgs_par3_events")
      .update({
        registrations_open: false,
        status_label: "Sold out",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.eventId);
  }

  return playerId;
}

export async function registerPar3Player(input: Par3RegistrationInput) {
  const snapshot = await getAdminPar3Snapshot();
  const activePlayers = snapshot.players.filter((player) => !player.isWithdrawn);

  if (!snapshot.event.registrationsOpen) {
    throw new Error("Registrations are currently closed.");
  }

  if (activePlayers.length >= snapshot.event.maxPlayers) {
    throw new Error("The Championship II field is sold out.");
  }

  const normalizedName = input.name.trim().toLocaleLowerCase();
  const normalizedPhone = input.phone.replace(/\D/g, "");
  const duplicate = snapshot.players.some(
    (player) =>
      !player.isWithdrawn &&
      (player.name.trim().toLocaleLowerCase() === normalizedName ||
        (normalizedPhone.length >= 8 &&
          player.phone.replace(/\D/g, "") === normalizedPhone))
  );

  if (duplicate) {
    throw new Error("That registration is already in the Championship II field.");
  }

  await createPar3Player({
    eventId: snapshot.event.id,
    name: input.name.trim(),
    phone: input.phone.trim(),
    teeCategory: input.teeCategory,
    poolNumber: null,
    poolRankOverride: null,
    displayOrder: activePlayers.length + 1,
    consent: input.consent,
    isWithdrawn: false,
  });

  return {
    remainingSpots: Math.max(
      0,
      snapshot.event.maxPlayers - activePlayers.length - 1
    ),
  };
}

export async function updatePar3Player(
  playerId: number,
  input: Par3PlayerInput
) {
  const snapshot = await getAdminPar3Snapshot();
  const existingPlayer = snapshot.players.find((player) => player.id === playerId);

  if (!existingPlayer || snapshot.event.id !== input.eventId) {
    throw new Error("Par 3 player not found.");
  }

  assertPar3PlayerInput(snapshot, input);

  const activePlayerCount = snapshot.players.filter(
    (player) => !player.isWithdrawn
  ).length;

  if (
    existingPlayer.isWithdrawn &&
    !input.isWithdrawn &&
    activePlayerCount >= snapshot.event.maxPlayers
  ) {
    throw new Error("The Championship II field is sold out.");
  }

  const allocationChanged =
    existingPlayer.poolNumber !== input.poolNumber ||
    existingPlayer.isWithdrawn !== input.isWithdrawn;
  if (snapshot.event.knockoutData && (allocationChanged || existingPlayer.poolRankOverride !== input.poolRankOverride || existingPlayer.displayOrder !== input.displayOrder)) {
    throw new Error("Pool allocations and seeds cannot change after the finals bracket is generated.");
  }
  const affectedPools = new Set(
    [existingPlayer.poolNumber, input.poolNumber].filter(
      (poolNumber): poolNumber is number => poolNumber !== null
    )
  );

  if (
    allocationChanged &&
    Array.from(affectedPools).some((poolNumber) =>
      poolHasRecordedResults(snapshot, poolNumber)
    )
  ) {
    throw new Error("Pool allocations cannot change after a match starts or results are recorded.");
  }

  if (
    allocationChanged &&
    input.poolNumber !== null &&
    !input.isWithdrawn
  ) {
    const otherActivePlayers = snapshot.players.filter(
      (player) =>
        player.id !== playerId &&
        !player.isWithdrawn &&
        player.poolNumber === input.poolNumber
    ).length;

    const capacity = getPar3PoolCapacity(snapshot.event, input.poolNumber);
    if (otherActivePlayers >= capacity) {
      throw new Error(
        `Pool ${input.poolNumber} already has ${capacity} active players.`
      );
    }
  }

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

  if (existingPlayer.isWithdrawn !== input.isWithdrawn) {
    const nextActivePlayerCount =
      activePlayerCount + (input.isWithdrawn ? -1 : 1);
    const capacityUpdate =
      nextActivePlayerCount >= snapshot.event.maxPlayers
        ? { registrations_open: false, status_label: "Sold out" }
        : snapshot.event.statusLabel === "Sold out"
          ? { registrations_open: true, status_label: "Registrations open" }
          : null;

    if (capacityUpdate) {
      const { error: capacityError } = await supabase
        .from("cgs_par3_events")
        .update({ ...capacityUpdate, updated_at: now })
        .eq("id", input.eventId);

      if (capacityError) {
        throw capacityError;
      }
    }
  }
}

export async function allocatePar3Pools(eventId: number, method: "seeded" | "random") {
  if (method !== "seeded" && method !== "random") throw new Error("Choose seeded or random allocation.");
  const snapshot = await getAdminPar3Snapshot();
  if (snapshot.event.id !== eventId) throw new Error("Par 3 event not found.");
  if (snapshot.event.knockoutData || snapshot.poolMatches.some((match) => match.status !== "scheduled" || match.winnerId !== null)) {
    throw new Error("Pools cannot be reallocated after a match starts or finals are generated.");
  }
  const players = snapshot.players.filter((player) => !player.isWithdrawn)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
  if (players.length < snapshot.event.poolCount * 2 || players.length > snapshot.event.maxPlayers) {
    throw new Error("Each nominated pool needs at least two players and the field must fit its capacity.");
  }
  if (method === "random") {
    for (let index = players.length - 1; index > 0; index -= 1) {
      const target = randomInt(index + 1);
      [players[index], players[target]] = [players[target], players[index]];
    }
  }
  const counts = getPar3PoolSizes(snapshot.event).map(() => 0);
  const assignments: Array<{ player_id: number; pool_number: number }> = [];
  let reverse = false;
  while (assignments.length < players.length) {
    const order = counts.map((_, index) => index);
    if (reverse) order.reverse();
    for (const index of order) {
      if (assignments.length === players.length) break;
      if (counts[index] >= getPar3PoolCapacity(snapshot.event, index + 1)) continue;
      assignments.push({ player_id: players[assignments.length].id, pool_number: index + 1 });
      counts[index] += 1;
    }
    reverse = !reverse;
  }
  const { error } = await getSupabaseAdmin().rpc("cgs_par3_allocate_pools", {
    p_event_id: eventId, p_assignments: assignments,
  });
  throwPar3MutationError(error);
}

export async function generatePar3PoolFixtures(eventId: number) {
  const snapshot = await getAdminPar3Snapshot();
  if (snapshot.event.id !== eventId) throw new Error("Par 3 event not found.");
  if (snapshot.event.knockoutData) throw new Error("Pool fixtures cannot change after the finals bracket is generated.");
  const active = snapshot.players.filter((player) => !player.isWithdrawn);
  if (active.some((player) => player.poolNumber === null)) throw new Error("Assign every active player to a pool first.");
  const rows: Array<{ pool_number: number; match_number: number; player1_id: number; player2_id: number }> = [];
  for (let poolNumber = 1; poolNumber <= snapshot.event.poolCount; poolNumber += 1) {
    const players = active.filter((player) => player.poolNumber === poolNumber)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
    const capacity = getPar3PoolCapacity(snapshot.event, poolNumber);
    if (players.length < 2 || players.length > capacity) {
      throw new Error(`Pool ${poolNumber} needs between 2 and ${capacity} active players.`);
    }
    for (const pairing of getPar3PoolFixturePairs(players.length)) {
      const [first, second] = [players[pairing.firstIndex].id, players[pairing.secondIndex].id].sort((a, b) => a - b);
      rows.push({ pool_number: poolNumber, match_number: pairing.matchNumber, player1_id: first, player2_id: second });
    }
  }
  const { error } = await getSupabaseAdmin().rpc("cgs_par3_sync_pool_fixtures", { p_event_id: eventId, p_fixtures: rows });
  throwPar3MutationError(error);
}

export async function updatePar3CtpQualifiers(eventId: number, playerIds: Array<number | null>) {
  const snapshot = await getAdminPar3Snapshot();
  if (snapshot.event.id !== eventId) throw new Error("Par 3 event not found.");
  if (snapshot.event.knockoutData) throw new Error("CTP qualifiers cannot change after the finals bracket is generated.");
  const plan = getPar3QualificationPlan(snapshot);
  const selectedIds = playerIds.filter((id): id is number => id !== null);
  if (selectedIds.some((id) => !Number.isSafeInteger(id) || id < 1) || new Set(selectedIds).size !== selectedIds.length) {
    throw new Error("Each CTP qualifying place must be assigned to a different valid player.");
  }
  if (selectedIds.length) {
    if (plan.errors.length) throw new Error(plan.errors[0]);
    if (playerIds.length > plan.ctpQualifierCount) throw new Error("Too many CTP qualifying places were supplied.");
    if (!buildPar3Pools(snapshot).every(isPar3PoolComplete)) throw new Error("Complete or manually seed every pool before the CTP playoff.");
    const eligibleIds = new Set(getPar3CtpContestants(snapshot).map((standing) => standing.player.id));
    if (selectedIds.some((id) => !eligibleIds.has(id))) throw new Error("CTP qualifiers must come from the nominated playoff contestants.");
  }
  const { error } = await getSupabaseAdmin().rpc("cgs_par3_set_ctp_qualifiers", {
    p_event_id: eventId, p_player_ids: selectedIds.length ? playerIds : [], p_expected_updated_at: snapshot.event.updatedAt,
  });
  throwPar3MutationError(error);
}

export async function updatePar3PoolMatch(
  matchId: number,
  winnerId: number | null,
  bayNumber: number | null,
  requestedStatus: "scheduled" | "live" | null = null
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

  if (requestedStatus === "live" && bayNumber === null) {
    throw new Error("Choose a simulator before starting a match.");
  }

  const status = winnerId !== null
    ? "complete"
    : requestedStatus ?? (bayNumber === null ? "scheduled" : "live");

  if (status === "live" && bayNumber !== null) {
    const snapshot = await getAdminPar3Snapshot();
    const simulatorBusy = snapshot.poolMatches.some(
      (match) =>
        match.id !== matchId &&
        match.bayNumber === bayNumber &&
        match.status === "live"
    );

    if (simulatorBusy) {
      throw new Error(`Simulator ${bayNumber} already has a live match.`);
    }
  }

  const { error } = await getSupabaseAdmin()
    .from("cgs_par3_pool_matches")
    .update({
      winner_id: winnerId,
      bay_number: bayNumber,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (error) {
    throw error;
  }
}

export async function updatePar3CtpDistance(
  eventId: number,
  playerId: number,
  distanceCm: number | null
) {
  const snapshot = await getAdminPar3Snapshot();
  const player = snapshot.players.find((candidate) => candidate.id === playerId);

  if (!player || snapshot.event.id !== eventId) {
    throw new Error("CTP player not found.");
  }

  if (distanceCm !== null && (!Number.isInteger(distanceCm) || distanceCm < 0 || distanceCm > 100000)) {
    throw new Error("Enter the CTP distance in centimetres.");
  }

  const { error } = await getSupabaseAdmin()
    .from("cgs_par3_players")
    .update({
      ctp_distance_cm: distanceCm,
      updated_at: new Date().toISOString(),
    })
    .eq("event_id", eventId)
    .eq("id", playerId);

  if (error) {
    throw error;
  }
}

export async function generatePar3Knockout(eventId: number) {
  const snapshot = await getAdminPar3Snapshot();
  if (snapshot.event.id !== eventId) throw new Error("Par 3 event not found.");
  if (snapshot.event.knockoutData) throw new Error("The finals bracket has already been generated. Existing matches have been preserved.");
  const plan = getPar3QualificationPlan(snapshot);
  if (plan.errors.length) throw new Error(plan.errors[0]);
  for (const pool of buildPar3Pools(snapshot)) {
    if (!isPar3PoolComplete(pool)) throw new Error(`${pool.label} must be complete or manually seeded.`);
  }
  const ctpQualifiers = getPar3CtpQualifiers(snapshot);
  if (ctpQualifiers.length !== plan.ctpQualifierCount || ctpQualifiers.some((player, index) => player.ctpRank !== index + 1)) {
    throw new Error(`Confirm all ${plan.ctpQualifierCount} CTP qualifying places before generating finals.`);
  }
  const templateSlots = getPar3FinalsTemplate(snapshot).flatMap((pairing) => [pairing.first, pairing.second]);
  const slots = templateSlots.map((slot) => resolvePar3BracketSlot(snapshot, slot));
  const entrants = slots.filter((player): player is Par3Player => player !== null);
  if (slots.length !== plan.finalsSize || slots.some((player, index) => !player && !templateSlots[index].isBye)
    || templateSlots.filter((slot) => slot.isBye).length !== plan.byeCount
    || entrants.length !== plan.requiredPlayerCount || new Set(entrants.map((player) => player.id)).size !== plan.requiredPlayerCount) {
    throw new Error("Every finals qualifying position must be confirmed with a different player first.");
  }
  const storage = new InMemoryDatabase();
  const manager = new BracketsManager(storage);
  const seedingIds: Array<number | null> = [];
  for (const player of slots) {
    seedingIds.push(player === null ? null : await storage.insert("participant", { tournament_id: 0, name: player.name, par3PlayerId: player.id }));
  }
  await manager.create.stage({
    tournamentId: 0, name: "CGS Par 3 Championship Finals", type: "single_elimination",
    seedingIds,
    settings: { size: plan.finalsSize, seedOrdering: ["natural"], balanceByes: false },
  });
  const knockoutData = await manager.get.tournamentData(0);
  const { error } = await getSupabaseAdmin().rpc("cgs_par3_create_finals", {
    p_event_id: eventId, p_knockout_data: knockoutData, p_expected_updated_at: snapshot.event.updatedAt,
  });
  throwPar3MutationError(error);
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

async function assertPar3PlayableKnockoutMatch(manager: BracketsManager, matchId: number) {
  if (!Number.isSafeInteger(matchId) || matchId < 0) throw new Error("Choose a valid finals match.");
  const data = await manager.get.tournamentData(0);
  const match = data.match.find((candidate) => candidate.id === matchId);
  if (!match) throw new Error("Finals match not found.");
  if (match.opponent1 === null || match.opponent2 === null) {
    throw new Error("A bye advances automatically and cannot be started, scored or reset.");
  }
  if (match.opponent1.id === null || match.opponent2.id === null) {
    throw new Error("Both players must be confirmed before changing this finals match.");
  }
}

export async function startPar3KnockoutMatch(
  eventId: number,
  matchId: number
) {
  const manager = await loadKnockoutManager(eventId);
  await assertPar3PlayableKnockoutMatch(manager, matchId);

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
  await assertPar3PlayableKnockoutMatch(manager, matchId);

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
  await assertPar3PlayableKnockoutMatch(manager, matchId);
  await manager.reset.matchResults(matchId);
  await saveKnockoutData(eventId, manager);
}
