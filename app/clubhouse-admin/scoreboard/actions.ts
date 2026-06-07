"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminAuthenticated } from "@/lib/admin-auth";
import { normalizeString } from "@/lib/form-utils";
import {
  createCompetitionScoreEntry,
  createCompetitionScoreboard,
  deleteCompetitionScoreEntry,
  updateCompetitionScoreEntry,
  updateCompetitionScoreEntryScore,
  updateCompetitionScoreboard,
} from "@/lib/scoreboards";

export type ScoreboardAdminActionState = {
  message: string;
};

function parseOptionalDate(value: string) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
}

function parseNullableNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function isValidCallToActionHref(value: string) {
  return value.startsWith("/") || /^https:\/\/.+/i.test(value);
}

function revalidateScoreboardPaths(slug: string) {
  revalidatePath("/scoreboard");
  revalidatePath(`/scoreboard/${slug}`);
  revalidatePath(`/scoreboard/${slug}/stream`);
  revalidatePath("/clubhouse-admin/scoreboard");
}

function getScoreboardAdminAnchor(competitionId: number) {
  return `/clubhouse-admin/scoreboard#scoreboard-${competitionId}`;
}

const initialScoreboardAdminActionState: ScoreboardAdminActionState = {
  message: "",
};

export async function createCompetitionScoreboardAction(
  previousState: ScoreboardAdminActionState = initialScoreboardAdminActionState,
  formData: FormData
) {
  void previousState;

  try {
    await requireAdminAuthenticated();
  } catch {
    return {
      message: "Your admin session expired. Refresh and sign in again.",
    };
  }

  const title = normalizeString(formData.get("title"), 120);
  const requestedSlug = normalizeString(formData.get("slug"), 120);
  const slug = normalizeSlug(requestedSlug || title);
  const summary = normalizeString(formData.get("summary"), 320);
  const statusLabel =
    normalizeString(formData.get("status_label"), 60) || "Scoreboard";
  const location = normalizeString(formData.get("location"), 120);
  const formatLabel = normalizeString(formData.get("format_label"), 80);
  const roundLabel = normalizeString(formData.get("round_label"), 80);
  const ctaLabel = normalizeString(formData.get("cta_label"), 40);
  const ctaHref = normalizeString(formData.get("cta_href"), 240);
  const startsAt = parseOptionalDate(normalizeString(formData.get("starts_at"), 40));
  const endsAt = parseOptionalDate(normalizeString(formData.get("ends_at"), 40));
  const isLive = formData.get("is_live") === "on";
  const isPublished = formData.get("is_published") === "on";

  if (!title || !slug || !summary) {
    return {
      message: "Title, slug, and summary are required for a competition board.",
    };
  }

  if ((ctaLabel && !ctaHref) || (!ctaLabel && ctaHref)) {
    return {
      message: "If you add a CTA, include both the label and the link.",
    };
  }

  if (ctaHref && !isValidCallToActionHref(ctaHref)) {
    return {
      message: "CTA links must start with / or https://.",
    };
  }

  try {
    await createCompetitionScoreboard({
      slug,
      title,
      summary,
      statusLabel,
      location,
      formatLabel,
      roundLabel,
      ctaLabel,
      ctaHref,
      startsAt,
      endsAt,
      isLive,
      isPublished,
    });
  } catch (error) {
    console.error("Create competition scoreboard action error:", error);
    return {
      message:
        "The scoreboard could not be saved. Check that the latest migration is applied and that the slug is unique.",
    };
  }

  revalidateScoreboardPaths(slug);

  return {
    message: "Competition scoreboard saved and ready for live scoring.",
  };
}

export async function updateCompetitionScoreboardAction(formData: FormData) {
  await requireAdminAuthenticated();

  const id = Number(formData.get("id"));
  const title = normalizeString(formData.get("title"), 120);
  const requestedSlug = normalizeString(formData.get("slug"), 120);
  const slug = normalizeSlug(requestedSlug || title);
  const summary = normalizeString(formData.get("summary"), 320);
  const statusLabel =
    normalizeString(formData.get("status_label"), 60) || "Scoreboard";
  const location = normalizeString(formData.get("location"), 120);
  const formatLabel = normalizeString(formData.get("format_label"), 80);
  const roundLabel = normalizeString(formData.get("round_label"), 80);
  const ctaLabel = normalizeString(formData.get("cta_label"), 40);
  const ctaHref = normalizeString(formData.get("cta_href"), 240);
  const startsAt = parseOptionalDate(normalizeString(formData.get("starts_at"), 40));
  const endsAt = parseOptionalDate(normalizeString(formData.get("ends_at"), 40));
  const isLive = formData.get("is_live") === "on";
  const isPublished = formData.get("is_published") === "on";

  if (!Number.isFinite(id) || !title || !slug || !summary) {
    redirect(
      Number.isFinite(id)
        ? getScoreboardAdminAnchor(id)
        : "/clubhouse-admin/scoreboard"
    );
  }

  if ((ctaLabel && !ctaHref) || (!ctaLabel && ctaHref) || (ctaHref && !isValidCallToActionHref(ctaHref))) {
    redirect(
      Number.isFinite(id)
        ? getScoreboardAdminAnchor(id)
        : "/clubhouse-admin/scoreboard"
    );
  }

  try {
    await updateCompetitionScoreboard(id, {
      slug,
      title,
      summary,
      statusLabel,
      location,
      formatLabel,
      roundLabel,
      ctaLabel,
      ctaHref,
      startsAt,
      endsAt,
      isLive,
      isPublished,
    });
  } catch (error) {
    console.error("Update competition scoreboard action error:", error);
  }

  revalidateScoreboardPaths(slug);
  redirect(getScoreboardAdminAnchor(id));
}

export async function createCompetitionScoreEntryAction(
  previousState: ScoreboardAdminActionState = initialScoreboardAdminActionState,
  formData: FormData
) {
  void previousState;

  try {
    await requireAdminAuthenticated();
  } catch {
    return {
      message: "Your admin session expired. Refresh and sign in again.",
    };
  }

  const competitionId = Number(formData.get("competition_id"));
  const competitionSlug = normalizeString(formData.get("competition_slug"), 120);
  const playerName = normalizeString(formData.get("player_name"), 120);
  const grossScore = parseNullableNumber(normalizeString(formData.get("score_value"), 20));
  const thruLabel = normalizeString(formData.get("thru_label"), 40);
  const isCgsMember = formData.get("is_cgs_member") === "on";

  if (!Number.isFinite(competitionId) || !competitionSlug || !playerName || grossScore === null) {
    return {
      message: "Competition, player name, and score are required.",
    };
  }

  try {
    await createCompetitionScoreEntry({
      competitionId,
      playerName,
      grossScore,
      thruLabel,
      isCgsMember,
    });
  } catch (error) {
    console.error("Create competition score entry action error:", error);
    return {
      message:
        "The score row could not be saved. Check that the latest scoreboard migration is live.",
    };
  }

  revalidateScoreboardPaths(competitionSlug);

  return {
    message: "Score row saved and pushed into the live board.",
  };
}

export async function updateCompetitionScoreEntryAction(formData: FormData) {
  await requireAdminAuthenticated();

  const id = Number(formData.get("id"));
  const competitionId = Number(formData.get("competition_id"));
  const competitionSlug = normalizeString(formData.get("competition_slug"), 120);
  const playerName = normalizeString(formData.get("player_name"), 120);
  const grossScore = parseNullableNumber(normalizeString(formData.get("score_value"), 20));
  const thruLabel = normalizeString(formData.get("thru_label"), 40);
  const isCgsMember = formData.get("is_cgs_member") === "on";

  if (
    !Number.isFinite(id) ||
    !Number.isFinite(competitionId) ||
    !competitionSlug ||
    !playerName ||
    grossScore === null
  ) {
    redirect(
      Number.isFinite(competitionId)
        ? getScoreboardAdminAnchor(competitionId)
        : "/clubhouse-admin/scoreboard"
    );
  }

  try {
    await updateCompetitionScoreEntry(id, {
      competitionId,
      playerName,
      grossScore,
      thruLabel,
      isCgsMember,
    });
  } catch (error) {
    console.error("Update competition score entry action error:", error);
  }

  revalidateScoreboardPaths(competitionSlug);
  redirect(getScoreboardAdminAnchor(competitionId));
}

export async function adjustCompetitionScoreEntryAction(formData: FormData) {
  await requireAdminAuthenticated();

  const id = Number(formData.get("id"));
  const competitionId = Number(formData.get("competition_id"));
  const competitionSlug = normalizeString(formData.get("competition_slug"), 120);
  const currentScore =
    parseNullableNumber(normalizeString(formData.get("current_score"), 20)) ?? 0;
  const scoreDelta = parseNullableNumber(
    normalizeString(formData.get("score_delta"), 20)
  );

  if (
    !Number.isFinite(id) ||
    !Number.isFinite(competitionId) ||
    !competitionSlug ||
    scoreDelta === null
  ) {
    redirect("/clubhouse-admin/scoreboard");
  }

  const grossScore = Number((currentScore + scoreDelta).toFixed(1));

  try {
    await updateCompetitionScoreEntryScore(id, competitionId, grossScore);
  } catch (error) {
    console.error("Adjust competition score entry action error:", error);
  }

  revalidateScoreboardPaths(competitionSlug);
  redirect(getScoreboardAdminAnchor(competitionId));
}

export async function deleteCompetitionScoreEntryAction(formData: FormData) {
  await requireAdminAuthenticated();

  const id = Number(formData.get("id"));
  const competitionId = Number(formData.get("competition_id"));
  const competitionSlug = normalizeString(formData.get("competition_slug"), 120);

  if (!Number.isFinite(id) || !Number.isFinite(competitionId) || !competitionSlug) {
    redirect("/clubhouse-admin/scoreboard");
  }

  try {
    await deleteCompetitionScoreEntry(id, competitionId);
  } catch (error) {
    console.error("Delete competition score entry action error:", error);
  }

  revalidateScoreboardPaths(competitionSlug);
  redirect(
    Number.isFinite(competitionId)
      ? getScoreboardAdminAnchor(competitionId)
      : "/clubhouse-admin/scoreboard"
  );
}
