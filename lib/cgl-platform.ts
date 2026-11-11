import "server-only";

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  isAdminAuthenticated,
  isValidAdminAppAccessToken,
} from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
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
  for (let offset = 0; offset < 100000; offset += 1000) {
    let query = db()
      .from(table)
      .select(columns)
      .range(offset, offset + 999)
      .order(
        table === "cgl_settings"
          ? "key"
          : table === "cgl_plans"
            ? "code"
            : table === "cgl_square_webhook_events"
              ? "event_id"
              : table === "cgl_square_season_entitlements"
                ? "checkout_id"
            : "id",
      );
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
  return {
    id: data.user.id,
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
  const username = process.env.CGS_ADMIN_USERNAME?.trim();
  const password = process.env.CGS_ADMIN_PASSWORD;
  return Boolean(
    secret &&
      secret.length >= 32 &&
      !["cgs-admin-session-admin", "admin"].includes(secret) &&
      username &&
      username.toLowerCase() !== "admin" &&
      password &&
      password.length >= 16 &&
      password.toLowerCase() !== "admin",
  );
}
export async function getCglAdminActor(request?: Request): Promise<CglActor> {
  if (request?.headers.get("authorization")) {
    const token = (request.headers.get("authorization") ?? "").replace(
      /^Bearer\s+/,
      "",
    );
    if (isConfiguredCglLegacyAdmin() && isValidAdminAppAccessToken(token))
      return { id: "legacy-configured-admin", role: "super_admin" };
    const identity = await getCglMemberIdentity(request);
    const role = identity.appMetadata.cgl_role;
    if (["super_admin", "league_admin", "results_admin"].includes(String(role)))
      return { id: identity.id, role: role as CglRole };
    throw new CglApiError(
      "A CGL administrator role is required.",
      403,
      "forbidden",
    );
  }
  if (isConfiguredCglLegacyAdmin() && (await isAdminAuthenticated()))
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
      weekly: { week: number; points: number | null }[];
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
      rounds_counted: summary.roundsCounted,
      counted: summary.counted,
      discarded: summary.discarded,
      missing_weeks: summary.missingWeeks,
      pending: summary.hasPending,
      weekly: group.weekly,
    });
  }
  result.sort(
    (a, b) =>
      Number(b.total_points) - Number(a.total_points) ||
      String(a.sgt_username).localeCompare(String(b.sgt_username)),
  );
  for (const row of result)
    row.position =
      1 +
      result.filter(
        (other) =>
          other.season_id === row.season_id &&
          other.division === row.division &&
          Number(other.total_points) > Number(row.total_points),
      ).length;
  return result;
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
  const publicResults = results
    .filter((r) => published.has(r.week_id) && handles.get(r.member_id))
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
    updated_at: new Date().toISOString(),
  };
}

export async function getCglMemberSnapshot(identity: CglIdentity) {
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
    rows("cgl_members", { id: identity.id }),
    rows("cgl_settings"),
    rows("cgl_memberships", { member_id: identity.id }),
    rows("cgl_payments", { member_id: identity.id }),
    rows("cgl_season_entries", { member_id: identity.id }),
    rows("cgl_division_assignments", { member_id: identity.id }),
    rows("cgl_results", { member_id: identity.id }),
    rows("cgl_credit_lots", { member_id: identity.id }),
    rows("cgl_credit_transactions", { member_id: identity.id }),
    rows("cgl_orders", { member_id: identity.id }),
    rows("cgl_gifts", { member_id: identity.id }),
    rows("cgl_notifications", { member_id: identity.id }),
    rows("cgl_catalogue", { active: true }),
    rows("cgl_seasons"),
    rows("cgl_weeks"),
    rows("cgl_calculations"),
    rows("cgl_sgt_link_requests", { member_id: identity.id }),
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
      (row) => row.playerId === identity.id,
    );
    return {
      ...result,
      week_name: week?.name,
      season_id: week?.season_id,
      points: points?.points ?? null,
      position: points?.position ?? null,
    };
  });
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
          id: identity.id,
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
  const membership = await one("cgl_memberships", membershipId, identity.id);
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
  };
}
export async function executeCglMemberAction(
  identity: CglIdentity,
  body: CglData,
) {
  const action = text(60).parse(body.action);
  if (action === "join") {
    const trial =
      identity.appMetadata.cgl && typeof identity.appMetadata.cgl === "object"
        ? (identity.appMetadata.cgl as CglData)
        : {};
    return rpc("cgl_command", {
      p_action: "join",
      p_actor: identity.id,
      p_payload: {
        member_id: identity.id,
        email: identity.email,
        display_name: identity.displayName,
        sgt_username:
          typeof trial.sgt_username === "string"
            ? sgtUsername.parse(trial.sgt_username)
            : null,
        sgt_id:
          typeof trial.sgt_id === "string"
            ? z
                .string()
                .regex(/^\d{8,30}$/)
                .parse(trial.sgt_id)
            : null,
        metadata: {
          source: "existing_cgs_auth",
          trial_membership: trial.membership_status === "trial",
        },
        reason: "Member joined CGL using their existing CGS account",
      },
    });
  }
  if (action === "link_sgt")
    return rpc("cgl_command", {
      p_action: action,
      p_actor: identity.id,
      p_payload: {
        member_id: identity.id,
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
    return rpc("cgl_command", {
      p_action: action,
      p_actor: identity.id,
      p_payload: {
        member_id: identity.id,
        membership_id: membershipId,
        quote,
        reason: reasonSchema.parse(body.reason),
      },
    });
  }
  if (action === "redeem")
    return {
      id: await rpc("cgl_redeem", {
        p_member_id: identity.id,
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
        member_id: identity.id,
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
    return getCglEligibility(identity.id, week);
  }
  throw new CglApiError("This member action is not supported.");
}

export async function getCglEligibility(
  memberId: string,
  week: CglData,
  at = new Date().toISOString(),
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
  const member = members[0];
  if (!member)
    return {
      eligible: false,
      reason: "A CGS member must join CGL first.",
      billingWarning: false,
      kind: "casual" as const,
    };
  const now = new Date(at).getTime();
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
    return {
      ...competitionEligibility({
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
        handicapEligible:
          week.phase === "qualification" ||
          member.handicap_status === "verified",
      }),
      kind: "full" as const,
    };
  }
  const registration = memberships.find(
    (m) =>
      !isCglSandboxRecord(m) &&
      m.plan_code === "casual_registration" &&
      m.state === "active" &&
      m.paid_through &&
      new Date(String(m.paid_through)).getTime() > now,
  );
  return {
    ...competitionEligibility({
      kind: "casual",
      active: Boolean(registration),
      now: at,
      competitionWeek: Number(week.week_number),
      casualRegistrationExpiresAt: registration?.paid_through as string | null,
      seasonEntryPaid: entries.some((e) => !isCglSandboxRecord(e) && e.state === "active" && e.paid_at),
      suspended: member.eligibility === "suspended",
      handicapEligible:
        week.phase === "qualification" || member.handicap_status === "verified",
    }),
    kind: "casual" as const,
  };
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
  ];
  const values = await Promise.all(names.map((name) => rows(`cgl_${name}`)));
  const snapshot = Object.fromEntries(
    names.map((name, index) => [name, values[index]]),
  );
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
  if (week.sgt_tournament_id) {
    const tournament = new URL(source).pathname.match(
      /^\/(?:tournament|scorecard|embed\/tournament)\/(\d+)(?:\/|$)/,
    )?.[1];
    if (tournament !== String(week.sgt_tournament_id))
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
    if (
      played > Date.now() ||
      !week.opens_at ||
      !week.closes_at ||
      played < Date.parse(String(week.opens_at)) ||
      played >= Date.parse(String(week.closes_at))
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
  const points = calculateDivisionPoints(inputs, pointsTable, countback);
  const rewards = config.rewards;
  const awards = selectWeeklyAwards(inputs, {
    verified: true,
    published: publish,
    weekId,
    priority: (rewards?.weekly_priority ?? [
      "net",
      "gross",
      "ctp",
    ]) as WeeklyAwardCategory[],
    casualCredits: (rewards?.casual ?? {
      net: 10,
      gross: 10,
      ctp: 5,
    }) as Record<WeeklyAwardCategory, number>,
    fullMultiplier: Number(rewards?.full_multiplier ?? 2),
    strokeIndexOrder: countback,
  });
  const configuredAwards = awards.awards.map((award) => ({
    ...award,
    credits:
      award.membership === "full" &&
      (rewards?.full as CglData | undefined)?.[award.category] != null
        ? Number((rewards.full as CglData)[award.category])
        : award.credits,
  }));
  const snapshot = verified
    .map((r) => ({ id: r.id, updated_at: r.updated_at }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const calculation = {
    rules_version: CGL_RULES_VERSION,
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
    const cEnabled = divisionRules?.c_grade_enabled === true;
    const division = assignDivision(Number(member.handicap), {
      cGradeEnabled: cEnabled,
      aMaximum: Number(divisionRules?.a_max ?? 9.9),
      bMaximum: Number(divisionRules?.c_min ?? 20) - 0.1,
      ...(body.division
        ? {
            override: {
              division: z.enum(["A", "B", "C"]).parse(body.division),
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
