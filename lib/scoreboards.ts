import { withTimeout } from "@/lib/async-timeout";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type LeaderboardMode = "gross" | "net";

export type CompetitionScoreEntry = {
  id: number;
  competitionId: number;
  position: number;
  playerName: string;
  grossScore: number | null;
  grossLabel: string;
  thruLabel: string | null;
  isCgsMember: boolean;
  updatedAt: string;
};

export type CompetitionScoreboard = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  statusLabel: string;
  location: string | null;
  formatLabel: string | null;
  roundLabel: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isLive: boolean;
  isPublished: boolean;
  updatedAt: string;
  createdAt: string;
  entries: CompetitionScoreEntry[];
};

export type ScoreboardFeed = {
  competitions: CompetitionScoreboard[];
  source: "database" | "fallback";
  warningMessage: string | null;
};

type CompetitionScoreboardInput = {
  slug: string;
  title: string;
  summary: string;
  statusLabel: string;
  location: string;
  formatLabel: string;
  roundLabel: string;
  ctaLabel: string;
  ctaHref: string;
  startsAt: string | null;
  endsAt: string | null;
  isLive: boolean;
  isPublished: boolean;
};

type CompetitionScoreEntryInput = {
  competitionId: number;
  playerName: string;
  grossScore: number | null;
  thruLabel: string;
  isCgsMember: boolean;
};

const missingTableMessage =
  "Competition scoreboards are not set up yet. Apply the latest Supabase migration to start using live scoring.";
const SCOREBOARD_QUERY_TIMEOUT_MS = 3500;

function isMissingScoreboardTableError(error: unknown) {
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

function formatGolfScore(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  if (value === 0) {
    return "E";
  }

  const isWholeNumber = Number.isInteger(value);
  const absoluteValue = Math.abs(value);
  const formattedValue = isWholeNumber ? absoluteValue.toString() : absoluteValue.toFixed(1);

  return `${value > 0 ? "+" : "-"}${formattedValue}`;
}

function mapRowToCompetition(row: Record<string, unknown>): CompetitionScoreboard {
  return {
    id: Number(row.id),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    statusLabel: String(row.status_label ?? "Scoreboard"),
    location:
      typeof row.location === "string" && row.location.trim() ? row.location : null,
    formatLabel:
      typeof row.format_label === "string" && row.format_label.trim()
        ? row.format_label
        : null,
    roundLabel:
      typeof row.round_label === "string" && row.round_label.trim()
        ? row.round_label
        : null,
    ctaLabel:
      typeof row.cta_label === "string" && row.cta_label.trim() ? row.cta_label : null,
    ctaHref:
      typeof row.cta_href === "string" && row.cta_href.trim() ? row.cta_href : null,
    startsAt:
      typeof row.starts_at === "string" && row.starts_at.trim() ? row.starts_at : null,
    endsAt:
      typeof row.ends_at === "string" && row.ends_at.trim() ? row.ends_at : null,
    isLive: Boolean(row.is_live),
    isPublished: Boolean(row.is_published),
    updatedAt: String(row.updated_at ?? ""),
    createdAt: String(row.created_at ?? ""),
    entries: [],
  };
}

function mapRowToEntry(row: Record<string, unknown>): CompetitionScoreEntry {
  const grossScore =
    parseNumericValue(row.gross_score) ??
    parseNumericValue(row.score_sort) ??
    parseNumericValue(row.score_display);
  const grossLabel =
    grossScore !== null
      ? formatGolfScore(grossScore)
      : typeof row.score_display === "string" && row.score_display.trim()
        ? row.score_display
        : "--";

  return {
    id: Number(row.id),
    competitionId: Number(row.competition_id),
    position: 99,
    playerName: String(row.player_name ?? ""),
    grossScore,
    grossLabel,
    thruLabel:
      typeof row.thru_label === "string" && row.thru_label.trim() ? row.thru_label : null,
    isCgsMember: Boolean(row.is_cgs_member),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function sortAndRankEntries(entries: CompetitionScoreEntry[]) {
  const sortedEntries = [...entries].sort((left, right) => {
    const leftPrimaryValue = left.grossScore;
    const rightPrimaryValue = right.grossScore;

    if (leftPrimaryValue === null && rightPrimaryValue !== null) {
      return 1;
    }

    if (leftPrimaryValue !== null && rightPrimaryValue === null) {
      return -1;
    }

    if (leftPrimaryValue !== null && rightPrimaryValue !== null) {
      if (leftPrimaryValue !== rightPrimaryValue) {
        return leftPrimaryValue - rightPrimaryValue;
      }
    }

    if (left.grossScore !== null && right.grossScore !== null) {
      if (left.grossScore !== right.grossScore) {
        return left.grossScore - right.grossScore;
      }
    } else if (left.grossScore === null && right.grossScore !== null) {
      return 1;
    } else if (left.grossScore !== null && right.grossScore === null) {
      return -1;
    }

    return left.playerName.localeCompare(right.playerName, "en-AU");
  });

  let previousRankingValue: number | null = null;
  let previousPosition = 0;

  return sortedEntries.map((entry, index) => {
    const rankingValue = entry.grossScore;
    let position = index + 1;

    if (rankingValue !== null && previousRankingValue !== null && rankingValue === previousRankingValue) {
      position = previousPosition;
    }

    previousRankingValue = rankingValue;
    previousPosition = position;

    return {
      ...entry,
      position,
    };
  });
}

function attachEntries(
  competitions: CompetitionScoreboard[],
  entryRows: Record<string, unknown>[]
) {
  const entriesByCompetition = new Map<number, CompetitionScoreEntry[]>();

  entryRows.forEach((row) => {
    const mappedEntry = mapRowToEntry(row);
    const currentEntries = entriesByCompetition.get(mappedEntry.competitionId) ?? [];
    currentEntries.push(mappedEntry);
    entriesByCompetition.set(mappedEntry.competitionId, currentEntries);
  });

  return competitions.map((competition) => ({
    ...competition,
    entries: sortAndRankEntries(entriesByCompetition.get(competition.id) ?? []),
  }));
}

async function loadCompetitionEntries(competitionIds: number[]) {
  if (competitionIds.length === 0) {
    return [];
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await withTimeout(
    supabaseAdmin
      .from("competition_score_entries")
      .select("*")
      .in("competition_id", competitionIds)
      .order("updated_at", { ascending: false }),
    SCOREBOARD_QUERY_TIMEOUT_MS,
    "Competition score entries query"
  );

  if (error) {
    throw error;
  }

  return (data ?? []) as Record<string, unknown>[];
}

async function touchCompetitionScoreboard(competitionId: number) {
  const supabaseAdmin = getSupabaseAdmin();

  const { error } = await supabaseAdmin
    .from("competition_scoreboards")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", competitionId);

  if (error) {
    throw error;
  }
}

export async function getPublishedCompetitionScoreboards(
  limit = 12
): Promise<ScoreboardFeed> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await withTimeout(
      supabaseAdmin
        .from("competition_scoreboards")
        .select("*")
        .eq("is_published", true)
        .order("is_live", { ascending: false })
        .order("starts_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(limit),
      SCOREBOARD_QUERY_TIMEOUT_MS,
      "Published competition scoreboards query"
    );

    if (error) {
      if (isMissingScoreboardTableError(error)) {
        return {
          competitions: [],
          source: "fallback",
          warningMessage: missingTableMessage,
        };
      }

      throw error;
    }

    const competitions = (data ?? []).map((row) =>
      mapRowToCompetition(row as Record<string, unknown>)
    );
    const entryRows = await loadCompetitionEntries(competitions.map((item) => item.id));

    return {
      competitions: attachEntries(competitions, entryRows),
      source: "database",
      warningMessage: null,
    };
  } catch (error) {
    console.error("Published competition scoreboards query error:", error);

    return {
      competitions: [],
      source: "fallback",
      warningMessage:
        "Live scoreboards could not be loaded right now, so the directory is temporarily empty.",
    };
  }
}

export async function getPublishedCompetitionScoreboardBySlug(slug: string) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await withTimeout(
      supabaseAdmin
        .from("competition_scoreboards")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle(),
      SCOREBOARD_QUERY_TIMEOUT_MS,
      "Published competition scoreboard by slug query"
    );

    if (error) {
      if (isMissingScoreboardTableError(error)) {
        return null;
      }

      throw error;
    }

    if (!data) {
      return null;
    }

    const competition = mapRowToCompetition(data as Record<string, unknown>);
    const entryRows = await loadCompetitionEntries([competition.id]);
    const [mappedCompetition] = attachEntries([competition], entryRows);

    return mappedCompetition;
  } catch (error) {
    console.error("Published competition scoreboard by slug query error:", error);
    return null;
  }
}

export async function getAdminCompetitionScoreboards(
  limit = 20
): Promise<ScoreboardFeed> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await withTimeout(
      supabaseAdmin
        .from("competition_scoreboards")
        .select("*")
        .order("is_live", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(limit),
      SCOREBOARD_QUERY_TIMEOUT_MS,
      "Admin competition scoreboards query"
    );

    if (error) {
      if (isMissingScoreboardTableError(error)) {
        return {
          competitions: [],
          source: "fallback",
          warningMessage: missingTableMessage,
        };
      }

      throw error;
    }

    const competitions = (data ?? []).map((row) =>
      mapRowToCompetition(row as Record<string, unknown>)
    );
    const entryRows = await loadCompetitionEntries(competitions.map((item) => item.id));

    return {
      competitions: attachEntries(competitions, entryRows),
      source: "database",
      warningMessage: null,
    };
  } catch (error) {
    console.error("Admin competition scoreboards query error:", error);

    return {
      competitions: [],
      source: "fallback",
      warningMessage:
        "Live scoreboards could not be loaded right now. Check the latest Supabase migration and try again.",
    };
  }
}

export async function createCompetitionScoreboard(input: CompetitionScoreboardInput) {
  const supabaseAdmin = getSupabaseAdmin();

  const { error } = await supabaseAdmin.from("competition_scoreboards").insert([
    {
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      status_label: input.statusLabel,
      leaderboard_mode: "gross",
      location: input.location || null,
      format_label: input.formatLabel || null,
      round_label: input.roundLabel || null,
      cta_label: input.ctaLabel || null,
      cta_href: input.ctaHref || null,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      is_live: input.isLive,
      is_published: input.isPublished,
      updated_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    throw error;
  }
}

export async function updateCompetitionScoreboard(
  id: number,
  input: CompetitionScoreboardInput
) {
  const supabaseAdmin = getSupabaseAdmin();

  const { error } = await supabaseAdmin
    .from("competition_scoreboards")
    .update({
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      status_label: input.statusLabel,
      leaderboard_mode: "gross",
      location: input.location || null,
      format_label: input.formatLabel || null,
      round_label: input.roundLabel || null,
      cta_label: input.ctaLabel || null,
      cta_href: input.ctaHref || null,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      is_live: input.isLive,
      is_published: input.isPublished,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function createCompetitionScoreEntry(input: CompetitionScoreEntryInput) {
  const supabaseAdmin = getSupabaseAdmin();

  const { error } = await supabaseAdmin.from("competition_score_entries").insert([
    {
      competition_id: input.competitionId,
      player_name: input.playerName,
      gross_score: input.grossScore,
      handicap_strokes: 0,
      is_cgs_member: input.isCgsMember,
      position: 99,
      score_display: formatGolfScore(input.grossScore),
      score_sort: input.grossScore ?? 0,
      thru_label: input.thruLabel || null,
      status_label: null,
      highlight_note: null,
      is_featured: false,
      updated_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    throw error;
  }

  await touchCompetitionScoreboard(input.competitionId);
}

export async function updateCompetitionScoreEntry(
  id: number,
  input: CompetitionScoreEntryInput
) {
  const supabaseAdmin = getSupabaseAdmin();

  const { error } = await supabaseAdmin
    .from("competition_score_entries")
    .update({
      player_name: input.playerName,
      gross_score: input.grossScore,
      handicap_strokes: 0,
      is_cgs_member: input.isCgsMember,
      score_display: formatGolfScore(input.grossScore),
      score_sort: input.grossScore ?? 0,
      thru_label: input.thruLabel || null,
      status_label: null,
      highlight_note: null,
      is_featured: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }

  await touchCompetitionScoreboard(input.competitionId);
}

export async function updateCompetitionScoreEntryScore(
  id: number,
  competitionId: number,
  grossScore: number | null
) {
  const supabaseAdmin = getSupabaseAdmin();

  const { error } = await supabaseAdmin
    .from("competition_score_entries")
    .update({
      gross_score: grossScore,
      score_display: formatGolfScore(grossScore),
      score_sort: grossScore ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }

  await touchCompetitionScoreboard(competitionId);
}

export async function deleteCompetitionScoreEntry(id: number, competitionId: number) {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("competition_score_entries")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }

  await touchCompetitionScoreboard(competitionId);
}
