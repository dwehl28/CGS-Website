import "server-only";

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  isAdminAuthenticated,
  isValidAdminAppAccessToken,
} from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildCglSeasonOneAdminDraft, CGL_SEASON_ONE_RULES, CGL_CASH_PRIZE_CENTS, CGL_SEASON_ONE_CREDITS, CGL_QUALIFIER_CONDITIONS, CGL_QUALIFIER_SGT_EVENTS, CGL_QUALIFIER_SGT_TOUR, CGL_SEASON_ONE_PLAN } from "@/lib/cgl-season-one";
import { sgtScorecardHoles, sgtRow, sgtFirst, sgtRows } from "@/lib/cgl-sgt-live";
import {
  CglSgtError,
  connectCglSgt,
  runCglSgtSync,
  sanitizeSgtPublic,
  setCglSgtSyncEnabled,
} from "@/lib/cgl-sgt";
import {
  auditCglSquareCatalogMappings,
  cancelCglSquareSubscription,
  verifyCglSquareConnection,
} from "@/lib/cgl-square";
import {
  CGL_DEFAULT_POINTS_TABLE,
  CGL_RULES_VERSION,
  annualRanking,
  assignDivision,
  bestEightOfTen,
  calculateDivisionPoints,
  cancellationQuote,
  canCgl,
  competitionEligibility,
  giftEligibility,
  scoreCompetition,
  selectWeeklyAwards,
  type CglRole,
  type CglPermission,
  type CompetitionResult,
  type MembershipPlan,
  type NineHoleAttempt,
  type PointsTable,
  type WeeklyAwardCategory,
} from "@/lib/cgl-engine";

export type CglData = Record<string, unknown>;
const configOf = (record: CglData) => (record.config ?? {}) as CglData;
const isSeasonOne = (season: CglData) => configOf(season).regulation === CGL_SEASON_ONE_RULES;
function fixtureEventIds(week: CglData) {
  return [week.sgt_tournament_id, configOf(week).sgt_tournament_b_id].filter((value): value is string => typeof value === "string" && value.length > 0);
}
function publicFixtureFields(value: unknown, keys: string[]) {
  const record = (value ?? {}) as CglData;
  return Object.fromEntries(keys.flatMap((key) => ["string", "number", "boolean"].includes(typeof record[key]) ? [[key,record[key]]] : []));
}
export function isCglSandboxRecord(record: CglData) {
  const metadata = record.metadata as CglData | null | undefined;
  return metadata?.environment === "sandbox" ||
    record.environment === "sandbox" ||
    record.source === "square_sandbox" ||
    String(record.external_id ?? "").startsWith("square:sandbox:");
}
export function isCglSquareEnvironmentRecord(
  record: CglData,
  environment: "sandbox" | "production",
) {
  if (environment === "sandbox") return isCglSandboxRecord(record);
  const metadata = record.metadata as CglData | null | undefined;
  return metadata?.environment === environment ||
    record.environment === environment ||
    record.source === `square_${environment}` ||
    String(record.external_id ?? "").startsWith(`square:${environment}:`);
}
export interface CglIdentity {
  id: string;
  memberId?: string;
  email: string;
  appMetadata: CglData;
  displayName: string;
}
export interface CglActor {
  id: string;
  role: CglRole;
}
export class CglApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "invalid_request",
  ) {
    super(message);
  }
}

const uuid = z.string().uuid();
const text = (max = 200) => z.string().trim().min(1).max(max);
const reasonSchema = z.string().trim().min(5).max(2000);
const idempotency = z
  .string()
  .trim()
  .min(12)
  .max(160)
  .regex(/^[a-zA-Z0-9:_-]+$/);
const sgtUsername = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[^\s/\\?#\u0000-\u001f]+$/);
const sourceUrl = z
  .string()
  .url()
  .max(1000)
  .refine((value) => {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      ["simulatorgolftour.com", "www.simulatorgolftour.com"].includes(
        u.hostname,
      )
    );
  }, "Use an official HTTPS SGT source URL.");

function db() {
  try {
    return getSupabaseAdmin();
  } catch {
    throw new CglApiError(
      "CGL database access is not configured.",
      503,
      "setup_required",
    );
  }
}
function failDatabase(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (["42P01", "42883", "PGRST205", "PGRST202"].includes(error.code ?? "")) {
    throw new CglApiError(
      "The CGL database migration has not been applied. Existing CGS accounts and trial results are preserved.",
      503,
      "setup_required",
    );
  }
  if (
    ["23505", "23514", "23503", "P0001", "22P02", "22003"].includes(
      error.code ?? "",
    )
  ) {
    throw new CglApiError(
      error.code === "23505"
        ? "This record already exists. Refresh and review the existing record."
        : error.code === "P0001"
          ? (error.message ?? "The CGL operation requires review.")
          : "The record does not meet CGL data rules. Check its values and relationships.",
      409,
      "conflict",
    );
  }
  throw new CglApiError(
    "CGL could not complete this database operation. Please retry; no successful action is being assumed.",
    503,
    "database_unavailable",
  );
}
async function rpc(name: string, args: CglData) {
  const { data, error } = await db().rpc(name, args);
  failDatabase(error);
  return data;
}
async function rows(
  table: string,
  filters: Record<string, unknown> = {},
  columns = "*",
): Promise<CglData[]> {
  const all: CglData[] = [];
  const keys: Record<string, string[]> = {
    cgl_settings:["key"], cgl_plans:["code"], cgl_square_webhook_events:["event_id"], cgl_square_season_entitlements:["checkout_id"],
    cgl_sgt_connections:["club_slug"], cgl_sgt_tours:["sgt_tour_id"], cgl_sgt_tournaments:["sgt_tournament_id"],
    cgl_event_enrolments:["week_id","member_id"], cgl_event_reviews:["week_id"], cgl_qualifying_cards:["season_id","scorecard_id"],
  };
  for (let offset = 0; offset < 100000; offset += 1000) {
    let query = db()
      .from(table)
      .select(columns)
      .range(offset, offset + 999);
    for (const key of keys[table] ?? ["id"]) query = query.order(key);
    for (const [key, value] of Object.entries(filters))
      query = value === null ? query.is(key, null) : query.eq(key, value);
    const { data, error } = await query;
    failDatabase(error);
    const page = (data ?? []) as unknown as CglData[];
    all.push(...page);
    if (page.length < 1000) return all;
  }
  throw new CglApiError(
    "This report exceeds the interactive record limit. Export a smaller date range.",
    413,
  );
}
async function one(table: string, id: string, owner?: string) {
  const result = await rows(table, {
    id,
    ...(owner ? { member_id: owner } : {}),
  });
  if (!result[0])
    throw new CglApiError("CGL record not found.", 404, "not_found");
  return result[0];
}
export function cglApiFailure(error: unknown) {
  const failure =
    error instanceof CglApiError
      ? error
      : error instanceof CglSgtError
        ? new CglApiError(error.message, error.status, error.code)
      : error instanceof z.ZodError
        ? new CglApiError(
            error.issues
              .map(
                (issue) =>
                  `${issue.path.join(".") || "Request"}: ${issue.message}`,
              )
              .join(" "),
            400,
          )
        : new CglApiError(
            "CGL could not complete this request. Please retry.",
            500,
            "request_failed",
          );
  return Response.json(
    { status: failure.code, message: failure.message },
    { status: failure.status, headers: { "Cache-Control": "no-store" } },
  );
}
export async function readCglBody(request: Request): Promise<CglData> {
  if (Number(request.headers.get("content-length") ?? 0) > 1_000_000)
    throw new CglApiError("The request is too large.", 413);
  const raw = await request.text();
  if (raw.length > 1_000_000)
    throw new CglApiError("The request is too large.", 413);
  try {
    return z.record(z.string(), z.unknown()).parse(JSON.parse(raw));
  } catch {
    throw new CglApiError("Send a valid JSON object.");
  }
}
export function verifyCglOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new CglApiError(
      "This action must be submitted from the CGS website.",
      403,
      "forbidden",
    );
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new CglApiError(
      "Cross-site CGL actions are not accepted.",
      403,
      "forbidden",
    );
}

export async function getCglMemberIdentity(
  request: Request,
): Promise<CglIdentity> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!token || token.length > 12000)
    throw new CglApiError(
      "Sign in to your CGS account to continue.",
      401,
      "unauthenticated",
    );
  // Deliberately bypass the legacy app-token shortcut: only a verified real Auth user owns a member account.
  const { data, error } = await db().auth.getUser(token);
  if (error || !data.user?.email)
    throw new CglApiError(
      "Your CGS session has expired. Sign in again.",
      401,
      "unauthenticated",
    );
  const accountMembers = await rows(
    "cgl_members",
    { account_id: data.user.id },
    "id",
  );
  let memberId = accountMembers[0]?.id as string | undefined;
  if (!memberId) {
    const legacyMembers = await rows(
      "cgl_members",
      { id: data.user.id },
      "id",
    );
    memberId = legacyMembers[0]?.id as string | undefined;
  }
  return {
    id: data.user.id,
    memberId,
    email: data.user.email,
    appMetadata: data.user.app_metadata ?? {},
    displayName: String(
      data.user.user_metadata?.display_name ??
        data.user.user_metadata?.full_name ??
        data.user.email.split("@")[0],
    ).slice(0, 120),
  };
}
export function isConfiguredCglLegacyAdmin() {
  const secret = process.env.CGS_ADMIN_SECRET?.trim();
  return Boolean(
    secret &&
      !["cgs-admin-session-admin", "admin"].includes(secret),
  );
}
export async function getCglAdminActor(request?: Request): Promise<CglActor> {
  const legacyAdmin =
    isConfiguredCglLegacyAdmin() && (await isAdminAuthenticated());
  if (request?.headers.get("authorization")) {
    const token = (request.headers.get("authorization") ?? "").replace(
      /^Bearer\s+/,
      "",
    );
    if (isConfiguredCglLegacyAdmin() && isValidAdminAppAccessToken(token))
      return { id: "legacy-configured-admin", role: "super_admin" };
    try {
      const identity = await getCglMemberIdentity(request);
      const role = identity.appMetadata.cgl_role;
      if (
        ["super_admin", "league_admin", "results_admin"].includes(
          String(role),
        )
      )
        return { id: identity.id, role: role as CglRole };
    } catch (error) {
      if (!legacyAdmin) throw error;
    }
    if (legacyAdmin)
      return { id: "legacy-configured-admin", role: "super_admin" };
    throw new CglApiError(
      "A CGL administrator role is required.",
      403,
      "forbidden",
    );
  }
  if (legacyAdmin)
    return { id: "legacy-configured-admin", role: "super_admin" };
  throw new CglApiError(
    "Sign in with an authorised CGS administrator account. CGL administration requires a configured strong admin session secret.",
    403,
    "forbidden",
  );
}
function permission(actor: CglActor, required: CglPermission) {
  if (!canCgl(actor.role, required))
    throw new CglApiError(
      "Your CGL administrator role does not allow this action.",
      403,
      "forbidden",
    );
}

function settingsMap(settings: CglData[]) {
  return Object.fromEntries(
    settings.map((row) => [String(row.key), row.value as CglData]),
  );
}
function publicPlan(plan: CglData) {
  const {
    code,
    name,
    price_cents,
    billing_interval,
    full_member,
    auto_renew,
    active,
  } = plan;
  return {
    code,
    name,
    price_cents,
    billing_interval,
    full_member,
    auto_renew,
    active,
  };
}
function publicProduct(item: CglData) {
  const {
    id,
    name,
    description,
    credit_price,
    retail_cents,
    cash_cents,
    stock,
    image_url,
    kind,
    fulfilment_method,
    available_from,
    available_until,
    restrictions,
  } = item;
  return {
    id,
    name,
    description,
    credit_price,
    retail_cents,
    cash_cents,
    stock,
    image_url,
    kind,
    fulfilment_method,
    available_from,
    available_until,
    restrictions,
  };
}
function publicStats(stats: unknown): CglData {
  if (!stats || typeof stats !== "object") return {};
  const source = stats as CglData,
    clean: CglData = {};
  for (const key of [
    "drive_metres",
    "average_drive_metres",
    "longest_drive_metres",
    "gir",
    "fir",
    "total_putts",
    "putting_distance_metres",
    "birdies",
    "eagles",
    "par_saves",
    "ctp_metres",
    "holes_completed",
  ]) {
    if (
      typeof source[key] === "number" &&
      Number.isFinite(source[key]) &&
      Number(source[key]) >= 0
    )
      clean[key] = source[key];
  }
  if (
    typeof source.ctp_verified_at === "string" &&
    Number.isFinite(Date.parse(source.ctp_verified_at))
  )
    clean.ctp_verified_at = source.ctp_verified_at;
  return clean;
}
function strokeIndexOrder(week: CglData) {
  const configured = (week.config as CglData | undefined)?.stroke_index_order;
  if (configured == null)
    return Array.from({ length: 18 }, (_, index) => index + 1);
  const order = z
    .array(z.number().int().min(1).max(18))
    .min(1)
    .max(18)
    .parse(configured);
  if (new Set(order).size !== order.length)
    throw new CglApiError("Countback stroke indices must be distinct.");
  return order;
}
function currentCalculations(calculations: CglData[], weeks: CglData[]) {
  const publishedWeeks = new Set(
    weeks.filter((week) => week.results_published).map((week) => week.id),
  );
  const latest = new Map<string, CglData>();
  for (const calculation of calculations
    .filter((row) => row.published_at && publishedWeeks.has(row.week_id))
    .sort((a, b) =>
      String(b.published_at).localeCompare(String(a.published_at)),
    )) {
    if (!latest.has(String(calculation.week_id)))
      latest.set(String(calculation.week_id), calculation);
  }
  return [...latest.values()];
}
function standingsFrom(
  calculations: CglData[],
  weeks: CglData[],
  members: CglData[],
) {
  const result: CglData[] = [];
  const bySeasonPlayer = new Map<
    string,
    {
      seasonId: string;
      memberId: string;
      division: string;
      weekly: { week: number; points: number | null; position: number | null }[];
    }
  >();
  for (const calculation of currentCalculations(calculations, weeks)) {
    const week = weeks.find((item) => item.id === calculation.week_id);
    if (!week?.championship_week) continue;
    for (const row of calculation.rows as CglData[]) {
      const memberId = String(row.playerId),
        key = `${week.season_id}:${memberId}`;
      const group = bySeasonPlayer.get(key) ?? {
        seasonId: String(week.season_id),
        memberId,
        division: String(row.division),
        weekly: [],
      };
      group.weekly.push({
        week: Number(week.championship_week),
        points: row.points == null ? null : Number(row.points),
        position: row.position == null ? null : Number(row.position),
      });
      bySeasonPlayer.set(key, group);
    }
  }
  for (const group of bySeasonPlayer.values()) {
    const summary = bestEightOfTen(group.weekly);
    const member = members.find((m) => m.id === group.memberId);
    if (!member?.sgt_username) continue;
    result.push({
      member_id: group.memberId,
      sgt_username: member.sgt_username,
      season_id: group.seasonId,
      division: group.division,
      handicap: member.handicap,
      total_points: summary.total,
      events_played: group.weekly.length,
      wins: group.weekly.filter((entry) => entry.position === 1).length,
      top_three: group.weekly.filter((entry) => entry.position != null && entry.position <= 3).length,
      rounds_counted: summary.roundsCounted,
      counted: summary.counted,
      discarded: summary.discarded,
      missing_weeks: summary.missingWeeks,
      pending: summary.hasPending,
      weekly: group.weekly,
    });
  }
  const managedSeasons = new Set(weeks.filter((week) => configOf(week).event_approved === true).map((week) => week.season_id));
  function compare(a: CglData,b: CglData) {
    const points = Number(b.total_points)-Number(a.total_points);
    if (points || a.season_id !== b.season_id || !managedSeasons.has(a.season_id)) return points;
    const positions = (record: CglData) => (record.weekly as { position: number | null }[]).map((entry) => entry.position);
    const left = positions(a), right = positions(b);
    for (const place of [...new Set([...left,...right].filter((value): value is number => value != null))].sort((x,y) => x-y)) {
      const difference = right.filter((p) => p===place).length-left.filter((p) => p===place).length;
      if (difference) return difference;
    }
    return 0;
  }
  result.sort(
    (a, b) =>
      compare(a,b) ||
      String(a.sgt_username).localeCompare(String(b.sgt_username)),
  );
  for (const row of result)
    row.position =
      1 +
      result.filter(
        (other) =>
          other.season_id === row.season_id &&
          other.division === row.division &&
          compare(other,row) < 0,
      ).length;
  for (const row of result) if (managedSeasons.has(row.season_id) && result.some((other) =>
    other !== row && other.season_id===row.season_id && other.division===row.division && other.position===row.position)) row.tiebreak_review = true;
  return result;
}

function publicSgtSnapshot(
  sgtConnections: CglData[],
  sgtTours: CglData[],
  sgtTournaments: CglData[],
) {
  const connection = sgtConnections[0];
  const sourceTimes = [
    ...sgtTours.map((tour) => String(tour.synced_at ?? "")),
    ...sgtTournaments.map((tournament) => String(tournament.synced_at ?? "")),
  ].filter((value) => Number.isFinite(Date.parse(value)));
  const sourceUpdatedAt = sourceTimes.toSorted().at(-1) ?? null;
  return {
    connection: connection
      ? {
          club_slug: connection.club_slug,
          club_id: connection.club_id,
          source_url: connection.source_url,
          status: connection.status,
          sync_enabled: connection.sync_enabled,
          live_sync_enabled: connection.live_sync_enabled,
          live_sync_interval_seconds: connection.live_sync_interval_seconds,
          last_sync_at: connection.last_sync_at,
          last_success_at: connection.last_success_at,
          last_live_sync_at: connection.last_live_sync_at,
          last_live_success_at: connection.last_live_success_at,
          source_updated_at: sourceUpdatedAt,
        }
      : null,
    tours: sgtTours.map((tour) => ({
      sgt_tour_id: tour.sgt_tour_id,
      name: tour.name,
      start_date: tour.start_date,
      end_date: tour.end_date,
      team_tour: tour.team_tour,
      active: tour.active,
      members: sanitizeSgtPublic(tour.members),
      teams: sanitizeSgtPublic(tour.teams),
      standings_gross: sanitizeSgtPublic(tour.standings_gross),
      standings_net: sanitizeSgtPublic(tour.standings_net),
      stats: sanitizeSgtPublic(tour.stats),
      synced_at: tour.synced_at,
    })),
    tournaments: sgtTournaments.map((tournament) => ({
      sgt_tournament_id: tournament.sgt_tournament_id,
      sgt_tour_id: tournament.sgt_tour_id,
      name: tournament.name,
      status: tournament.status,
      start_date: tournament.start_date,
      end_date: tournament.end_date,
      registration_start_date: tournament.registration_start_date,
      registration_end_date: tournament.registration_end_date,
      course_name: tournament.course_name,
      number_rounds: tournament.number_rounds,
      number_holes: tournament.number_holes,
      gameplay: tournament.gameplay,
      stableford: tournament.stableford,
      registrations: sanitizeSgtPublic(tournament.registrations),
      scorecards: sanitizeSgtPublic(tournament.scorecards),
      stats: sanitizeSgtPublic(tournament.stats),
      synced_at: tournament.synced_at,
    })),
  };
}

export async function getCglSgtPublicSnapshot() {
  const [connections, tours, tournaments] = await Promise.all([
    rows(
      "cgl_sgt_connections",
      {},
      "club_slug,club_id,source_url,status,sync_enabled,live_sync_enabled,live_sync_interval_seconds,last_sync_at,last_success_at,last_live_sync_at,last_live_success_at,updated_at",
    ),
    rows("cgl_sgt_tours"),
    rows("cgl_sgt_tournaments"),
  ]);
  return {
    status: "ready",
    sgt: publicSgtSnapshot(connections, tours, tournaments),
    updated_at: new Date().toISOString(),
  };
}

export async function getCglPublicSnapshot() {
  const [
    settings,
    plans,
    seasons,
    weeks,
    results,
    calculations,
    members,
    prizes,
    catalogue,
    sgtConnections,
    sgtTours,
    sgtTournaments,
  ] = await Promise.all([
    rows("cgl_settings"),
    rows("cgl_plans", { active: true }),
    rows("cgl_seasons"),
    rows("cgl_weeks"),
    rows("cgl_results", { state: "verified" }),
    rows("cgl_calculations"),
    rows("cgl_members", {}, "id,sgt_username,handicap"),
    rows("cgl_prizes"),
    rows("cgl_catalogue", { active: true }),
    rows(
      "cgl_sgt_connections",
      {},
      "club_slug,club_id,source_url,status,sync_enabled,live_sync_enabled,live_sync_interval_seconds,last_sync_at,last_success_at,last_live_sync_at,last_live_success_at,updated_at",
    ),
    rows("cgl_sgt_tours"),
    rows("cgl_sgt_tournaments"),
  ]);
  const visibleSeasons = seasons.filter((s) => s.status !== "draft");
  const seasonIds = new Set(visibleSeasons.map((s) => s.id));
  const visibleWeeks = weeks.filter(
    (w) => seasonIds.has(w.season_id) && w.status !== "draft",
  );
  const published = new Set(
    visibleWeeks.filter((w) => w.results_published).map((w) => w.id),
  );
  const handles = new Map(members.map((m) => [m.id, m.sgt_username]));
  const current = currentCalculations(calculations, visibleWeeks);
  const reviews = visibleSeasons.some(isSeasonOne) ? await rows("cgl_event_reviews") : [];
  const provisional = new Map(reviews.filter((review) => !published.has(review.week_id) && visibleWeeks.some((week) => week.id===review.week_id)).map((review) => [review.week_id,review]));
  const reviewedRows = new Map([...provisional.values()].map((review) => [review.week_id, new Set(
    ((calculations.find((calc) => calc.id===review.calculation_id)?.source_snapshot ?? []) as CglData[]).map((record) => `${record.id}:${record.updated_at}`),
  )]));
  const publicResults = results
    .filter((r) => (published.has(r.week_id) || reviewedRows.get(r.week_id)?.has(`${r.id}:${r.updated_at}`)) && handles.get(r.member_id))
    .map((r) => {
      const week = visibleWeeks.find((w) => w.id === r.week_id),
        calculation = current.find((c) => c.week_id === r.week_id);
      const points = (calculation?.rows as CglData[] | undefined)?.find(
        (row) => row.playerId === r.member_id,
      );
      return {
        id: r.id,
        week_id: r.week_id,
        season_id: week?.season_id,
        week_name: week?.name,
        sgt_username: handles.get(r.member_id),
        gross: r.gross,
        net: r.net,
        division: points?.division ?? r.division,
        handicap: r.handicap,
        position: points?.position ?? null,
        points: points?.points ?? null,
        scorecard_url: r.scorecard_url,
        source_url: r.source_url,
        holes: r.holes,
        stats: publicStats(r.stats),
        played_at: r.played_at,
        provisional: !published.has(r.week_id),
      };
    });
  const rawStandings = standingsFrom(calculations, visibleWeeks, members);
  const publicStandings = rawStandings.map(({ member_id, ...publicFields }) => {
    void member_id;
    return publicFields;
  });
  const config = settingsMap(settings);
  const annual: CglData[] = [];
  for (const year of [
    ...new Set(visibleSeasons.map((season) => Number(season.year))),
  ]) {
    const yearSeasons = new Set(
      visibleSeasons
        .filter((season) => Number(season.year) === year)
        .map((season) => season.id),
    );
    for (const member of members.filter((m) => m.sgt_username)) {
      const seasonPoints = rawStandings
        .filter(
          (s) => s.member_id === member.id && yearSeasons.has(s.season_id),
        )
        .map((s) => ({
          seasonId: String(s.season_id),
          points: Number(s.total_points),
        }));
      if (seasonPoints.length === 0) continue;
      annual.push({
        year,
        sgt_username: member.sgt_username,
        ...annualRanking(seasonPoints, {
          approved: config.annual_formula?.approved === true,
          method: ["sum", "best_seasons"].includes(
            String(config.annual_formula?.method),
          )
            ? (config.annual_formula.method as "sum" | "best_seasons")
            : "pending",
          countedSeasons: Number(config.annual_formula?.counted_seasons ?? 4),
        }),
      });
    }
  }
  annual.sort(
    (a, b) =>
      Number(b.year) - Number(a.year) ||
      Number(b.points ?? 0) - Number(a.points ?? 0),
  );
  for (const row of annual)
    row.position =
      row.status === "calculated"
        ? 1 +
          annual.filter(
            (other) =>
              other.year === row.year &&
              Number(other.points) > Number(row.points),
          ).length
        : null;
  const safeSeasons = visibleSeasons.map(
    ({
      id,
      slug,
      name,
      year,
      season_number,
      format,
      starts_at,
      ends_at,
      qualification_ends_at,
      status,
      config,
    }) => ({
      id,
      slug,
      name,
      year,
      season_number,
      format,
      starts_at,
      ends_at,
      qualification_ends_at,
      status,
      entry_opens_at: typeof (config as CglData | undefined)?.entry_opens_at === "string" ? (config as CglData).entry_opens_at : undefined,
      calendar_ends_at: typeof (config as CglData | undefined)?.calendar_ends_at === "string" ? (config as CglData).calendar_ends_at : undefined,
    }),
  );
  const safeWeeks = visibleWeeks.map(
    ({
      id,
      season_id,
      week_number,
      championship_week,
      name,
      phase,
      opens_at,
      closes_at,
      status,
      course_name,
      second_course_name,
      sgt_tournament_id,
      sgt_tour_id,
      results_published,
      config,
      conditions,
    }) => ({
      id,
      season_id,
      week_number,
      championship_week,
      name,
      phase,
      opens_at,
      closes_at,
      status,
      course_name,
      second_course_name,
      sgt_tournament_id,
      sgt_tour_id,
      results_published,
      review_until: provisional.get(id)?.review_until,
      ...((config as CglData | undefined)?.event_approved === true && visibleSeasons.some((season) => season.id===season_id && isSeasonOne(season)) ? {
        course_a: publicFixtureFields((config as CglData).course_a, ["segment", "tee", "verified", "par", "yards"]),
        course_b: publicFixtureFields((config as CglData).course_b, ["segment", "tee", "verified"]),
        sgt_tournament_b_id: typeof (config as CglData).sgt_tournament_b_id === "string" ? (config as CglData).sgt_tournament_b_id : undefined,
        conditions: { ...publicFixtureFields(conditions,["wind","greenFirmness","fairwayFirmness","greenSpeed","teeCategory"]),
          ...publicFixtureFields((config as CglData).verified_play_settings,["pins","putting","gimmies"]) },
      } : {}),
    }),
  );
  return {
    status: "ready",
    seasons: safeSeasons,
    weeks: safeWeeks,
    plans: plans.map(publicPlan),
    results: publicResults,
    standings: publicStandings,
    annual,
    players: members
      .filter((m) => m.sgt_username)
      .map((m) => ({ sgt_username: m.sgt_username, handicap: m.handicap })),
    prizes: prizes
      .filter(
        (p) =>
          ["awarded", "claimed"].includes(String(p.state)) &&
          seasonIds.has(p.season_id),
      )
      .map((p) => ({
        id: p.id,
        season_id: p.season_id,
        week_id: p.week_id,
        category: p.category,
        kind: p.kind,
        amount: p.amount,
        sgt_username: handles.get(p.member_id),
        state: p.state,
      })),
    catalogue: catalogue.map(publicProduct),
    settings: {
      divisions: config.divisions,
      annual_formula: config.annual_formula,
      gifts: config.gifts,
      points: config.points,
      rewards: {
        full: config.rewards?.full,
        casual: config.rewards?.casual,
        weekly_priority: config.rewards?.weekly_priority,
        credit_expiry_months: config.rewards?.credit_expiry_months,
      },
      prizes: {
        a_cash_cents: config.prizes?.a_cash_cents,
        b_credits: config.prizes?.b_credits,
        legal_approved: config.prizes?.legal_approved,
      },
      legal: { approved: config.legal?.approved === true },
    },
    sgt: publicSgtSnapshot(sgtConnections, sgtTours, sgtTournaments),
    updated_at: new Date().toISOString(),
  };
}

export async function getCglMemberSnapshot(identity: CglIdentity) {
  const memberId = identity.memberId ?? identity.id;
  const [
    memberRows,
    settings,
    memberships,
    payments,
    entries,
    divisions,
    results,
    lots,
    transactions,
    orders,
    gifts,
    notifications,
    catalogue,
    seasons,
    weeks,
    calculations,
    links,
    plans,
    giftItems,
  ] = await Promise.all([
    rows("cgl_members", { id: memberId }),
    rows("cgl_settings"),
    rows("cgl_memberships", { member_id: memberId }),
    rows("cgl_payments", { member_id: memberId }),
    rows("cgl_season_entries", { member_id: memberId }),
    rows("cgl_division_assignments", { member_id: memberId }),
    rows("cgl_results", { member_id: memberId }),
    rows("cgl_credit_lots", { member_id: memberId }),
    rows("cgl_credit_transactions", { member_id: memberId }),
    rows("cgl_orders", { member_id: memberId }),
    rows("cgl_gifts", { member_id: memberId }),
    rows("cgl_notifications", { member_id: memberId }),
    rows("cgl_catalogue", { active: true }),
    rows("cgl_seasons"),
    rows("cgl_weeks"),
    rows("cgl_calculations"),
    rows("cgl_sgt_link_requests", { member_id: memberId }),
    rows("cgl_plans"),
    rows("cgl_gift_items"),
  ]);
  const now = Date.now(),
    expiring = now + 30 * 86400000;
  const availableLots = lots.filter(
    (lot) => new Date(String(lot.expires_at)).getTime() > now,
  );
  const config = settingsMap(settings);
  const member = memberRows[0] ?? null;
  const trial =
    identity.appMetadata.cgl && typeof identity.appMetadata.cgl === "object"
      ? (identity.appMetadata.cgl as CglData)
      : null;
  const visibleSeasons = seasons.filter((s) => s.status !== "draft");
  const visibleWeeks = weeks.filter(
    (w) =>
      w.status !== "draft" && visibleSeasons.some((s) => s.id === w.season_id),
  );
  const current = currentCalculations(calculations, visibleWeeks);
  const enrichedResults = results.map((result) => {
    const week = weeks.find((w) => w.id === result.week_id),
      calculation = current.find((c) => c.week_id === result.week_id);
    const points = (calculation?.rows as CglData[] | undefined)?.find(
      (row) => row.playerId === memberId,
    );
    return {
      ...result,
      week_name: week?.name,
      season_id: week?.season_id,
      points: points?.points ?? null,
      position: points?.position ?? null,
    };
  });
  const managedSeason = visibleSeasons.find(isSeasonOne);
  const [managedCards, memberEnrolments] = member && managedSeason ? await Promise.all([
    rows("cgl_qualifying_cards",{season_id:managedSeason.id,member_id:memberId}),rows("cgl_event_enrolments",{member_id:memberId}),
  ]) : [[],[]];
  const verifiedCards = managedCards.filter((card)=>card.sgt_player_id===member?.sgt_id);
  const qualificationProgress = member && managedSeason ? {
    target: (verifiedCards[0] ? verifiedCards[0].path==="established" : member.handicap_status==="verified") ? 18 : 54,
    holes: verifiedCards.reduce((total,card)=>total+Number(card.holes),0),
    handicap_verified: member.handicap_status==="verified" && !!member.sgt_verified_at,
    rounds: visibleWeeks.filter((week)=>week.season_id===managedSeason.id && week.phase==="qualification").map((week)=>({
      name:week.name, verified:verifiedCards.some((card)=>card.week_id===week.id),
      enrolled:memberEnrolments.some((entry)=>entry.week_id===week.id && entry.state==="confirmed" && entry.sgt_player_id===member.sgt_id && JSON.stringify(entry.event_ids)===JSON.stringify(fixtureEventIds(week))),
    })),
  } : null;
  const roundAccess = member && managedSeason ? visibleWeeks.filter((week) => week.season_id===managedSeason.id && ["published","open"].includes(String(week.status)) && Date.parse(String(week.closes_at))+1000>now).map((week) => {
    const access = evaluateCglEligibility({member,memberships,entries:entries.filter((entry)=>entry.season_id===managedSeason.id),plans,season:managedSeason,week,
      at:new Date(now).toISOString(),ignoreEnrolment:false,cards:managedCards,enrolments:memberEnrolments.filter((item)=>item.week_id===week.id),divisions:divisions.filter((item)=>item.season_id===managedSeason.id)});
    return {week_id:week.id,name:week.name,opens_at:week.opens_at,closes_at:week.closes_at,eligible:access.eligible,reason:access.reason,
      event_ids:access.eligible ? fixtureEventIds(week) : []};
  }) : [];
  const fullMembership = memberships
    .filter(
      (m) =>
        !isCglSandboxRecord(m) &&
        ["annual", "monthly", "weekly"].includes(String(m.plan_code)) &&
        ["active", "cancel_scheduled"].includes(String(m.state)) &&
        m.paid_through &&
        Date.parse(String(m.paid_through)) > now,
    )
    .sort((a, b) => String(b.starts_at).localeCompare(String(a.starts_at)))[0];
  const giftRules = config.gifts;
  const giftEntitlements = visibleSeasons
    .filter(
      (s) =>
        s.starts_at &&
        s.ends_at &&
        Date.parse(String(s.starts_at)) <= now &&
        Date.parse(String(s.ends_at)) > now,
    )
    .map((season) => ({
      season_id: season.id,
      ...giftEligibility({
        planId: (fullMembership?.plan_code ??
          "casual_registration") as MembershipPlan["id"],
        active: Boolean(fullMembership) && member?.eligibility !== "suspended",
        seasonWeek: Math.max(
          1,
          Math.floor(
            (now - Date.parse(String(season.starts_at))) / (7 * 86400000),
          ) + 1,
        ),
        successfulPayments: payments.filter(
          (p) =>
            !isCglSandboxRecord(p) &&
            p.membership_id === fullMembership?.id &&
            p.state === "completed" &&
            Number(p.amount_cents) > 0,
        ).length,
        alreadyAllocated: gifts.some((g) => g.season_id === season.id),
        joinedMidSeason: Boolean(
          fullMembership?.starts_at &&
            Date.parse(String(fullMembership.starts_at)) >
              Date.parse(String(season.starts_at)),
        ),
        midSeasonPolicy:
          giftRules?.midseason_review_required === false ||
          (fullMembership?.metadata as CglData | undefined)
            ?.midseason_gift_approved === true
            ? "same_rules"
            : "review",
        seasonConditionsMet: member?.eligibility !== "suspended",
        minimumSeasonWeek: Number(giftRules?.annual_release_week ?? 5),
        monthlyPaymentsRequired: Number(giftRules?.monthly_payments ?? 2),
        weeklyPaymentsRequired: Number(giftRules?.weekly_payments ?? 5),
      }),
    }));
  return {
    status: "ready",
    joined: Boolean(member),
    member: member
      ? { ...member, private_notes: undefined }
      : {
          id: memberId,
          email: identity.email,
          display_name: identity.displayName,
          sgt_username: trial?.sgt_username ?? null,
          sgt_id: trial?.sgt_id ?? null,
          handicap: null,
          handicap_status: "unverified",
          qualifying_holes: 0,
        },
    memberships: memberships.filter((record) => !isCglSandboxRecord(record)),
    payments: payments.filter((record) => !isCglSandboxRecord(record)),
    entries: entries.filter((record) => !isCglSandboxRecord(record)),
    round_access: roundAccess,
    qualification_progress: qualificationProgress,
    billing: {
      environment: "sandbox",
      livePaymentsEnabled: false,
      memberships: memberships.filter(isCglSandboxRecord),
      payments: payments.filter(isCglSandboxRecord),
      cancellationPolicyApproved: config.cancellation_policy?.approved === true && config.legal?.approved === true,
    },
    divisions,
    results: enrichedResults,
    standings: member
      ? standingsFrom(calculations, visibleWeeks, [member])
      : [],
    credits: {
      available: availableLots.reduce(
        (sum, lot) => sum + Number(lot.remaining_amount),
        0,
      ),
      expiringSoon: availableLots
        .filter((lot) => new Date(String(lot.expires_at)).getTime() <= expiring)
        .reduce((sum, lot) => sum + Number(lot.remaining_amount), 0),
      lots,
      transactions,
    },
    orders,
    gifts: gifts.map((gift) => ({
      ...gift,
      created_at: gift.allocated_at,
      item_name: giftItems.find((item) => item.id === gift.gift_item_id)?.name,
    })),
    gift_eligibility: giftEntitlements,
    notifications,
    sgt_link_requests: links,
    catalogue: catalogue.map(publicProduct),
    plans: plans.map(publicPlan),
    seasons: visibleSeasons,
    weeks: visibleWeeks,
    settings: {
      cancellation_policy: config.cancellation_policy,
      annual_formula: config.annual_formula,
      gifts: config.gifts,
      legal: { approved: config.legal?.approved === true },
    },
  };
}

function planForRules(plan: CglData): MembershipPlan {
  const code = plan.code as MembershipPlan["id"];
  return {
    id: code,
    name: String(plan.name),
    priceCents: Number(plan.price_cents),
    currency: "AUD",
    recurring: plan.auto_renew === true,
    fullMembership: plan.full_member === true,
    interval:
      code === "annual" || code === "casual_registration"
        ? "year"
        : code === "monthly"
          ? "month"
          : code === "weekly"
            ? "week"
            : "season",
  };
}
async function cancellationFor(identity: CglIdentity, membershipId: string) {
  const membership = await one(
    "cgl_memberships",
    membershipId,
    identity.memberId ?? identity.id,
  );
  if (isCglSandboxRecord(membership))
    throw new CglApiError(
      "Sandbox cancellation requests remain disabled until the season-boundary terms and provider workflow are approved. Contact CGS to end a test subscription.",
      409,
      "policy_pending",
    );
  if (
    !membership.paid_through ||
    !["active", "past_due", "cancel_scheduled"].includes(
      String(membership.state),
    )
  )
    throw new CglApiError(
      "This membership does not have an active paid term to cancel.",
      409,
    );
  const [plans, settings, seasons] = await Promise.all([
    rows("cgl_plans", { code: membership.plan_code }),
    rows("cgl_settings"),
    rows("cgl_seasons"),
  ]);
  const config = settingsMap(settings),
    policy = config.cancellation_policy;
  const quote = cancellationQuote({
    plan: planForRules(plans[0]),
    requestedAt: new Date().toISOString(),
    paidThrough: String(membership.paid_through),
    nextBillingAt: membership.next_billing_at as string | null,
    billingAnchor: membership.starts_at as string | undefined,
    seasonBoundaries: seasons
      .filter(
        (s) =>
          ["published", "active", "closed"].includes(String(s.status)) &&
          s.ends_at,
      )
      .map((s) => String(s.ends_at)),
    policy: {
      mode: ["season_boundary", "immediate"].includes(String(policy?.mode))
        ? (policy.mode as "season_boundary" | "immediate")
        : "paid_term",
      approved: policy?.approved === true && config.legal?.approved === true,
    },
  });
  return {
    ...quote,
    membershipId,
    minimumCommitment: quote.futureAmountCents,
    policyApproved:
      policy?.approved === true && config.legal?.approved === true,
    policyVersion: String(policy?.version ?? "unapproved-draft"),
    rulesVersion: CGL_RULES_VERSION,
    providerManaged:
      Boolean(membership.square_subscription_id) &&
      (membership.metadata as CglData | null | undefined)?.environment ===
        "production",
  };
}
export async function executeCglMemberAction(
  identity: CglIdentity,
  body: CglData,
) {
  const action = text(60).parse(body.action);
  const memberId = identity.memberId ?? identity.id;
  if (action === "join") {
    const trial =
      identity.appMetadata.cgl && typeof identity.appMetadata.cgl === "object"
        ? (identity.appMetadata.cgl as CglData)
        : {};
    return rpc("cgl_claim_or_join_account", {
      p_account_id: identity.id,
      p_email: identity.email,
      p_display_name: identity.displayName,
      p_sgt_username:
        typeof trial.sgt_username === "string"
          ? sgtUsername.parse(trial.sgt_username)
          : null,
      p_sgt_id:
        typeof trial.sgt_id === "string"
          ? z.string().regex(/^\d{8,30}$/).parse(trial.sgt_id)
          : null,
      p_metadata: {
        source: "existing_cgs_auth",
        trial_membership: trial.membership_status === "trial",
      },
    });
  }
  if (action === "link_sgt")
    return rpc("cgl_command", {
      p_action: action,
      p_actor: identity.id,
      p_payload: {
        member_id: memberId,
        sgt_username: sgtUsername.parse(body.sgtUsername ?? body.sgt_username),
        sgt_id: z
          .string()
          .regex(
            /^\d{8,30}$/,
            "SGT IDs must be kept as strings of 8–30 digits.",
          )
          .parse(body.sgtId ?? body.sgt_id),
        reason: "Member requested SGT identity verification",
      },
    });
  if (action === "quote_cancellation")
    return cancellationFor(
      identity,
      uuid.parse(body.membershipId ?? body.membership_id),
    );
  if (action === "request_cancellation") {
    if (body.acknowledged !== true)
      throw new CglApiError(
        "Review and acknowledge the cancellation quote before submitting.",
      );
    const membershipId = uuid.parse(body.membershipId ?? body.membership_id),
      quote = await cancellationFor(identity, membershipId);
    const acceptedDate = z
        .string()
        .datetime({ offset: true })
        .parse(body.acceptedEffectiveAt),
      acceptedAmount = z
        .number()
        .int()
        .min(0)
        .parse(body.acceptedFutureAmountCents);
    if (
      Date.parse(acceptedDate) !== Date.parse(quote.effectiveAt) ||
      acceptedAmount !== quote.futureAmountCents
    )
      throw new CglApiError(
        "The cancellation disclosure has changed. Review a fresh quote before confirming.",
        409,
        "quote_changed",
      );
    const providerCancellation = quote.providerManaged
      ? await cancelCglSquareSubscription(
          memberId,
          membershipId,
          quote.effectiveAt,
        )
      : null;
    return rpc("cgl_command", {
      p_action: action,
      p_actor: identity.id,
      p_payload: {
        member_id: memberId,
        membership_id: membershipId,
        quote: { ...quote, providerCancellation },
        reason: reasonSchema.parse(body.reason),
      },
    });
  }
  if (action === "redeem")
    return {
      id: await rpc("cgl_redeem", {
        p_member_id: memberId,
        p_catalogue_id: uuid.parse(body.catalogueId ?? body.catalogue_id),
        p_quantity: z
          .number()
          .int()
          .min(1)
          .max(20)
          .parse(body.quantity ?? 1),
        p_request_key: idempotency.parse(body.requestKey ?? body.request_key),
      }),
    };
  if (action === "mark_notification_read")
    return rpc("cgl_command", {
      p_action: action,
      p_actor: identity.id,
      p_payload: {
        id: uuid.parse(body.id),
        member_id: memberId,
        reason: "Member read notification",
      },
    });
  if (action === "check_eligibility") {
    const week = await one(
      "cgl_weeks",
      uuid.parse(body.weekId ?? body.week_id),
    );
    const now = Date.now();
    if (
      !["published", "open"].includes(String(week.status)) ||
      !week.opens_at ||
      !week.closes_at ||
      Date.parse(String(week.opens_at)) > now ||
      Date.parse(String(week.closes_at)) <= now
    )
      return {
        eligible: false,
        reason: "This competition is not currently open for entry.",
        billingWarning: false,
      };
    return getCglEligibility(memberId, week);
  }
  throw new CglApiError("This member action is not supported.");
}

export async function getCglEligibility(
  memberId: string,
  week: CglData,
  at = new Date().toISOString(),
  ignoreEnrolment = false,
) {
  const [members, memberships, entries, plans, season] = await Promise.all([
    rows("cgl_members", { id: memberId }),
    rows("cgl_memberships", { member_id: memberId }),
    rows("cgl_season_entries", {
      member_id: memberId,
      season_id: week.season_id,
    }),
    rows("cgl_plans"),
    one("cgl_seasons", String(week.season_id)),
  ]);
  const [cards, enrolments, divisions] = isSeasonOne(season) ? await Promise.all([
    rows("cgl_qualifying_cards", { season_id: season.id, member_id: memberId }),
    ignoreEnrolment ? [] : rows("cgl_event_enrolments", { week_id: week.id, member_id: memberId }),
    rows("cgl_division_assignments", { season_id: season.id, member_id: memberId }),
  ]) : [[], [], []];
  return evaluateCglEligibility({ member: members[0], memberships, entries, plans, season, week, at, ignoreEnrolment, cards, enrolments, divisions });
}

function evaluateCglEligibility({ member, memberships, entries, plans, season, week, at, ignoreEnrolment, cards, enrolments, divisions }: {
  member?: CglData; memberships: CglData[]; entries: CglData[]; plans: CglData[]; season: CglData; week: CglData; at: string;
  ignoreEnrolment: boolean; cards: CglData[]; enrolments: CglData[]; divisions: CglData[];
}) {
  if (!member)
    return {
      eligible: false,
      reason: "A CGS member must join CGL first.",
      billingWarning: false,
      kind: "casual" as const,
    };
  const now = new Date(at).getTime();
  const managed = isSeasonOne(season);
  const qualifying = cards.filter((card) => card.sgt_player_id === member.sgt_id && Date.parse(String(card.played_at)) <= now);
  const holes = qualifying.reduce((sum, card) => sum + Number(card.holes), 0);
  const required = qualifying[0]?.path === "established" ? 18 : 54;
  const handicapEligible = week.phase === "qualification" || (member.handicap_status === "verified" && (!managed || holes >= required));
  function withEventGate<T extends ReturnType<typeof competitionEligibility>>(access: T, kind: "full" | "casual") {
    if (!managed || !access.eligible) return { ...access, kind };
    const blocked = (reason: string) => ({ ...access, kind, eligible: false, reason });
    if (season.status === "draft" || configOf(season).schedule_approved !== true || now < Date.parse(String(configOf(season).entry_opens_at)))
      return blocked("Season 1 entry is not open yet.");
    if (!member?.sgt_id || !member.sgt_verified_at) return blocked("Verify the player's unique SGT identity first.");
    if (week.phase === "championship" && !divisions.some((division) => division.locked_at && ["A", "B"].includes(String(division.division)))) return blocked("Assign and lock an A or B Grade division first.");
    if (ignoreEnrolment) return { ...access, kind };
    if (week.status === "draft" || now < Date.parse(String(week.opens_at)) || now >= Date.parse(String(week.closes_at)) + 1000) return blocked("This round is outside its published play window.");
    if (!enrolments.some((record) => record.state === "confirmed" && record.sgt_player_id === member.sgt_id &&
      JSON.stringify(record.event_ids) === JSON.stringify(fixtureEventIds(week)) && Date.parse(String(record.confirmed_at)) <= now)) return blocked("Awaiting confirmed enrolment in SGT.");
    return { ...access, kind };
  }
  const membership = memberships
    .filter(
      (m) =>
        !isCglSandboxRecord(m) &&
        plans.some((p) => p.code === m.plan_code && p.full_member) &&
        m.starts_at &&
        new Date(String(m.starts_at)).getTime() <= now &&
        (!m.cancel_effective_at ||
          new Date(String(m.cancel_effective_at)).getTime() > now),
    )
    .sort((a, b) => String(b.starts_at).localeCompare(String(a.starts_at)))[0];
  if (membership) {
    const failedAt = membership.failed_at
      ? new Date(String(membership.failed_at)).getTime()
      : null;
    const failedBeforePlay =
      failedAt != null && failedAt <= now && membership.state === "past_due";
    const seasonStart = season.starts_at
      ? new Date(String(season.starts_at)).getTime()
      : null;
    const failedWeek =
      failedBeforePlay && seasonStart != null
        ? Math.max(
            1,
            Math.floor((failedAt! - seasonStart) / (7 * 86400000)) + 1,
          )
        : failedBeforePlay
          ? 1
          : null;
    const paidBeforePlay =
      Boolean(membership.paid_through) &&
      new Date(String(membership.paid_through)).getTime() > now;
    const historicalPaid =
      now < Date.now() - 1000 &&
      paidBeforePlay &&
      ["cancelled", "expired"].includes(String(membership.state));
    return withEventGate(competitionEligibility({
        kind: "full",
        active:
          Boolean(membership.paid_through) &&
          (["active", "past_due", "cancel_scheduled"].includes(
            String(membership.state),
          ) ||
            historicalPaid),
        now: at,
        paidThrough: membership.paid_through as string | null,
        competitionWeek: Number(week.week_number),
        failedPaymentWeek: failedWeek,
        paymentConfirmed: !failedBeforePlay,
        suspended: member.eligibility === "suspended",
        handicapEligible,
      }), "full");
  }
  const registration = memberships.find(
    (m) =>
      !isCglSandboxRecord(m) &&
      m.plan_code === "casual_registration" &&
      m.state === "active" &&
      m.paid_through &&
      new Date(String(m.paid_through)).getTime() > now,
  );
  return withEventGate(competitionEligibility({
      kind: "casual",
      active: Boolean(registration),
      now: at,
      competitionWeek: Number(week.week_number),
      casualRegistrationExpiresAt: registration?.paid_through as string | null,
      seasonEntryPaid: entries.some((e) => !isCglSandboxRecord(e) && e.state === "active" && e.paid_at && (!managed || Date.parse(String(e.paid_at)) <= now)),
      suspended: member.eligibility === "suspended",
      handicapEligible,
    }), "casual");
}

export async function getCglAdminSnapshot(actor: CglActor) {
  permission(actor, "manage_results");
  const names = [
    "settings",
    "plans",
    "seasons",
    "weeks",
    "members",
    "memberships",
    "payments",
    "season_entries",
    "division_assignments",
    "results",
    "imports",
    "calculations",
    "prizes",
    "credit_lots",
    "credit_transactions",
    "catalogue",
    "orders",
    "gift_items",
    "gifts",
    "notifications",
    "audit_events",
    "sgt_link_requests",
    "square_checkout_intents",
    "square_webhook_events",
    "square_invoice_states",
    "square_season_entitlements",
    "sgt_tours",
    "sgt_tournaments",
    "sgt_sync_runs",
  ];
  const [values, sgtConnections] = await Promise.all([
    Promise.all(names.map((name) => rows(`cgl_${name}`))),
    rows(
      "cgl_sgt_connections",
      {},
      "club_slug,club_id,source_url,status,api_key_expires_at,sync_enabled,sync_interval_minutes,last_refresh_at,last_sync_started_at,last_sync_at,last_success_at,last_error,updated_at",
    ),
  ]);
  const snapshot = Object.fromEntries(
    names.map((name, index) => [name, values[index]]),
  );
  snapshot.sgt_connections = sgtConnections;
  const managedSeason = snapshot.seasons.find(isSeasonOne);
  if (managedSeason) {
    const [reviews, disputes, cards, enrolments] = await Promise.all([
      rows("cgl_event_reviews"), rows("cgl_event_disputes"),
      actor.role === "results_admin" ? [] : rows("cgl_qualifying_cards", {season_id:managedSeason.id}),
      actor.role === "results_admin" ? [] : rows("cgl_event_enrolments"),
    ]);
    snapshot.event_reviews = reviews;
    snapshot.event_disputes = disputes;
    snapshot.qualifying_cards = cards;
    snapshot.event_enrolments = enrolments;
    if (actor.role !== "results_admin") {
      const byMember = (records: CglData[]) => {
        const groups = new Map<unknown,CglData[]>();
        for (const record of records) groups.set(record.member_id,[...(groups.get(record.member_id) ?? []),record]);
        return groups;
      };
      const now = new Date().toISOString();
      const memberships = byMember(snapshot.memberships), entries = byMember(snapshot.season_entries.filter((entry) => entry.season_id === managedSeason.id));
      const qualifications = byMember(cards), divisions = byMember(snapshot.division_assignments.filter((record) => record.season_id===managedSeason.id));
      snapshot.enrolment_queue = snapshot.weeks.filter((week) => week.season_id===managedSeason.id && ["open","published"].includes(String(week.status)) && Date.parse(String(week.closes_at))+1000>Date.parse(now)).flatMap((week) => {
        const marked = byMember(enrolments.filter((record) => record.week_id===week.id));
        return snapshot.members.filter((member) => memberships.has(member.id) || entries.has(member.id)).map((member) => {
          const division = divisions.get(member.id) ?? [];
          const access = evaluateCglEligibility({ member, season:managedSeason, week, at:now, ignoreEnrolment:true, enrolments:[],
            memberships:memberships.get(member.id) ?? [],entries:entries.get(member.id) ?? [],plans:snapshot.plans,cards:qualifications.get(member.id) ?? [],divisions:division });
          const state = marked.get(member.id)?.[0];
          const confirmed = state?.state === "confirmed" && state.sgt_player_id === member.sgt_id && JSON.stringify(state.event_ids)===JSON.stringify(fixtureEventIds(week));
          return { week_id:week.id, member_id:member.id, sgt_player_id:member.sgt_id, player:member.sgt_username ?? member.display_name,
            division:division[0]?.division, event_ids:fixtureEventIds(week), state:!access.eligible ? "blocked" : confirmed ? "confirmed" : state?.state==="confirmed" ? "needs_recheck" : state?.state ?? "ready",
            reason:access.eligible ? null : access.reason, account_optional: !member.account_id };
        });
      });
    }
  }
  if (actor.role === "results_admin") {
    return {
      status: "ready",
      role: actor.role,
      seasons: snapshot.seasons,
      weeks: snapshot.weeks,
      results: snapshot.results,
      imports: snapshot.imports,
      calculations: snapshot.calculations,
      members: snapshot.members.map(
        ({
          id,
          sgt_username,
          handicap,
          handicap_status,
          qualifying_holes,
          eligibility,
        }) => ({
          id,
          sgt_username,
          handicap,
          handicap_status,
          qualifying_holes,
          eligibility,
        }),
      ),
      division_assignments: snapshot.division_assignments,
      settings: snapshot.settings.filter((s) =>
        ["points", "divisions", "sgt"].includes(String(s.key)),
      ),
      sgt_connections: snapshot.sgt_connections,
      sgt_tours: snapshot.sgt_tours,
      sgt_tournaments: snapshot.sgt_tournaments,
      sgt_sync_runs: snapshot.sgt_sync_runs,
      event_reviews: snapshot.event_reviews,
      event_disputes: snapshot.event_disputes,
    };
  }
  const now = Date.now(),
    year = new Date().getUTCFullYear();
  const outstanding = snapshot.credit_lots
    .filter((l) => new Date(String(l.expires_at)).getTime() > now)
    .reduce((sum, l) => sum + Number(l.remaining_amount), 0);
  const completePayments = snapshot.payments.filter((p) =>
    !isCglSandboxRecord(p) && ["completed", "refunded"].includes(String(p.state)),
  );
  const annualPayments = completePayments.filter(
    (p) =>
      new Date(String(p.paid_at ?? p.created_at)).getUTCFullYear() === year,
  );
  const config = settingsMap(snapshot.settings),
    conversion = Number(config.rewards?.credits_per_aud ?? 2);
  return {
    status: "ready",
    role: actor.role,
    ...snapshot,
    memberships: snapshot.memberships.filter((record) => !isCglSandboxRecord(record)),
    payments: snapshot.payments.filter((record) => !isCglSandboxRecord(record)),
    season_entries: snapshot.season_entries.filter((record) => !isCglSandboxRecord(record)),
    billing: {
      environment: "sandbox",
      livePaymentsEnabled: false,
      memberships: snapshot.memberships.filter(isCglSandboxRecord),
      payments: snapshot.payments.filter(isCglSandboxRecord),
      checkouts: snapshot.square_checkout_intents,
      events: snapshot.square_webhook_events,
      invoices: snapshot.square_invoice_states,
      seasonEntitlements: snapshot.square_season_entitlements,
    },
    settings_map: config,
    standings: standingsFrom(
      snapshot.calculations,
      snapshot.weeks,
      snapshot.members,
    ),
    overview: {
      registered_players: snapshot.members.length,
      active_subscribers: snapshot.memberships.filter(
        (m) =>
          !isCglSandboxRecord(m) &&
          ["active", "cancel_scheduled"].includes(String(m.state)) &&
          ["annual", "monthly", "weekly"].includes(String(m.plan_code)) &&
          new Date(String(m.paid_through)).getTime() > now,
      ).length,
      casual_entrants: new Set(
        snapshot.season_entries
          .filter((e) => !isCglSandboxRecord(e) && e.state === "active" && e.paid_at)
          .map((e) => e.member_id),
      ).size,
      failed_payments: snapshot.payments.filter((p) => !isCglSandboxRecord(p) && p.state === "failed")
        .length,
      pending_prizes: snapshot.prizes.filter((p) =>
        ["pending", "verified", "approved"].includes(String(p.state)),
      ).length,
      upcoming_gifts: snapshot.gifts.filter((g) =>
        ["allocated", "ready"].includes(String(g.state)),
      ).length,
      credits_outstanding: outstanding,
      annual_revenue_cents: annualPayments.reduce(
        (sum, p) =>
          sum +
          Math.max(
            0,
            Number(p.amount_cents) -
              Number(
                (p.metadata as CglData | undefined)?.refunded_cents ??
                  (p.state === "refunded" ? p.amount_cents : 0),
              ),
          ),
        0,
      ),
      processing_fees_cents: annualPayments.reduce(
        (sum, p) => sum + Number(p.fee_cents),
        0,
      ),
      maximum_redemption_value_cents: Math.ceil(
        (outstanding * 100) / conversion,
      ),
      actual_merchandise_cost_cents:
        snapshot.orders
          .filter((o) => ["dispatched", "collected"].includes(String(o.state)))
          .reduce(
            (sum, o) => sum + Number(o.unit_cost_cents) * Number(o.quantity),
            0,
          ) +
        snapshot.gifts
          .filter((g) => ["dispatched", "collected"].includes(String(g.state)))
          .reduce((sum, g) => sum + Number(g.unit_cost_cents), 0),
      credits_issued: snapshot.credit_transactions
        .filter((t) => t.kind === "issue")
        .reduce((sum, t) => sum + Number(t.amount), 0),
      credits_redeemed: -snapshot.credit_transactions
        .filter((t) => t.kind === "redeem")
        .reduce((sum, t) => sum + Number(t.amount), 0),
      credits_expired: -snapshot.credit_transactions
        .filter((t) => t.kind === "expire")
        .reduce((sum, t) => sum + Number(t.amount), 0),
      revenue_classification: "confirmed_paid_transactions",
      forecasts:
        "Planning assumptions are stored separately in Settings; scheduled subscriptions are not collected income.",
    },
  };
}

const seasonSchema = z
  .object({
    id: uuid.optional(),
    slug: text(80).regex(/^[a-z0-9-]+$/),
    name: text(120),
    year: z.number().int().min(2027).max(2100),
    season_number: z.number().int().min(1).max(4),
    format: z.enum(["aggregate", "redemption", "world_tour", "elements"]),
    starts_at: z.string().datetime({ offset: true }).nullable().optional(),
    ends_at: z.string().datetime({ offset: true }).nullable().optional(),
    qualification_ends_at: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional(),
    status: z
      .enum([
        "draft",
        "registration",
        "published",
        "active",
        "closed",
        "archived",
      ])
      .default("draft"),
    config: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
const weekSchema = z
  .object({
    id: uuid.optional(),
    season_id: uuid,
    week_number: z.number().int().min(1).max(13),
    championship_week: z.number().int().min(1).max(10).nullable().optional(),
    name: text(120),
    phase: z.enum(["qualification", "championship"]),
    opens_at: z.string().datetime({ offset: true }).nullable().optional(),
    closes_at: z.string().datetime({ offset: true }).nullable().optional(),
    status: z
      .enum([
        "draft",
        "published",
        "open",
        "closed",
        "verified",
        "locked",
        "archived",
      ])
      .default("draft"),
    course_name: z.string().max(150).nullable().optional(),
    second_course_name: z.string().max(150).nullable().optional(),
    sgt_tournament_id: z.string().regex(/^\d+$/).nullable().optional(),
    sgt_tour_id: z.string().regex(/^\d+$/).nullable().optional(),
    conditions: z.record(z.string(), z.unknown()).default({}),
    config: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
const planSchema = z
  .object({
    code: z.enum([
      "annual",
      "monthly",
      "weekly",
      "casual_registration",
      "casual_season",
    ]),
    name: text(120),
    price_cents: z.number().int().min(1).max(1000000),
    billing_interval: z.enum(["annual", "monthly", "weekly", "once"]),
    full_member: z.boolean(),
    auto_renew: z.boolean(),
    active: z.boolean(),
    config: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
const catalogueSchema = z
  .object({
    id: uuid.optional(),
    name: text(150),
    description: z.string().max(2000).default(""),
    credit_price: z.number().int().positive().max(1000000),
    retail_cents: z.number().int().min(0).default(0),
    cost_cents: z.number().int().min(0).default(0),
    cash_cents: z.number().int().min(0).default(0),
    stock: z.number().int().min(0).max(100000),
    image_url: z.string().url().startsWith("https://").nullable().optional(),
    kind: z
      .enum(["physical", "season_discount", "membership_discount"])
      .default("physical"),
    fulfilment_method: z
      .enum(["pickup", "dispatch", "digital"])
      .default("pickup"),
    active: z.boolean().default(false),
    available_from: z.string().datetime({ offset: true }).nullable().optional(),
    available_until: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional(),
    restrictions: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
const giftItemSchema = z
  .object({
    id: uuid.optional(),
    season_id: uuid,
    name: text(120),
    unit_cost_cents: z.number().int().min(0),
    stock: z.number().int().min(0),
    active: z.boolean().default(true),
    config: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

async function importResults(actor: CglActor, body: CglData, reason: string) {
  const weekId = uuid.parse(body.weekId ?? body.week_id),
    week = await one("cgl_weeks", weekId),
    season = await one("cgl_seasons", String(week.season_id));
  if (week.status === "draft" || season.status === "draft")
    throw new CglApiError(
      "Publish the competition fixture before importing official rounds.",
      409,
    );
  const source = sourceUrl.parse(body.sourceUrl ?? body.source_url);
  const managed = isSeasonOne(season);
  if (managed && week.phase === "qualification")
    throw new CglApiError("Use the verified 18-hole qualifier import in Season 1 launch. Qualifiers do not enter championship results.", 409);
  if (week.sgt_tournament_id) {
    const tournament = new URL(source).pathname.match(
      /^\/(?:tournament|scorecard|embed\/tournament)\/(\d+)(?:\/|$)/,
    )?.[1];
    if (!tournament || !fixtureEventIds(week).includes(tournament))
      throw new CglApiError(
        "The source URL must match this fixture's official SGT tournament.",
        409,
      );
  }
  const attemptSchema = z
    .object({
      id: text(120),
      courseId: text(150),
      conditionsId: z.string().max(120).nullable().optional(),
      holesCompleted: z.literal(9),
      gross: z.number().positive().max(200),
      net: z.number().min(-100).max(200),
      eligible: z.literal(true),
      verified: z.literal(true),
      sgtPlayerId: z.string().regex(/^\d{8,30}$/).optional(),
      tournamentId: z.string().regex(/^\d+$/).optional(),
      nine: z.enum(["front_9","back_9"]).optional(),
      playedAt: z.string().datetime({ offset: true }).optional(),
      scorecardUrl: sourceUrl.optional(),
      holes: z
        .array(
          z.object({
            strokeIndex: z.number().int().min(1).max(18),
            net: z.number().min(-10).max(30),
            gross: z.number().min(1).max(30),
            segment: z.number().int().min(1).max(2).optional(),
          }),
        )
        .max(9)
        .optional(),
    })
    .strict();
  const statsSchema = z
    .object({
      average_drive_metres: z.number().min(0).max(1000).optional(),
      longest_drive_metres: z.number().min(0).max(1000).optional(),
      drive_metres: z.number().min(0).max(1000).optional(),
      gir: z.number().min(0).max(100).optional(),
      fir: z.number().min(0).max(100).optional(),
      total_putts: z.number().int().min(0).max(500).optional(),
      putting_distance_metres: z.number().min(0).max(10000).optional(),
      birdies: z.number().int().min(0).max(18).optional(),
      eagles: z.number().int().min(0).max(18).optional(),
      par_saves: z.number().int().min(0).max(18).optional(),
      ctp_metres: z.number().min(0).max(1000).optional(),
      ctp_verified_at: z.string().datetime({ offset: true }).optional(),
      ctp_hole: z.string().optional(),
      ctp_first_shot: z.literal(true).optional(),
    })
    .passthrough();
  const resultSchema = z
    .object({
      member_id: uuid,
      external_id: text(160),
      scorecard_url: sourceUrl.nullable().optional(),
      played_at: z.string().datetime({ offset: true }),
      handicap: z.number().min(-20).max(54),
      attempts: z.array(attemptSchema).length(2),
      stats: statsSchema.default({}),
    })
    .strict();
  const incoming = z.array(resultSchema).min(1).max(500).parse(body.rows);
  const divisions = await rows("cgl_division_assignments", {
    season_id: week.season_id,
  });
  const normalised: CglData[] = [];
  for (const result of incoming) {
    const played = Date.parse(result.played_at);
    const latest = Date.parse(String(week.closes_at)) + (managed ? 1000 : 0);
    if (
      played > Date.now() ||
      !week.opens_at ||
      !week.closes_at ||
      played < Date.parse(String(week.opens_at)) ||
      played >= latest
    )
      throw new CglApiError(
        "The official completion timestamp must be within this fixture's published window. An administrator can record a deadline extension first.",
        409,
      );
    if (
      result.stats.ctp_verified_at &&
      (Date.parse(result.stats.ctp_verified_at) <
        Date.parse(String(week.opens_at)) ||
        Date.parse(result.stats.ctp_verified_at) > played)
    )
      throw new CglApiError(
        "The verified CTP timestamp must fall inside the eligible round window and no later than its completion.",
        409,
      );
    const assignment = divisions.find((d) => d.member_id === result.member_id);
    if (week.phase === "championship" && !assignment?.locked_at)
      throw new CglApiError(
        "Lock each player's season division before importing championship results.",
        409,
      );
    const score = scoreCompetition(
      season.format as Parameters<typeof scoreCompetition>[0],
      result.attempts as NineHoleAttempt[],
      { strokeIndexOrder: strokeIndexOrder(week) },
    );
    if (managed) {
      const member = await one("cgl_members", result.member_id);
      const eventIds = fixtureEventIds(week);
      const mapped = [configOf(week).course_a, configOf(week).course_b] as CglData[];
      const finishes: number[] = [];
      for (const [index, attempt] of result.attempts.entries()) {
        const completed = Date.parse(attempt.playedAt ?? "");
        if (!member.sgt_verified_at || !attempt.sgtPlayerId || attempt.sgtPlayerId !== member.sgt_id ||
          !attempt.scorecardUrl || attempt.courseId !== mapped[index]?.sgtCourseId || attempt.nine !== mapped[index]?.segment ||
          attempt.tournamentId !== (eventIds[index] ?? eventIds[0]) || !Number.isFinite(completed) ||
          completed < Date.parse(String(week.opens_at)) || completed >= latest || completed > Date.now()) {
          throw new CglApiError("Provide both official cards in Course A / B order with the verified SGT player, event, course, nine and completion time.", 409);
        }
        const access = await getCglEligibility(result.member_id,week,attempt.playedAt);
        if (!access.eligible) throw new CglApiError(access.reason ?? "The golfer was not eligible at play time.", 409);
        finishes.push(completed);
      }
      if (new Set(result.attempts.map((a) => a.scorecardUrl)).size !== 2 || Math.max(...finishes) !== played)
        throw new CglApiError("Use two distinct official scorecards and the later completion timestamp.", 409);
      if (result.stats.ctp_metres != null && (result.stats.ctp_first_shot !== true || !result.stats.ctp_verified_at || result.stats.ctp_hole !== configOf(week).ctp_hole))
        throw new CglApiError("CTP requires a verified first shot on the designated par three.", 409);
    }
    if (score.status !== "complete")
      throw new CglApiError(
        score.reason ?? "Verified complete source attempts are required.",
        409,
      );
    const eligible = await getCglEligibility(
      result.member_id,
      week,
      result.played_at,
    );
    if (!eligible.eligible)
      throw new CglApiError(
        `SGT result ${result.external_id}: ${eligible.reason}`,
        409,
        "ineligible",
      );
    const counted = result.attempts.filter((attempt) =>
      score.countedAttemptIds.includes(attempt.id),
    );
    normalised.push({
      ...result,
      gross: score.gross,
      net: score.net,
      division: assignment?.division ?? null,
      holes: counted.flatMap((attempt, index) =>
        (attempt.holes ?? []).map((hole) => ({ ...hole, segment: index + 1 })),
      ),
      stats: { ...result.stats, membership_kind: eligible.kind },
      counted_attempt_ids: score.countedAttemptIds,
    });
  }
  if (new Set(normalised.map((r) => r.member_id)).size !== normalised.length)
    throw new CglApiError("Import one combined weekly result per player.");
  const checksum = createHash("sha256")
    .update(JSON.stringify({ weekId, source, normalised }))
    .digest("hex");
  return rpc("cgl_import_results", {
    p_week_id: weekId,
    p_source_url: source,
    p_checksum: checksum,
    p_rows: normalised,
    p_actor: actor.id,
    p_reason: reason,
    p_correction: body.correction === true,
  });
}

async function recalculate(actor: CglActor, weekId: string, publish: boolean) {
  const [week, results, settings, divisions] = await Promise.all([
    one("cgl_weeks", weekId),
    rows("cgl_results", { week_id: weekId }),
    rows("cgl_settings"),
    rows("cgl_division_assignments"),
  ]);
  const managed = isSeasonOne(await one("cgl_seasons", String(week.season_id)));
  const verified = results.filter((r) => r.state === "verified"),
    config = settingsMap(settings);
  if (verified.length === 0)
    throw new CglApiError(
      "Verify at least one real result before calculating points.",
      409,
    );
  const inputs: CompetitionResult[] = [];
  for (const result of verified) {
    const assignment = divisions.find(
      (d) => d.member_id === result.member_id && d.season_id === week.season_id,
    );
    if (!assignment?.locked_at)
      throw new CglApiError(
        "A locked division is required for every championship player.",
        409,
      );
    const stats = result.stats as CglData;
    if (!["full", "casual"].includes(String(stats.membership_kind)))
      throw new CglApiError(
        "Verify each player's membership classification at the eligible competition date.",
        409,
      );
    inputs.push({
      playerId: String(result.member_id),
      division: assignment.division as CompetitionResult["division"],
      gross: Number(result.gross),
      net: Number(result.net),
      verified: true,
      eligible: true,
      holes: result.holes as CompetitionResult["holes"],
      membership: stats.membership_kind as "full" | "casual",
      ctpMetres: typeof stats.ctp_metres === "number" ? stats.ctp_metres : null,
      ctpVerifiedAt:
        typeof stats.ctp_verified_at === "string"
          ? stats.ctp_verified_at
          : null,
      completedAt: typeof result.played_at === "string" ? result.played_at : undefined,
    });
  }
  const pointsSetting = config.points;
  const pointsTable: PointsTable = pointsSetting
    ? {
        version: String(pointsSetting.version),
        name: "CGL configured placement table",
        sourceUrl: String(pointsSetting.source),
        approved: pointsSetting.approved === true,
        values: z
          .array(z.number().min(0))
          .min(10)
          .max(200)
          .parse(pointsSetting.table),
      }
    : CGL_DEFAULT_POINTS_TABLE;
  if (publish && !pointsTable.approved)
    throw new CglApiError(
      "An administrator must review and approve the versioned points table before publishing championship results.",
      409,
    );
  const countback = strokeIndexOrder(week);
  const points = calculateDivisionPoints(inputs, pointsTable, countback, managed);
  const rewards = config.rewards;
  const awards = selectWeeklyAwards(inputs, {
    verified: true,
    published: publish || managed,
    weekId,
    priority: (managed ? ["net","gross","ctp"] : rewards?.weekly_priority ?? [
      "net",
      "gross",
      "ctp",
    ]) as WeeklyAwardCategory[],
    casualCredits: (managed ? CGL_SEASON_ONE_CREDITS.casual : rewards?.casual ?? {
      net: 10,
      gross: 10,
      ctp: 5,
    }) as Record<WeeklyAwardCategory, number>,
    fullMultiplier: managed ? 2 : Number(rewards?.full_multiplier ?? 2),
    strokeIndexOrder: countback,
    secondNineFirst: managed,
  });
  const configuredAwards = awards.awards.map((award) => ({
    ...award,
    credits:
      !managed && award.membership === "full" &&
      (rewards?.full as CglData | undefined)?.[award.category] != null
        ? Number((rewards.full as CglData)[award.category])
        : award.credits,
  }));
  const snapshot = verified
    .map((r) => ({ id: r.id, updated_at: r.updated_at }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const calculation = {
    rules_version: managed ? CGL_SEASON_ONE_RULES : CGL_RULES_VERSION,
    points_version: pointsTable,
    source_snapshot: snapshot,
    rows: points.rows,
    awards: awards.manualReview ? [] : configuredAwards,
    manual_review: points.manualReview || awards.manualReview,
  };
  const id = await rpc("cgl_publish_calculation", {
    p_week_id: weekId,
    p_calculation: calculation,
    p_actor: actor.id,
    p_publish: publish,
  });
  return {
    id,
    ...calculation,
    message: calculation.manual_review
      ? "Verified detail is missing for a tie. Resolve it before publication."
      : publish
        ? "Verified results and eligible weekly credits published."
        : "Points calculated; results remain unpublished.",
  };
}

export async function executeCglAdminAction(actor: CglActor, body: CglData) {
  const action = text(60).parse(body.action),
    reason = reasonSchema.parse(body.reason);
  if (action === "seed_season_one") {
    permission(actor, "manage_seasons");
    const draft = buildCglSeasonOneAdminDraft();
    return rpc("cgl_seed_season_one", { p_season: draft.season, p_weeks: draft.weeks, p_actor: actor.id, p_reason: reason });
  }
  if (action === "approve_season_one_schedule" || action === "approve_season_one_prizes") {
    permission(actor, action === "approve_season_one_prizes" ? "manage_rewards" : "manage_seasons");
    const season = await one("cgl_seasons", uuid.parse(body.seasonId));
    if (!isSeasonOne(season) || body.approved !== true) throw new CglApiError("Explicit approval of the Season 1 draft is required.");
    const config = configOf(season);
    const prize = action === "approve_season_one_prizes";
    const rules = prize ? { prize_cents: CGL_CASH_PRIZE_CENTS.seasonal } : {
      schedule_approved: true,
      entry_opens_at: z.string().datetime({ offset: true }).parse(body.entryOpensAt),
      calendar_ends_at: z.string().datetime({ offset: true }).parse(body.calendarEndsAt),
    };
    if (!prize && !(Date.parse(String(rules.entry_opens_at)) < Date.parse(String(season.starts_at)) &&
      Date.parse(String(rules.calendar_ends_at)) >= Date.parse(String(season.starts_at)) &&
      Date.parse(String(rules.calendar_ends_at)) <= Date.parse(String(season.ends_at)))) throw new CglApiError("Entry, season calendar and submission deadline must be in order.");
    return rpc("cgl_admin_save", { p_entity: "season", p_record: { id: season.id, config: { ...config, ...rules } }, p_actor: actor.id, p_reason: reason });
  }
  if (action === "verify_season_one_event") {
    permission(actor, "manage_seasons");
    const week = await one("cgl_weeks", uuid.parse(body.weekId));
    const season = await one("cgl_seasons", String(week.season_id));
    if (!isSeasonOne(season) || week.status !== "draft" || body.approved !== true || !week.opens_at || !week.closes_at) throw new CglApiError("Explicitly verify the event while this fixture is a Season 1 draft with exact play windows.");
    const eventId = z.string().regex(/^\d{1,15}$/);
    const aId = eventId.parse(body.eventA);
    const bId = body.eventB == null || body.eventB === "" ? undefined : eventId.parse(body.eventB);
    if (aId === bId) throw new CglApiError("For one shared SGT event, leave the second event blank.");
    const tournaments = await rows("cgl_sgt_tournaments");
    if (![aId, ...(bId ? [bId] : [])].every((id) => tournaments.some((t) => String(t.sgt_tournament_id) === id)))
      throw new CglApiError("Both SGT event references must already be present in the synced club cache.", 409);
    if (week.phase === "qualification") {
      const planned = CGL_SEASON_ONE_PLAN.rounds.find((round) => round.phase === "qualification" && round.weekNumber === week.week_number)?.courses[0];
      const tournament = tournaments.find((item) => String(item.sgt_tournament_id) === aId)!;
      const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const day = (value: unknown) => new Date(Date.parse(String(value)) + 36_000_000).toISOString().slice(0, 10);
      const holeCount = String(tournament.number_holes ?? "").trim();
      if (!planned || !planned.par || aId !== CGL_QUALIFIER_SGT_EVENTS[Number(week.week_number)-1] || String(tournament.sgt_tour_id)!==CGL_QUALIFIER_SGT_TOUR ||
        bId || normalize(tournament.course_name) !== normalize(planned.name) ||
        (holeCount && !/^18(?:\s*holes?)?$/i.test(holeCount)) || tournament.stableford === true ||
        (tournament.start_date && tournament.start_date !== day(week.opens_at)) || (tournament.end_date && tournament.end_date !== day(week.closes_at)))
        throw new CglApiError("The synced SGT event must match the scheduled course, one full 18 and the Brisbane date range.", 409);
      const settings = configOf(season).qualifier_play_settings;
      if (!settings || body.handicapCounting !== true) throw new CglApiError("Approve the shared playing settings and check handicap contribution in SGT first.");
      const yards = z.number().int().min(4500).max(8000).parse(body.yards);
      if ((yards < 6000 || yards > 6300) && body.teeException !== true)
        throw new CglApiError("Review the best available regular tee and document why it is outside the target yardage.");
      const { course_b: _courseB, sgt_tournament_b_id: _eventB, ctp_hole: _ctp, ...prior } = configOf(week);
      void _courseB; void _eventB; void _ctp;
      return rpc("cgl_admin_save", { p_entity: "week", p_record: {id:week.id, course_name:planned.name, second_course_name:null,
        sgt_tournament_id:aId, sgt_tour_id:CGL_QUALIFIER_SGT_TOUR, conditions:CGL_QUALIFIER_CONDITIONS, config:{...prior,course_a:{...planned, verified:true,
          sgtCourseId:text(150).parse(body.courseA), version:text(80).parse(body.courseVersion), tee:text(120).parse(body.teeA), yards},
          event_approved:true, handicap_counting_verified:true, verified_play_settings:settings, course_verification:"verified", conditions_verification:"verified",
          verified_opens_at:week.opens_at, verified_closes_at:week.closes_at,
        }},p_actor:actor.id,p_reason:reason });
    }
    const readCourse = (suffix: "A" | "B") => ({
      sgtCourseId: text(150).parse(body[`course${suffix}`]),
      segment: z.enum(["front_9","back_9"]).parse(body[`nine${suffix}`]),
      tee: text(150).parse(body[`tee${suffix}`]),
      verified: true,
    });
    const a = readCourse("A"), b = readCourse("B");
    if (a.sgtCourseId === b.sgtCourseId) throw new CglApiError("The two halves must use different course builds.");
    const ctp = week.phase === "championship" ? z.string().regex(/^[AB]:(?:[1-9]|1[0-8])$/).parse(body.ctpHole) : null;
    if (ctp) {
      const [side, rawHole] = ctp.split(":"), hole = Number(rawHole);
      if (((side === "A" ? a : b).segment === "front_9") !== (hole <= 9)) throw new CglApiError("The CTP hole must belong to the nominated nine.");
    }
    return rpc("cgl_admin_save", { p_entity: "week", p_record: { id: week.id, sgt_tournament_id: aId, config: {
      ...configOf(week), course_a: a, course_b: b, sgt_tournament_b_id: bId ?? null,
      event_approved: true, ctp_hole: ctp, course_verification: "verified", conditions_verification: "verified",
      verified_opens_at: week.opens_at, verified_closes_at: week.closes_at,
    } }, p_actor: actor.id, p_reason: reason });
  }
  if (action === "approve_qualifier_settings") {
    permission(actor,"manage_seasons");
    const season = await one("cgl_seasons",uuid.parse(body.seasonId));
    if (!isSeasonOne(season) || body.approved !== true) throw new CglApiError("Explicit approval is required for the shared qualifier settings.");
    const settings = {pins:text(100).parse(body.pins),putting:text(100).parse(body.putting),gimmies:text(100).parse(body.gimmies)};
    const linked = await rows("cgl_weeks",{season_id:season.id,phase:"qualification"});
    const current = sgtRow(configOf(season).qualifier_play_settings);
    if (linked.some((week)=>configOf(week).event_approved===true) && Object.entries(settings).some(([key,value])=>current[key]!==value))
      throw new CglApiError("The shared settings are locked after a qualifier is verified.");
    return rpc("cgl_admin_save",{p_entity:"season",p_record:{id:season.id,config:{...configOf(season),qualifier_play_settings:settings}},p_actor:actor.id,p_reason:reason});
  }
  if (action === "import_qualifier_scorecard") {
    permission(actor,"manage_members");
    if (body.approved !== true) throw new CglApiError("Confirm the eligible SGT scorecard before importing.");
    const [week, member] = await Promise.all([one("cgl_weeks",uuid.parse(body.weekId)),one("cgl_members",uuid.parse(body.memberId))]);
    const eventId = String(week.sgt_tournament_id ?? "");
    const course = sgtRow(configOf(week).course_a);
    if (week.phase!=="qualification" || week.status==="draft" || configOf(week).event_approved!==true || course.segment!=="full_18" || !/^\d+$/.test(eventId) || !member.sgt_verified_at || !member.sgt_id ||
      !isSeasonOne(await one("cgl_seasons",String(week.season_id))))
      throw new CglApiError("A verified Season 1 full-round event and verified SGT identity are required.");
    const id = text(120).parse(body.scorecardId);
    const source = (await rows("cgl_sgt_tournaments",{sgt_tournament_id:Number(eventId)}))[0];
    const matching = sgtRows(source?.scorecards).filter((card)=>String(sgtFirst(card,["scorecard_id","scorecardId","round_id","roundId","id"]))===id);
    const card = matching[0];
    if (matching.length!==1 || String(sgtFirst(card,["game_id","gameid","gameId","sgt_player_id","player_id","playerId","user_id","userId"]))!==String(member.sgt_id))
      throw new CglApiError("The synced scorecard must match that unique SGT player ID. Sync SGT or check the correct card ID.",409);
    const cardCourse = sgtFirst(card,["course_id","courseId","courseid"]);
    if (cardCourse != null && String(cardCourse)!==String(course.sgtCourseId)) throw new CglApiError("The scorecard course ID does not match the verified qualifier.",409);
    const holes = sgtScorecardHoles(card);
    if (holes.length!==18 || holes.some((hole,i)=>hole.hole!==i+1 || !Number.isInteger(hole.gross) || Number(hole.gross)<1) ||
      (holes.every((hole)=>hole.par!=null) && holes.reduce((total,hole)=>total+Number(hole.par),0)!==Number(course.par)))
      throw new CglApiError("The synced scorecard must contain a complete, matching 18-hole round.",409);
    const playedAt = z.string().datetime({offset:true}).parse(body.playedAt);
    const cachedCompletion = sgtFirst(card,["completed_at","completedAt","played_at","playedAt"]);
    if (cachedCompletion && Number.isFinite(Date.parse(String(cachedCompletion))) && Date.parse(String(cachedCompletion))!==Date.parse(playedAt))
      throw new CglApiError("The recorded completion time must match the synced SGT card.");
    const access = await getCglEligibility(String(member.id),week,playedAt);
    if (!access.eligible) throw new CglApiError(access.reason ?? "The golfer was not eligible when this card was played.",409);
    return rpc("cgl_record_qualifying_card",{p_record:{season_id:week.season_id,member_id:member.id,sgt_player_id:member.sgt_id,
      scorecard_id:id,week_id:week.id,path:z.enum(["established","new"]).parse(body.path),holes:18,played_at:playedAt,
      gross:holes.reduce((total,hole)=>total+Number(hole.gross),0),source_url:`https://simulatorgolftour.com/tournament/${eventId}`},p_actor:actor.id,p_reason:reason});
  }
  if (action === "record_qualifying_card") {
    permission(actor, "manage_members");
    const [member, season] = await Promise.all([one("cgl_members", uuid.parse(body.memberId)), one("cgl_seasons", uuid.parse(body.seasonId))]);
    if (!isSeasonOne(season) || !member.sgt_id || !member.sgt_verified_at || body.approved!==true) throw new CglApiError("Verify the player's SGT account and approve the external SGT card before counting holes.");
    const source = sourceUrl.parse(body.sourceUrl);
    const eventId = z.string().regex(/^\d{1,15}$/).parse(body.eventId);
    const localEvents = await rows("cgl_weeks",{season_id:season.id,phase:"qualification"});
    if (CGL_QUALIFIER_SGT_EVENTS.some((known)=>known===eventId) || localEvents.some((week)=>String(week.sgt_tournament_id)===eventId)) throw new CglApiError("Import a dedicated qualifier through its fixture rather than as an external card.");
    return rpc("cgl_record_qualifying_card", { p_record: {
      season_id: season.id, member_id: member.id, sgt_player_id: member.sgt_id, scorecard_id: text(120).parse(body.scorecardId),
      path: z.enum(["established","new"]).parse(body.path), holes: z.union([z.literal(9),z.literal(18)]).parse(body.holes),
      played_at: z.string().datetime({offset:true}).parse(body.playedAt), source_url: source,
    }, p_actor: actor.id, p_reason: reason });
  }
  if (action === "verify_qualifier_handicap") {
    permission(actor,"manage_members");
    const [member, season] = await Promise.all([one("cgl_members",uuid.parse(body.memberId)),one("cgl_seasons",uuid.parse(body.seasonId))]);
    if (!isSeasonOne(season) || !member.sgt_verified_at || body.approved!==true || String(member.sgt_id)!==String(body.playerId))
      throw new CglApiError("Verify the official handicap for this player's exact SGT identity.");
    const cards = (await rows("cgl_qualifying_cards",{season_id:season.id,member_id:member.id})).filter((card)=>card.sgt_player_id===member.sgt_id);
    const holes = cards.reduce((total,card)=>total+Number(card.holes),0);
    if (holes < (cards[0]?.path==="established" ? 18 : 54)) throw new CglApiError("The qualification-hole requirement is not yet met.",409);
    const reference = sourceUrl.parse(body.sourceUrl);
    return rpc("cgl_admin_save",{p_entity:"member",p_record:{id:member.id,handicap:z.number().min(-20).max(54).parse(body.handicap),
      qualifying_holes:holes,handicap_status:"verified",handicap_verified_at:new Date().toISOString()},p_actor:actor.id,p_reason:`${reason} | SGT handicap evidence: ${reference}`});
  }
  if (action === "verify_guest_sgt") {
    permission(actor,"manage_members");
    if (body.approved !== true) throw new CglApiError("Verify the unique SGT ID and guest ownership first.");
    return rpc("cgl_verify_guest_sgt",{p_member_id:uuid.parse(body.memberId),p_username:sgtUsername.parse(body.username),
      p_sgt_id:z.string().regex(/^\d{8,30}$/).parse(body.playerId),p_source:sourceUrl.parse(body.sourceUrl),p_actor:actor.id,p_reason:reason});
  }
  if (action === "save_event_enrolment") {
    permission(actor, "manage_members");
    const week = await one("cgl_weeks", uuid.parse(body.weekId));
    const member = await one("cgl_members", uuid.parse(body.memberId));
    const season = await one("cgl_seasons", String(week.season_id));
    const state = z.enum(["in_progress","confirmed","failed"]).parse(body.state);
    if (!isSeasonOne(season) || !member.sgt_id || !member.sgt_verified_at) throw new CglApiError("Use a Season 1 fixture and a verified SGT player.");
    const access = await getCglEligibility(String(member.id),week,new Date().toISOString(),true);
    if (state !== "failed" && !access.eligible) throw new CglApiError(access.reason ?? "This player is not ready for enrolment.", 409);
    if (state === "confirmed" && body.approved !== true) throw new CglApiError("Check the unique player ID in every required SGT event before confirming.");
    return rpc("cgl_save_event_enrolment", { p_week_id: week.id, p_member_id: member.id, p_player_id: member.sgt_id,
      p_event_ids: fixtureEventIds(week), p_state: state, p_evidence: reason, p_actor: actor.id });
  }
  if (["open_review", "log_dispute", "resolve_dispute", "extend_dispute"].includes(action)) {
    permission(actor, "manage_results");
    const week = await one("cgl_weeks", uuid.parse(body.weekId));
    if (!isSeasonOne(await one("cgl_seasons", String(week.season_id)))) throw new CglApiError("This review workflow is for Season 1.");
    return rpc("cgl_update_event_review", { p_week_id: week.id, p_action: action,
      p_dispute_id: ["resolve_dispute","extend_dispute"].includes(action) ? uuid.parse(body.disputeId) : null, p_actor: actor.id, p_reason: reason });
  }
  const saveActions: Record<
    string,
    { entity: string; permission: CglPermission; schema: z.ZodType }
  > = {
    create_season: {
      entity: "season",
      permission: "manage_seasons",
      schema: seasonSchema,
    },
    save_season: {
      entity: "season",
      permission: "manage_seasons",
      schema: seasonSchema,
    },
    save_week: {
      entity: "week",
      permission: "manage_seasons",
      schema: weekSchema,
    },
    save_plan: {
      entity: "plan",
      permission: "manage_billing",
      schema: planSchema,
    },
    save_catalogue: {
      entity: "catalogue",
      permission: "manage_rewards",
      schema: catalogueSchema,
    },
    save_gift_item: {
      entity: "gift_item",
      permission: "manage_rewards",
      schema: giftItemSchema,
    },
    update_member: {
      entity: "member",
      permission: "manage_members",
      schema: z
        .object({
          id: uuid,
          handicap: z.number().min(-20).max(54).nullable().optional(),
          handicap_status: z
            .enum(["unverified", "qualifying", "verified"])
            .optional(),
          qualifying_holes: z.number().int().min(0).max(10000).optional(),
          handicap_verified_at: z
            .string()
            .datetime({ offset: true })
            .nullable()
            .optional(),
          eligibility: z.enum(["active", "suspended"]).optional(),
          private_notes: z.string().max(10000).optional(),
        })
        .strict(),
    },
  };
  if (saveActions[action]) {
    const choice = saveActions[action];
    permission(actor, choice.permission);
    const record = choice.schema.parse(body.record) as CglData;
    if ((choice.entity === "season" || choice.entity === "week") && record.id) {
      const previous = await one(choice.entity === "season" ? "cgl_seasons" : "cgl_weeks", String(record.id));
      const parent = choice.entity === "season" ? previous : await one("cgl_seasons", String(previous.season_id));
      if (isSeasonOne(parent)) {
        record.config = configOf(previous);
        if (choice.entity === "season" && ["starts_at","ends_at","qualification_ends_at"].some((key) =>
          record[key] != null && Date.parse(String(record[key])) !== Date.parse(String(previous[key])))) {
          if (previous.status !== "draft") throw new CglApiError("Review the approved season boundaries before changing live dates.");
          record.config = { ...configOf(previous), schedule_approved: false };
        }
        if (choice.entity === "week" && (record.course_name !== previous.course_name || record.second_course_name !== previous.second_course_name ||
          record.sgt_tournament_id !== previous.sgt_tournament_id || JSON.stringify(record.conditions) !== JSON.stringify(previous.conditions) ||
          ["opens_at","closes_at"].some((key) => Date.parse(String(record[key])) !== Date.parse(String(previous[key]))))) {
          if (record.status !== "draft") throw new CglApiError("Save changed event settings as a draft and verify them again before release.");
          record.config = { ...configOf(previous), event_approved: false };
        }
      }
    }
    if (
      ["season", "week", "catalogue", "gift_item"].includes(choice.entity) &&
      !record.id
    )
      record.id = randomUUID();
    if (
      choice.entity === "season" &&
      record.status !== "draft" &&
      (!record.starts_at || !record.ends_at)
    )
      throw new CglApiError(
        "Publish exact season dates before opening registration.",
      );
    if (
      choice.entity === "member" &&
      record.handicap_status === "verified" &&
      (record.handicap == null || !record.handicap_verified_at)
    )
      throw new CglApiError(
        "A verified SGT handicap value and verification timestamp are required.",
      );
    if (choice.entity === "plan") {
      const casual = ["casual_registration", "casual_season"].includes(
        String(record.code),
      );
      if (
        casual &&
        (record.auto_renew ||
          record.full_member ||
          record.billing_interval !== "once")
      )
        throw new CglApiError(
          "Casual registration and season entry are one-off purchases and cannot auto-renew.",
        );
      if (
        !casual &&
        (!record.auto_renew ||
          !record.full_member ||
          record.billing_interval !== record.code)
      )
        throw new CglApiError(
          "Full membership billing interval must match its plan.",
        );
    }
    return rpc("cgl_admin_save", {
      p_entity: choice.entity,
      p_record: record,
      p_actor: actor.id,
      p_reason: reason,
    });
  }
  if (action === "connect_sgt") {
    permission(actor, "manage_settings");
    return connectCglSgt({
      username: body.username,
      password: body.password,
      actor: actor.id,
      reason,
    });
  }
  if (action === "sync_sgt") {
    permission(actor, "manage_results");
    return runCglSgtSync({
      force: true,
      trigger: "manual",
      actor: actor.id,
    });
  }
  if (action === "set_sgt_sync") {
    permission(actor, "manage_settings");
    return setCglSgtSyncEnabled({
      enabled: z.boolean().parse(body.enabled),
      actor: actor.id,
      reason,
    });
  }
  if (action === "verify_square_connection") {
    permission(actor, "manage_billing");
    const connection = await verifyCglSquareConnection();
    return {
      ...connection,
      message: `Square ${connection.environment} connection verified for an active AUD location in ${connection.timezone}. No payment was created.`,
    };
  }
  if (action === "audit_square_catalog") {
    permission(actor, "manage_billing");
    const recurringCodes = ["annual", "monthly", "weekly"];
    const plans = (await rows(
      "cgl_plans",
      { active: true },
      "code,price_cents,config",
    )).filter((plan) => recurringCodes.includes(String(plan.code)));
    const mappings = recurringCodes.map((code) => {
      const plan = plans.find((candidate) => candidate.code === code);
      const config = plan?.config && typeof plan.config === "object" &&
        !Array.isArray(plan.config) ? plan.config as CglData : {};
      const variationId = typeof config.square_plan_variation_id === "string"
        ? config.square_plan_variation_id.trim()
        : "";
      if (!plan || !Number.isSafeInteger(plan.price_cents) || !variationId)
        throw new CglApiError(
          `The ${code} Square catalogue mapping is incomplete. No payment was created.`,
          409,
          "square_catalog_incomplete",
        );
      return {
        code,
        amountCents: Number(plan.price_cents),
        variationId,
      };
    });
    const audit = await auditCglSquareCatalogMappings(mappings);
    return {
      environment: audit.environment,
      timezone: audit.timezone,
      mappings: audit.mappings.map((mapping) => ({
        code: mapping.code,
        amountCents: mapping.amountCents,
        currency: mapping.currency,
        cadence: mapping.cadence,
      })),
      message: `Square ${audit.environment} catalogue verified for annual, monthly and weekly AUD pricing. No product or payment was created.`,
    };
  }
  if (action === "save_settings") {
    permission(actor, "manage_settings");
    const record = z
      .object({
        key: z.enum([
          "legal",
          "cancellation_policy",
          "annual_formula",
          "divisions",
          "rewards",
          "prizes",
          "gifts",
          "financial",
          "sgt",
          "points",
        ]),
        value: z.record(z.string(), z.unknown()),
      })
      .strict()
      .parse(body.record);
    if (record.key === "rewards") {
      z.object({
        credit_expiry_months: z.number().int().min(1).max(60),
        credits_per_aud: z.number().positive(),
        payment_redemption_enabled: z.literal(false),
        weekly_priority: z.array(z.enum(["net", "gross", "ctp"])).length(3),
        full: z.record(z.string(), z.number().int().min(0)),
        casual: z.record(z.string(), z.number().int().min(0)),
      }).parse(record.value);
      if (new Set(record.value.weekly_priority as string[]).size !== 3)
        throw new CglApiError(
          "Each weekly award must appear once in the priority list.",
        );
    }
    if (record.key === "points")
      z.object({
        version: text(100),
        source: z.string().url(),
        approved: z.boolean(),
        table: z.array(z.number().min(0)).min(10).max(200),
      }).parse(record.value);
    if (record.key === "divisions") {
      const bounds = z
        .object({
          c_grade_enabled: z.boolean(),
          a_max: z.number().min(-10).max(53.9),
          b_min: z.number().min(-9.9).max(54),
          c_min: z.number().min(-9.8).max(54),
        })
        .parse(record.value);
      if (
        Math.abs(bounds.b_min - bounds.a_max - 0.1) > 0.00001 ||
        bounds.c_min <= bounds.b_min
      )
        throw new CglApiError(
          "Division thresholds must be contiguous at one decimal place, with C Grade above B Grade.",
        );
    }
    if (record.key === "gifts")
      z.object({
        annual_release_week: z.number().int().min(1).max(13),
        monthly_payments: z.number().int().min(1).max(24),
        weekly_payments: z.number().int().min(1).max(104),
        midseason_review_required: z.boolean(),
      }).parse(record.value);
    if (record.key === "annual_formula")
      z.object({
        approved: z.boolean(),
        method: z.enum(["pending", "sum", "best_seasons"]).nullable(),
        counted_seasons: z.number().int().min(1).max(4).optional(),
      }).parse(record.value);
    if (record.key === "cancellation_policy")
      z.object({
        approved: z.boolean(),
        mode: z.enum(["season_boundary", "paid_term", "immediate"]),
      }).parse(record.value);
    if (record.key === "legal") {
      z.object({
        approved: z.boolean(),
        version: z.string().trim().min(1).optional(),
      }).parse(record.value);
      if (record.value.approved && !record.value.version)
        throw new CglApiError(
          "Record the approved terms version before enabling this approval.",
        );
    }
    return rpc("cgl_admin_save", {
      p_entity: "setting",
      p_record: record,
      p_actor: actor.id,
      p_reason: reason,
    });
  }
  if (action === "generate_fixtures") {
    permission(actor, "manage_seasons");
    return {
      created: await rpc("cgl_generate_fixtures", {
        p_season_id: uuid.parse(body.seasonId ?? body.season_id),
        p_actor: actor.id,
        p_reason: reason,
      }),
    };
  }
  if (action === "publish_block") {
    permission(actor, "manage_seasons");
    return {
      published: await rpc("cgl_publish_block", {
        p_week_ids: z
          .array(uuid)
          .min(1)
          .max(13)
          .parse(body.weekIds ?? body.week_ids),
        p_opens_at:
          body.opensAt == null
            ? null
            : z.string().datetime({ offset: true }).parse(body.opensAt),
        p_closes_at:
          body.closesAt == null
            ? null
            : z.string().datetime({ offset: true }).parse(body.closesAt),
        p_actor: actor.id,
        p_reason: reason,
      }),
    };
  }
  if (
    [
      "import_results",
      "review_result",
      "recalculate",
      "publish_results",
      "unpublish_results",
    ].includes(action)
  ) {
    permission(actor, "manage_results");
    if (action === "import_results") return importResults(actor, body, reason);
    if (action === "review_result")
      return rpc("cgl_review_result", {
        p_id: uuid.parse(body.id),
        p_state: z.enum(["pending", "verified", "excluded"]).parse(body.state),
        p_reason: reason,
        p_actor: actor.id,
      });
    if (action === "unpublish_results")
      return rpc("cgl_command", {
        p_action: action,
        p_payload: { week_id: uuid.parse(body.weekId ?? body.week_id), reason },
        p_actor: actor.id,
      });
    if (action === "publish_results") permission(actor, "manage_rewards");
    return recalculate(
      actor,
      uuid.parse(body.weekId ?? body.week_id),
      action === "publish_results",
    );
  }
  if (action === "assign_division") {
    permission(actor, "manage_members");
    const memberId = uuid.parse(body.memberId ?? body.member_id),
      seasonId = uuid.parse(body.seasonId ?? body.season_id);
    const [member, season, settings] = await Promise.all([
      one("cgl_members", memberId),
      one("cgl_seasons", seasonId),
      rows("cgl_settings"),
    ]);
    if (member.handicap_status !== "verified" || member.handicap == null)
      throw new CglApiError(
        "Verify the official SGT handicap before assigning a division.",
        409,
      );
    const divisionRules = settingsMap(settings).divisions;
    const managed = isSeasonOne(season);
    if (managed) {
      const qualification = (await rows("cgl_qualifying_cards", { season_id: seasonId, member_id: memberId })).filter((card) => card.sgt_player_id===member.sgt_id);
      if (qualification.reduce((sum, card) => sum+Number(card.holes),0) < (qualification[0]?.path==="established" ? 18 : 54))
        throw new CglApiError("Record the verified Season 1 qualification scorecards before assigning a division.", 409);
      if (body.locked === false) throw new CglApiError("Season 1 divisions must be locked before championship play.");
    }
    const cEnabled = !managed && divisionRules?.c_grade_enabled === true;
    const division = assignDivision(Number(member.handicap), {
      cGradeEnabled: cEnabled,
      aMaximum: managed ? 9.9 : Number(divisionRules?.a_max ?? 9.9),
      bMaximum: Number(divisionRules?.c_min ?? 20) - 0.1,
      ...(body.division
        ? {
            override: {
              division: (managed ? z.enum(["A", "B"]) : z.enum(["A", "B", "C"])).parse(body.division),
              reason,
              actorId: actor.id,
            },
          }
        : {}),
    });
    return rpc("cgl_command", {
      p_action: action,
      p_payload: {
        member_id: memberId,
        season_id: seasonId,
        division,
        handicap: member.handicap,
        locked_at: body.locked === false ? null : new Date().toISOString(),
        reason,
        season_status: season.status,
      },
      p_actor: actor.id,
    });
  }
  if (action === "verify_sgt") {
    permission(actor, "manage_members");
    return rpc("cgl_command", {
      p_action: action,
      p_payload: {
        id: uuid.parse(body.id),
        state: z.enum(["verified", "rejected"]).parse(body.state),
        reason,
      },
      p_actor: actor.id,
    });
  }
  if (action === "adjust_credits") {
    permission(actor, "manage_rewards");
    return rpc("cgl_adjust_credits", {
      p_member_id: uuid.parse(body.memberId ?? body.member_id),
      p_amount: z
        .number()
        .int()
        .min(-100000)
        .max(100000)
        .refine((n) => n !== 0)
        .parse(body.amount),
      p_request_key: idempotency.parse(body.requestKey ?? body.request_key),
      p_reason: reason,
      p_actor: actor.id,
    });
  }
  if (action === "allocate_gift") {
    permission(actor, "manage_rewards");
    return {
      id: await rpc("cgl_allocate_gift", {
        p_member_id: uuid.parse(body.memberId ?? body.member_id),
        p_gift_item_id: uuid.parse(body.giftItemId ?? body.gift_item_id),
        p_actor: actor.id,
        p_reason: reason,
      }),
    };
  }
  if (action === "approve_midseason_gift") {
    permission(actor, "manage_rewards");
    return rpc("cgl_command", {
      p_action: action,
      p_payload: {
        membership_id: uuid.parse(body.membershipId ?? body.membership_id),
        reason,
      },
      p_actor: actor.id,
    });
  }
  if (
    [
      "fulfil_order",
      "cancel_order",
      "fulfil_gift",
      "review_prize",
      "reverse_prize",
    ].includes(action)
  ) {
    permission(actor, "manage_rewards");
    const state =
      action === "review_prize"
        ? z
            .enum(["verified", "approved", "awarded", "claimed"])
            .parse(body.state)
        : ["cancel_order", "reverse_prize"].includes(action)
          ? undefined
          : z.enum(["ready", "dispatched", "collected"]).parse(body.state);
    return rpc("cgl_command", {
      p_action: action,
      p_payload: { id: uuid.parse(body.id), state, reason },
      p_actor: actor.id,
    });
  }
  if (action === "prepare_season_one_cash_prizes") {
    permission(actor,"manage_rewards");
    permission(actor,"manage_billing");
    const season = await one("cgl_seasons",uuid.parse(body.seasonId));
    if (!isSeasonOne(season) || body.approved !== true || Date.parse(String(season.ends_at))>=Date.now())
      throw new CglApiError("Wait until Season 1 submissions close and explicitly confirm the prize list.");
    const [weeks,calculations,members,prizes] = await Promise.all([rows("cgl_weeks",{season_id:season.id}),rows("cgl_calculations"),rows("cgl_members"),rows("cgl_prizes",{season_id:season.id})]);
    if (weeks.filter((week) => week.phase==="championship" && week.results_published).length!==10)
      throw new CglApiError("Finalise all ten championship rounds before creating the cash prize list.");
    const rankings = standingsFrom(calculations,weeks,members);
    const amounts = CGL_CASH_PRIZE_CENTS.seasonal;
    const pending = (["A","B"] as const).flatMap((grade) => (["champion","runner_up"] as const).map((award, i) => {
      const winner = rankings.find((row) => row.division===grade && row.position===i+1);
      if (!winner || winner.tiebreak_review) throw new CglApiError("Resolve the final division positions before preparing cash prizes.",409);
      return { member_id:winner.member_id, season_id:season.id, category:`${grade}:${award}`,kind:"cash",amount:amounts[grade][award],
        source_key:`season-one-cash:${season.id}:${grade}:${award}`,reason };
    }));
    for (const award of pending) {
      const existing = prizes.find((prize) => prize.source_key===award.source_key);
      if (existing && (existing.member_id!==award.member_id || Number(existing.amount)!==award.amount))
        throw new CglApiError("An existing cash prize differs from final standings and needs reconciliation.",409);
    }
    const confirmedAt = Math.max(...currentCalculations(calculations,weeks).map((calc) => Date.parse(String(calc.published_at))));
    const payoutTarget = new Date(confirmedAt+14*86_400_000).toISOString();
    let created = 0;
    for (const award of pending) if (!prizes.some((prize) => prize.source_key===award.source_key)) {
      await rpc("cgl_command",{p_action:"save_prize",p_payload:{...award,metadata:{payout_target_at:payoutTarget, method:"manual_bank_transfer"}},p_actor:actor.id});
      created++;
    }
    return { created, payout_target_at:payoutTarget };
  }
  if (action === "save_prize") {
    permission(actor, "manage_rewards");
    const record = z
      .object({
        member_id: uuid,
        season_id: uuid,
        category: text(100),
        kind: z.enum(["credits", "cash", "physical"]),
        amount: z.number().int().positive().max(1000000),
        source_key: idempotency,
        claim_deadline: z
          .string()
          .datetime({ offset: true })
          .nullable()
          .optional(),
        metadata: z.record(z.string(), z.unknown()).default({}),
      })
      .strict()
      .parse(body.record);
    if (record.kind === "cash") permission(actor, "manage_billing");
    if (["cash","credits"].includes(record.kind) && isSeasonOne(await one("cgl_seasons",record.season_id)))
      throw new CglApiError("Use Season 1 finalisation or the approved season cash prize list to allocate this award.");
    if (record.kind === "physical" && !record.claim_deadline) {
      const season = await one("cgl_seasons", record.season_id),
        seasons = await rows("cgl_seasons");
      const following = seasons.filter(
        (s) =>
          Number(s.year) * 4 + Number(s.season_number) ===
            Number(season.year) * 4 + Number(season.season_number) + 1 &&
          s.ends_at,
      )[0];
      if (!following?.ends_at)
        throw new CglApiError(
          "Confirm the following season's end date before allocating a physical prize, or supply an explicitly reviewed claim deadline.",
          409,
        );
      record.claim_deadline = String(following.ends_at);
    }
    return rpc("cgl_command", {
      p_action: action,
      p_payload: { ...record, reason },
      p_actor: actor.id,
    });
  }
  if (action === "notification") {
    permission(actor, "manage_members");
    const record = z
      .object({
        member_id: uuid,
        kind: text(60),
        title: text(150),
        body: text(5000),
        source_key: idempotency,
      })
      .strict()
      .parse(body.record);
    return rpc("cgl_command", {
      p_action: action,
      p_payload: { ...record, reason },
      p_actor: actor.id,
    });
  }
  throw new CglApiError("This CGL admin action is not supported.");
}

export async function runCglScheduledJobs(request: Request) {
  const expected = process.env.CGL_JOB_SECRET ?? "",
    actual = (request.headers.get("authorization") ?? "").replace(
      /^Bearer\s+/,
      "",
    );
  if (
    expected.length < 32 ||
    actual.length !== expected.length ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  )
    throw new CglApiError(
      "The CGL scheduler is not authorised.",
      403,
      "forbidden",
    );
  const creditsExpired = await rpc("cgl_expire_credits", {});
  const physicalPrizesExpired = await rpc("cgl_expire_physical_prizes", {});
  return {
    status: "completed",
    creditsExpired,
    physicalPrizesExpired,
    emailDelivery:
      "Preview notifications are stored; no email is claimed as sent.",
  };
}

export function cglCsv(rowsToExport: CglData[]) {
  if (!rowsToExport.length) return "No records\r\n";
  const columns = [...new Set(rowsToExport.flatMap(Object.keys))];
  const escape = (value: unknown) => {
    let data =
      value == null
        ? ""
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
    if (/^[=+\-@\t\r]/.test(data)) data = `'${data}`;
    return `"${data.replaceAll('"', '""')}"`;
  };
  return [
    columns.map(escape).join(","),
    ...rowsToExport.map((row) =>
      columns.map((key) => escape(row[key])).join(","),
    ),
  ].join("\r\n");
}
