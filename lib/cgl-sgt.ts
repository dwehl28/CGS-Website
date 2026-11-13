import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type JsonRecord = Record<string, unknown>;
type SyncTrigger = "connect" | "manual" | "schedule" | "recovery";

const SGT_API_ROOT = "https://simulatorgolftour.com/sgt-api/club-admin";
export const CGL_SGT_CLUB_SLUG =
  process.env.CGL_SGT_CLUB_SLUG?.trim() || "CGSBunker";
const SGT_REQUEST_TIMEOUT_MS = 12_000;
const SGT_REFRESH_WINDOW_MS = 35 * 60 * 1000;
const SGT_MAX_TOURS = 100;
const SGT_MAX_TOURNAMENTS = 300;
const SGT_MAX_ROWS = 2_000;

export class CglSgtError extends Error {
  constructor(
    message: string,
    public status = 503,
    public code = "sgt_unavailable",
    public providerStatus?: number,
  ) {
    super(message);
  }
}

const clubSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/);
const credentialSchema = z.object({
  username: z.string().trim().min(2).max(64),
  password: z.string().min(6).max(500),
});
const keyResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    key: z.string().min(32).max(500),
    expires: z.coerce.number().int().positive().max(172_800),
  }),
  z.object({
    success: z.literal(false),
    error: z.string().max(500).optional(),
  }),
]);

function database() {
  try {
    return getSupabaseAdmin();
  } catch {
    throw new CglSgtError(
      "The CGL database connection is unavailable.",
      503,
      "setup_required",
    );
  }
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asRows(value: unknown, maximum = SGT_MAX_ROWS): JsonRecord[] {
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is JsonRecord =>
            !!item && typeof item === "object" && !Array.isArray(item),
        )
        .slice(0, maximum)
    : [];
}

function payloadRows(
  value: unknown,
  keys: string[],
  maximum = SGT_MAX_ROWS,
) {
  const direct = asRows(value, maximum);
  if (direct.length) return direct;
  const record = asRecord(value);
  for (const key of keys) {
    const nested = asRows(record[key], maximum);
    if (nested.length) return nested;
  }
  return [];
}

function payloadJson(value: unknown, fallback: unknown = {}) {
  return value && typeof value === "object" ? value : fallback;
}

function firstValue(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function textValue(record: JsonRecord, keys: string[], fallback = "") {
  const value = firstValue(record, keys);
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : fallback;
}

function numberValue(record: JsonRecord, keys: string[]) {
  const value = Number(firstValue(record, keys));
  return Number.isFinite(value) ? value : null;
}

function integerValue(record: JsonRecord, keys: string[]) {
  const value = numberValue(record, keys);
  return value !== null && Number.isSafeInteger(value) ? value : null;
}

function booleanValue(record: JsonRecord, keys: string[]) {
  const value = firstValue(record, keys);
  return value === true || value === 1 || value === "1" || value === "true";
}

function dateValue(record: JsonRecord, keys: string[]) {
  const value = textValue(record, keys);
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
}

function providerMessage(status: number) {
  if (status === 401 || status === 403)
    return "The SGT connection needs to be renewed by an administrator.";
  if (status === 404)
    return "SGT could not find one of the configured club resources.";
  if (status === 429)
    return "SGT is receiving too many requests. Automatic sync will retry.";
  return "SGT did not complete the data request. Automatic sync will retry.";
}

async function parseProviderResponse(response: Response) {
  const raw = await response.text();
  if (!response.ok) {
    throw new CglSgtError(
      providerMessage(response.status),
      response.status === 401 || response.status === 403 ? 409 : 502,
      response.status === 401 || response.status === 403
        ? "sgt_authorisation_required"
        : "sgt_provider_error",
      response.status,
    );
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new CglSgtError(
      "SGT returned data in an unexpected format. Automatic sync will retry.",
      502,
      "sgt_invalid_response",
    );
  }
}

async function sgtFormPost(
  clubSlug: string,
  path: string,
  values: Record<string, string>,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SGT_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${SGT_API_ROOT}/${encodeURIComponent(clubSlug)}${path}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(values),
        cache: "no-store",
        signal: controller.signal,
      },
    );
    return await parseProviderResponse(response);
  } catch (error) {
    if (error instanceof CglSgtError) throw error;
    throw new CglSgtError(
      "SGT could not be reached. The connection was not assumed to be complete.",
      503,
      "sgt_unreachable",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function sgtGet(
  clubSlug: string,
  path: string,
  apiKey: string,
  params: Record<string, string | number | undefined> = {},
) {
  const url = new URL(
    `${SGT_API_ROOT}/${encodeURIComponent(clubSlug)}${path}`,
  );
  url.searchParams.set("api-key", apiKey);
  for (const [key, value] of Object.entries(params))
    if (value !== undefined) url.searchParams.set(key, String(value));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SGT_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    return await parseProviderResponse(response);
  } catch (error) {
    if (error instanceof CglSgtError) throw error;
    throw new CglSgtError(
      "SGT could not be reached. Cached CGL data remains available.",
      503,
      "sgt_unreachable",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function safeSgtGet(
  warnings: string[],
  label: string,
  clubSlug: string,
  path: string,
  apiKey: string,
  params?: Record<string, string | number | undefined>,
) {
  try {
    return await sgtGet(clubSlug, path, apiKey, params);
  } catch (error) {
    if (
      error instanceof CglSgtError &&
      error.code === "sgt_authorisation_required"
    )
      throw error;
    warnings.push(`${label} could not be refreshed.`);
    return null;
  }
}

async function mapLimited<T, R>(
  values: T[],
  limit: number,
  work: (value: T) => Promise<R>,
) {
  const output: R[] = [];
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, Math.max(values.length, 1)) },
    async () => {
      while (next < values.length) {
        const index = next++;
        output[index] = await work(values[index]);
      }
    },
  );
  await Promise.all(workers);
  return output;
}

async function storeApiKey(
  clubSlug: string,
  apiKey: string,
  expiresInSeconds: number,
  actor: string,
  reason: string,
) {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  const { error } = await database().rpc("cgl_sgt_store_api_key", {
    p_club_slug: clubSlug,
    p_api_key: apiKey,
    p_expires_at: expiresAt,
    p_actor: actor,
    p_reason: reason,
  });
  if (error)
    throw new CglSgtError(
      "The SGT key could not be stored securely.",
      503,
      "sgt_secret_store_failed",
    );
  return expiresAt;
}

async function loadConnection(clubSlug: string) {
  const { data, error } = await database()
    .from("cgl_sgt_connections")
    .select("*")
    .eq("club_slug", clubSlug)
    .maybeSingle();
  if (error || !data)
    throw new CglSgtError(
      "The SGT club connection has not been configured.",
      503,
      "setup_required",
    );
  return data as JsonRecord;
}

async function loadApiKey(clubSlug: string) {
  const { data, error } = await database().rpc("cgl_sgt_get_api_key", {
    p_club_slug: clubSlug,
  });
  if (error || typeof data !== "string" || data.length < 32)
    throw new CglSgtError(
      "Connect the CGSBunker SGT account before automatic sync can run.",
      409,
      "sgt_not_connected",
    );
  return data;
}

async function refreshApiKey(
  clubSlug: string,
  actor: string,
  reason: string,
) {
  const currentKey = await loadApiKey(clubSlug);
  const response = keyResponseSchema.parse(
    await sgtFormPost(clubSlug, "/apikey/refresh", {
      "api-key": currentKey,
    }),
  );
  if (!response.success)
    throw new CglSgtError(
      "SGT did not renew the API connection.",
      409,
      "sgt_authorisation_required",
    );
  await storeApiKey(
    clubSlug,
    response.key,
    response.expires,
    actor,
    reason,
  );
  return response.key;
}

async function validApiKey(
  clubSlug: string,
  connection: JsonRecord,
  actor: string,
) {
  const expiresAt = Date.parse(String(connection.api_key_expires_at ?? ""));
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now())
    throw new CglSgtError(
      "The SGT connection expired and needs administrator renewal.",
      409,
      "sgt_authorisation_required",
    );
  if (expiresAt - Date.now() <= SGT_REFRESH_WINDOW_MS)
    return refreshApiKey(
      clubSlug,
      actor,
      "Automatic renewal before the SGT key expired",
    );
  return loadApiKey(clubSlug);
}

function tournamentRows(payload: unknown) {
  return payloadRows(
    payload,
    ["results", "tournaments", "data", "rows"],
    SGT_MAX_TOURNAMENTS,
  );
}

function tourRow(clubSlug: string, tour: JsonRecord, details: JsonRecord) {
  const id = integerValue(tour, ["tourId", "tour_id", "id"]);
  if (id === null) return null;
  return {
    sgt_tour_id: id,
    club_slug: clubSlug,
    name: textValue(tour, ["name", "tourname", "tour_name"], `SGT Tour ${id}`),
    start_date: dateValue(tour, ["start_date", "startdate", "startDate"]),
    end_date: dateValue(tour, ["end_date", "enddate", "endDate"]),
    team_tour: booleanValue(tour, ["teamTour", "team_tour", "tourtype"]),
    active: booleanValue(tour, ["active", "is_active"]),
    admin_username: textValue(tour, ["admin_uid", "admin_username"]) || null,
    past_due: booleanValue(tour, ["pastDue", "past_due"]),
    members: details.members ?? [],
    teams: details.teams ?? {},
    standings_gross: details.standingsGross ?? [],
    standings_net: details.standingsNet ?? [],
    stats: details.stats ?? {},
    raw: tour,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function tournamentRow(
  clubSlug: string,
  tourId: number,
  tournament: JsonRecord,
  details: JsonRecord,
) {
  const id = integerValue(tournament, [
    "tournamentId",
    "tournament_id",
    "tourneyId",
    "id",
  ]);
  if (id === null) return null;
  return {
    sgt_tournament_id: id,
    sgt_tour_id: tourId,
    club_slug: clubSlug,
    name: textValue(
      tournament,
      ["name", "tourneyname", "tournamentName", "tournament_name"],
      `SGT Tournament ${id}`,
    ),
    status: textValue(tournament, ["status", "state"]) || null,
    start_date: dateValue(tournament, ["startdate", "start_date", "startDate"]),
    end_date: dateValue(tournament, ["enddate", "end_date", "endDate"]),
    registration_start_date: dateValue(tournament, [
      "regstartdate",
      "registration_start_date",
    ]),
    registration_end_date: dateValue(tournament, [
      "regenddate",
      "registration_end_date",
    ]),
    course_name:
      textValue(tournament, ["courseName", "course_name", "course1_name"]) ||
      null,
    number_rounds: integerValue(tournament, ["numberrounds", "number_rounds"]),
    number_holes:
      textValue(tournament, ["numberholes", "number_holes"]) || null,
    gameplay: textValue(tournament, ["gameplay", "format"]) || null,
    stableford: booleanValue(tournament, ["stableford"]),
    registrations: details.registrations ?? [],
    scorecards: details.scorecards ?? [],
    stats: details.stats ?? {},
    raw: tournament,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function candidateMembers(value: unknown) {
  const direct = asRows(value);
  if (direct.length) return direct;
  const teams = asRecord(value);
  return Object.values(teams).flatMap((team) => asRows(team));
}

async function syncLinkedCglMembers(memberSets: unknown[], actor: string) {
  const candidates = memberSets.flatMap(candidateMembers);
  const byName = new Map<string, JsonRecord>();
  for (const candidate of candidates) {
    const name = textValue(candidate, ["user_name", "username", "player_name"]);
    if (name) byName.set(name.toLowerCase(), candidate);
  }
  if (!byName.size) return 0;
  const { data: members, error } = await database()
    .from("cgl_members")
    .select("id,sgt_username,handicap,handicap_status,sgt_verified_at");
  if (error) return 0;
  let updated = 0;
  for (const member of (members ?? []) as JsonRecord[]) {
    const username = textValue(member, ["sgt_username"]);
    const source = byName.get(username.toLowerCase());
    if (!source) continue;
    const handicap = numberValue(source, [
      "SGT_Combo_HCP",
      "SGTcombo_hcp",
      "combo_hcp",
      "hcp_index",
      "custom_hcp",
    ]);
    if (handicap === null || handicap < -20 || handicap > 54) continue;
    const changed =
      Number(member.handicap) !== handicap ||
      member.handicap_status !== "verified" ||
      !member.sgt_verified_at;
    if (!changed) continue;
    const now = new Date().toISOString();
    const { error: updateError } = await database()
      .from("cgl_members")
      .update({
        handicap,
        handicap_status: "verified",
        handicap_verified_at: now,
        sgt_verified_at: member.sgt_verified_at ?? now,
        updated_at: now,
      })
      .eq("id", member.id);
    if (!updateError) {
      updated += 1;
      await database().from("cgl_audit_events").insert({
        actor,
        action: "sgt_handicap_sync",
        entity: "member",
        entity_id: String(member.id),
        reason: "Updated the linked member from the official SGT Club API",
        before_data: {
          handicap: member.handicap,
          handicap_status: member.handicap_status,
        },
        after_data: { handicap, handicap_status: "verified" },
      });
    }
  }
  return updated;
}

async function upsertRows(table: string, values: JsonRecord[]) {
  if (!values.length) return;
  const { error } = await database().from(table).upsert(values);
  if (error)
    throw new CglSgtError(
      "SGT data was received but could not be saved. Cached data was preserved.",
      503,
      "sgt_snapshot_store_failed",
    );
}

async function performSync(
  clubSlug: string,
  apiKey: string,
  actor: string,
) {
  const warnings: string[] = [];
  const [memberPayload, tourPayload] = await Promise.all([
    safeSgtGet(
      warnings,
      "Club members",
      clubSlug,
      "/members/list",
      apiKey,
    ),
    sgtGet(clubSlug, "/tours/list", apiKey),
  ]);
  const memberRecord = asRecord(memberPayload);
  const clubMembers = payloadRows(memberPayload, ["members", "data", "results"]);
  const inviteLinks = asRecord(memberRecord.links);
  const tours = payloadRows(
    tourPayload,
    ["tours", "data", "results"],
    SGT_MAX_TOURS,
  );
  const tourSnapshots: JsonRecord[] = [];
  const tournamentSnapshots: JsonRecord[] = [];
  const linkedMemberSets: unknown[] = [clubMembers];

  await mapLimited(tours, 3, async (tour) => {
    const tourId = integerValue(tour, ["tourId", "tour_id", "id"]);
    if (tourId === null) {
      warnings.push("One SGT tour was skipped because it had no ID.");
      return;
    }
    const teamTour = booleanValue(tour, ["teamTour", "team_tour", "tourtype"]);
    const [tournamentsPayload, gross, net, stats, roster] = await Promise.all([
      safeSgtGet(
        warnings,
        `Tour ${tourId} tournaments`,
        clubSlug,
        "/tournaments/list",
        apiKey,
        { tourId },
      ),
      safeSgtGet(
        warnings,
        `Tour ${tourId} gross standings`,
        clubSlug,
        "/tours/standings",
        apiKey,
        { tourId, grossOrNet: "gross" },
      ),
      safeSgtGet(
        warnings,
        `Tour ${tourId} net standings`,
        clubSlug,
        "/tours/standings",
        apiKey,
        { tourId, grossOrNet: "net" },
      ),
      safeSgtGet(
        warnings,
        `Tour ${tourId} statistics`,
        clubSlug,
        "/tours/stats",
        apiKey,
        { tourId },
      ),
      safeSgtGet(
        warnings,
        `Tour ${tourId} roster`,
        clubSlug,
        teamTour ? "/tours/teams" : "/tours/members",
        apiKey,
        { tourId },
      ),
    ]);
    linkedMemberSets.push(roster);
    const snapshot = tourRow(clubSlug, tour, {
      members: teamTour
        ? []
        : payloadRows(roster, ["members", "players", "data", "results"]),
      teams: teamTour ? asRecord(asRecord(roster).teams ?? roster) : {},
      standingsGross: payloadRows(gross, ["standings", "results", "data", "rows"]),
      standingsNet: payloadRows(net, ["standings", "results", "data", "rows"]),
      stats: payloadJson(stats),
    });
    if (snapshot) tourSnapshots.push(snapshot);
    const tournaments = tournamentRows(tournamentsPayload);
    await mapLimited(tournaments, 4, async (tournament) => {
      const tournamentId = integerValue(tournament, [
        "tournamentId",
        "tournament_id",
        "tourneyId",
        "id",
      ]);
      if (tournamentId === null) {
        warnings.push(`One tournament in tour ${tourId} had no ID.`);
        return;
      }
      const [registrations, scorecards, tournamentStats] = await Promise.all([
        safeSgtGet(
          warnings,
          `Tournament ${tournamentId} registrations`,
          clubSlug,
          "/registrations/view",
          apiKey,
          { tournamentId },
        ),
        safeSgtGet(
          warnings,
          `Tournament ${tournamentId} scorecards`,
          clubSlug,
          "/tournaments/scorecards",
          apiKey,
          { tournamentId },
        ),
        safeSgtGet(
          warnings,
          `Tournament ${tournamentId} statistics`,
          clubSlug,
          "/tournaments/stats",
          apiKey,
          { tournamentId },
        ),
      ]);
      linkedMemberSets.push(registrations, scorecards);
      const row = tournamentRow(clubSlug, tourId, tournament, {
        registrations: payloadRows(registrations, ["registrations", "results", "data", "rows"]),
        scorecards: payloadRows(scorecards, ["scorecards", "results", "data", "rows"]),
        stats: payloadJson(tournamentStats),
      });
      if (row) tournamentSnapshots.push(row);
    });
  });

  await upsertRows("cgl_sgt_tours", tourSnapshots);
  await upsertRows("cgl_sgt_tournaments", tournamentSnapshots);
  const linkedMembersUpdated = await syncLinkedCglMembers(linkedMemberSets, actor);
  return {
    warnings,
    clubMembers,
    inviteLinks,
    counts: {
      members: clubMembers.length,
      tours: tourSnapshots.length,
      tournaments: tournamentSnapshots.length,
      linkedMembersUpdated,
    },
  };
}

async function beginSyncRun(
  clubSlug: string,
  trigger: SyncTrigger,
  actor: string,
) {
  const { data, error } = await database()
    .from("cgl_sgt_sync_runs")
    .insert({ club_slug: clubSlug, trigger, actor, state: "running" })
    .select("id")
    .single();
  if (error || !data)
    throw new CglSgtError(
      "The SGT sync audit record could not be started.",
      503,
      "sgt_sync_store_failed",
    );
  return String(data.id);
}

async function finishSync(
  clubSlug: string,
  leaseToken: string,
  runId: string,
  result: {
    state: "completed" | "partial" | "failed";
    counts?: JsonRecord;
    warnings?: string[];
    error?: string;
    clubMembers?: JsonRecord[];
    inviteLinks?: JsonRecord;
  },
) {
  const now = new Date().toISOString();
  await database()
    .from("cgl_sgt_sync_runs")
    .update({
      state: result.state,
      counts: result.counts ?? {},
      warnings: result.warnings ?? [],
      error: result.error ?? null,
      completed_at: now,
    })
    .eq("id", runId);
  await database()
    .from("cgl_sgt_connections")
    .update({
      status: result.state === "failed" ? "error" : "connected",
      last_sync_at: now,
      ...(result.state === "failed" ? {} : { last_success_at: now }),
      last_error:
        result.error ??
        (result.warnings?.length
          ? `${result.warnings.length} SGT section(s) will retry automatically.`
          : null),
      ...(result.clubMembers ? { members: result.clubMembers } : {}),
      ...(result.inviteLinks ? { invite_links: result.inviteLinks } : {}),
      lease_token: null,
      lease_until: null,
      updated_at: now,
    })
    .eq("club_slug", clubSlug)
    .eq("lease_token", leaseToken);
}

export async function connectCglSgt(input: {
  username: unknown;
  password: unknown;
  actor: string;
  reason: string;
  clubSlug?: string;
}) {
  const clubSlug = clubSlugSchema.parse(input.clubSlug ?? CGL_SGT_CLUB_SLUG);
  const credentials = credentialSchema.parse({
    username: input.username,
    password: input.password,
  });
  const response = keyResponseSchema.parse(
    await sgtFormPost(clubSlug, "/apikey/create", credentials),
  );
  if (!response.success)
    throw new CglSgtError(
      "SGT did not approve the club administrator credentials.",
      409,
      "sgt_authorisation_required",
    );
  const expiresAt = await storeApiKey(
    clubSlug,
    response.key,
    response.expires,
    input.actor,
    input.reason,
  );
  await database()
    .from("cgl_settings")
    .update({
      value: {
        mode: "official_club_api",
        club_slug: clubSlug,
        club_id: 1125,
        api_configured: true,
        sync_interval_minutes: 30,
        read_only: true,
      },
      updated_at: new Date().toISOString(),
      updated_by: input.actor,
    })
    .eq("key", "sgt");
  const sync = await runCglSgtSync({
    force: true,
    trigger: "connect",
    actor: input.actor,
    clubSlug,
  });
  return { connected: true, clubSlug, expiresAt, sync };
}

export async function runCglSgtSync(input: {
  force?: boolean;
  trigger?: SyncTrigger;
  actor?: string;
  clubSlug?: string;
}) {
  const clubSlug = clubSlugSchema.parse(input.clubSlug ?? CGL_SGT_CLUB_SLUG);
  const trigger = input.trigger ?? "manual";
  const actor = input.actor?.trim().slice(0, 200) || "sgt-sync";
  const leaseToken = randomUUID();
  const { data: claimed, error: claimError } = await database().rpc(
    "cgl_sgt_claim_sync",
    {
      p_club_slug: clubSlug,
      p_lease_token: leaseToken,
      p_force: input.force === true,
    },
  );
  if (claimError)
    throw new CglSgtError(
      "The SGT sync lock could not be acquired.",
      503,
      "sgt_sync_store_failed",
    );
  if (claimed !== true)
    return {
      status: "skipped",
      message: "SGT is already syncing or the next automatic sync is not due.",
    };
  const runId = await beginSyncRun(clubSlug, trigger, actor);
  try {
    let connection = await loadConnection(clubSlug);
    let apiKey = await validApiKey(clubSlug, connection, actor);
    let snapshot;
    try {
      snapshot = await performSync(clubSlug, apiKey, actor);
    } catch (error) {
      if (
        !(error instanceof CglSgtError) ||
        error.code !== "sgt_authorisation_required"
      )
        throw error;
      apiKey = await refreshApiKey(
        clubSlug,
        actor,
        "Recovered an authorised SGT sync after provider rejection",
      );
      connection = await loadConnection(clubSlug);
      void connection;
      snapshot = await performSync(clubSlug, apiKey, actor);
    }
    const state = snapshot.warnings.length ? "partial" : "completed";
    await finishSync(clubSlug, leaseToken, runId, {
      state,
      counts: snapshot.counts,
      warnings: snapshot.warnings,
      clubMembers: snapshot.clubMembers,
      inviteLinks: snapshot.inviteLinks,
    });
    return {
      status: state,
      counts: snapshot.counts,
      warnings: snapshot.warnings,
    };
  } catch (error) {
    const safeError =
      error instanceof CglSgtError
        ? error
        : new CglSgtError("SGT sync failed. Cached data remains available.");
    await finishSync(clubSlug, leaseToken, runId, {
      state: "failed",
      error: safeError.message,
    });
    throw safeError;
  }
}

export async function setCglSgtSyncEnabled(input: {
  enabled: boolean;
  actor: string;
  reason: string;
  clubSlug?: string;
}) {
  const clubSlug = clubSlugSchema.parse(input.clubSlug ?? CGL_SGT_CLUB_SLUG);
  const connection = await loadConnection(clubSlug);
  const { error } = await database()
    .from("cgl_sgt_connections")
    .update({
      sync_enabled: input.enabled,
      status: input.enabled
        ? connection.api_key_secret_id
          ? "connected"
          : "disconnected"
        : "disconnected",
      updated_at: new Date().toISOString(),
    })
    .eq("club_slug", clubSlug);
  if (error)
    throw new CglSgtError("The automatic SGT sync setting was not saved.");
  await database().from("cgl_audit_events").insert({
    actor: input.actor,
    action: input.enabled ? "sgt_sync_enabled" : "sgt_sync_paused",
    entity: "sgt_connection",
    entity_id: clubSlug,
    reason: input.reason,
    before_data: { sync_enabled: connection.sync_enabled },
    after_data: { sync_enabled: input.enabled },
  });
  return { clubSlug, enabled: input.enabled };
}

const PRIVATE_KEY = /(?:email|api.?key|secret|password|game.?id|user.?id|player.?id|registration.?id|scorecard.?id|team.?id)/i;

export function sanitizeSgtPublic(value: unknown, depth = 0): unknown {
  if (depth > 8) return null;
  if (Array.isArray(value))
    return value.slice(0, SGT_MAX_ROWS).map((item) => sanitizeSgtPublic(item, depth + 1));
  if (!value || typeof value !== "object")
    return typeof value === "string" && value.length > 1_000
      ? value.slice(0, 1_000)
      : value;
  return Object.fromEntries(
    Object.entries(value as JsonRecord)
      .filter(([key]) => !PRIVATE_KEY.test(key))
      .map(([key, item]) => [key, sanitizeSgtPublic(item, depth + 1)]),
  );
}
