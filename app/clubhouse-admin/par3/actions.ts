"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminAuthenticated } from "@/lib/admin-auth";
import { normalizeString } from "@/lib/form-utils";
import {
  createPar3Player,
  generatePar3Knockout,
  generatePar3PoolFixtures,
  recordPar3KnockoutWinner,
  resetPar3KnockoutMatch,
  updatePar3EventSettings,
  updatePar3Player,
  updatePar3PoolMatch,
  type Par3PlayerInput,
} from "@/lib/par3-showdown";
import type {
  Par3Phase,
  Par3TeeCategory,
} from "@/lib/par3-showdown-types";

const phases: Par3Phase[] = [
  "registrations",
  "pools",
  "knockout",
  "complete",
];
const teeCategories: Par3TeeCategory[] = [
  "championship",
  "ladies",
  "junior",
];

function parseNumber(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const normalized = normalizeString(value, 10);
  return normalized ? parseNumber(normalized) : null;
}

function parsePlayerInput(formData: FormData): Par3PlayerInput {
  const teeCategory = normalizeString(formData.get("tee_category"), 30);

  return {
    eventId: parseNumber(formData.get("event_id")) ?? 0,
    name: normalizeString(formData.get("name"), 100),
    phone: normalizeString(formData.get("phone"), 40),
    teeCategory: teeCategories.includes(teeCategory as Par3TeeCategory)
      ? (teeCategory as Par3TeeCategory)
      : "championship",
    poolNumber: parseOptionalNumber(formData.get("pool_number")),
    poolRankOverride: parseOptionalNumber(formData.get("pool_rank_override")),
    displayOrder: parseNumber(formData.get("display_order")) ?? 99,
    consent: formData.get("consent") === "on",
    isWithdrawn: formData.get("is_withdrawn") === "on",
  };
}

function revalidatePar3() {
  revalidatePath("/");
  revalidatePath("/clubhouse-admin");
  revalidatePath("/clubhouse-admin/par3");
  revalidatePath("/api/par3-showdown");
}

function noticeUrl(notice: string, anchor = "") {
  return `/clubhouse-admin/par3?notice=${notice}${anchor ? `#${anchor}` : ""}`;
}

export async function updatePar3EventAction(formData: FormData) {
  await requireAdminAuthenticated();

  const eventId = parseNumber(formData.get("event_id"));
  const phaseValue = normalizeString(formData.get("current_phase"), 30);
  const currentPhase = phases.includes(phaseValue as Par3Phase)
    ? (phaseValue as Par3Phase)
    : "registrations";

  if (!eventId) {
    redirect(noticeUrl("settings-failed"));
  }

  try {
    await updatePar3EventSettings(eventId, {
      statusLabel:
        normalizeString(formData.get("status_label"), 80) ||
        "Registrations open",
      publicMessage: normalizeString(formData.get("public_message"), 300),
      currentPhase,
      youtubeUrl: normalizeString(formData.get("youtube_url"), 400),
      isLive: formData.get("is_live") === "on",
      registrationsOpen: formData.get("registrations_open") === "on",
    });
  } catch (error) {
    console.error("Update Par 3 event error:", error);
    redirect(noticeUrl("settings-failed"));
  }

  revalidatePar3();
  redirect(noticeUrl("settings-saved"));
}

export async function createPar3PlayerAction(formData: FormData) {
  await requireAdminAuthenticated();
  const input = parsePlayerInput(formData);

  if (!input.eventId || !input.name || !input.phone || !input.consent) {
    redirect(noticeUrl("player-check", "entrants"));
  }

  try {
    await createPar3Player(input);
  } catch (error) {
    console.error("Create Par 3 player error:", error);
    redirect(noticeUrl("player-failed", "entrants"));
  }

  revalidatePar3();
  redirect(noticeUrl("player-added", "entrants"));
}

export async function updatePar3PlayerAction(formData: FormData) {
  await requireAdminAuthenticated();
  const playerId = parseNumber(formData.get("player_id"));
  const input = parsePlayerInput(formData);

  if (!playerId || !input.eventId || !input.name) {
    redirect(noticeUrl("player-failed", "entrants"));
  }

  try {
    await updatePar3Player(playerId, input);
  } catch (error) {
    console.error("Update Par 3 player error:", error);
    redirect(noticeUrl("player-failed", "entrants"));
  }

  revalidatePar3();
  redirect(noticeUrl("player-saved", `player-${playerId}`));
}

export async function generatePar3PoolFixturesAction(formData: FormData) {
  await requireAdminAuthenticated();
  const eventId = parseNumber(formData.get("event_id"));

  if (!eventId) {
    redirect(noticeUrl("fixtures-failed", "pool-play"));
  }

  try {
    await generatePar3PoolFixtures(eventId);
  } catch (error) {
    console.error("Generate Par 3 fixtures error:", error);
    redirect(noticeUrl("fixtures-failed", "pool-play"));
  }

  revalidatePar3();
  redirect(noticeUrl("fixtures-created", "pool-play"));
}

export async function updatePar3PoolMatchAction(formData: FormData) {
  await requireAdminAuthenticated();
  const matchId = parseNumber(formData.get("match_id"));
  const winnerId = parseOptionalNumber(formData.get("winner_id"));
  const bayNumber = parseOptionalNumber(formData.get("bay_number"));

  if (!matchId) {
    redirect(noticeUrl("result-failed", "pool-play"));
  }

  try {
    await updatePar3PoolMatch(matchId, winnerId, bayNumber);
  } catch (error) {
    console.error("Update Par 3 pool match error:", error);
    redirect(noticeUrl("result-failed", "pool-play"));
  }

  revalidatePar3();
  redirect(noticeUrl("result-saved", `match-${matchId}`));
}

export async function generatePar3KnockoutAction(formData: FormData) {
  await requireAdminAuthenticated();
  const eventId = parseNumber(formData.get("event_id"));

  if (!eventId) {
    redirect(noticeUrl("knockout-failed", "finals"));
  }

  try {
    await generatePar3Knockout(eventId);
  } catch (error) {
    console.error("Generate Par 3 knockout error:", error);
    redirect(noticeUrl("knockout-failed", "finals"));
  }

  revalidatePar3();
  redirect(noticeUrl("knockout-created", "finals"));
}

export async function recordPar3KnockoutWinnerAction(formData: FormData) {
  await requireAdminAuthenticated();
  const eventId = parseNumber(formData.get("event_id"));
  const matchId = parseNumber(formData.get("match_id"));
  const winnerSide = parseNumber(formData.get("winner_side"));

  if (!eventId || !matchId || (winnerSide !== 1 && winnerSide !== 2)) {
    redirect(noticeUrl("final-result-failed", "finals"));
  }

  try {
    await recordPar3KnockoutWinner(eventId, matchId, winnerSide as 1 | 2);
  } catch (error) {
    console.error("Record Par 3 finals winner error:", error);
    redirect(noticeUrl("final-result-failed", "finals"));
  }

  revalidatePar3();
  redirect(noticeUrl("final-result-saved", "finals"));
}

export async function resetPar3KnockoutMatchAction(formData: FormData) {
  await requireAdminAuthenticated();
  const eventId = parseNumber(formData.get("event_id"));
  const matchId = parseNumber(formData.get("match_id"));

  if (!eventId || !matchId) {
    redirect(noticeUrl("final-reset-failed", "finals"));
  }

  try {
    await resetPar3KnockoutMatch(eventId, matchId);
  } catch (error) {
    console.error("Reset Par 3 finals match error:", error);
    redirect(noticeUrl("final-reset-failed", "finals"));
  }

  revalidatePar3();
  redirect(noticeUrl("final-reset", "finals"));
}
