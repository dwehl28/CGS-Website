import { createHash } from "node:crypto";

import { withTimeout } from "@/lib/async-timeout";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type CgsProfile = {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  nickname: string;
  avatarUrl: string;
  handicap: number | null;
  role: "player" | "admin";
  isPublic: boolean;
  seasonStats: Record<string, unknown>;
  updatedAt: string;
  createdAt: string;
};

export type CgsBroadcastProfileStats = {
  averageDrive: string;
  goToIron: string;
  bestResult: string;
  biggestWeakness: string;
};

export type AmbroseEvent = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  seasonLabel: string;
  courseName: string;
  statusLabel: string;
  bayCount: number;
  holeCount: number;
  startsAt: string | null;
  isLive: boolean;
  isPublished: boolean;
  scoringNotes: string;
  updatedAt: string;
  createdAt: string;
  teams: AmbroseTeam[];
  holes: AmbroseHole[];
  entries: AmbroseEntry[];
};

export type AmbroseTeam = {
  id: number;
  eventId: number;
  displayOrder: number;
  name: string;
  shortName: string;
  accentColor: string;
  bayLabel: string;
  startingHole: number | null;
  isFeatured: boolean;
  createdBy: string | null;
  hasJoinCode: boolean;
  updatedAt: string;
  members: AmbroseTeamMember[];
};

export type AmbroseTeamMember = {
  id: number;
  eventId: number;
  teamId: number;
  profileId: string;
  displayOrder: number;
  roleLabel: string;
  updatedAt: string;
  profile: CgsProfile | null;
};

export type AmbroseHole = {
  id: number;
  eventId: number;
  displayOrder: number;
  holeNumber: number;
  holeLabel: string;
  par: number;
  yardageYards: number | null;
  strokeIndex: number | null;
  updatedAt: string;
};

export type AmbroseEntry = {
  id: number;
  eventId: number;
  teamId: number;
  holeId: number;
  submittedBy: string | null;
  grossStrokes: number | null;
  scoreToPar: number | null;
  scoreLabel: string;
  putts: number | null;
  fairwayHit: boolean | null;
  greenInRegulation: boolean | null;
  penalties: number;
  drivePlayerId: string | null;
  driveDistanceMeters: number | null;
  approachPlayerId: string | null;
  ironClub: string | null;
  ironDistanceMeters: number | null;
  puttPlayerId: string | null;
  notes: string | null;
  updatedByAdmin: boolean;
  updatedAt: string;
};

export type AmbroseFeed = {
  events: AmbroseEvent[];
  source: "database" | "fallback";
  warningMessage: string | null;
};

export type AmbroseTeamContribution = {
  profileId: string;
  displayName: string;
  nickname: string;
  handle: string;
  avatarUrl: string;
  teamId: number;
  teamName: string;
  driveUses: number;
  approachUses: number;
  puttUses: number;
  totalUses: number;
};

export type AmbroseTeamSummary = {
  team: AmbroseTeam;
  entries: AmbroseEntry[];
  holesComplete: number;
  thruLabel: string;
  scoreToPar: number | null;
  scoreLabel: string;
  birdies: number;
  eaglesOrBetter: number;
  pars: number;
  bogeysOrWorse: number;
  totalPutts: number;
  puttEntries: number;
  averagePutts: number | null;
  fairwaysHit: number;
  fairwayOpportunities: number;
  fairwayRate: number | null;
  greensInRegulation: number;
  girOpportunities: number;
  girRate: number | null;
  penalties: number;
  contributionLeader: AmbroseTeamContribution | null;
};

export type AmbroseSnapshot = {
  event: AmbroseEvent;
  leaderboard: AmbroseTeamSummary[];
  playerContributions: AmbroseTeamContribution[];
  totalTeams: number;
  totalPlayers: number;
  totalHoles: number;
  completeEntries: number;
  totalEntriesPossible: number;
  completionRate: number;
};

export type PlayerAmbroseDashboard = {
  profile: CgsProfile;
  events: AmbroseEvent[];
  assignedTeamIds: number[];
  source: "database" | "fallback";
  warningMessage: string | null;
};

export type PublicPlayerProfile = {
  profile: CgsProfile;
  currentTeam: {
    eventTitle: string;
    eventSlug: string;
    teamName: string;
    teamShortName: string;
    bayLabel: string;
  } | null;
  stats: {
    eventsPlayed: number;
    teamsPlayed: number;
    holesRecorded: number;
    averageTeamScoreToPar: number | null;
    driveUses: number;
    approachUses: number;
    puttUses: number;
    totalContributionUses: number;
  };
  memberships: Array<{
    eventTitle: string;
    eventSlug: string;
    seasonLabel: string;
    teamName: string;
    teamShortName: string;
    bayLabel: string;
    isLive: boolean;
  }>;
};

export type AmbroseEventInput = {
  slug: string;
  title: string;
  summary: string;
  seasonLabel: string;
  courseName: string;
  statusLabel: string;
  bayCount: number;
  holeCount: number;
  startsAt: string | null;
  isLive: boolean;
  isPublished: boolean;
  scoringNotes: string;
};

export type AmbroseTeamInput = {
  eventId: number;
  displayOrder: number;
  name: string;
  shortName: string;
  accentColor: string;
  bayLabel: string;
  startingHole: number | null;
  isFeatured: boolean;
};

export type AmbroseEntryInput = {
  eventId: number;
  teamId: number;
  holeId: number;
  grossStrokes: number;
  putts: number | null;
  fairwayHit: boolean | null;
  greenInRegulation: boolean | null;
  penalties: number;
  drivePlayerId: string;
  driveDistanceMeters: number | null;
  approachPlayerId: string;
  ironClub: string;
  ironDistanceMeters: number | null;
  puttPlayerId: string;
  notes: string;
  actorProfileId: string | null;
  updatedByAdmin: boolean;
};

type AuthUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

const AMBROSE_QUERY_TIMEOUT_MS = 3500;
const CGS_PLAYER_PHOTO_BUCKET = "cgs-player-photos";
const CGS_PLAYER_PHOTO_SIZE_LIMIT = 5 * 1024 * 1024;
const CGS_PLAYER_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const ADMIN_APP_PROFILE: CgsProfile = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "admin@crossodoggolf.com",
  handle: "admin",
  displayName: "CGS Admin",
  nickname: "Admin",
  avatarUrl: "/cgs-logo.png",
  handicap: null,
  role: "admin",
  isPublic: false,
  seasonStats: {},
  updatedAt: "",
  createdAt: "",
};
const missingTableMessage =
  "The CGS Ambrose app tables are not set up yet. Apply the latest Supabase migration before using player accounts and team entry.";

function isMissingAmbroseTableError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  return error.code === "42P01" || error.code === "PGRST205";
}

function isMissingStorageBucketError(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return false;
  }

  const message = String(error.message ?? "").toLowerCase();
  return message.includes("bucket") && message.includes("not found");
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
  return typeof value === "boolean" ? value : null;
}

export function formatAmbroseScore(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  if (value === 0) {
    return "E";
  }

  const absoluteValue = Math.abs(value);
  const formattedValue = Number.isInteger(value)
    ? absoluteValue.toString()
    : absoluteValue.toFixed(1);

  return `${value > 0 ? "+" : "-"}${formattedValue}`;
}

function normalizeHandle(value: string) {
  const normalizedValue = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);

  return normalizedValue || "player";
}

function normalizeTeamJoinCode(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}

function hashTeamJoinCode(eventId: number, joinCode: string) {
  return createHash("sha256")
    .update(`${eventId}:${normalizeTeamJoinCode(joinCode)}`)
    .digest("hex");
}

function buildTeamShortName(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = words.map((word) => word[0]).join("").slice(0, 4);

  return (initials || name.slice(0, 4) || "TEAM").toUpperCase();
}

function normalizeBroadcastProfileStats(
  value: Partial<CgsBroadcastProfileStats> | null | undefined
): CgsBroadcastProfileStats {
  return {
    averageDrive: String(value?.averageDrive ?? "").trim().slice(0, 80),
    goToIron: String(value?.goToIron ?? "").trim().slice(0, 80),
    bestResult: String(value?.bestResult ?? "").trim().slice(0, 120),
    biggestWeakness: String(value?.biggestWeakness ?? "").trim().slice(0, 140),
  };
}

function mergeBroadcastProfileStats(
  currentStats: Record<string, unknown>,
  nextStats: Partial<CgsBroadcastProfileStats> | null | undefined
) {
  return {
    ...currentStats,
    ...normalizeBroadcastProfileStats(nextStats),
  };
}

export function getBroadcastProfileStats(
  seasonStats: Record<string, unknown>
): CgsBroadcastProfileStats {
  return normalizeBroadcastProfileStats({
    averageDrive:
      typeof seasonStats.averageDrive === "string"
        ? seasonStats.averageDrive
        : typeof seasonStats.average_drive === "string"
          ? seasonStats.average_drive
          : "",
    goToIron:
      typeof seasonStats.goToIron === "string"
        ? seasonStats.goToIron
        : typeof seasonStats.go_to_iron === "string"
          ? seasonStats.go_to_iron
          : "",
    bestResult:
      typeof seasonStats.bestResult === "string"
        ? seasonStats.bestResult
        : typeof seasonStats.best_result === "string"
          ? seasonStats.best_result
          : "",
    biggestWeakness:
      typeof seasonStats.biggestWeakness === "string"
        ? seasonStats.biggestWeakness
        : typeof seasonStats.biggest_weakness === "string"
          ? seasonStats.biggest_weakness
          : "",
  });
}

function mapRowToProfile(row: Record<string, unknown>): CgsProfile {
  const role = row.role === "admin" ? "admin" : "player";
  const seasonStats =
    row.season_stats && typeof row.season_stats === "object"
      ? (row.season_stats as Record<string, unknown>)
      : {};

  return {
    id: String(row.id ?? ""),
    email: String(row.email ?? ""),
    handle: String(row.handle ?? ""),
    displayName: String(row.display_name ?? ""),
    nickname: String(row.nickname ?? ""),
    avatarUrl: String(row.avatar_url ?? ""),
    handicap: parseNumericValue(row.handicap),
    role,
    isPublic: Boolean(row.is_public),
    seasonStats,
    updatedAt: String(row.updated_at ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

function mapRowToEvent(row: Record<string, unknown>): AmbroseEvent {
  return {
    id: Number(row.id),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    seasonLabel: String(row.season_label ?? "CGS Ambrose"),
    courseName: String(row.course_name ?? "GSPro course TBC"),
    statusLabel: String(row.status_label ?? "Ambrose team event"),
    bayCount: Number(row.bay_count ?? 3),
    holeCount: Number(row.hole_count ?? 18),
    startsAt:
      typeof row.starts_at === "string" && row.starts_at.trim()
        ? row.starts_at
        : null,
    isLive: Boolean(row.is_live),
    isPublished: Boolean(row.is_published),
    scoringNotes: String(row.scoring_notes ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    createdAt: String(row.created_at ?? ""),
    teams: [],
    holes: [],
    entries: [],
  };
}

function mapRowToTeam(row: Record<string, unknown>): AmbroseTeam {
  return {
    id: Number(row.id),
    eventId: Number(row.event_id),
    displayOrder: Number(row.display_order ?? 99),
    name: String(row.name ?? ""),
    shortName: String(row.short_name ?? ""),
    accentColor: String(row.accent_color ?? "#62d7ff"),
    bayLabel: String(row.bay_label ?? "Bay TBC"),
    startingHole: parseIntegerValue(row.starting_hole),
    isFeatured: Boolean(row.is_featured),
    createdBy:
      typeof row.created_by === "string" && row.created_by.trim()
        ? row.created_by
        : null,
    hasJoinCode:
      typeof row.join_code_hash === "string" && row.join_code_hash.trim().length > 0,
    updatedAt: String(row.updated_at ?? ""),
    members: [],
  };
}

function mapRowToTeamMember(
  row: Record<string, unknown>,
  profilesById: Map<string, CgsProfile>
): AmbroseTeamMember {
  const profileId = String(row.profile_id ?? "");

  return {
    id: Number(row.id),
    eventId: Number(row.event_id),
    teamId: Number(row.team_id),
    profileId,
    displayOrder: Number(row.display_order ?? 99),
    roleLabel: String(row.role_label ?? "Player"),
    updatedAt: String(row.updated_at ?? ""),
    profile: profilesById.get(profileId) ?? null,
  };
}

function mapRowToHole(row: Record<string, unknown>): AmbroseHole {
  return {
    id: Number(row.id),
    eventId: Number(row.event_id),
    displayOrder: Number(row.display_order ?? 99),
    holeNumber: Number(row.hole_number ?? 0),
    holeLabel: String(row.hole_label ?? ""),
    par: Number(row.par ?? 4),
    yardageYards: parseIntegerValue(row.yardage_yards),
    strokeIndex: parseIntegerValue(row.stroke_index),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapRowToEntry(row: Record<string, unknown>): AmbroseEntry {
  const scoreToPar = parseNumericValue(row.score_to_par);

  return {
    id: Number(row.id),
    eventId: Number(row.event_id),
    teamId: Number(row.team_id),
    holeId: Number(row.hole_id),
    submittedBy:
      typeof row.submitted_by === "string" && row.submitted_by.trim()
        ? row.submitted_by
        : null,
    grossStrokes: parseIntegerValue(row.gross_strokes),
    scoreToPar,
    scoreLabel: formatAmbroseScore(scoreToPar),
    putts: parseIntegerValue(row.putts),
    fairwayHit: parseBooleanValue(row.fairway_hit),
    greenInRegulation: parseBooleanValue(row.green_in_regulation),
    penalties: parseIntegerValue(row.penalties) ?? 0,
    drivePlayerId:
      typeof row.drive_player_id === "string" && row.drive_player_id.trim()
        ? row.drive_player_id
        : null,
    driveDistanceMeters: parseNumericValue(row.drive_distance_meters),
    approachPlayerId:
      typeof row.approach_player_id === "string" && row.approach_player_id.trim()
        ? row.approach_player_id
        : null,
    ironClub:
      typeof row.iron_club === "string" && row.iron_club.trim()
        ? row.iron_club
        : null,
    ironDistanceMeters: parseNumericValue(row.iron_distance_meters),
    puttPlayerId:
      typeof row.putt_player_id === "string" && row.putt_player_id.trim()
        ? row.putt_player_id
        : null,
    notes: typeof row.notes === "string" && row.notes.trim() ? row.notes : null,
    updatedByAdmin: Boolean(row.updated_by_admin),
    updatedAt: String(row.updated_at ?? ""),
  };
}

async function loadProfiles(profileIds: string[]) {
  const uniqueProfileIds = [...new Set(profileIds.filter(Boolean))];

  if (uniqueProfileIds.length === 0) {
    return new Map<string, CgsProfile>();
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await withTimeout(
    supabaseAdmin.from("cgs_profiles").select("*").in("id", uniqueProfileIds),
    AMBROSE_QUERY_TIMEOUT_MS,
    "CGS profiles query"
  );

  if (error) {
    throw error;
  }

  return new Map(
    ((data ?? []) as Record<string, unknown>[])
      .map(mapRowToProfile)
      .map((profile) => [profile.id, profile])
  );
}

async function loadAmbroseChildren(eventIds: number[]) {
  if (eventIds.length === 0) {
    return {
      teamRows: [] as Record<string, unknown>[],
      memberRows: [] as Record<string, unknown>[],
      holeRows: [] as Record<string, unknown>[],
      entryRows: [] as Record<string, unknown>[],
      profilesById: new Map<string, CgsProfile>(),
    };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const [teamsResponse, membersResponse, holesResponse, entriesResponse] =
    await Promise.all([
      withTimeout(
        supabaseAdmin
          .from("cgs_ambrose_teams")
          .select("*")
          .in("event_id", eventIds)
          .order("display_order", { ascending: true }),
        AMBROSE_QUERY_TIMEOUT_MS,
        "Ambrose teams query"
      ),
      withTimeout(
        supabaseAdmin
          .from("cgs_ambrose_team_members")
          .select("*")
          .in("event_id", eventIds)
          .order("display_order", { ascending: true }),
        AMBROSE_QUERY_TIMEOUT_MS,
        "Ambrose team members query"
      ),
      withTimeout(
        supabaseAdmin
          .from("cgs_ambrose_holes")
          .select("*")
          .in("event_id", eventIds)
          .order("display_order", { ascending: true }),
        AMBROSE_QUERY_TIMEOUT_MS,
        "Ambrose holes query"
      ),
      withTimeout(
        supabaseAdmin
          .from("cgs_ambrose_entries")
          .select("*")
          .in("event_id", eventIds)
          .order("updated_at", { ascending: false }),
        AMBROSE_QUERY_TIMEOUT_MS,
        "Ambrose entries query"
      ),
    ]);

  const firstError =
    teamsResponse.error ??
    membersResponse.error ??
    holesResponse.error ??
    entriesResponse.error;

  if (firstError) {
    throw firstError;
  }

  const memberRows = (membersResponse.data ?? []) as Record<string, unknown>[];
  const entryRows = (entriesResponse.data ?? []) as Record<string, unknown>[];
  const profileIds = [
    ...memberRows.map((row) => String(row.profile_id ?? "")),
    ...entryRows.map((row) => String(row.submitted_by ?? "")),
    ...entryRows.map((row) => String(row.drive_player_id ?? "")),
    ...entryRows.map((row) => String(row.approach_player_id ?? "")),
    ...entryRows.map((row) => String(row.putt_player_id ?? "")),
  ];
  const profilesById = await loadProfiles(profileIds);

  return {
    teamRows: (teamsResponse.data ?? []) as Record<string, unknown>[],
    memberRows,
    holeRows: (holesResponse.data ?? []) as Record<string, unknown>[],
    entryRows,
    profilesById,
  };
}

function attachAmbroseChildren(
  events: AmbroseEvent[],
  teamRows: Record<string, unknown>[],
  memberRows: Record<string, unknown>[],
  holeRows: Record<string, unknown>[],
  entryRows: Record<string, unknown>[],
  profilesById: Map<string, CgsProfile>
) {
  const teamsByEvent = new Map<number, AmbroseTeam[]>();
  const membersByTeam = new Map<number, AmbroseTeamMember[]>();
  const holesByEvent = new Map<number, AmbroseHole[]>();
  const entriesByEvent = new Map<number, AmbroseEntry[]>();

  memberRows
    .map((row) => mapRowToTeamMember(row, profilesById))
    .forEach((member) => {
      const currentMembers = membersByTeam.get(member.teamId) ?? [];
      currentMembers.push(member);
      membersByTeam.set(member.teamId, currentMembers);
    });

  teamRows.map(mapRowToTeam).forEach((team) => {
    const currentTeams = teamsByEvent.get(team.eventId) ?? [];
    currentTeams.push({
      ...team,
      members: [...(membersByTeam.get(team.id) ?? [])].sort(
        (left, right) => left.displayOrder - right.displayOrder
      ),
    });
    teamsByEvent.set(team.eventId, currentTeams);
  });

  holeRows.map(mapRowToHole).forEach((hole) => {
    const currentHoles = holesByEvent.get(hole.eventId) ?? [];
    currentHoles.push(hole);
    holesByEvent.set(hole.eventId, currentHoles);
  });

  entryRows.map(mapRowToEntry).forEach((entry) => {
    const currentEntries = entriesByEvent.get(entry.eventId) ?? [];
    currentEntries.push(entry);
    entriesByEvent.set(entry.eventId, currentEntries);
  });

  return events.map((event) => ({
    ...event,
    teams: [...(teamsByEvent.get(event.id) ?? [])].sort(
      (left, right) => left.displayOrder - right.displayOrder
    ),
    holes: [...(holesByEvent.get(event.id) ?? [])].sort(
      (left, right) => left.displayOrder - right.displayOrder
    ),
    entries: entriesByEvent.get(event.id) ?? [],
  }));
}

async function hydrateAmbroseEvents(events: AmbroseEvent[]) {
  const { teamRows, memberRows, holeRows, entryRows, profilesById } =
    await loadAmbroseChildren(events.map((event) => event.id));

  return attachAmbroseChildren(
    events,
    teamRows,
    memberRows,
    holeRows,
    entryRows,
    profilesById
  );
}

export function getAmbroseSnapshot(event: AmbroseEvent): AmbroseSnapshot {
  const entriesByTeam = new Map<number, AmbroseEntry[]>();
  const holesById = new Map(event.holes.map((hole) => [hole.id, hole]));
  const profilesById = new Map<string, CgsProfile>();
  const contributionMap = new Map<string, AmbroseTeamContribution>();

  event.teams.forEach((team) => {
    team.members.forEach((member) => {
      if (member.profile) {
        profilesById.set(member.profile.id, member.profile);
      }
    });
  });

  event.entries.forEach((entry) => {
    const currentEntries = entriesByTeam.get(entry.teamId) ?? [];
    currentEntries.push(entry);
    entriesByTeam.set(entry.teamId, currentEntries);
  });

  const ensureContribution = (team: AmbroseTeam, profileId: string) => {
    const profile = profilesById.get(profileId);

    if (!profile) {
      return null;
    }

    const key = `${team.id}:${profileId}`;
    const currentContribution = contributionMap.get(key);

    if (currentContribution) {
      return currentContribution;
    }

    const nextContribution = {
      profileId,
      displayName: profile.displayName || profile.email || profile.handle,
      nickname: profile.nickname,
      handle: profile.handle,
      avatarUrl: profile.avatarUrl,
      teamId: team.id,
      teamName: team.name,
      driveUses: 0,
      approachUses: 0,
      puttUses: 0,
      totalUses: 0,
    };

    contributionMap.set(key, nextContribution);
    return nextContribution;
  };

  const leaderboard = event.teams.map((team) => {
    team.members.forEach((member) => {
      ensureContribution(team, member.profileId);
    });

    const teamEntries = [...(entriesByTeam.get(team.id) ?? [])].sort(
      (left, right) => {
        const leftHole = holesById.get(left.holeId);
        const rightHole = holesById.get(right.holeId);
        return (leftHole?.displayOrder ?? 99) - (rightHole?.displayOrder ?? 99);
      }
    );
    const completeEntries = teamEntries.filter(
      (entry) => entry.grossStrokes !== null && entry.scoreToPar !== null
    );
    const fairwayEntries = completeEntries.filter(
      (entry) => entry.fairwayHit !== null
    );
    const girEntries = completeEntries.filter(
      (entry) => entry.greenInRegulation !== null
    );
    const puttEntries = completeEntries.filter((entry) => entry.putts !== null);
    const scoreToPar =
      completeEntries.length > 0
        ? completeEntries.reduce((total, entry) => total + (entry.scoreToPar ?? 0), 0)
        : null;

    completeEntries.forEach((entry) => {
      if (entry.drivePlayerId) {
        const contribution = ensureContribution(team, entry.drivePlayerId);
        if (contribution) {
          contribution.driveUses += 1;
          contribution.totalUses += 1;
        }
      }

      if (entry.approachPlayerId) {
        const contribution = ensureContribution(team, entry.approachPlayerId);
        if (contribution) {
          contribution.approachUses += 1;
          contribution.totalUses += 1;
        }
      }

      if (entry.puttPlayerId) {
        const contribution = ensureContribution(team, entry.puttPlayerId);
        if (contribution) {
          contribution.puttUses += 1;
          contribution.totalUses += 1;
        }
      }
    });

    const teamContributions = [...contributionMap.values()].filter(
      (contribution) => contribution.teamId === team.id
    );
    const contributionLeader =
      teamContributions.sort((left, right) => {
        if (left.totalUses !== right.totalUses) {
          return right.totalUses - left.totalUses;
        }

        return left.displayName.localeCompare(right.displayName, "en-AU");
      })[0] ?? null;
    const totalPutts = puttEntries.reduce(
      (total, entry) => total + (entry.putts ?? 0),
      0
    );

    return {
      team,
      entries: teamEntries,
      holesComplete: completeEntries.length,
      thruLabel: `Thru ${completeEntries.length}/${event.holes.length || event.holeCount}`,
      scoreToPar,
      scoreLabel: formatAmbroseScore(scoreToPar),
      birdies: completeEntries.filter((entry) => entry.scoreToPar === -1).length,
      eaglesOrBetter: completeEntries.filter(
        (entry) => entry.scoreToPar !== null && entry.scoreToPar <= -2
      ).length,
      pars: completeEntries.filter((entry) => entry.scoreToPar === 0).length,
      bogeysOrWorse: completeEntries.filter(
        (entry) => entry.scoreToPar !== null && entry.scoreToPar > 0
      ).length,
      totalPutts,
      puttEntries: puttEntries.length,
      averagePutts:
        puttEntries.length > 0 ? totalPutts / puttEntries.length : null,
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

  const completeEntries = event.entries.filter(
    (entry) => entry.grossStrokes !== null && entry.scoreToPar !== null
  ).length;

  return {
    event,
    leaderboard,
    playerContributions: [...contributionMap.values()].sort((left, right) => {
      if (left.totalUses !== right.totalUses) {
        return right.totalUses - left.totalUses;
      }

      return left.displayName.localeCompare(right.displayName, "en-AU");
    }),
    totalTeams: event.teams.length,
    totalPlayers: event.teams.reduce(
      (total, team) => total + team.members.length,
      0
    ),
    totalHoles: event.holes.length,
    completeEntries,
    totalEntriesPossible: event.teams.length * event.holes.length,
    completionRate:
      event.teams.length * event.holes.length > 0
        ? completeEntries / (event.teams.length * event.holes.length)
        : 0,
  };
}

export async function getAdminAmbroseEvents(limit = 20): Promise<AmbroseFeed> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await withTimeout(
      supabaseAdmin
        .from("cgs_ambrose_events")
        .select("*")
        .order("is_live", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(limit),
      AMBROSE_QUERY_TIMEOUT_MS,
      "Admin Ambrose events query"
    );

    if (error) {
      if (isMissingAmbroseTableError(error)) {
        return {
          events: [],
          source: "fallback",
          warningMessage: missingTableMessage,
        };
      }

      throw error;
    }

    const events = (data ?? []).map((row) =>
      mapRowToEvent(row as Record<string, unknown>)
    );

    return {
      events: await hydrateAmbroseEvents(events),
      source: "database",
      warningMessage: null,
    };
  } catch (error) {
    console.error("Admin Ambrose events query error:", error);

    return {
      events: [],
      source: "fallback",
      warningMessage:
        "CGS Ambrose events could not be loaded right now. Check the latest Supabase migration.",
    };
  }
}

export async function getPublishedAmbroseEvents(
  limit = 12
): Promise<AmbroseFeed> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await withTimeout(
      supabaseAdmin
        .from("cgs_ambrose_events")
        .select("*")
        .eq("is_published", true)
        .order("is_live", { ascending: false })
        .order("starts_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(limit),
      AMBROSE_QUERY_TIMEOUT_MS,
      "Published Ambrose events query"
    );

    if (error) {
      if (isMissingAmbroseTableError(error)) {
        return {
          events: [],
          source: "fallback",
          warningMessage: missingTableMessage,
        };
      }

      throw error;
    }

    const events = (data ?? []).map((row) =>
      mapRowToEvent(row as Record<string, unknown>)
    );

    return {
      events: await hydrateAmbroseEvents(events),
      source: "database",
      warningMessage: null,
    };
  } catch (error) {
    console.error("Published Ambrose events query error:", error);

    return {
      events: [],
      source: "fallback",
      warningMessage: "CGS Ambrose events could not be loaded right now.",
    };
  }
}

export async function getPublishedAmbroseEventBySlug(slug: string) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await withTimeout(
      supabaseAdmin
        .from("cgs_ambrose_events")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle(),
      AMBROSE_QUERY_TIMEOUT_MS,
      "Published Ambrose event by slug query"
    );

    if (error) {
      if (isMissingAmbroseTableError(error)) {
        return null;
      }

      throw error;
    }

    if (!data) {
      return null;
    }

    const [event] = await hydrateAmbroseEvents([
      mapRowToEvent(data as Record<string, unknown>),
    ]);
    return event;
  } catch (error) {
    console.error("Published Ambrose event by slug query error:", error);
    return null;
  }
}

export async function getAdminAmbroseEventById(id: number) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await withTimeout(
    supabaseAdmin.from("cgs_ambrose_events").select("*").eq("id", id).maybeSingle(),
    AMBROSE_QUERY_TIMEOUT_MS,
    "Admin Ambrose event by id query"
  );

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const [event] = await hydrateAmbroseEvents([
    mapRowToEvent(data as Record<string, unknown>),
  ]);

  return event;
}

export async function getAllProfilesForAdmin(limit = 200) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await withTimeout(
      supabaseAdmin
        .from("cgs_profiles")
        .select("*")
        .order("display_name", { ascending: true })
        .limit(limit),
      AMBROSE_QUERY_TIMEOUT_MS,
      "Admin profiles query"
    );

    if (error) {
      if (isMissingAmbroseTableError(error)) {
        return [];
      }

      throw error;
    }

    return ((data ?? []) as Record<string, unknown>[]).map(mapRowToProfile);
  } catch (error) {
    console.error("Admin profiles query error:", error);
    return [];
  }
}

async function createUniqueHandle(baseValue: string, userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const baseHandle = normalizeHandle(baseValue);
  const fallbackSuffix = userId.slice(0, 8).toLowerCase();
  const candidates = [
    baseHandle,
    `${baseHandle}-${fallbackSuffix.slice(0, 4)}`,
    `${baseHandle}-${fallbackSuffix}`,
  ];

  for (const candidate of candidates) {
    const { data, error } = await supabaseAdmin
      .from("cgs_profiles")
      .select("id")
      .eq("handle", candidate)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return candidate;
    }
  }

  return `${baseHandle}-${Date.now().toString(36)}`;
}

export async function ensureCgsProfileForAuthUser(user: AuthUserLike) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await withTimeout(
    supabaseAdmin.from("cgs_profiles").select("*").eq("id", user.id).maybeSingle(),
    AMBROSE_QUERY_TIMEOUT_MS,
    "Own profile query"
  );

  if (error && !isMissingAmbroseTableError(error)) {
    throw error;
  }

  const email = user.email ?? "";
  const metadata = user.user_metadata ?? {};
  const metadataName =
    typeof metadata.display_name === "string"
      ? metadata.display_name
      : typeof metadata.name === "string"
        ? metadata.name
        : "";
  const metadataNickname =
    typeof metadata.nickname === "string" ? metadata.nickname : "";

  if (data) {
    const profile = mapRowToProfile(data as Record<string, unknown>);

    if (email && profile.email !== email) {
      const { data: updatedData, error: updateError } = await supabaseAdmin
        .from("cgs_profiles")
        .update({ email, updated_at: new Date().toISOString() })
        .eq("id", user.id)
        .select("*")
        .single();

      if (updateError) {
        throw updateError;
      }

      return mapRowToProfile(updatedData as Record<string, unknown>);
    }

    return profile;
  }

  if (error && isMissingAmbroseTableError(error)) {
    throw error;
  }

  const displayName = metadataName || email.split("@")[0] || "CGS Player";
  const handle = await createUniqueHandle(
    metadataNickname || displayName || email || "player",
    user.id
  );
  const { data: insertedData, error: insertError } = await supabaseAdmin
    .from("cgs_profiles")
    .insert({
      id: user.id,
      email,
      handle,
      display_name: displayName,
      nickname: metadataNickname,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError) {
    throw insertError;
  }

  return mapRowToProfile(insertedData as Record<string, unknown>);
}

export async function updateOwnCgsProfile(
  profileId: string,
  input: {
    handle: string;
    displayName: string;
    nickname: string;
    avatarUrl: string;
    handicap: number | null;
    isPublic: boolean;
    broadcastStats?: Partial<CgsBroadcastProfileStats>;
  }
) {
  const supabaseAdmin = getSupabaseAdmin();
  const normalizedHandle = normalizeHandle(input.handle);
  const { data: currentProfile, error: currentProfileError } = await supabaseAdmin
    .from("cgs_profiles")
    .select("season_stats")
    .eq("id", profileId)
    .single();

  if (currentProfileError) {
    throw currentProfileError;
  }

  const currentSeasonStats =
    currentProfile?.season_stats && typeof currentProfile.season_stats === "object"
      ? (currentProfile.season_stats as Record<string, unknown>)
      : {};
  const seasonStats = mergeBroadcastProfileStats(
    currentSeasonStats,
    input.broadcastStats
  );

  const { data, error } = await supabaseAdmin
    .from("cgs_profiles")
    .update({
      handle: normalizedHandle,
      display_name: input.displayName,
      nickname: input.nickname,
      avatar_url: input.avatarUrl,
      handicap: input.handicap,
      is_public: input.isPublic,
      season_stats: seasonStats,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapRowToProfile(data as Record<string, unknown>);
}

export async function updateCgsProfilePhoto(profileId: string, avatarUrl: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("cgs_profiles")
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapRowToProfile(data as Record<string, unknown>);
}

export async function updateCgsProfileForAdmin(
  profileId: string,
  input: {
    handle: string;
    displayName: string;
    nickname: string;
    avatarUrl: string;
    handicap: number | null;
    isPublic: boolean;
    broadcastStats?: Partial<CgsBroadcastProfileStats>;
  }
) {
  const supabaseAdmin = getSupabaseAdmin();
  const normalizedHandle = normalizeHandle(input.handle);
  const { data: currentProfile, error: currentProfileError } = await supabaseAdmin
    .from("cgs_profiles")
    .select("season_stats")
    .eq("id", profileId)
    .single();

  if (currentProfileError) {
    throw currentProfileError;
  }

  const currentSeasonStats =
    currentProfile?.season_stats && typeof currentProfile.season_stats === "object"
      ? (currentProfile.season_stats as Record<string, unknown>)
      : {};
  const seasonStats = mergeBroadcastProfileStats(
    currentSeasonStats,
    input.broadcastStats
  );

  const { data, error } = await supabaseAdmin
    .from("cgs_profiles")
    .update({
      handle: normalizedHandle,
      display_name: input.displayName,
      nickname: input.nickname,
      avatar_url: input.avatarUrl,
      handicap: input.handicap,
      is_public: input.isPublic,
      season_stats: seasonStats,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapRowToProfile(data as Record<string, unknown>);
}

function getPhotoFileExtension(contentType: string) {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "";
  }
}

async function ensureCgsPlayerPhotoBucket() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: buckets, error: listError } =
    await supabaseAdmin.storage.listBuckets();

  if (listError) {
    throw listError;
  }

  if (buckets.some((bucket) => bucket.id === CGS_PLAYER_PHOTO_BUCKET)) {
    return;
  }

  const { error: createError } = await supabaseAdmin.storage.createBucket(
    CGS_PLAYER_PHOTO_BUCKET,
    {
      public: true,
      fileSizeLimit: CGS_PLAYER_PHOTO_SIZE_LIMIT,
      allowedMimeTypes: [...CGS_PLAYER_PHOTO_MIME_TYPES],
    }
  );

  if (createError) {
    throw createError;
  }
}

export async function uploadCgsProfilePhoto(profileId: string, file: File) {
  if (file.size <= 0) {
    return "";
  }

  if (file.size > CGS_PLAYER_PHOTO_SIZE_LIMIT) {
    throw new Error("Player photos must be 5MB or smaller.");
  }

  if (
    !CGS_PLAYER_PHOTO_MIME_TYPES.includes(
      file.type as (typeof CGS_PLAYER_PHOTO_MIME_TYPES)[number]
    )
  ) {
    throw new Error("Player photos must be JPG, PNG, or WebP.");
  }

  await ensureCgsPlayerPhotoBucket();

  const supabaseAdmin = getSupabaseAdmin();
  const extension = getPhotoFileExtension(file.type);
  const objectPath = `${profileId}/${Date.now().toString(36)}.${extension}`;
  const { error } = await supabaseAdmin.storage
    .from(CGS_PLAYER_PHOTO_BUCKET)
    .upload(objectPath, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data } = supabaseAdmin.storage
    .from(CGS_PLAYER_PHOTO_BUCKET)
    .getPublicUrl(objectPath);

  return data.publicUrl;
}

async function deleteCgsProfilePhotoObjects(profileId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: files, error: listError } = await supabaseAdmin.storage
    .from(CGS_PLAYER_PHOTO_BUCKET)
    .list(profileId, { limit: 1000 });

  if (listError) {
    if (isMissingStorageBucketError(listError)) {
      return;
    }

    throw listError;
  }

  const objectPaths = (files ?? [])
    .filter((file) => file.name)
    .map((file) => `${profileId}/${file.name}`);

  if (objectPaths.length === 0) {
    return;
  }

  const { error: removeError } = await supabaseAdmin.storage
    .from(CGS_PLAYER_PHOTO_BUCKET)
    .remove(objectPaths);

  if (removeError) {
    throw removeError;
  }
}

export async function deleteOwnCgsAccount(profileId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  await deleteCgsProfilePhotoObjects(profileId);

  const { error: teamError } = await supabaseAdmin
    .from("cgs_ambrose_teams")
    .update({
      created_by: null,
      join_code_hash: "",
      updated_at: new Date().toISOString(),
    })
    .eq("created_by", profileId);

  if (teamError && !isMissingAmbroseTableError(teamError)) {
    throw teamError;
  }

  const { error: deleteError } =
    await supabaseAdmin.auth.admin.deleteUser(profileId);

  if (deleteError) {
    throw deleteError;
  }
}

export async function getPlayerAmbroseDashboard(
  profileId: string
): Promise<PlayerAmbroseDashboard> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: profileData, error: profileError } = await withTimeout(
      supabaseAdmin.from("cgs_profiles").select("*").eq("id", profileId).single(),
      AMBROSE_QUERY_TIMEOUT_MS,
      "Player profile query"
    );

    if (profileError) {
      throw profileError;
    }

    const { data: memberData, error: memberError } = await withTimeout(
      supabaseAdmin
        .from("cgs_ambrose_team_members")
        .select("*")
        .eq("profile_id", profileId),
      AMBROSE_QUERY_TIMEOUT_MS,
      "Player Ambrose assignment query"
    );

    if (memberError) {
      if (isMissingAmbroseTableError(memberError)) {
        return {
          profile: mapRowToProfile(profileData as Record<string, unknown>),
          events: [],
          assignedTeamIds: [],
          source: "fallback",
          warningMessage: missingTableMessage,
        };
      }

      throw memberError;
    }

    const assignments = (memberData ?? []) as Record<string, unknown>[];
    const assignedTeamIds = [
      ...new Set(assignments.map((row) => Number(row.team_id)).filter(Boolean)),
    ];

    const { data: eventData, error: eventError } = await withTimeout(
      supabaseAdmin
        .from("cgs_ambrose_events")
        .select("*")
        .eq("is_published", true)
        .order("is_live", { ascending: false })
        .order("updated_at", { ascending: false }),
      AMBROSE_QUERY_TIMEOUT_MS,
      "Player published Ambrose events query"
    );

    if (eventError) {
      throw eventError;
    }

    const events = ((eventData ?? []) as Record<string, unknown>[]).map(
      mapRowToEvent
    );

    return {
      profile: mapRowToProfile(profileData as Record<string, unknown>),
      events: await hydrateAmbroseEvents(events),
      assignedTeamIds,
      source: "database",
      warningMessage: null,
    };
  } catch (error) {
    console.error("Player Ambrose dashboard query error:", error);
    throw error;
  }
}

export async function getAdminPlayerAmbroseDashboard(): Promise<PlayerAmbroseDashboard> {
  const feed = await getPublishedAmbroseEvents(20);
  const assignedTeamIds = [
    ...new Set(feed.events.flatMap((event) => event.teams.map((team) => team.id))),
  ];

  return {
    profile: ADMIN_APP_PROFILE,
    events: feed.events,
    assignedTeamIds,
    source: feed.source,
    warningMessage: feed.warningMessage,
  };
}

export async function createPlayerAmbroseTeam(input: {
  eventId: number;
  profileId: string;
  name: string;
  joinCode: string;
}) {
  const teamName = input.name.trim().slice(0, 80);
  const joinCode = normalizeTeamJoinCode(input.joinCode);

  if (!teamName) {
    throw new Error("Team name is required.");
  }

  if (joinCode.length < 4) {
    throw new Error("Team password must be at least 4 characters.");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: eventData, error: eventError } = await supabaseAdmin
    .from("cgs_ambrose_events")
    .select("id,is_published")
    .eq("id", input.eventId)
    .single();

  if (eventError) {
    throw eventError;
  }

  if (!eventData.is_published) {
    throw new Error("This competition is not open for player teams.");
  }

  const { data: teamData, error: teamError } = await supabaseAdmin
    .from("cgs_ambrose_teams")
    .select("display_order")
    .eq("event_id", input.eventId)
    .order("display_order", { ascending: false })
    .limit(1);

  if (teamError) {
    throw teamError;
  }

  const nextDisplayOrder =
    ((teamData ?? []) as Record<string, unknown>[]).reduce(
      (highest, row) => Math.max(highest, Number(row.display_order ?? 0)),
      0
    ) + 1;
  const now = new Date().toISOString();
  const { data: insertedTeam, error: insertError } = await supabaseAdmin
    .from("cgs_ambrose_teams")
    .insert({
      event_id: input.eventId,
      display_order: nextDisplayOrder,
      name: teamName,
      short_name: buildTeamShortName(teamName),
      accent_color: "#62d7ff",
      bay_label: "Bay TBC",
      starting_hole: null,
      is_featured: false,
      created_by: input.profileId,
      join_code_hash: hashTeamJoinCode(input.eventId, joinCode),
      updated_at: now,
    })
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  await addAmbroseTeamMember({
    teamId: Number(insertedTeam.id),
    profileId: input.profileId,
    displayOrder: 1,
    roleLabel: "Captain",
  });

  await touchAmbroseEvent(input.eventId);
}

export async function joinPlayerAmbroseTeam(input: {
  eventId: number;
  teamId: number;
  profileId: string;
  joinCode: string;
}) {
  const joinCode = normalizeTeamJoinCode(input.joinCode);

  if (joinCode.length < 4) {
    throw new Error("Team password is required.");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: teamData, error: teamError } = await supabaseAdmin
    .from("cgs_ambrose_teams")
    .select("id,event_id,join_code_hash")
    .eq("id", input.teamId)
    .single();

  if (teamError) {
    throw teamError;
  }

  if (Number(teamData.event_id) !== input.eventId) {
    throw new Error("That team does not belong to this competition.");
  }

  const expectedHash = String(teamData.join_code_hash ?? "");

  if (!expectedHash || expectedHash !== hashTeamJoinCode(input.eventId, joinCode)) {
    throw new Error("Team password is incorrect.");
  }

  await addAmbroseTeamMember({
    teamId: input.teamId,
    profileId: input.profileId,
    displayOrder: 2,
    roleLabel: "Player",
  });

  await touchAmbroseEvent(input.eventId);
}

export async function createAmbroseEvent(input: AmbroseEventInput) {
  const supabaseAdmin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("cgs_ambrose_events")
    .insert({
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      season_label: input.seasonLabel,
      course_name: input.courseName,
      status_label: input.statusLabel,
      bay_count: input.bayCount,
      hole_count: input.holeCount,
      starts_at: input.startsAt,
      is_live: input.isLive,
      is_published: input.isPublished,
      scoring_notes: input.scoringNotes,
      updated_at: now,
    })
    .select("id,hole_count")
    .single();

  if (error) {
    throw error;
  }

  const eventId = Number(data.id);
  const holeCount = Number(data.hole_count ?? input.holeCount);
  const holes = Array.from({ length: holeCount }, (_, index) => ({
    event_id: eventId,
    display_order: index + 1,
    hole_number: index + 1,
    hole_label: `Hole ${index + 1}`,
    par: 4,
    updated_at: now,
  }));

  const { error: holeError } = await supabaseAdmin
    .from("cgs_ambrose_holes")
    .insert(holes);

  if (holeError) {
    throw holeError;
  }

  return eventId;
}

export async function updateAmbroseEvent(id: number, input: AmbroseEventInput) {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("cgs_ambrose_events")
    .update({
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      season_label: input.seasonLabel,
      course_name: input.courseName,
      status_label: input.statusLabel,
      bay_count: input.bayCount,
      hole_count: input.holeCount,
      starts_at: input.startsAt,
      is_live: input.isLive,
      is_published: input.isPublished,
      scoring_notes: input.scoringNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function createAmbroseTeam(input: AmbroseTeamInput) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("cgs_ambrose_teams")
    .insert({
      event_id: input.eventId,
      display_order: input.displayOrder,
      name: input.name,
      short_name: input.shortName,
      accent_color: input.accentColor,
      bay_label: input.bayLabel,
      starting_hole: input.startingHole,
      is_featured: input.isFeatured,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await touchAmbroseEvent(input.eventId);
  return Number(data.id);
}

export async function updateAmbroseTeam(id: number, input: AmbroseTeamInput) {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("cgs_ambrose_teams")
    .update({
      display_order: input.displayOrder,
      name: input.name,
      short_name: input.shortName,
      accent_color: input.accentColor,
      bay_label: input.bayLabel,
      starting_hole: input.startingHole,
      is_featured: input.isFeatured,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }

  await touchAmbroseEvent(input.eventId);
}

export async function addAmbroseTeamMember(input: {
  teamId: number;
  profileId: string;
  displayOrder: number;
  roleLabel: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: teamData, error: teamError } = await supabaseAdmin
    .from("cgs_ambrose_teams")
    .select("event_id")
    .eq("id", input.teamId)
    .single();

  if (teamError) {
    throw teamError;
  }

  const eventId = Number(teamData.event_id);
  const { data: existingMembers, error: existingMembersError } =
    await supabaseAdmin
      .from("cgs_ambrose_team_members")
      .select("profile_id")
      .eq("team_id", input.teamId);

  if (existingMembersError) {
    throw existingMembersError;
  }

  const existingMemberRows = (existingMembers ?? []) as Record<string, unknown>[];
  const profileAlreadyOnTeam = existingMemberRows.some(
    (row) => String(row.profile_id ?? "") === input.profileId
  );

  if (!profileAlreadyOnTeam && existingMemberRows.length >= 2) {
    throw new Error("Ambrose teams are limited to two allocated players.");
  }

  const { error } = await supabaseAdmin.from("cgs_ambrose_team_members").upsert(
    {
      event_id: eventId,
      team_id: input.teamId,
      profile_id: input.profileId,
      display_order: input.displayOrder,
      role_label: input.roleLabel,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "event_id,profile_id",
    }
  );

  if (error) {
    throw error;
  }

  await touchAmbroseEvent(eventId);
}

export async function removeAmbroseTeamMember(memberId: number, eventId: number) {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("cgs_ambrose_team_members")
    .delete()
    .eq("id", memberId);

  if (error) {
    throw error;
  }

  await touchAmbroseEvent(eventId);
}

export async function upsertAmbroseEntry(input: AmbroseEntryInput) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: holeData, error: holeError } = await supabaseAdmin
    .from("cgs_ambrose_holes")
    .select("id,event_id,par")
    .eq("id", input.holeId)
    .single();

  if (holeError) {
    throw holeError;
  }

  const { data: teamData, error: teamError } = await supabaseAdmin
    .from("cgs_ambrose_teams")
    .select("id,event_id")
    .eq("id", input.teamId)
    .single();

  if (teamError) {
    throw teamError;
  }

  const eventId = Number(holeData.event_id);

  if (eventId !== input.eventId || Number(teamData.event_id) !== input.eventId) {
    throw new Error("The selected team and hole do not belong to this Ambrose event.");
  }

  const { data: memberData, error: memberError } = await supabaseAdmin
    .from("cgs_ambrose_team_members")
    .select("profile_id")
    .eq("team_id", input.teamId);

  if (memberError) {
    throw memberError;
  }

  const teamProfileIds = new Set(
    ((memberData ?? []) as Record<string, unknown>[]).map((row) =>
      String(row.profile_id ?? "")
    )
  );

  if (!input.updatedByAdmin) {
    if (!input.actorProfileId || !teamProfileIds.has(input.actorProfileId)) {
      throw new Error("Only allocated team members can submit this team score.");
    }
  }

  const contributionIds = [
    input.drivePlayerId,
    input.approachPlayerId,
    input.puttPlayerId,
  ].filter(Boolean);
  const hasInvalidContribution = contributionIds.some(
    (profileId) => !teamProfileIds.has(profileId)
  );

  if (hasInvalidContribution) {
    throw new Error("Shot contribution players must be allocated to this team.");
  }

  const par = Number(holeData.par ?? 4);
  const scoreToPar = input.grossStrokes - par;
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("cgs_ambrose_entries").upsert(
    {
      event_id: input.eventId,
      team_id: input.teamId,
      hole_id: input.holeId,
      submitted_by: input.actorProfileId,
      gross_strokes: input.grossStrokes,
      score_to_par: scoreToPar,
      putts: input.putts,
      fairway_hit: input.fairwayHit,
      green_in_regulation: input.greenInRegulation,
      penalties: Math.max(Math.trunc(input.penalties), 0),
      drive_player_id: input.drivePlayerId || null,
      drive_distance_meters: input.driveDistanceMeters,
      approach_player_id: input.approachPlayerId || null,
      iron_club: input.ironClub || "",
      iron_distance_meters: input.ironDistanceMeters,
      putt_player_id: input.puttPlayerId || null,
      notes: input.notes || null,
      updated_by_admin: input.updatedByAdmin,
      updated_at: now,
    },
    {
      onConflict: "team_id,hole_id",
    }
  );

  if (error) {
    throw error;
  }

  await touchAmbroseEvent(input.eventId);
}

async function touchAmbroseEvent(eventId: number) {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("cgs_ambrose_events")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", eventId);

  if (error) {
    throw error;
  }
}

export async function getPublicPlayerProfileByHandle(handle: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await withTimeout(
    supabaseAdmin
      .from("cgs_profiles")
      .select("*")
      .eq("handle", normalizeHandle(handle))
      .eq("is_public", true)
      .maybeSingle(),
    AMBROSE_QUERY_TIMEOUT_MS,
    "Public profile by handle query"
  );

  if (error) {
    if (isMissingAmbroseTableError(error)) {
      return null;
    }

    throw error;
  }

  if (!data) {
    return null;
  }

  return buildPublicPlayerProfile(mapRowToProfile(data as Record<string, unknown>));
}

async function buildPublicPlayerProfile(profile: CgsProfile) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: memberData, error: memberError } = await withTimeout(
    supabaseAdmin
      .from("cgs_ambrose_team_members")
      .select("*")
      .eq("profile_id", profile.id),
    AMBROSE_QUERY_TIMEOUT_MS,
    "Public profile Ambrose memberships query"
  );

  if (memberError) {
    throw memberError;
  }

  const memberships = (memberData ?? []) as Record<string, unknown>[];
  const eventIds = [
    ...new Set(memberships.map((row) => Number(row.event_id)).filter(Boolean)),
  ];

  if (eventIds.length === 0) {
    return {
      profile,
      currentTeam: null,
      stats: {
        eventsPlayed: 0,
        teamsPlayed: 0,
        holesRecorded: 0,
        averageTeamScoreToPar: null,
        driveUses: 0,
        approachUses: 0,
        puttUses: 0,
        totalContributionUses: 0,
      },
      memberships: [],
    } satisfies PublicPlayerProfile;
  }

  const { data: eventData, error: eventError } = await withTimeout(
    supabaseAdmin
      .from("cgs_ambrose_events")
      .select("*")
      .in("id", eventIds)
      .eq("is_published", true)
      .order("is_live", { ascending: false })
      .order("updated_at", { ascending: false }),
    AMBROSE_QUERY_TIMEOUT_MS,
    "Public profile Ambrose events query"
  );

  if (eventError) {
    throw eventError;
  }

  const events = await hydrateAmbroseEvents(
    ((eventData ?? []) as Record<string, unknown>[]).map(mapRowToEvent)
  );
  const membershipEventIds = new Set(events.map((event) => event.id));
  const membershipsForPublishedEvents = memberships.filter((row) =>
    membershipEventIds.has(Number(row.event_id))
  );
  const teamIds = [
    ...new Set(membershipsForPublishedEvents.map((row) => Number(row.team_id))),
  ];
  const teamEntries = events.flatMap((event) =>
    event.entries.filter((entry) => teamIds.includes(entry.teamId))
  );
  const completeEntries = teamEntries.filter(
    (entry) => entry.grossStrokes !== null && entry.scoreToPar !== null
  );
  const driveUses = teamEntries.filter(
    (entry) => entry.drivePlayerId === profile.id
  ).length;
  const approachUses = teamEntries.filter(
    (entry) => entry.approachPlayerId === profile.id
  ).length;
  const puttUses = teamEntries.filter(
    (entry) => entry.puttPlayerId === profile.id
  ).length;
  const totalScoreToPar = completeEntries.reduce(
    (total, entry) => total + (entry.scoreToPar ?? 0),
    0
  );
  const eventMemberships = events.flatMap((event) =>
    event.teams
      .filter((team) => teamIds.includes(team.id))
      .map((team) => ({
        eventTitle: event.title,
        eventSlug: event.slug,
        seasonLabel: event.seasonLabel,
        teamName: team.name,
        teamShortName: team.shortName,
        bayLabel: team.bayLabel,
        isLive: event.isLive,
      }))
  );
  const currentMembership = eventMemberships.find((membership) => membership.isLive)
    ?? eventMemberships[0]
    ?? null;

  return {
    profile,
    currentTeam: currentMembership
      ? {
          eventTitle: currentMembership.eventTitle,
          eventSlug: currentMembership.eventSlug,
          teamName: currentMembership.teamName,
          teamShortName: currentMembership.teamShortName,
          bayLabel: currentMembership.bayLabel,
        }
      : null,
    stats: {
      eventsPlayed: new Set(eventMemberships.map((item) => item.eventSlug)).size,
      teamsPlayed: new Set(eventMemberships.map((item) => item.teamName)).size,
      holesRecorded: completeEntries.length,
      averageTeamScoreToPar:
        completeEntries.length > 0 ? totalScoreToPar / completeEntries.length : null,
      driveUses,
      approachUses,
      puttUses,
      totalContributionUses: driveUses + approachUses + puttUses,
    },
    memberships: eventMemberships,
  } satisfies PublicPlayerProfile;
}
