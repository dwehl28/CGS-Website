import { withTimeout } from "@/lib/async-timeout";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  getTopDogScoreMargin,
  normalizeTopDogSlug,
  type CgsTeam,
  type TopDogCentralOverlay,
  type TopDogSnapshot,
  updateTopDogStreamState,
} from "@/lib/top-dog";

const QUERY_TIMEOUT_MS = 5000;

export const TOP_DOG_PRIZE_CATEGORIES = [
  "best_team",
  "longest_drive",
  "ctp",
  "bunker_boy",
  "shot_of_night",
  "player_of_night",
  "sponsor_prize",
  "custom",
] as const;

export const TOP_DOG_CLIP_TAGS = [
  "great_shot",
  "fail",
  "celebration",
  "bunker_boy",
  "trash_talk",
  "interview",
  "one_putt",
  "sponsor",
  "funny_moment",
  "other",
] as const;

export const TOP_DOG_INTERVIEW_TYPES = [
  "pre_match",
  "post_match",
  "winner",
  "prize_winner",
  "other",
] as const;

export const TOP_DOG_SEGMENT_TYPES = [
  "doghouse",
  "shot_of_night",
  "butters_board",
  "stat_of_week",
] as const;

export type TopDogPrizeCategory = (typeof TOP_DOG_PRIZE_CATEGORIES)[number];
export type TopDogClipTag = (typeof TOP_DOG_CLIP_TAGS)[number];
export type TopDogInterviewType = (typeof TOP_DOG_INTERVIEW_TYPES)[number];
export type TopDogSegmentType = (typeof TOP_DOG_SEGMENT_TYPES)[number];

export type CgsSponsor = {
  id: number;
  slug: string;
  name: string;
  logoUrl: string;
  websiteUrl: string;
  promoCode: string;
  prizeSupplied: string;
  campaign: string;
  notes: string;
  isActive: boolean;
};

export type TopDogPlayerOption = {
  profileId: string;
  teamId: number;
  teamName: string;
  displayName: string;
  avatarUrl: string;
};

export type TopDogProfileDirectoryItem = {
  profileId: string;
  displayName: string;
  avatarUrl: string;
  teamId: number | null;
  teamName: string;
};

export type TopDogPrize = {
  id: number;
  seasonId: number;
  roundId: number;
  category: TopDogPrizeCategory;
  customCategory: string;
  profileId: string | null;
  teamId: number | null;
  displayName: string;
  resultValue: string;
  prize: string;
  sponsorId: number | null;
  notes: string;
  winnerStatus: "tracking" | "leader" | "winner";
  updatedAt: string;
};

export type TopDogJackpot = {
  id: number;
  seasonId: number;
  roundId: number | null;
  defaultAmount: number;
  currentAmount: number;
  selectedProfileId: string | null;
  selectedTeamId: number | null;
  selectedName: string;
  status: "idle" | "selected" | "reveal" | "countdown" | "miss" | "won" | "rollover";
  startedAt: string | null;
  updatedAt: string;
};

export type TopDogJackpotAttempt = {
  id: number;
  roundId: number | null;
  playerName: string;
  teamId: number | null;
  amount: number;
  result: "pending" | "success" | "miss" | "rollover";
  attemptedAt: string;
};

export type TopDogSponsorActivation = {
  id: number;
  roundId: number;
  sponsorId: number;
  campaign: string;
  prizeSupplied: string;
  notes: string;
  logoDisplayed: boolean;
  verbalMention: boolean;
  productShown: boolean;
  promoCodeShown: boolean;
  winnerPhotographed: boolean;
  sponsorTagged: boolean;
  socialPostCompleted: boolean;
};

export type TopDogInterview = {
  id: number;
  roundId: number;
  fixtureId: number | null;
  profileId: string | null;
  teamId: number | null;
  playerName: string;
  teamLabel: string;
  interviewType: TopDogInterviewType;
  status: "queued" | "live" | "complete";
  suggestedQuestions: string[];
  notes: string;
  updatedAt: string;
};

export type TopDogContentClip = {
  id: number;
  roundId: number;
  fixtureId: number | null;
  profileId: string | null;
  teamId: number | null;
  markedAt: string;
  tag: TopDogClipTag;
  playerName: string;
  note: string;
};

export type TopDogSegment = {
  id: number;
  roundId: number;
  segmentType: TopDogSegmentType;
  title: string;
  primaryText: string;
  secondaryText: string;
  payload: Record<string, unknown>;
  status: "draft" | "confirmed";
  updatedAt: string;
};

export type TopDogChecklistItem = {
  id: number;
  phase: "before" | "during" | "after";
  label: string;
  displayOrder: number;
  isComplete: boolean;
  completedAt: string | null;
};

export type TopDogNightRecap = {
  id: number;
  roundId: number;
  recapText: string;
  payload: Record<string, unknown>;
  generatedAt: string;
};

export type TopDogTeamSeasonStat = {
  team: CgsTeam;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  winPercentage: number;
  points: number;
  differential: number;
  biggestWin: number;
  streak: string;
};

export type TopDogPlayerSeasonStat = {
  player: TopDogPlayerOption;
  appearances: number;
  wins: number;
  longestDrivePb: number | null;
  prizeWins: number;
  onePuttAttempts: number;
  onePuttWins: number;
  bunkerBoyCount: number;
  shotOfNightWins: number;
};

export type TopDogProductionSnapshot = {
  seasonId: number;
  roundId: number | null;
  sponsors: CgsSponsor[];
  prizes: TopDogPrize[];
  jackpot: TopDogJackpot | null;
  jackpotAttempts: TopDogJackpotAttempt[];
  sponsorActivations: TopDogSponsorActivation[];
  interviews: TopDogInterview[];
  clips: TopDogContentClip[];
  segments: TopDogSegment[];
  checklist: TopDogChecklistItem[];
  recap: TopDogNightRecap | null;
  players: TopDogPlayerOption[];
  profileDirectory: TopDogProfileDirectoryItem[];
  teamStats: TopDogTeamSeasonStat[];
  playerStats: TopDogPlayerSeasonStat[];
  generatedAt: string;
};

export type TopDogProductionFeed = {
  snapshot: TopDogProductionSnapshot | null;
  warningMessage: string | null;
};

type DatabaseRow = Record<string, unknown>;

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isMissingProductionTable(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "42P01" || error.code === "PGRST205")
  );
}

function mapSponsor(row: DatabaseRow): CgsSponsor {
  return {
    id: numberValue(row.id),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? "Sponsor"),
    logoUrl: String(row.logo_url ?? ""),
    websiteUrl: String(row.website_url ?? ""),
    promoCode: String(row.promo_code ?? ""),
    prizeSupplied: String(row.prize_supplied ?? ""),
    campaign: String(row.campaign ?? ""),
    notes: String(row.notes ?? ""),
    isActive: row.is_active !== false,
  };
}

function mapPrize(row: DatabaseRow): TopDogPrize {
  return {
    id: numberValue(row.id),
    seasonId: numberValue(row.season_id),
    roundId: numberValue(row.round_id),
    category: String(row.category ?? "custom") as TopDogPrizeCategory,
    customCategory: String(row.custom_category ?? ""),
    profileId: row.profile_id ? String(row.profile_id) : null,
    teamId: nullableNumber(row.team_id),
    displayName: String(row.display_name ?? ""),
    resultValue: String(row.result_value ?? ""),
    prize: String(row.prize ?? ""),
    sponsorId: nullableNumber(row.sponsor_id),
    notes: String(row.notes ?? ""),
    winnerStatus: String(row.winner_status ?? "tracking") as TopDogPrize["winnerStatus"],
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapJackpot(row: DatabaseRow | null): TopDogJackpot | null {
  if (!row) {
    return null;
  }

  return {
    id: numberValue(row.id),
    seasonId: numberValue(row.season_id),
    roundId: nullableNumber(row.round_id),
    defaultAmount: numberValue(row.default_amount, 100),
    currentAmount: numberValue(row.current_amount, 100),
    selectedProfileId: row.selected_profile_id ? String(row.selected_profile_id) : null,
    selectedTeamId: nullableNumber(row.selected_team_id),
    selectedName: String(row.selected_name ?? ""),
    status: String(row.status ?? "idle") as TopDogJackpot["status"],
    startedAt: row.started_at ? String(row.started_at) : null,
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapJackpotAttempt(row: DatabaseRow): TopDogJackpotAttempt {
  return {
    id: numberValue(row.id),
    roundId: nullableNumber(row.round_id),
    playerName: String(row.player_name ?? ""),
    teamId: nullableNumber(row.team_id),
    amount: numberValue(row.amount),
    result: String(row.result ?? "pending") as TopDogJackpotAttempt["result"],
    attemptedAt: String(row.attempted_at ?? row.created_at ?? ""),
  };
}

function mapActivation(row: DatabaseRow): TopDogSponsorActivation {
  return {
    id: numberValue(row.id),
    roundId: numberValue(row.round_id),
    sponsorId: numberValue(row.sponsor_id),
    campaign: String(row.campaign ?? ""),
    prizeSupplied: String(row.prize_supplied ?? ""),
    notes: String(row.notes ?? ""),
    logoDisplayed: Boolean(row.logo_displayed),
    verbalMention: Boolean(row.verbal_mention),
    productShown: Boolean(row.product_shown),
    promoCodeShown: Boolean(row.promo_code_shown),
    winnerPhotographed: Boolean(row.winner_photographed),
    sponsorTagged: Boolean(row.sponsor_tagged),
    socialPostCompleted: Boolean(row.social_post_completed),
  };
}

function mapInterview(row: DatabaseRow): TopDogInterview {
  return {
    id: numberValue(row.id),
    roundId: numberValue(row.round_id),
    fixtureId: nullableNumber(row.fixture_id),
    profileId: row.profile_id ? String(row.profile_id) : null,
    teamId: nullableNumber(row.team_id),
    playerName: String(row.player_name ?? ""),
    teamLabel: String(row.team_label ?? ""),
    interviewType: String(row.interview_type ?? "other") as TopDogInterviewType,
    status: String(row.status ?? "queued") as TopDogInterview["status"],
    suggestedQuestions: stringArray(row.suggested_questions),
    notes: String(row.notes ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapClip(row: DatabaseRow): TopDogContentClip {
  return {
    id: numberValue(row.id),
    roundId: numberValue(row.round_id),
    fixtureId: nullableNumber(row.fixture_id),
    profileId: row.profile_id ? String(row.profile_id) : null,
    teamId: nullableNumber(row.team_id),
    markedAt: String(row.marked_at ?? row.created_at ?? ""),
    tag: String(row.tag ?? "other") as TopDogClipTag,
    playerName: String(row.player_name ?? ""),
    note: String(row.note ?? ""),
  };
}

function mapSegment(row: DatabaseRow): TopDogSegment {
  return {
    id: numberValue(row.id),
    roundId: numberValue(row.round_id),
    segmentType: String(row.segment_type ?? "butters_board") as TopDogSegmentType,
    title: String(row.title ?? ""),
    primaryText: String(row.primary_text ?? ""),
    secondaryText: String(row.secondary_text ?? ""),
    payload: objectValue(row.payload),
    status: String(row.status ?? "draft") as TopDogSegment["status"],
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapChecklistItem(row: DatabaseRow): TopDogChecklistItem {
  return {
    id: numberValue(row.id),
    phase: String(row.phase ?? "before") as TopDogChecklistItem["phase"],
    label: String(row.label ?? ""),
    displayOrder: numberValue(row.display_order, 99),
    isComplete: Boolean(row.is_complete),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

function mapRecap(row: DatabaseRow | null): TopDogNightRecap | null {
  if (!row) {
    return null;
  }

  return {
    id: numberValue(row.id),
    roundId: numberValue(row.round_id),
    recapText: String(row.recap_text ?? ""),
    payload: objectValue(row.payload),
    generatedAt: String(row.generated_at ?? row.updated_at ?? ""),
  };
}

async function assertRoundBelongsToSeason(seasonId: number, roundId: number) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("top_dog_rounds")
    .select("id")
    .eq("id", roundId)
    .eq("season_id", seasonId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("The selected league night does not belong to this season.");
  }
}

async function ensureChecklist(seasonId: number, roundId: number) {
  const supabaseAdmin = getSupabaseAdmin();
  const templateResult = await supabaseAdmin
    .from("top_dog_checklist_templates")
    .select("id")
    .eq("season_id", seasonId)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();

  if (templateResult.error) {
    throw templateResult.error;
  }

  if (!templateResult.data) {
    return;
  }

  const itemResult = await supabaseAdmin
    .from("top_dog_checklist_template_items")
    .select("id, phase, label, display_order")
    .eq("template_id", templateResult.data.id);

  if (itemResult.error) {
    throw itemResult.error;
  }

  if ((itemResult.data ?? []).length === 0) {
    return;
  }

  const { error } = await supabaseAdmin.from("top_dog_round_checklist_items").upsert(
    itemResult.data!.map((item) => ({
      round_id: roundId,
      template_item_id: item.id,
      phase: item.phase,
      label: item.label,
      display_order: item.display_order,
    })),
    { onConflict: "round_id,phase,label", ignoreDuplicates: true }
  );

  if (error) {
    throw error;
  }
}

async function ensureJackpot(seasonId: number) {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("top_dog_jackpots").upsert(
    {
      season_id: seasonId,
      default_amount: 100,
      current_amount: 100,
      status: "idle",
    },
    { onConflict: "season_id", ignoreDuplicates: true }
  );

  if (error) {
    throw error;
  }
}

async function loadPlayers(teamIds: number[]) {
  if (teamIds.length === 0) {
    return [];
  }

  const supabaseAdmin = getSupabaseAdmin();
  const memberResult = await supabaseAdmin
    .from("cgs_team_members")
    .select("team_id, profile_id, display_order")
    .in("team_id", teamIds)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (memberResult.error) {
    throw memberResult.error;
  }

  const profileIds = [...new Set((memberResult.data ?? []).map((item) => item.profile_id))];

  if (profileIds.length === 0) {
    return [];
  }

  const profileResult = await supabaseAdmin
    .from("cgs_profiles")
    .select("id, display_name, nickname, handle, avatar_url")
    .in("id", profileIds);

  if (profileResult.error) {
    throw profileResult.error;
  }

  const profiles = new Map(
    (profileResult.data ?? []).map((profile) => [String(profile.id), profile])
  );

  return (memberResult.data ?? [])
    .map((member): TopDogPlayerOption | null => {
      const profile = profiles.get(String(member.profile_id));

      if (!profile) {
        return null;
      }

      const displayName =
        String(profile.display_name ?? "").trim() ||
        String(profile.nickname ?? "").trim() ||
        String(profile.handle ?? "").trim();

      return {
        profileId: String(profile.id),
        teamId: numberValue(member.team_id),
        teamName: "",
        displayName: displayName || "CGS player",
        avatarUrl: String(profile.avatar_url ?? ""),
      };
    })
    .filter((player): player is TopDogPlayerOption => player !== null);
}

async function loadProfileDirectory(teamIds: number[]) {
  const supabaseAdmin = getSupabaseAdmin();
  const [profileResult, memberResult] = await Promise.all([
    supabaseAdmin
      .from("cgs_profiles")
      .select("id, display_name, nickname, handle, avatar_url")
      .order("display_name", { ascending: true }),
    teamIds.length > 0
      ? supabaseAdmin
          .from("cgs_team_members")
          .select("team_id, profile_id")
          .in("team_id", teamIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (memberResult.error) {
    throw memberResult.error;
  }

  const teamByProfile = new Map(
    (memberResult.data ?? []).map((member) => [String(member.profile_id), numberValue(member.team_id)])
  );

  return (profileResult.data ?? []).map((profile): TopDogProfileDirectoryItem => ({
    profileId: String(profile.id),
    displayName:
      String(profile.display_name ?? "").trim() ||
      String(profile.nickname ?? "").trim() ||
      String(profile.handle ?? "").trim() ||
      "CGS player",
    avatarUrl: String(profile.avatar_url ?? ""),
    teamId: teamByProfile.get(String(profile.id)) ?? null,
    teamName: "",
  }));
}

function calculateTeamStats(core: TopDogSnapshot): TopDogTeamSeasonStat[] {
  const pointsByTeam = new Map(core.officialLadder.map((row) => [row.team.id, row.points]));
  const roundOrder = new Map(core.rounds.map((round) => [round.id, round.roundNumber]));
  const finalFixtures = core.allFixtures
    .filter((fixture) => fixture.status === "final")
    .sort((left, right) => {
      const roundDifference =
        (roundOrder.get(left.roundId) ?? 0) - (roundOrder.get(right.roundId) ?? 0);
      return roundDifference || left.displayOrder - right.displayOrder;
    });

  return core.seasonTeams
    .filter((membership) => membership.isActive)
    .map((membership) => {
      let wins = 0;
      let draws = 0;
      let losses = 0;
      let differential = membership.differentialAdjustment;
      let biggestWin = 0;
      const results: string[] = [];

      finalFixtures.forEach((fixture) => {
        const isHome = fixture.homeTeam.id === membership.team.id;
        const isAway = fixture.awayTeam.id === membership.team.id;

        if (!isHome && !isAway) {
          return;
        }

        const scored = isHome ? fixture.homeScore : fixture.awayScore;
        const conceded = isHome ? fixture.awayScore : fixture.homeScore;
        const margin = getTopDogScoreMargin(core.season, scored, conceded);
        differential += margin;

        if (margin > 0) {
          wins += 1;
          biggestWin = Math.max(biggestWin, margin);
          results.push("W");
        } else if (margin < 0) {
          losses += 1;
          results.push("L");
        } else {
          draws += 1;
          results.push("D");
        }
      });

      const played = wins + draws + losses;
      const lastResult = results.at(-1);
      let streakCount = 0;

      if (lastResult) {
        for (let index = results.length - 1; index >= 0; index -= 1) {
          if (results[index] !== lastResult) {
            break;
          }
          streakCount += 1;
        }
      }

      return {
        team: membership.team,
        played,
        wins,
        draws,
        losses,
        winPercentage: played > 0 ? Math.round((wins / played) * 1000) / 10 : 0,
        points: pointsByTeam.get(membership.team.id) ?? 0,
        differential,
        biggestWin,
        streak: lastResult ? `${lastResult}${streakCount}` : "-",
      };
    })
    .sort((left, right) => right.points - left.points || right.differential - left.differential);
}

function numericResult(value: string) {
  const match = value.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function calculatePlayerStats(
  core: TopDogSnapshot,
  players: TopDogPlayerOption[],
  prizes: TopDogPrize[],
  attempts: TopDogJackpotAttempt[]
): TopDogPlayerSeasonStat[] {
  return players.map((player) => {
    const teamFixtures = core.allFixtures.filter(
      (fixture) =>
        fixture.status === "final" &&
        (fixture.homeTeam.id === player.teamId || fixture.awayTeam.id === player.teamId)
    );
    const playerPrizes = prizes.filter(
      (prize) => prize.profileId === player.profileId || (!prize.profileId && prize.displayName === player.displayName)
    );
    const playerAttempts = attempts.filter(
      (attempt) => attempt.playerName.toLowerCase() === player.displayName.toLowerCase()
    );
    const driveValues = playerPrizes
      .filter((prize) => prize.category === "longest_drive")
      .map((prize) => numericResult(prize.resultValue))
      .filter((value): value is number => value !== null);

    return {
      player,
      appearances: teamFixtures.length,
      wins: teamFixtures.filter((fixture) => {
        const homeWon =
          getTopDogScoreMargin(core.season, fixture.homeScore, fixture.awayScore) > 0;
        const awayWon =
          getTopDogScoreMargin(core.season, fixture.awayScore, fixture.homeScore) > 0;
        return (
          (homeWon && fixture.homeTeam.id === player.teamId) ||
          (awayWon && fixture.awayTeam.id === player.teamId)
        );
      }).length,
      longestDrivePb: driveValues.length > 0 ? Math.max(...driveValues) : null,
      prizeWins: playerPrizes.filter((prize) => prize.winnerStatus === "winner").length,
      onePuttAttempts: playerAttempts.length,
      onePuttWins: playerAttempts.filter((attempt) => attempt.result === "success").length,
      bunkerBoyCount: playerPrizes.filter(
        (prize) => prize.category === "bunker_boy" && prize.winnerStatus === "winner"
      ).length,
      shotOfNightWins: playerPrizes.filter(
        (prize) => prize.category === "shot_of_night" && prize.winnerStatus === "winner"
      ).length,
    };
  });
}

export async function getAdminTopDogProductionFeed(
  core: TopDogSnapshot
): Promise<TopDogProductionFeed> {
  const roundId = core.selectedRound?.id ?? null;

  try {
    await ensureJackpot(core.season.id);

    if (roundId) {
      await ensureChecklist(core.season.id, roundId);
    }

    const supabaseAdmin = getSupabaseAdmin();
    const teamIds = core.seasonTeams.map((membership) => membership.team.id);
    const [
      sponsorResult,
      prizeResult,
      jackpotResult,
      activationResult,
      interviewResult,
      clipResult,
      segmentResult,
      checklistResult,
      recapResult,
      players,
      profileDirectory,
    ] = await Promise.all([
      withTimeout(
        supabaseAdmin.from("cgs_sponsors").select("*").order("name"),
        QUERY_TIMEOUT_MS,
        "Top Dog sponsors query"
      ),
      roundId
        ? withTimeout(
            supabaseAdmin.from("top_dog_prizes").select("*").eq("round_id", roundId).order("updated_at", { ascending: false }),
            QUERY_TIMEOUT_MS,
            "Top Dog prizes query"
          )
        : Promise.resolve({ data: [], error: null }),
      withTimeout(
        supabaseAdmin.from("top_dog_jackpots").select("*").eq("season_id", core.season.id).maybeSingle(),
        QUERY_TIMEOUT_MS,
        "Top Dog jackpot query"
      ),
      roundId
        ? withTimeout(
            supabaseAdmin.from("top_dog_sponsor_activations").select("*").eq("round_id", roundId),
            QUERY_TIMEOUT_MS,
            "Top Dog sponsor activation query"
          )
        : Promise.resolve({ data: [], error: null }),
      roundId
        ? withTimeout(
            supabaseAdmin.from("top_dog_interviews").select("*").eq("round_id", roundId).order("created_at", { ascending: false }),
            QUERY_TIMEOUT_MS,
            "Top Dog interviews query"
          )
        : Promise.resolve({ data: [], error: null }),
      roundId
        ? withTimeout(
            supabaseAdmin.from("top_dog_content_clips").select("*").eq("round_id", roundId).order("marked_at", { ascending: false }).limit(200),
            QUERY_TIMEOUT_MS,
            "Top Dog content clips query"
          )
        : Promise.resolve({ data: [], error: null }),
      roundId
        ? withTimeout(
            supabaseAdmin.from("top_dog_segments").select("*").eq("round_id", roundId),
            QUERY_TIMEOUT_MS,
            "Top Dog recurring segments query"
          )
        : Promise.resolve({ data: [], error: null }),
      roundId
        ? withTimeout(
            supabaseAdmin.from("top_dog_round_checklist_items").select("*").eq("round_id", roundId).order("phase").order("display_order"),
            QUERY_TIMEOUT_MS,
            "Top Dog checklist query"
          )
        : Promise.resolve({ data: [], error: null }),
      roundId
        ? withTimeout(
            supabaseAdmin.from("top_dog_night_recaps").select("*").eq("round_id", roundId).maybeSingle(),
            QUERY_TIMEOUT_MS,
            "Top Dog recap query"
          )
        : Promise.resolve({ data: null, error: null }),
      withTimeout(loadPlayers(teamIds), QUERY_TIMEOUT_MS, "Top Dog player directory query"),
      withTimeout(
        loadProfileDirectory(teamIds),
        QUERY_TIMEOUT_MS,
        "CGS profile directory query"
      ),
    ]);

    const resultErrors = [
      sponsorResult.error,
      prizeResult.error,
      jackpotResult.error,
      activationResult.error,
      interviewResult.error,
      clipResult.error,
      segmentResult.error,
      checklistResult.error,
      recapResult.error,
    ].filter(Boolean);

    if (resultErrors.length > 0) {
      throw resultErrors[0];
    }

    const teamNames = new Map(core.seasonTeams.map((item) => [item.team.id, item.team.name]));
    const playerOptions = players.map((player) => ({
      ...player,
      teamName: teamNames.get(player.teamId) ?? "",
    }));
    const directory = profileDirectory.map((profile) => ({
      ...profile,
      teamName: profile.teamId ? teamNames.get(profile.teamId) ?? "" : "",
    }));
    const jackpot = mapJackpot(jackpotResult.data as DatabaseRow | null);
    const attemptResult = jackpot
      ? await withTimeout(
          supabaseAdmin
            .from("top_dog_jackpot_attempts")
            .select("*")
            .eq("jackpot_id", jackpot.id)
            .order("attempted_at", { ascending: false })
            .limit(100),
          QUERY_TIMEOUT_MS,
          "Top Dog jackpot history query"
        )
      : { data: [], error: null };

    if (attemptResult.error) {
      throw attemptResult.error;
    }

    const prizes = ((prizeResult.data ?? []) as DatabaseRow[]).map(mapPrize);
    const attempts = ((attemptResult.data ?? []) as DatabaseRow[]).map(mapJackpotAttempt);

    return {
      snapshot: {
        seasonId: core.season.id,
        roundId,
        sponsors: ((sponsorResult.data ?? []) as DatabaseRow[]).map(mapSponsor),
        prizes,
        jackpot,
        jackpotAttempts: attempts,
        sponsorActivations: ((activationResult.data ?? []) as DatabaseRow[]).map(mapActivation),
        interviews: ((interviewResult.data ?? []) as DatabaseRow[]).map(mapInterview),
        clips: ((clipResult.data ?? []) as DatabaseRow[]).map(mapClip),
        segments: ((segmentResult.data ?? []) as DatabaseRow[]).map(mapSegment),
        checklist: ((checklistResult.data ?? []) as DatabaseRow[]).map(mapChecklistItem),
        recap: mapRecap(recapResult.data as DatabaseRow | null),
        players: playerOptions,
        profileDirectory: directory,
        teamStats: calculateTeamStats(core),
        playerStats: calculatePlayerStats(core, playerOptions, prizes, attempts),
        generatedAt: new Date().toISOString(),
      },
      warningMessage: null,
    };
  } catch (error) {
    console.error("Top Dog production desk query error:", error);
    return {
      snapshot: null,
      warningMessage: isMissingProductionTable(error)
        ? "The production desk is waiting for its additive database migration."
        : "The production desk could not refresh. Existing match controls remain available.",
    };
  }
}

export async function assignTopDogTeamMember(input: {
  seasonId: number;
  roundId: number;
  profileId: string;
  teamId: number;
  roleLabel: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const membershipResult = await supabaseAdmin
    .from("top_dog_season_teams")
    .select("team_id")
    .eq("season_id", input.seasonId);

  if (membershipResult.error) {
    throw membershipResult.error;
  }

  const seasonTeamIds = (membershipResult.data ?? []).map((item) => numberValue(item.team_id));

  if (!seasonTeamIds.includes(input.teamId)) {
    throw new Error("The selected team does not belong to this Top Dog season.");
  }

  const now = new Date().toISOString();
  const deactivateResult = await supabaseAdmin
    .from("cgs_team_members")
    .update({ is_active: false, updated_at: now })
    .eq("profile_id", input.profileId)
    .in("team_id", seasonTeamIds)
    .neq("team_id", input.teamId);

  if (deactivateResult.error) {
    throw deactivateResult.error;
  }

  const { error } = await supabaseAdmin.from("cgs_team_members").upsert(
    {
      team_id: input.teamId,
      profile_id: input.profileId,
      role_label: input.roleLabel.trim() || "Player",
      is_active: true,
      updated_at: now,
    },
    { onConflict: "team_id,profile_id" }
  );

  if (error) {
    throw error;
  }

  await logOperation({
    seasonId: input.seasonId,
    roundId: input.roundId,
    action: "team_member_assigned",
    entityType: "profile",
    entityId: input.profileId,
    details: { teamId: input.teamId, roleLabel: input.roleLabel },
  });
}

async function logOperation(input: {
  seasonId: number;
  roundId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  details?: Record<string, unknown>;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("top_dog_operations_log").insert({
    season_id: input.seasonId,
    round_id: input.roundId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId === null || input.entityId === undefined ? "" : String(input.entityId),
    details: input.details ?? {},
  });

  if (error) {
    console.error("Top Dog operations log error:", error);
  }
}

async function mergeBroadcastPayload(input: {
  seasonId: number;
  roundId: number | null;
  overlay: TopDogCentralOverlay;
  payload: Record<string, unknown>;
  visible?: boolean;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("top_dog_stream_state")
    .select("overlay_payload")
    .eq("season_id", input.seasonId)
    .single();

  if (error) {
    throw error;
  }

  await updateTopDogStreamState(input.seasonId, {
    roundId: input.roundId,
    centralOverlay: input.overlay,
    centralOverlayVisible: input.visible !== false,
    overlayPayload: {
      ...objectValue(data.overlay_payload),
      ...input.payload,
    },
  });
}

export async function saveTopDogSponsor(input: {
  seasonId: number;
  roundId: number | null;
  id?: number;
  name: string;
  logoUrl: string;
  websiteUrl: string;
  promoCode: string;
  prizeSupplied: string;
  campaign: string;
  notes: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const values = {
    slug: normalizeTopDogSlug(input.name),
    name: input.name.trim(),
    logo_url: input.logoUrl.trim(),
    website_url: input.websiteUrl.trim(),
    promo_code: input.promoCode.trim(),
    prize_supplied: input.prizeSupplied.trim(),
    campaign: input.campaign.trim(),
    notes: input.notes.trim(),
    is_active: true,
    updated_at: now,
  };
  const query = input.id
    ? supabaseAdmin.from("cgs_sponsors").update(values).eq("id", input.id)
    : supabaseAdmin.from("cgs_sponsors").upsert(values, { onConflict: "slug" });
  const { data, error } = await query.select("id").single();

  if (error) {
    throw error;
  }

  await logOperation({
    seasonId: input.seasonId,
    roundId: input.roundId,
    action: input.id ? "sponsor_updated" : "sponsor_saved",
    entityType: "sponsor",
    entityId: data.id,
  });
}

export async function saveTopDogPrize(input: {
  id?: number;
  seasonId: number;
  roundId: number;
  category: TopDogPrizeCategory;
  customCategory: string;
  profileId: string | null;
  teamId: number | null;
  displayName: string;
  resultValue: string;
  prize: string;
  sponsorId: number | null;
  notes: string;
  winnerStatus: TopDogPrize["winnerStatus"];
}) {
  await assertRoundBelongsToSeason(input.seasonId, input.roundId);
  const supabaseAdmin = getSupabaseAdmin();
  const values = {
    season_id: input.seasonId,
    round_id: input.roundId,
    category: input.category,
    custom_category: input.customCategory.trim(),
    profile_id: input.profileId,
    team_id: input.teamId,
    display_name: input.displayName.trim(),
    result_value: input.resultValue.trim(),
    prize: input.prize.trim(),
    sponsor_id: input.sponsorId,
    notes: input.notes.trim(),
    winner_status: input.winnerStatus,
    updated_at: new Date().toISOString(),
  };
  const query = input.id
    ? supabaseAdmin.from("top_dog_prizes").update(values).eq("id", input.id)
    : supabaseAdmin.from("top_dog_prizes").insert(values);
  const { data, error } = await query.select("id").single();

  if (error) {
    throw error;
  }

  await logOperation({
    seasonId: input.seasonId,
    roundId: input.roundId,
    action: "prize_saved",
    entityType: "prize",
    entityId: data.id,
    details: { category: input.category },
  });

  return numberValue(data.id);
}

function prizeOverlay(category: TopDogPrizeCategory): TopDogCentralOverlay {
  const overlayMap: Partial<Record<TopDogPrizeCategory, TopDogCentralOverlay>> = {
    best_team: "best_team",
    longest_drive: "longest_drive",
    ctp: "ctp",
    bunker_boy: "bunker_boy",
    shot_of_night: "shot_of_night",
  };

  return overlayMap[category] ?? "sponsor";
}

export async function showTopDogPrize(input: {
  seasonId: number;
  roundId: number;
  prizeId: number;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("top_dog_prizes")
    .select("*")
    .eq("id", input.prizeId)
    .eq("season_id", input.seasonId)
    .eq("round_id", input.roundId)
    .single();

  if (error) {
    throw error;
  }

  const prize = mapPrize(data as DatabaseRow);
  let sponsorName = "";

  if (prize.sponsorId) {
    const sponsorResult = await supabaseAdmin
      .from("cgs_sponsors")
      .select("name")
      .eq("id", prize.sponsorId)
      .maybeSingle();
    if (sponsorResult.error) {
      throw sponsorResult.error;
    }
    sponsorName = String(sponsorResult.data?.name ?? "");
  }

  const categoryLabel = (prize.customCategory || prize.category).replaceAll("_", " ").toUpperCase();
  const tickerKey: Partial<Record<TopDogPrizeCategory, string>> = {
    longest_drive: "longestDrive",
    ctp: "ctp",
    bunker_boy: "bunkerBoy",
  };
  const tickerPatch = tickerKey[prize.category]
    ? { [tickerKey[prize.category]!]: `${categoryLabel}: ${prize.displayName}${prize.resultValue ? ` ${prize.resultValue}` : ""}` }
    : {};

  await mergeBroadcastPayload({
    seasonId: input.seasonId,
    roundId: input.roundId,
    overlay: prizeOverlay(prize.category),
    payload: {
      ...tickerPatch,
      title: categoryLabel,
      primary: prize.displayName,
      value: prize.resultValue,
      prize: prize.prize,
      sponsor: sponsorName,
      status: prize.winnerStatus,
    },
  });
}

export async function saveTopDogSponsorActivation(input: {
  seasonId: number;
  roundId: number;
  sponsorId: number;
  campaign: string;
  prizeSupplied: string;
  notes: string;
}) {
  await assertRoundBelongsToSeason(input.seasonId, input.roundId);
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("top_dog_sponsor_activations").upsert(
    {
      season_id: input.seasonId,
      round_id: input.roundId,
      sponsor_id: input.sponsorId,
      campaign: input.campaign.trim(),
      prize_supplied: input.prizeSupplied.trim(),
      notes: input.notes.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "round_id,sponsor_id" }
  );

  if (error) {
    throw error;
  }

  await logOperation({
    seasonId: input.seasonId,
    roundId: input.roundId,
    action: "sponsor_activated",
    entityType: "sponsor",
    entityId: input.sponsorId,
  });
}

export async function toggleTopDogSponsorFulfilment(input: {
  seasonId: number;
  roundId: number;
  activationId: number;
  field:
    | "logo_displayed"
    | "verbal_mention"
    | "product_shown"
    | "promo_code_shown"
    | "winner_photographed"
    | "sponsor_tagged"
    | "social_post_completed";
  value: boolean;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("top_dog_sponsor_activations")
    .update({ [input.field]: input.value, updated_at: new Date().toISOString() })
    .eq("id", input.activationId)
    .eq("season_id", input.seasonId)
    .eq("round_id", input.roundId);

  if (error) {
    throw error;
  }
}

export async function showTopDogSponsor(input: {
  seasonId: number;
  roundId: number;
  sponsorId: number;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("cgs_sponsors")
    .select("id, name, logo_url, promo_code, campaign, prize_supplied")
    .eq("id", input.sponsorId)
    .single();

  if (error) {
    throw error;
  }

  await mergeBroadcastPayload({
    seasonId: input.seasonId,
    roundId: input.roundId,
    overlay: "sponsor",
    payload: {
      title: "Official Partner",
      primary: data.name,
      value: data.campaign || data.prize_supplied || "CGS League Night Partner",
      sponsor: data.name,
      sponsorLogo: data.logo_url,
      promoCode: data.promo_code,
      sponsorMessage: `${data.name}: ${data.campaign || data.prize_supplied || "Official CGS partner"}`,
    },
  });
}

export async function runTopDogJackpotCommand(input: {
  seasonId: number;
  roundId: number;
  command: "random" | "select" | "reveal" | "start" | "success" | "miss" | "rollover" | "reset" | "set_amount";
  profileId?: string | null;
  teamId?: number | null;
  playerName?: string;
  amount?: number;
}) {
  await assertRoundBelongsToSeason(input.seasonId, input.roundId);
  await ensureJackpot(input.seasonId);
  const supabaseAdmin = getSupabaseAdmin();
  const jackpotResult = await supabaseAdmin
    .from("top_dog_jackpots")
    .select("*")
    .eq("season_id", input.seasonId)
    .single();

  if (jackpotResult.error) {
    throw jackpotResult.error;
  }

  const current = mapJackpot(jackpotResult.data as DatabaseRow)!;
  const updates: Record<string, unknown> = {
    round_id: input.roundId,
    updated_at: new Date().toISOString(),
  };

  if (input.command === "random") {
    const roundResult = await supabaseAdmin
      .from("top_dog_season_teams")
      .select("team_id")
      .eq("season_id", input.seasonId)
      .eq("is_active", true);
    if (roundResult.error) {
      throw roundResult.error;
    }
    const players = await loadPlayers((roundResult.data ?? []).map((item) => numberValue(item.team_id)));
    if (players.length === 0) {
      throw new Error("No linked players are available. Select a player manually for this attempt.");
    }
    const selected = players[Math.floor(Math.random() * players.length)];
    updates.selected_profile_id = selected.profileId;
    updates.selected_team_id = selected.teamId;
    updates.selected_name = selected.displayName;
    updates.status = "selected";
  } else if (input.command === "select") {
    if (!input.playerName?.trim()) {
      throw new Error("Enter or select a player before saving the jackpot selection.");
    }
    updates.selected_profile_id = input.profileId ?? null;
    updates.selected_team_id = input.teamId ?? null;
    updates.selected_name = input.playerName.trim();
    updates.status = "selected";
  } else if (input.command === "set_amount") {
    updates.current_amount = input.amount ?? current.currentAmount;
  } else if (input.command === "reveal") {
    updates.status = "reveal";
  } else if (input.command === "start") {
    updates.status = "countdown";
    updates.started_at = new Date().toISOString();
  } else if (input.command === "success") {
    updates.status = "won";
  } else if (input.command === "miss") {
    updates.status = "miss";
  } else if (input.command === "rollover") {
    updates.status = "rollover";
  } else if (input.command === "reset") {
    updates.status = "idle";
    updates.current_amount = current.defaultAmount;
    updates.selected_profile_id = null;
    updates.selected_team_id = null;
    updates.selected_name = "";
    updates.started_at = null;
  }

  if (["reveal", "start", "success", "miss", "rollover"].includes(input.command) && !current.selectedName) {
    throw new Error("Select a player before starting the One-Putt Challenge.");
  }

  const { data, error } = await supabaseAdmin
    .from("top_dog_jackpots")
    .update(updates)
    .eq("season_id", input.seasonId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const updated = mapJackpot(data as DatabaseRow)!;

  if (["success", "miss", "rollover"].includes(input.command)) {
    const result = input.command === "success" ? "success" : input.command;
    const attemptResult = await supabaseAdmin.from("top_dog_jackpot_attempts").insert({
      jackpot_id: updated.id,
      round_id: input.roundId,
      profile_id: updated.selectedProfileId,
      team_id: updated.selectedTeamId,
      player_name: updated.selectedName,
      amount: updated.currentAmount,
      result,
    });
    if (attemptResult.error) {
      throw attemptResult.error;
    }
  }

  if (["reveal", "start", "success", "miss", "rollover"].includes(input.command)) {
    const titles: Record<string, string> = {
      reveal: "Player Selected",
      start: `$${updated.currentAmount.toFixed(0)} One-Putt Challenge`,
      success: "Jackpot Won",
      miss: "One-Putt Missed",
      rollover: "Jackpot Rolls Over",
    };
    await mergeBroadcastPayload({
      seasonId: input.seasonId,
      roundId: input.roundId,
      overlay: "one_putt_jackpot",
      payload: {
        title: titles[input.command],
        primary: updated.selectedName,
        value: `$${updated.currentAmount.toFixed(0)}`,
        jackpotStatus: updated.status,
        jackpot: `ONE-PUTT JACKPOT: $${updated.currentAmount.toFixed(0)}`,
      },
    });
  }

  await logOperation({
    seasonId: input.seasonId,
    roundId: input.roundId,
    action: `jackpot_${input.command}`,
    entityType: "jackpot",
    entityId: updated.id,
    details: { status: updated.status, player: updated.selectedName },
  });
}

export function getInterviewQuestions(type: TopDogInterviewType) {
  if (type === "pre_match") {
    return ["Prediction tonight?", "Who carries the team?", "Biggest threat?"];
  }

  if (type === "post_match") {
    return ["What changed the match?", "Shot of the night?", "Who gets the blame?"];
  }

  if (type === "winner") {
    return ["What won it tonight?", "Biggest pressure moment?", "Message for the next opponent?"];
  }

  if (type === "prize_winner") {
    return ["Talk us through the moment.", "Did you expect it?", "Who are you dedicating it to?"];
  }

  return ["What is the story tonight?", "Best moment so far?", "What should viewers watch next?"];
}

export async function saveTopDogInterview(input: {
  seasonId: number;
  roundId: number;
  fixtureId: number | null;
  profileId: string | null;
  teamId: number | null;
  playerName: string;
  teamLabel: string;
  interviewType: TopDogInterviewType;
  notes: string;
}) {
  await assertRoundBelongsToSeason(input.seasonId, input.roundId);
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("top_dog_interviews")
    .insert({
      season_id: input.seasonId,
      round_id: input.roundId,
      fixture_id: input.fixtureId,
      profile_id: input.profileId,
      team_id: input.teamId,
      player_name: input.playerName.trim(),
      team_label: input.teamLabel.trim(),
      interview_type: input.interviewType,
      status: "queued",
      suggested_questions: getInterviewQuestions(input.interviewType),
      notes: input.notes.trim(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await logOperation({
    seasonId: input.seasonId,
    roundId: input.roundId,
    action: "interview_queued",
    entityType: "interview",
    entityId: data.id,
  });
}

export async function setTopDogInterviewStatus(input: {
  seasonId: number;
  roundId: number;
  interviewId: number;
  status: TopDogInterview["status"];
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("top_dog_interviews")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.interviewId)
    .eq("season_id", input.seasonId)
    .eq("round_id", input.roundId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const interview = mapInterview(data as DatabaseRow);

  if (input.status === "live") {
    await mergeBroadcastPayload({
      seasonId: input.seasonId,
      roundId: input.roundId,
      overlay: "player_interview",
      payload: {
        title: interview.interviewType.replaceAll("_", " ").toUpperCase(),
        primary: interview.playerName,
        value: interview.teamLabel,
        interviewType: interview.interviewType,
      },
    });
  } else if (input.status === "complete") {
    await updateTopDogStreamState(input.seasonId, { centralOverlayVisible: false });
  }
}

export async function markTopDogContentClip(input: {
  seasonId: number;
  roundId: number;
  fixtureId: number | null;
  profileId: string | null;
  teamId: number | null;
  playerName: string;
  tag: TopDogClipTag;
  note: string;
}) {
  await assertRoundBelongsToSeason(input.seasonId, input.roundId);
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("top_dog_content_clips")
    .insert({
      season_id: input.seasonId,
      round_id: input.roundId,
      fixture_id: input.fixtureId,
      profile_id: input.profileId,
      team_id: input.teamId,
      tag: input.tag,
      player_name: input.playerName.trim(),
      note: input.note.trim(),
    })
    .select("id, marked_at")
    .single();

  if (error) {
    throw error;
  }

  await logOperation({
    seasonId: input.seasonId,
    roundId: input.roundId,
    action: "clip_marked",
    entityType: "content_clip",
    entityId: data.id,
    details: { tag: input.tag, markedAt: data.marked_at },
  });
}

export async function saveTopDogSegment(input: {
  seasonId: number;
  roundId: number;
  segmentType: TopDogSegmentType;
  title: string;
  primaryText: string;
  secondaryText: string;
  status: TopDogSegment["status"];
}) {
  await assertRoundBelongsToSeason(input.seasonId, input.roundId);
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("top_dog_segments")
    .upsert(
      {
        season_id: input.seasonId,
        round_id: input.roundId,
        segment_type: input.segmentType,
        title: input.title.trim(),
        primary_text: input.primaryText.trim(),
        secondary_text: input.secondaryText.trim(),
        status: input.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "round_id,segment_type" }
    )
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await logOperation({
    seasonId: input.seasonId,
    roundId: input.roundId,
    action: "segment_saved",
    entityType: input.segmentType,
    entityId: data.id,
  });
}

export async function showTopDogSegment(input: {
  seasonId: number;
  roundId: number;
  segmentType: TopDogSegmentType;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("top_dog_segments")
    .select("*")
    .eq("round_id", input.roundId)
    .eq("segment_type", input.segmentType)
    .single();

  if (error) {
    throw error;
  }

  const segment = mapSegment(data as DatabaseRow);
  const overlays: Record<TopDogSegmentType, TopDogCentralOverlay> = {
    doghouse: "doghouse",
    shot_of_night: "shot_of_night",
    butters_board: "butters_board",
    stat_of_week: "stat_of_week",
  };

  await mergeBroadcastPayload({
    seasonId: input.seasonId,
    roundId: input.roundId,
    overlay: overlays[input.segmentType],
    payload: {
      title: segment.title,
      primary: segment.primaryText,
      value: segment.secondaryText,
    },
  });
}

export async function toggleTopDogChecklistItem(input: {
  seasonId: number;
  roundId: number;
  itemId: number;
  isComplete: boolean;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("top_dog_round_checklist_items")
    .update({
      is_complete: input.isComplete,
      completed_at: input.isComplete ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.itemId)
    .eq("round_id", input.roundId);

  if (error) {
    throw error;
  }

  await logOperation({
    seasonId: input.seasonId,
    roundId: input.roundId,
    action: input.isComplete ? "checklist_completed" : "checklist_reopened",
    entityType: "checklist_item",
    entityId: input.itemId,
  });
}

function getPrizeSummary(prize: TopDogPrize) {
  const label = (prize.customCategory || prize.category).replaceAll("_", " ");
  return `${label}: ${prize.displayName || "TBC"}${prize.resultValue ? ` (${prize.resultValue})` : ""}`;
}

export async function generateTopDogNightRecap(input: {
  core: TopDogSnapshot;
  production: TopDogProductionSnapshot;
}) {
  const selectedRound = input.core.selectedRound;
  const roundId = selectedRound?.id;

  if (!roundId) {
    throw new Error("Select a league night before generating its recap.");
  }

  const results = input.core.fixtures
    .filter((fixture) => fixture.status === "final")
    .map(
      (fixture) =>
        `${fixture.homeTeam.name} ${fixture.homeScore}-${fixture.awayScore} ${fixture.awayTeam.name}`
    );
  const winners = input.production.prizes.filter((prize) => prize.winnerStatus === "winner");
  const topTeam = input.core.officialLadder[0];
  const segmentByType = new Map(
    input.production.segments.map((segment) => [segment.segmentType, segment])
  );
  const lines = [
    `TONIGHT IN TOP DOG - ${selectedRound.name}`,
    results.length > 0 ? `Results: ${results.join(" | ")}` : "Results: awaiting final scores",
    topTeam ? `Ladder leader: ${topTeam.team.name} (${topTeam.points} pts)` : "Ladder leader: TBC",
    ...winners.map(getPrizeSummary),
  ];
  const jackpot = input.production.jackpot;

  if (jackpot) {
    lines.push(
      `One-Putt Jackpot: ${jackpot.status === "won" ? "WON" : jackpot.status === "rollover" ? "ROLLOVER" : jackpot.status.toUpperCase()} - $${jackpot.currentAmount.toFixed(0)}${jackpot.selectedName ? ` - ${jackpot.selectedName}` : ""}`
    );
  }

  (["shot_of_night", "doghouse"] as TopDogSegmentType[]).forEach((type) => {
    const segment = segmentByType.get(type);
    if (segment?.primaryText) {
      lines.push(`${type.replaceAll("_", " ")}: ${segment.primaryText}`);
    }
  });

  const payload = {
    title: "Tonight in Top Dog",
    primary: results.slice(0, 3).join(" | ") || "League night complete",
    value: topTeam ? `${topTeam.team.name} lead on ${topTeam.points} points` : "Full recap ready",
    results,
    ladder: input.core.officialLadder.slice(0, 6).map((row) => ({
      position: row.position,
      team: row.team.name,
      points: row.points,
    })),
    prizes: winners.map(getPrizeSummary),
    jackpot: jackpot
      ? { status: jackpot.status, amount: jackpot.currentAmount, player: jackpot.selectedName }
      : null,
  };
  const recapText = lines.join("\n");
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("top_dog_night_recaps").upsert(
    {
      season_id: input.core.season.id,
      round_id: roundId,
      recap_text: recapText,
      payload,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "round_id" }
  );

  if (error) {
    throw error;
  }

  await logOperation({
    seasonId: input.core.season.id,
    roundId,
    action: "night_recap_generated",
    entityType: "night_recap",
    entityId: roundId,
  });
}

export async function showTopDogNightRecap(input: {
  seasonId: number;
  roundId: number;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("top_dog_night_recaps")
    .select("payload")
    .eq("round_id", input.roundId)
    .single();

  if (error) {
    throw error;
  }

  await mergeBroadcastPayload({
    seasonId: input.seasonId,
    roundId: input.roundId,
    overlay: "night_wrap_up",
    payload: objectValue(data.payload),
  });
}

export function buildTopDogClipsCsv(
  production: TopDogProductionSnapshot,
  core: TopDogSnapshot
) {
  const fixtureNames = new Map(
    core.fixtures.map((fixture) => [
      fixture.id,
      `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}`,
    ])
  );
  const teamNames = new Map(core.seasonTeams.map((item) => [item.team.id, item.team.name]));
  const escapeCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const header = ["Timestamp", "Tag", "Player", "Team", "Fixture", "Note"];
  const rows = production.clips.map((clip) => [
    clip.markedAt,
    clip.tag.replaceAll("_", " "),
    clip.playerName,
    clip.teamId ? teamNames.get(clip.teamId) ?? "" : "",
    clip.fixtureId ? fixtureNames.get(clip.fixtureId) ?? "" : "",
    clip.note,
  ]);

  return [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
}
