import { withTimeout } from "@/lib/async-timeout";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type TopDogMatchStatus = "waiting" | "live" | "final";

export type TopDogScoreDirection = "higher_wins" | "lower_wins";

export type TopDogCentralOverlay =
  | "none"
  | "match"
  | "match_of_night"
  | "live_ladder"
  | "results_hold"
  | "best_team"
  | "longest_drive"
  | "ctp"
  | "bunker_boy"
  | "one_putt_jackpot"
  | "sponsor"
  | "subscribe"
  | "player_interview"
  | "up_next"
  | "match_result"
  | "shot_of_night"
  | "doghouse"
  | "butters_board"
  | "night_wrap_up"
  | "stat_of_week";

export type TopDogTickerCategory =
  | "scores"
  | "ladder"
  | "longest_drive"
  | "ctp"
  | "bunker_boy"
  | "one_putt_jackpot"
  | "next_match"
  | "sponsor";

export type CgsTeam = {
  id: number;
  slug: string;
  name: string;
  shortName: string;
  accentColor: string;
  logoUrl: string;
  isActive: boolean;
  updatedAt: string;
};

export type TopDogSeason = {
  id: number;
  slug: string;
  name: string;
  seasonLabel: string;
  startsOn: string | null;
  endsOn: string | null;
  defaultHoles: number;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  scoreDirection: TopDogScoreDirection;
  isActive: boolean;
  isPublished: boolean;
  integrationConfig: Record<string, unknown>;
  updatedAt: string;
};

export type TopDogSeasonTeam = {
  id: number;
  seasonId: number;
  displayOrder: number;
  isActive: boolean;
  pointsAdjustment: number;
  differentialAdjustment: number;
  adjustmentNote: string;
  team: CgsTeam;
};

export type TopDogRound = {
  id: number;
  seasonId: number;
  scoreboardId: number | null;
  roundNumber: number;
  name: string;
  scheduledAt: string | null;
  venue: string;
  courseName: string;
  scoreDirection: TopDogScoreDirection | null;
  differentialDivisor: number;
  status: TopDogMatchStatus;
  isCurrent: boolean;
  updatedAt: string;
};

export type TopDogFixture = {
  id: number;
  roundId: number;
  displayOrder: number;
  scheduledAt: string | null;
  simulatorBay: string;
  status: TopDogMatchStatus;
  homeTeam: CgsTeam;
  awayTeam: CgsTeam;
  homeScore: number;
  awayScore: number;
  homeScoreConfirmed: boolean;
  awayScoreConfirmed: boolean;
  currentHole: number;
  holesTotal: number;
  holesRemaining: number;
  resultNote: string;
  isMatchOfNight: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  canUndo: boolean;
};

export type TopDogStanding = {
  position: number;
  previousPosition: number | null;
  movement: number;
  team: CgsTeam;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  differential: number;
  points: number;
  pointsAdjustment: number;
  adjustmentNote: string;
  qualification: "direct-finals" | "wildcard" | "outside";
};

export type TopDogStreamState = {
  id: number;
  seasonId: number;
  roundId: number | null;
  featuredFixtureId: number | null;
  scorebugFixtureId: number | null;
  scorebugVisible: boolean;
  tickerVisible: boolean;
  tickerPaused: boolean;
  tickerIntervalSeconds: number;
  tickerCategories: TopDogTickerCategory[];
  tickerManualMessage: string;
  centralOverlay: TopDogCentralOverlay;
  centralOverlayVisible: boolean;
  overlayPayload: Record<string, unknown>;
  updatedAt: string;
};

export type TopDogSnapshot = {
  season: TopDogSeason;
  seasonTeams: TopDogSeasonTeam[];
  rounds: TopDogRound[];
  selectedRound: TopDogRound | null;
  fixtures: TopDogFixture[];
  allFixtures: TopDogFixture[];
  officialLadder: TopDogStanding[];
  projectedLadder: TopDogStanding[];
  streamState: TopDogStreamState;
  generatedAt: string;
};

export type TopDogFeed = {
  snapshot: TopDogSnapshot | null;
  source: "database" | "fallback";
  warningMessage: string | null;
};

export type TopDogFixtureCommand =
  | "start"
  | "set_score"
  | "adjust_score"
  | "next_hole"
  | "previous_hole"
  | "finish"
  | "reopen"
  | "match_of_night"
  | "undo";

const TOP_DOG_QUERY_TIMEOUT_MS = 15000;
const validTickerCategories = new Set<TopDogTickerCategory>([
  "scores",
  "ladder",
  "longest_drive",
  "ctp",
  "bunker_boy",
  "one_putt_jackpot",
  "next_match",
  "sponsor",
]);

const missingTableMessage =
  "Top Dog League Control is waiting for its database migration. Apply the latest Supabase migration, then refresh this page.";

function isMissingTopDogTableError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  return error.code === "42P01" || error.code === "PGRST205";
}

function parseNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseTickerCategories(value: unknown): TopDogTickerCategory[] {
  if (!Array.isArray(value)) {
    return ["scores", "ladder", "next_match"];
  }

  const categories = value.filter(
    (item): item is TopDogTickerCategory =>
      typeof item === "string" && validTickerCategories.has(item as TopDogTickerCategory)
  );

  return categories.length > 0 ? categories : ["scores", "ladder", "next_match"];
}

function mapTeam(row: Record<string, unknown>): CgsTeam {
  return {
    id: parseNumber(row.id),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? "Team TBC"),
    shortName: String(row.short_name ?? ""),
    accentColor: String(row.accent_color ?? "#20c8ff"),
    logoUrl: String(row.logo_url ?? ""),
    isActive: row.is_active !== false,
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapSeason(row: Record<string, unknown>): TopDogSeason {
  return {
    id: parseNumber(row.id),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? "CGS Top Dog League"),
    seasonLabel: String(row.season_label ?? ""),
    startsOn: row.starts_on ? String(row.starts_on) : null,
    endsOn: row.ends_on ? String(row.ends_on) : null,
    defaultHoles: parseNumber(row.default_holes, 9),
    winPoints: parseNumber(row.win_points, 3),
    drawPoints: parseNumber(row.draw_points, 1),
    lossPoints: parseNumber(row.loss_points, 0),
    scoreDirection: row.score_direction === "lower_wins" ? "lower_wins" : "higher_wins",
    isActive: Boolean(row.is_active),
    isPublished: Boolean(row.is_published),
    integrationConfig: parseObject(row.integration_config),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapRound(row: Record<string, unknown>): TopDogRound {
  const status = String(row.status ?? "waiting");

  return {
    id: parseNumber(row.id),
    seasonId: parseNumber(row.season_id),
    scoreboardId: parseNullableNumber(row.scoreboard_id),
    roundNumber: parseNumber(row.round_number),
    name: String(row.name ?? "League round"),
    scheduledAt: row.scheduled_at ? String(row.scheduled_at) : null,
    venue: String(row.venue ?? "The Tee Lounge"),
    courseName: String(row.course_name ?? ""),
    scoreDirection:
      row.score_direction === "higher_wins" || row.score_direction === "lower_wins"
        ? row.score_direction
        : null,
    differentialDivisor: Math.max(parseNumber(row.differential_divisor, 1), 0.01),
    status: status === "live" || status === "final" ? status : "waiting",
    isCurrent: Boolean(row.is_current),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapStreamState(
  row: Record<string, unknown> | null,
  seasonId: number
): TopDogStreamState {
  const centralOverlay = String(row?.central_overlay ?? "none") as TopDogCentralOverlay;

  return {
    id: parseNumber(row?.id),
    seasonId,
    roundId: parseNullableNumber(row?.round_id),
    featuredFixtureId: parseNullableNumber(row?.featured_fixture_id),
    scorebugFixtureId: parseNullableNumber(row?.scorebug_fixture_id),
    scorebugVisible: row?.scorebug_visible !== false,
    tickerVisible: row?.ticker_visible !== false,
    tickerPaused: Boolean(row?.ticker_paused),
    tickerIntervalSeconds: parseNumber(row?.ticker_interval_seconds, 12),
    tickerCategories: parseTickerCategories(row?.ticker_categories),
    tickerManualMessage: String(row?.ticker_manual_message ?? ""),
    centralOverlay,
    centralOverlayVisible: Boolean(row?.central_overlay_visible),
    overlayPayload: parseObject(row?.overlay_payload),
    updatedAt: String(row?.updated_at ?? ""),
  };
}

function mapFixture(
  row: Record<string, unknown>,
  teamsById: Map<number, CgsTeam>,
  undoFixtureIds: Set<number>
): TopDogFixture | null {
  const homeTeam = teamsById.get(parseNumber(row.home_team_id));
  const awayTeam = teamsById.get(parseNumber(row.away_team_id));

  if (!homeTeam || !awayTeam) {
    return null;
  }

  const status = String(row.status ?? "waiting");
  const holesTotal = parseNumber(row.holes_total, 9);
  const currentHole = Math.min(parseNumber(row.current_hole), holesTotal);
  const id = parseNumber(row.id);

  return {
    id,
    roundId: parseNumber(row.round_id),
    displayOrder: parseNumber(row.display_order, 99),
    scheduledAt: row.scheduled_at ? String(row.scheduled_at) : null,
    simulatorBay: String(row.simulator_bay ?? ""),
    status: status === "live" || status === "final" ? status : "waiting",
    homeTeam,
    awayTeam,
    homeScore: parseNumber(row.home_score),
    awayScore: parseNumber(row.away_score),
    homeScoreConfirmed: Boolean(row.home_score_confirmed),
    awayScoreConfirmed: Boolean(row.away_score_confirmed),
    currentHole,
    holesTotal,
    holesRemaining: Math.max(holesTotal - currentHole, 0),
    resultNote: String(row.result_note ?? ""),
    isMatchOfNight: Boolean(row.is_match_of_night),
    startedAt: row.started_at ? String(row.started_at) : null,
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    updatedAt: String(row.updated_at ?? ""),
    canUndo: undoFixtureIds.has(id),
  };
}

type LadderAccumulator = Omit<
  TopDogStanding,
  "position" | "previousPosition" | "movement" | "qualification"
>;

function getQualification(position: number): TopDogStanding["qualification"] {
  if (position <= 4) {
    return "direct-finals";
  }

  if (position <= 6) {
    return "wildcard";
  }

  return "outside";
}

export function getTopDogScoreMargin(
  season: Pick<TopDogSeason, "scoreDirection">,
  score: number,
  opponentScore: number
) {
  return season.scoreDirection === "lower_wins"
    ? opponentScore - score
    : score - opponentScore;
}

export function getTopDogRoundScoreMargin(
  season: Pick<TopDogSeason, "scoreDirection">,
  round: Pick<TopDogRound, "scoreDirection" | "differentialDivisor"> | null,
  score: number,
  opponentScore: number
) {
  const rawMargin = getTopDogScoreMargin(
    { scoreDirection: round?.scoreDirection ?? season.scoreDirection },
    score,
    opponentScore
  );
  const divisor = Math.max(round?.differentialDivisor ?? 1, 0.01);

  return Math.sign(rawMargin) * Math.ceil(Math.abs(rawMargin) / divisor);
}

function calculateLadder(
  season: TopDogSeason,
  seasonTeams: TopDogSeasonTeam[],
  rounds: TopDogRound[],
  fixtures: TopDogFixture[],
  includeLive: boolean,
  previousPositions?: Map<number, number>
) {
  const rows = new Map<number, LadderAccumulator>();
  const roundsById = new Map(rounds.map((round) => [round.id, round]));

  seasonTeams
    .filter((membership) => membership.isActive)
    .forEach((membership) => {
      rows.set(membership.team.id, {
        team: membership.team,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        differential: membership.differentialAdjustment,
        points: membership.pointsAdjustment,
        pointsAdjustment: membership.pointsAdjustment,
        adjustmentNote: membership.adjustmentNote,
      });
    });

  fixtures
    .filter(
      (fixture) =>
        fixture.homeScoreConfirmed &&
        fixture.awayScoreConfirmed &&
        (fixture.status === "final" || (includeLive && fixture.status === "live"))
    )
    .forEach((fixture) => {
      const home = rows.get(fixture.homeTeam.id);
      const away = rows.get(fixture.awayTeam.id);

      if (!home || !away) {
        return;
      }

      home.played += 1;
      away.played += 1;
      const homeMargin = getTopDogRoundScoreMargin(
        season,
        roundsById.get(fixture.roundId) ?? null,
        fixture.homeScore,
        fixture.awayScore
      );
      home.differential += homeMargin;
      away.differential -= homeMargin;

      if (homeMargin > 0) {
        home.wins += 1;
        home.points += season.winPoints;
        away.losses += 1;
        away.points += season.lossPoints;
      } else if (homeMargin < 0) {
        away.wins += 1;
        away.points += season.winPoints;
        home.losses += 1;
        home.points += season.lossPoints;
      } else {
        home.draws += 1;
        away.draws += 1;
        home.points += season.drawPoints;
        away.points += season.drawPoints;
      }
    });

  const sortedRows = [...rows.values()].sort((left, right) => {
    if (left.points !== right.points) {
      return right.points - left.points;
    }

    if (left.differential !== right.differential) {
      return right.differential - left.differential;
    }

    if (left.wins !== right.wins) {
      return right.wins - left.wins;
    }

    return left.team.name.localeCompare(right.team.name, "en-AU");
  });

  return sortedRows.map((row, index): TopDogStanding => {
    const position = index + 1;
    const previousPosition = previousPositions?.get(row.team.id) ?? null;

    return {
      ...row,
      position,
      previousPosition,
      movement: previousPosition === null ? 0 : previousPosition - position,
      qualification: getQualification(position),
    };
  });
}

async function loadSeason(seasonSlug: string | null, publishedOnly: boolean) {
  const supabaseAdmin = getSupabaseAdmin();
  const baseQuery = () => {
    let query = supabaseAdmin.from("top_dog_seasons").select("*");

    if (publishedOnly) {
      query = query.eq("is_published", true);
    }

    return query;
  };

  if (seasonSlug) {
    const { data, error } = await withTimeout(
      baseQuery().eq("slug", seasonSlug).maybeSingle(),
      TOP_DOG_QUERY_TIMEOUT_MS,
      "Top Dog season by slug query"
    );

    if (error) {
      throw error;
    }

    return data ? mapSeason(data as Record<string, unknown>) : null;
  }

  const activeResult = await withTimeout(
    baseQuery().eq("is_active", true).maybeSingle(),
    TOP_DOG_QUERY_TIMEOUT_MS,
    "Active Top Dog season query"
  );

  if (activeResult.error) {
    throw activeResult.error;
  }

  if (activeResult.data) {
    return mapSeason(activeResult.data as Record<string, unknown>);
  }

  const latestResult = await withTimeout(
    baseQuery().order("starts_on", { ascending: false, nullsFirst: false }).limit(1),
    TOP_DOG_QUERY_TIMEOUT_MS,
    "Latest Top Dog season query"
  );

  if (latestResult.error) {
    throw latestResult.error;
  }

  const row = latestResult.data?.[0];
  return row ? mapSeason(row as Record<string, unknown>) : null;
}

async function loadTopDogSnapshot(input: {
  seasonSlug?: string | null;
  roundId?: number | null;
  publishedOnly: boolean;
  includeUndo: boolean;
}): Promise<TopDogSnapshot | null> {
  const supabaseAdmin = getSupabaseAdmin();
  const season = await loadSeason(input.seasonSlug ?? null, input.publishedOnly);

  if (!season) {
    return null;
  }

  const [membershipResult, roundsResult, streamResult] = await Promise.all([
    withTimeout(
      supabaseAdmin
        .from("top_dog_season_teams")
        .select("*")
        .eq("season_id", season.id)
        .order("display_order", { ascending: true }),
      TOP_DOG_QUERY_TIMEOUT_MS,
      "Top Dog season teams query"
    ),
    withTimeout(
      supabaseAdmin
        .from("top_dog_rounds")
        .select("*")
        .eq("season_id", season.id)
        .order("round_number", { ascending: true }),
      TOP_DOG_QUERY_TIMEOUT_MS,
      "Top Dog rounds query"
    ),
    withTimeout(
      supabaseAdmin
        .from("top_dog_stream_state")
        .select("*")
        .eq("season_id", season.id)
        .maybeSingle(),
      TOP_DOG_QUERY_TIMEOUT_MS,
      "Top Dog stream state query"
    ),
  ]);

  if (membershipResult.error) {
    throw membershipResult.error;
  }

  if (roundsResult.error) {
    throw roundsResult.error;
  }

  if (streamResult.error) {
    throw streamResult.error;
  }

  const membershipRows = (membershipResult.data ?? []) as Record<string, unknown>[];
  const rounds = ((roundsResult.data ?? []) as Record<string, unknown>[]).map(mapRound);
  const teamIds = [...new Set(membershipRows.map((row) => parseNumber(row.team_id)))];
  const roundIds = rounds.map((round) => round.id);

  const teamsResult = teamIds.length
    ? await withTimeout(
        supabaseAdmin.from("cgs_teams").select("*").in("id", teamIds),
        TOP_DOG_QUERY_TIMEOUT_MS,
        "CGS teams query"
      )
    : { data: [], error: null };

  if (teamsResult.error) {
    throw teamsResult.error;
  }

  const teams = ((teamsResult.data ?? []) as Record<string, unknown>[]).map(mapTeam);
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const seasonTeams = membershipRows
    .map((row): TopDogSeasonTeam | null => {
      const team = teamsById.get(parseNumber(row.team_id));

      if (!team) {
        return null;
      }

      return {
        id: parseNumber(row.id),
        seasonId: season.id,
        displayOrder: parseNumber(row.display_order, 99),
        isActive: row.is_active !== false,
        pointsAdjustment: parseNumber(row.points_adjustment),
        differentialAdjustment: parseNumber(row.differential_adjustment),
        adjustmentNote: String(row.adjustment_note ?? ""),
        team,
      };
    })
    .filter((item): item is TopDogSeasonTeam => item !== null);

  const fixtureResult = roundIds.length
    ? await withTimeout(
        supabaseAdmin
          .from("top_dog_fixtures")
          .select("*")
          .in("round_id", roundIds)
          .order("display_order", { ascending: true }),
        TOP_DOG_QUERY_TIMEOUT_MS,
        "Top Dog fixtures query"
      )
    : { data: [], error: null };

  if (fixtureResult.error) {
    throw fixtureResult.error;
  }

  const fixtureRows = (fixtureResult.data ?? []) as Record<string, unknown>[];
  const fixtureIds = fixtureRows.map((row) => parseNumber(row.id));
  const historyResult = input.includeUndo && fixtureIds.length
    ? await withTimeout(
        supabaseAdmin
          .from("top_dog_fixture_history")
          .select("id, fixture_id, action")
          .in("fixture_id", fixtureIds)
          .order("id", { ascending: false }),
        TOP_DOG_QUERY_TIMEOUT_MS,
        "Top Dog fixture undo query"
      )
    : { data: [], error: null };

  if (historyResult.error) {
    throw historyResult.error;
  }

  const latestHistoryActionByFixture = new Map<number, string>();

  ((historyResult.data ?? []) as Record<string, unknown>[]).forEach((row) => {
    const fixtureId = parseNumber(row.fixture_id);

    if (!latestHistoryActionByFixture.has(fixtureId)) {
      latestHistoryActionByFixture.set(fixtureId, String(row.action ?? ""));
    }
  });

  const undoFixtureIds = new Set(
    [...latestHistoryActionByFixture.entries()]
      .filter(([, action]) => action !== "official_import_boundary")
      .map(([fixtureId]) => fixtureId)
  );
  const allFixtures = fixtureRows
    .map((row) => mapFixture(row, teamsById, undoFixtureIds))
    .filter((fixture): fixture is TopDogFixture => fixture !== null);

  const selectedRound =
    rounds.find((round) => round.id === input.roundId) ??
    rounds.find((round) => round.isCurrent) ??
    rounds.find((round) => round.status === "live") ??
    [...rounds].reverse().find((round) => round.status === "waiting") ??
    rounds.at(-1) ??
    null;
  const fixtures = selectedRound
    ? allFixtures.filter((fixture) => fixture.roundId === selectedRound.id)
    : [];
  const officialLadder = calculateLadder(
    season,
    seasonTeams,
    rounds,
    allFixtures,
    false
  );
  const officialPositions = new Map(
    officialLadder.map((standing) => [standing.team.id, standing.position])
  );
  const projectedLadder = calculateLadder(
    season,
    seasonTeams,
    rounds,
    allFixtures,
    true,
    officialPositions
  );

  return {
    season,
    seasonTeams,
    rounds,
    selectedRound,
    fixtures,
    allFixtures,
    officialLadder,
    projectedLadder,
    streamState: mapStreamState(
      streamResult.data as Record<string, unknown> | null,
      season.id
    ),
    generatedAt: new Date().toISOString(),
  };
}

export async function getAdminTopDogSnapshot(input?: {
  seasonSlug?: string | null;
  roundId?: number | null;
}): Promise<TopDogFeed> {
  try {
    return {
      snapshot: await loadTopDogSnapshot({
        seasonSlug: input?.seasonSlug,
        roundId: input?.roundId,
        publishedOnly: false,
        includeUndo: true,
      }),
      source: "database",
      warningMessage: null,
    };
  } catch (error) {
    console.error("Admin Top Dog snapshot query error:", error);

    return {
      snapshot: null,
      source: "fallback",
      warningMessage: isMissingTopDogTableError(error)
        ? missingTableMessage
        : "League Night Control could not load from Supabase. Existing site tools remain available while the connection recovers.",
    };
  }
}

export async function getPublishedTopDogSnapshot(
  seasonSlug: string,
  roundId?: number | null
) {
  try {
    return await loadTopDogSnapshot({
      seasonSlug,
      roundId,
      publishedOnly: true,
      includeUndo: false,
    });
  } catch (error) {
    console.error("Published Top Dog snapshot query error:", error);
    return null;
  }
}

export function normalizeTopDogSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function createTopDogSeason(input: {
  name: string;
  slug: string;
  seasonLabel: string;
  defaultHoles: number;
  isPublished: boolean;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const now = new Date().toISOString();

  await supabaseAdmin
    .from("top_dog_seasons")
    .update({ is_active: false, updated_at: now })
    .eq("is_active", true);

  const { data, error } = await supabaseAdmin
    .from("top_dog_seasons")
    .insert({
      name: input.name,
      slug: input.slug,
      season_label: input.seasonLabel,
      default_holes: input.defaultHoles,
      win_points: 3,
      draw_points: 2,
      loss_points: 1,
      score_direction: "lower_wins",
      is_active: true,
      is_published: input.isPublished,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  const seasonId = parseNumber(data.id);
  const streamResult = await supabaseAdmin.from("top_dog_stream_state").insert({
    season_id: seasonId,
    updated_at: now,
  });

  if (streamResult.error) {
    throw streamResult.error;
  }

  return seasonId;
}

export async function createCgsTeamForSeason(input: {
  seasonId: number;
  name: string;
  shortName: string;
  accentColor: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const slug = normalizeTopDogSlug(input.name);
  const now = new Date().toISOString();
  const { data: teamData, error: teamError } = await supabaseAdmin
    .from("cgs_teams")
    .upsert(
      {
        slug,
        name: input.name,
        short_name: input.shortName,
        accent_color: input.accentColor,
        is_active: true,
        updated_at: now,
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();

  if (teamError) {
    throw teamError;
  }

  const { data: membershipRows, error: membershipError } = await supabaseAdmin
    .from("top_dog_season_teams")
    .select("display_order")
    .eq("season_id", input.seasonId)
    .order("display_order", { ascending: false })
    .limit(1);

  if (membershipError) {
    throw membershipError;
  }

  const nextOrder = parseNumber(membershipRows?.[0]?.display_order) + 1;
  const { error } = await supabaseAdmin.from("top_dog_season_teams").upsert(
    {
      season_id: input.seasonId,
      team_id: parseNumber(teamData.id),
      display_order: nextOrder,
      is_active: true,
      updated_at: now,
    },
    { onConflict: "season_id,team_id" }
  );

  if (error) {
    throw error;
  }
}

export async function createTopDogRound(input: {
  seasonId: number;
  roundNumber: number;
  name: string;
  scheduledAt: string | null;
  venue: string;
  courseName: string;
  scoreDirection: TopDogScoreDirection | null;
  differentialDivisor: number;
  isCurrent: boolean;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (input.isCurrent) {
    const clearResult = await supabaseAdmin
      .from("top_dog_rounds")
      .update({ is_current: false, updated_at: now })
      .eq("season_id", input.seasonId)
      .eq("is_current", true);

    if (clearResult.error) {
      throw clearResult.error;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("top_dog_rounds")
    .insert({
      season_id: input.seasonId,
      round_number: input.roundNumber,
      name: input.name,
      scheduled_at: input.scheduledAt,
      venue: input.venue,
      course_name: input.courseName,
      score_direction: input.scoreDirection,
      differential_divisor: input.differentialDivisor,
      status: "waiting",
      is_current: input.isCurrent,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  if (input.isCurrent) {
    const streamResult = await supabaseAdmin
      .from("top_dog_stream_state")
      .update({ round_id: parseNumber(data.id), updated_at: now })
      .eq("season_id", input.seasonId);

    if (streamResult.error) {
      throw streamResult.error;
    }
  }

  return parseNumber(data.id);
}

export async function createTopDogFixture(input: {
  seasonId: number;
  roundId: number;
  homeTeamId: number;
  awayTeamId: number;
  scheduledAt: string | null;
  simulatorBay: string;
  holesTotal: number;
}) {
  if (input.homeTeamId === input.awayTeamId) {
    throw new Error("A team cannot play itself.");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: round, error: roundError } = await supabaseAdmin
    .from("top_dog_rounds")
    .select("season_id")
    .eq("id", input.roundId)
    .single();

  if (roundError) {
    throw roundError;
  }

  if (parseNumber(round.season_id) !== input.seasonId) {
    throw new Error("The selected round does not belong to this season.");
  }

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from("top_dog_season_teams")
    .select("team_id")
    .eq("season_id", input.seasonId)
    .in("team_id", [input.homeTeamId, input.awayTeamId]);

  if (membershipError) {
    throw membershipError;
  }

  if ((memberships ?? []).length !== 2) {
    throw new Error("Both fixture teams must belong to the selected season.");
  }

  const { data: fixtureRows, error: fixtureError } = await supabaseAdmin
    .from("top_dog_fixtures")
    .select("display_order")
    .eq("round_id", input.roundId)
    .order("display_order", { ascending: false })
    .limit(1);

  if (fixtureError) {
    throw fixtureError;
  }

  const { error } = await supabaseAdmin.from("top_dog_fixtures").insert({
    round_id: input.roundId,
    home_team_id: input.homeTeamId,
    away_team_id: input.awayTeamId,
    display_order: parseNumber(fixtureRows?.[0]?.display_order) + 1,
    scheduled_at: input.scheduledAt,
    simulator_bay: input.simulatorBay,
    holes_total: input.holesTotal,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
}

export async function updateTopDogFixture(input: {
  fixtureId: number;
  seasonId: number;
  roundId: number;
  homeTeamId: number;
  awayTeamId: number;
  scheduledAt: string | null;
  simulatorBay: string;
  holesTotal: number;
  displayOrder: number;
}) {
  if (input.homeTeamId === input.awayTeamId) {
    throw new Error("A team cannot play itself.");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const [fixtureResult, roundResult, membershipResult] = await Promise.all([
    supabaseAdmin
      .from("top_dog_fixtures")
      .select("*")
      .eq("id", input.fixtureId)
      .single(),
    supabaseAdmin
      .from("top_dog_rounds")
      .select("season_id")
      .eq("id", input.roundId)
      .single(),
    supabaseAdmin
      .from("top_dog_season_teams")
      .select("team_id")
      .eq("season_id", input.seasonId)
      .in("team_id", [input.homeTeamId, input.awayTeamId]),
  ]);

  if (fixtureResult.error) {
    throw fixtureResult.error;
  }

  if (roundResult.error) {
    throw roundResult.error;
  }

  if (membershipResult.error) {
    throw membershipResult.error;
  }

  if (parseNumber(roundResult.data.season_id) !== input.seasonId) {
    throw new Error("The selected round does not belong to this season.");
  }

  if ((membershipResult.data ?? []).length !== 2) {
    throw new Error("Both fixture teams must belong to the selected season.");
  }

  const currentFixture = fixtureResult.data as Record<string, unknown>;
  const currentRoundId = parseNumber(currentFixture.round_id);
  const { data: currentRound, error: currentRoundError } = await supabaseAdmin
    .from("top_dog_rounds")
    .select("season_id")
    .eq("id", currentRoundId)
    .single();

  if (currentRoundError) {
    throw currentRoundError;
  }

  if (parseNumber(currentRound.season_id) !== input.seasonId) {
    throw new Error("The fixture does not belong to this season.");
  }

  const historyResult = await supabaseAdmin
    .from("top_dog_fixture_history")
    .insert({
      fixture_id: input.fixtureId,
      action: "edit_fixture",
      snapshot: currentFixture,
    })
    .select("id")
    .single();

  if (historyResult.error) {
    throw historyResult.error;
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("top_dog_fixtures")
    .update({
      round_id: input.roundId,
      home_team_id: input.homeTeamId,
      away_team_id: input.awayTeamId,
      display_order: input.displayOrder,
      scheduled_at: input.scheduledAt,
      simulator_bay: input.simulatorBay,
      holes_total: input.holesTotal,
      current_hole: Math.min(parseNumber(currentFixture.current_hole), input.holesTotal),
      is_match_of_night:
        currentRoundId === input.roundId && Boolean(currentFixture.is_match_of_night),
      updated_at: now,
    })
    .eq("id", input.fixtureId);

  if (error) {
    await supabaseAdmin
      .from("top_dog_fixture_history")
      .delete()
      .eq("id", historyResult.data.id);
    throw error;
  }
}

export async function deleteTopDogFixture(input: {
  fixtureId: number;
  seasonId: number;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: fixture, error: fixtureError } = await supabaseAdmin
    .from("top_dog_fixtures")
    .select("round_id")
    .eq("id", input.fixtureId)
    .single();

  if (fixtureError) {
    throw fixtureError;
  }

  const { data: round, error: roundError } = await supabaseAdmin
    .from("top_dog_rounds")
    .select("season_id")
    .eq("id", parseNumber(fixture.round_id))
    .single();

  if (roundError) {
    throw roundError;
  }

  if (parseNumber(round.season_id) !== input.seasonId) {
    throw new Error("The fixture does not belong to this season.");
  }

  const { error } = await supabaseAdmin
    .from("top_dog_fixtures")
    .delete()
    .eq("id", input.fixtureId);

  if (error) {
    throw error;
  }
}

export async function applyTopDogFixtureCommand(input: {
  fixtureId: number;
  command: TopDogFixtureCommand;
  payload?: Record<string, unknown>;
}) {
  const supabaseAdmin = getSupabaseAdmin();

  if (input.command === "undo") {
    const { data: latestHistory, error: historyError } = await supabaseAdmin
      .from("top_dog_fixture_history")
      .select("action")
      .eq("fixture_id", input.fixtureId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (historyError) {
      throw historyError;
    }

    if (latestHistory?.action === "official_import_boundary") {
      return;
    }
  }

  const { data, error } = await supabaseAdmin.rpc("apply_top_dog_fixture_command", {
    p_fixture_id: input.fixtureId,
    p_command: input.command,
    p_payload: input.payload ?? {},
  });

  if (error) {
    throw error;
  }

  const fixtureRow = Array.isArray(data) ? data[0] : data;
  const roundId = parseNumber((fixtureRow as Record<string, unknown> | null)?.round_id);

  if (!roundId) {
    return;
  }

  const { data: roundData, error: roundError } = await supabaseAdmin
    .from("top_dog_rounds")
    .select("season_id")
    .eq("id", roundId)
    .single();

  if (roundError) {
    throw roundError;
  }

  const seasonId = parseNumber(roundData.season_id);
  const now = new Date().toISOString();

  if (["start", "next_hole", "reopen"].includes(input.command)) {
    const clearCurrentResult = await supabaseAdmin
      .from("top_dog_rounds")
      .update({ is_current: false, updated_at: now })
      .eq("season_id", seasonId)
      .neq("id", roundId);

    if (clearCurrentResult.error) {
      throw clearCurrentResult.error;
    }

    const roundUpdateResult = await supabaseAdmin
      .from("top_dog_rounds")
      .update({ status: "live", is_current: true, updated_at: now })
      .eq("id", roundId);

    if (roundUpdateResult.error) {
      throw roundUpdateResult.error;
    }

    const streamUpdateResult = await supabaseAdmin
      .from("top_dog_stream_state")
      .update({ round_id: roundId, updated_at: now })
      .eq("season_id", seasonId);

    if (streamUpdateResult.error) {
      throw streamUpdateResult.error;
    }
  }

  if (input.command === "finish") {
    const { data: unfinished, error: unfinishedError } = await supabaseAdmin
      .from("top_dog_fixtures")
      .select("id")
      .eq("round_id", roundId)
      .neq("status", "final")
      .limit(1);

    if (unfinishedError) {
      throw unfinishedError;
    }

    if ((unfinished ?? []).length === 0) {
      const roundFinishResult = await supabaseAdmin
        .from("top_dog_rounds")
        .update({ status: "final", updated_at: now })
        .eq("id", roundId);

      if (roundFinishResult.error) {
        throw roundFinishResult.error;
      }
    }
  }
}

export async function updateTopDogStreamState(
  seasonId: number,
  updates: Partial<{
    roundId: number | null;
    featuredFixtureId: number | null;
    scorebugFixtureId: number | null;
    scorebugVisible: boolean;
    tickerVisible: boolean;
    tickerPaused: boolean;
    tickerIntervalSeconds: number;
    tickerCategories: TopDogTickerCategory[];
    tickerManualMessage: string;
    centralOverlay: TopDogCentralOverlay;
    centralOverlayVisible: boolean;
    overlayPayload: Record<string, unknown>;
  }>
) {
  const databaseUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  const columnMap = {
    roundId: "round_id",
    featuredFixtureId: "featured_fixture_id",
    scorebugFixtureId: "scorebug_fixture_id",
    scorebugVisible: "scorebug_visible",
    tickerVisible: "ticker_visible",
    tickerPaused: "ticker_paused",
    tickerIntervalSeconds: "ticker_interval_seconds",
    tickerCategories: "ticker_categories",
    tickerManualMessage: "ticker_manual_message",
    centralOverlay: "central_overlay",
    centralOverlayVisible: "central_overlay_visible",
    overlayPayload: "overlay_payload",
  } as const;

  (Object.keys(columnMap) as Array<keyof typeof columnMap>).forEach((key) => {
    if (updates[key] !== undefined) {
      databaseUpdates[columnMap[key]] = updates[key];
    }
  });

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("top_dog_stream_state")
    .update(databaseUpdates)
    .eq("season_id", seasonId);

  if (error) {
    throw error;
  }
}
