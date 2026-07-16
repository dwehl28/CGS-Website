"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminAuthenticated } from "@/lib/admin-auth";
import { normalizeString } from "@/lib/form-utils";
import {
  addAmbroseTeamMember,
  createAmbroseEvent,
  createAmbroseTeam,
  removeAmbroseTeamMember,
  updateCgsProfileForAdmin,
  updateAmbroseEvent,
  updateAmbroseTeam,
  uploadCgsProfilePhoto,
  upsertAmbroseEntry,
} from "@/lib/ambrose-events";

function parseOptionalDate(value: string) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
}

function parseNullableNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function parseNullableBoolean(value: FormDataEntryValue | null) {
  if (value === "yes") {
    return true;
  }

  if (value === "no") {
    return false;
  }

  return null;
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function revalidateAmbrosePaths(slug: string) {
  revalidatePath("/play");
  revalidatePath(`/competitions/${slug}`);
  revalidatePath(`/stream/ambrose/${slug}/leaderboard`);
  revalidatePath("/stream/ambrose/[slug]/player/[handle]", "page");
  revalidatePath("/clubhouse-admin/ambrose");
}

function getAmbroseAdminAnchor(eventId: number) {
  return `/clubhouse-admin/ambrose#ambrose-event-${eventId}`;
}

function parseEventInput(formData: FormData) {
  const title = normalizeString(formData.get("title"), 140);
  const requestedSlug = normalizeString(formData.get("slug"), 120);
  const slug = normalizeSlug(requestedSlug || title);
  const summary = normalizeString(formData.get("summary"), 420);
  const seasonLabel =
    normalizeString(formData.get("season_label"), 80) || "CGS Team Event";
  const courseName =
    normalizeString(formData.get("course_name"), 120) || "GSPro course TBC";
  const statusLabel =
    normalizeString(formData.get("status_label"), 80) || "Ambrose team event";
  const bayCount = Math.min(
    Math.max(Number(formData.get("bay_count")) || 3, 1),
    3
  );
  const holeCount = Math.min(
    Math.max(Number(formData.get("hole_count")) || 18, 1),
    18
  );
  const startsAt = parseOptionalDate(
    normalizeString(formData.get("starts_at"), 40)
  );
  const isLive = formData.get("is_live") === "on";
  const isPublished = formData.get("is_published") === "on";
  const scoringNotes =
    normalizeString(formData.get("scoring_notes"), 420) ||
    "Team Ambrose. Either allocated team member can enter the team hole result.";

  return {
    title,
    slug,
    summary,
    seasonLabel,
    courseName,
    statusLabel,
    bayCount,
    holeCount,
    startsAt,
    isLive,
    isPublished,
    scoringNotes,
  };
}

function parseTeamInput(formData: FormData) {
  return {
    eventId: Number(formData.get("event_id")),
    displayOrder: Number(formData.get("display_order")) || 99,
    name: normalizeString(formData.get("name"), 120),
    shortName: normalizeString(formData.get("short_name"), 16),
    accentColor:
      normalizeString(formData.get("accent_color"), 24) || "#62d7ff",
    bayLabel: normalizeString(formData.get("bay_label"), 40) || "Bay TBC",
    startingHole: parseNullableNumber(
      normalizeString(formData.get("starting_hole"), 8)
    ),
    isFeatured: formData.get("is_featured") === "on",
  };
}

export async function createAmbroseEventAction(formData: FormData) {
  await requireAdminAuthenticated();

  const input = parseEventInput(formData);

  if (!input.title || !input.slug || !input.summary) {
    redirect("/clubhouse-admin/ambrose");
  }

  let eventId: number | null = null;

  try {
    eventId = await createAmbroseEvent(input);
  } catch (error) {
    console.error("Create Ambrose event action error:", error);
    redirect("/clubhouse-admin/ambrose");
  }

  revalidateAmbrosePaths(input.slug);
  if (eventId === null) {
    redirect("/clubhouse-admin/ambrose");
  }

  redirect(getAmbroseAdminAnchor(eventId));
}

export async function updateAmbroseEventAction(formData: FormData) {
  await requireAdminAuthenticated();

  const id = Number(formData.get("id"));
  const input = parseEventInput(formData);

  if (!Number.isFinite(id) || !input.title || !input.slug || !input.summary) {
    redirect("/clubhouse-admin/ambrose");
  }

  try {
    await updateAmbroseEvent(id, input);
  } catch (error) {
    console.error("Update Ambrose event action error:", error);
  }

  revalidateAmbrosePaths(input.slug);
  redirect(getAmbroseAdminAnchor(id));
}

export async function createAmbroseTeamAction(formData: FormData) {
  await requireAdminAuthenticated();

  const eventSlug = normalizeString(formData.get("event_slug"), 120);
  const input = parseTeamInput(formData);

  if (!Number.isFinite(input.eventId) || !input.name) {
    redirect("/clubhouse-admin/ambrose");
  }

  try {
    await createAmbroseTeam(input);
  } catch (error) {
    console.error("Create Ambrose team action error:", error);
  }

  revalidateAmbrosePaths(eventSlug);
  redirect(getAmbroseAdminAnchor(input.eventId));
}

export async function createAmbroseTeamWithMembersAction(formData: FormData) {
  await requireAdminAuthenticated();

  const eventSlug = normalizeString(formData.get("event_slug"), 120);
  const firstProfileId = normalizeString(formData.get("player_one_id"), 80);
  const secondProfileId = normalizeString(formData.get("player_two_id"), 80);
  const input = parseTeamInput(formData);

  if (!Number.isFinite(input.eventId) || !input.name) {
    redirect("/clubhouse-admin/ambrose");
  }

  try {
    const teamId = await createAmbroseTeam(input);
    const profileIds = [...new Set([firstProfileId, secondProfileId].filter(Boolean))];

    await Promise.all(
      profileIds.map((profileId, index) =>
        addAmbroseTeamMember({
          teamId,
          profileId,
          displayOrder: index + 1,
          roleLabel: index === 0 ? "Player 1" : "Player 2",
        })
      )
    );
  } catch (error) {
    console.error("Create Ambrose team with members action error:", error);
  }

  revalidateAmbrosePaths(eventSlug);
  redirect(getAmbroseAdminAnchor(input.eventId));
}

export async function updateAmbroseTeamAction(formData: FormData) {
  await requireAdminAuthenticated();

  const id = Number(formData.get("id"));
  const eventSlug = normalizeString(formData.get("event_slug"), 120);
  const input = parseTeamInput(formData);

  if (!Number.isFinite(id) || !Number.isFinite(input.eventId) || !input.name) {
    redirect("/clubhouse-admin/ambrose");
  }

  try {
    await updateAmbroseTeam(id, input);
  } catch (error) {
    console.error("Update Ambrose team action error:", error);
  }

  revalidateAmbrosePaths(eventSlug);
  redirect(getAmbroseAdminAnchor(input.eventId));
}

export async function addAmbroseTeamMemberAction(formData: FormData) {
  await requireAdminAuthenticated();

  const eventId = Number(formData.get("event_id"));
  const eventSlug = normalizeString(formData.get("event_slug"), 120);
  const teamId = Number(formData.get("team_id"));
  const profileId = normalizeString(formData.get("profile_id"), 80);
  const displayOrder = Number(formData.get("display_order")) || 99;
  const roleLabel =
    normalizeString(formData.get("role_label"), 40) || "Player";

  if (!Number.isFinite(eventId) || !Number.isFinite(teamId) || !profileId) {
    redirect("/clubhouse-admin/ambrose");
  }

  try {
    await addAmbroseTeamMember({
      teamId,
      profileId,
      displayOrder,
      roleLabel,
    });
  } catch (error) {
    console.error("Add Ambrose team member action error:", error);
  }

  revalidateAmbrosePaths(eventSlug);
  redirect(getAmbroseAdminAnchor(eventId));
}

export async function removeAmbroseTeamMemberAction(formData: FormData) {
  await requireAdminAuthenticated();

  const eventId = Number(formData.get("event_id"));
  const eventSlug = normalizeString(formData.get("event_slug"), 120);
  const memberId = Number(formData.get("member_id"));

  if (!Number.isFinite(eventId) || !Number.isFinite(memberId)) {
    redirect("/clubhouse-admin/ambrose");
  }

  try {
    await removeAmbroseTeamMember(memberId, eventId);
  } catch (error) {
    console.error("Remove Ambrose team member action error:", error);
  }

  revalidateAmbrosePaths(eventSlug);
  redirect(getAmbroseAdminAnchor(eventId));
}

export async function updateAmbroseEntryAction(formData: FormData) {
  await requireAdminAuthenticated();

  const eventId = Number(formData.get("event_id"));
  const eventSlug = normalizeString(formData.get("event_slug"), 120);
  const teamId = Number(formData.get("team_id"));
  const holeId = Number(formData.get("hole_id"));
  const grossStrokes = parseNullableNumber(
    normalizeString(formData.get("gross_strokes"), 8)
  );
  const putts = parseNullableNumber(normalizeString(formData.get("putts"), 8));
  const penalties =
    parseNullableNumber(normalizeString(formData.get("penalties"), 8)) ?? 0;
  const fairwayHit = parseNullableBoolean(formData.get("fairway_hit"));
  const greenInRegulation = parseNullableBoolean(
    formData.get("green_in_regulation")
  );
  const drivePlayerId = normalizeString(formData.get("drive_player_id"), 80);
  const driveDistanceMeters = parseNullableNumber(
    normalizeString(formData.get("drive_distance_meters"), 8)
  );
  const approachPlayerId = normalizeString(
    formData.get("approach_player_id"),
    80
  );
  const ironClub = normalizeString(formData.get("iron_club"), 40);
  const ironDistanceMeters = parseNullableNumber(
    normalizeString(formData.get("iron_distance_meters"), 8)
  );
  const puttPlayerId = normalizeString(formData.get("putt_player_id"), 80);
  const notes = normalizeString(formData.get("notes"), 240);

  if (
    !Number.isFinite(eventId) ||
    !Number.isFinite(teamId) ||
    !Number.isFinite(holeId) ||
    grossStrokes === null
  ) {
    redirect("/clubhouse-admin/ambrose");
  }

  try {
    await upsertAmbroseEntry({
      eventId,
      teamId,
      holeId,
      grossStrokes,
      putts,
      fairwayHit,
      greenInRegulation,
      penalties,
      drivePlayerId,
      driveDistanceMeters,
      approachPlayerId,
      ironClub,
      ironDistanceMeters,
      puttPlayerId,
      notes,
      actorProfileId: null,
      updatedByAdmin: true,
    });
  } catch (error) {
    console.error("Update Ambrose entry action error:", error);
  }

  revalidateAmbrosePaths(eventSlug);
  redirect(getAmbroseAdminAnchor(eventId));
}

export async function updateCgsPlayerProfileAction(formData: FormData) {
  await requireAdminAuthenticated();

  const profileId = normalizeString(formData.get("profile_id"), 80);
  const handle = normalizeSlug(normalizeString(formData.get("handle"), 80));
  const displayName = normalizeString(formData.get("display_name"), 120);
  const nickname = normalizeString(formData.get("nickname"), 80);
  const handicap = parseNullableNumber(normalizeString(formData.get("handicap"), 8));
  const avatarFile = formData.get("avatar_file");
  let avatarUrl = normalizeString(formData.get("avatar_url"), 500);

  if (!profileId || !handle || !displayName) {
    redirect("/clubhouse-admin/ambrose#ambrose-profiles");
  }

  try {
    if (avatarFile instanceof File && avatarFile.size > 0) {
      avatarUrl = await uploadCgsProfilePhoto(profileId, avatarFile);
    }

    await updateCgsProfileForAdmin(profileId, {
      handle,
      displayName,
      nickname,
      avatarUrl,
      handicap,
      isPublic: formData.get("is_public") === "on",
      broadcastStats: {
        averageDrive: normalizeString(formData.get("average_drive"), 80),
        goToIron: normalizeString(formData.get("go_to_iron"), 80),
        bestResult: normalizeString(formData.get("best_result"), 120),
        biggestWeakness: normalizeString(formData.get("biggest_weakness"), 140),
      },
    });
  } catch (error) {
    console.error("Update CGS player profile action error:", error);
  }

  revalidatePath("/play");
  revalidatePath(`/players/${handle}`);
  revalidatePath("/stream/ambrose/[slug]/player/[handle]", "page");
  revalidatePath("/clubhouse-admin/ambrose");
  redirect("/clubhouse-admin/ambrose#ambrose-profiles");
}
