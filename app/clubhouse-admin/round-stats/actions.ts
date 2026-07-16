"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAuthenticated } from "@/lib/admin-auth";
import { normalizeString } from "@/lib/form-utils";
import { updateRoundStatEntry } from "@/lib/round-stats";

export type RoundStatsAdminActionState = {
  message: string;
};

const initialRoundStatsAdminActionState: RoundStatsAdminActionState = {
  message: "",
};

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

function revalidateRoundStatsPaths(slug: string) {
  revalidatePath("/stats");
  revalidatePath(`/stats/${slug}`);
  revalidatePath("/clubhouse-admin/round-stats");
}

export async function updateRoundStatEntryAction(
  previousState: RoundStatsAdminActionState = initialRoundStatsAdminActionState,
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

  const roundId = Number(formData.get("round_id"));
  const roundSlug = normalizeString(formData.get("round_slug"), 120);
  const teamId = Number(formData.get("team_id"));
  const holeId = Number(formData.get("hole_id"));
  const scoreToPar = parseNullableNumber(
    normalizeString(formData.get("score_to_par"), 20)
  );
  const putts = parseNullableNumber(normalizeString(formData.get("putts"), 20));
  const penalties =
    parseNullableNumber(normalizeString(formData.get("penalties"), 20)) ?? 0;
  const fairwayHit = parseNullableBoolean(formData.get("fairway_hit"));
  const greenInRegulation = parseNullableBoolean(
    formData.get("green_in_regulation")
  );
  const drivePlayer = normalizeString(formData.get("drive_player"), 80);
  const approachPlayer = normalizeString(formData.get("approach_player"), 80);
  const puttPlayer = normalizeString(formData.get("putt_player"), 80);
  const notes = normalizeString(formData.get("notes"), 240);

  if (
    !Number.isFinite(roundId) ||
    !roundSlug ||
    !Number.isFinite(teamId) ||
    !Number.isFinite(holeId) ||
    scoreToPar === null
  ) {
    return {
      message: "Round, team, hole, and score to par are required.",
    };
  }

  if (putts !== null && (!Number.isInteger(putts) || putts < 0)) {
    return {
      message: "Putts must be a whole number, or left blank.",
    };
  }

  if (!Number.isInteger(penalties) || penalties < 0) {
    return {
      message: "Penalties must be a whole number, or left blank.",
    };
  }

  try {
    await updateRoundStatEntry({
      roundId,
      teamId,
      holeId,
      scoreToPar,
      putts,
      fairwayHit,
      greenInRegulation,
      penalties,
      drivePlayer,
      approachPlayer,
      puttPlayer,
      notes,
    });
  } catch (error) {
    console.error("Update round stat entry action error:", error);
    return {
      message:
        "The stat entry could not be saved. Check that the round stat migration is live.",
    };
  }

  revalidateRoundStatsPaths(roundSlug);

  return {
    message: "Stat entry saved and pushed to the round displays.",
  };
}
