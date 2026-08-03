"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminAuthenticated } from "@/lib/admin-auth";
import {
  createDoubleEliminationBracket,
  normalizeParticipantNames,
  recordDoubleEliminationWinner,
  resetDoubleEliminationMatch,
  updateDoubleEliminationBracketSettings,
} from "@/lib/double-elimination";
import { normalizeString } from "@/lib/form-utils";

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseSettings(formData: FormData) {
  const title = normalizeString(formData.get("title"), 140);
  const requestedSlug = normalizeString(formData.get("slug"), 120);

  return {
    title,
    slug: normalizeSlug(requestedSlug || title),
    subtitle:
      normalizeString(formData.get("subtitle"), 160) ||
      "Par 3 Double Elimination",
    statusLabel:
      normalizeString(formData.get("status_label"), 80) || "Bracket setup",
    isLive: formData.get("is_live") === "on",
    isPublished: formData.get("is_published") === "on",
  };
}

function revalidateBracketPaths(slug: string) {
  revalidatePath("/clubhouse-admin/brackets");
  revalidatePath(`/api/brackets/${slug}`);
  revalidatePath(`/stream/brackets/${slug}`);
}

function getBracketAnchor(id: number) {
  return `/clubhouse-admin/brackets#bracket-${id}`;
}

function getBracketNoticeUrl(id: number, notice: string) {
  return `/clubhouse-admin/brackets?notice=${notice}#bracket-${id}`;
}

export async function createDoubleEliminationBracketAction(
  formData: FormData
) {
  await requireAdminAuthenticated();

  const settings = parseSettings(formData);
  const participantNames = normalizeParticipantNames(
    normalizeString(formData.get("participant_names"), 1600).split(/\r?\n/)
  );

  if (
    !settings.title ||
    !settings.slug ||
    participantNames.length < 2 ||
    participantNames.length > 16
  ) {
    redirect("/clubhouse-admin/brackets?notice=check-names");
  }

  let bracketId: number;

  try {
    bracketId = await createDoubleEliminationBracket({
      ...settings,
      participantNames,
    });
  } catch (error) {
    console.error("Create double-elimination bracket action error:", error);
    redirect("/clubhouse-admin/brackets?notice=create-failed");
  }

  revalidateBracketPaths(settings.slug);
  redirect(getBracketAnchor(bracketId));
}

export async function updateDoubleEliminationBracketAction(
  formData: FormData
) {
  await requireAdminAuthenticated();

  const id = Number(formData.get("id"));
  const originalSlug = normalizeSlug(
    normalizeString(formData.get("original_slug"), 120)
  );
  const settings = parseSettings(formData);

  if (!Number.isFinite(id) || !settings.title || !settings.slug) {
    redirect("/clubhouse-admin/brackets?notice=update-failed");
  }

  try {
    await updateDoubleEliminationBracketSettings(id, settings);
  } catch (error) {
    console.error("Update double-elimination bracket action error:", error);
    redirect(getBracketNoticeUrl(id, "update-failed"));
  }

  revalidateBracketPaths(originalSlug);
  revalidateBracketPaths(settings.slug);
  redirect(getBracketAnchor(id));
}

export async function recordDoubleEliminationWinnerAction(formData: FormData) {
  await requireAdminAuthenticated();

  const bracketId = Number(formData.get("bracket_id"));
  const matchId = Number(formData.get("match_id"));
  const winnerSide = Number(formData.get("winner_side"));
  const slug = normalizeSlug(normalizeString(formData.get("slug"), 120));

  if (
    !Number.isFinite(bracketId) ||
    !Number.isFinite(matchId) ||
    (winnerSide !== 1 && winnerSide !== 2)
  ) {
    redirect("/clubhouse-admin/brackets?notice=result-failed");
  }

  try {
    await recordDoubleEliminationWinner(
      bracketId,
      matchId,
      winnerSide as 1 | 2
    );
  } catch (error) {
    console.error("Record double-elimination winner action error:", error);
    redirect(getBracketNoticeUrl(bracketId, "result-failed"));
  }

  revalidateBracketPaths(slug);
  redirect(getBracketAnchor(bracketId));
}

export async function resetDoubleEliminationMatchAction(formData: FormData) {
  await requireAdminAuthenticated();

  const bracketId = Number(formData.get("bracket_id"));
  const matchId = Number(formData.get("match_id"));
  const slug = normalizeSlug(normalizeString(formData.get("slug"), 120));

  if (!Number.isFinite(bracketId) || !Number.isFinite(matchId)) {
    redirect("/clubhouse-admin/brackets?notice=reset-failed");
  }

  try {
    await resetDoubleEliminationMatch(bracketId, matchId);
  } catch (error) {
    console.error("Reset double-elimination match action error:", error);
    redirect(getBracketNoticeUrl(bracketId, "reset-failed"));
  }

  revalidateBracketPaths(slug);
  redirect(getBracketAnchor(bracketId));
}
