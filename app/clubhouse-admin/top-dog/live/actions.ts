"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminAuthenticated } from "@/lib/admin-auth";
import { normalizeString } from "@/lib/form-utils";
import { initializeTopDogRoundProduction } from "@/lib/top-dog-production";
import {
  createCgsTeamForSeason,
  createTopDogFixture,
  createTopDogRound,
  createTopDogSeason,
  normalizeTopDogSlug,
} from "@/lib/top-dog";

const CONTROL_PATH = "/clubhouse-admin/top-dog/live";

function parseBrisbaneDateTime(value: string) {
  if (!value) {
    return null;
  }

  const hasOffset = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value);
  const parsed = new Date(hasOffset ? value : `${value}:00+10:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function finishAction(message: string, tone: "success" | "error" = "success") {
  revalidatePath(CONTROL_PATH);
  redirect(`${CONTROL_PATH}?${tone}=${encodeURIComponent(message)}`);
}

export async function createTopDogSeasonAction(formData: FormData) {
  await requireAdminAuthenticated();

  const name = normalizeString(formData.get("name"), 100);
  const seasonLabel = normalizeString(formData.get("season_label"), 60);
  const slug = normalizeTopDogSlug(
    normalizeString(formData.get("slug"), 80) || `${name}-${seasonLabel}`
  );
  const defaultHoles = Math.min(
    Math.max(Number(formData.get("default_holes")) || 9, 1),
    36
  );

  if (!name || !slug) {
    finishAction("Add a league name and season label first.", "error");
  }

  try {
    await createTopDogSeason({
      name,
      slug,
      seasonLabel,
      defaultHoles,
      isPublished: formData.get("is_published") === "on",
    });
  } catch (error) {
    console.error("Create Top Dog season action error:", error);
    finishAction("The season could not be created. Check that its name is unique.", "error");
  }

  finishAction("Top Dog season created.");
}

export async function createTopDogTeamAction(formData: FormData) {
  await requireAdminAuthenticated();

  const seasonId = Number(formData.get("season_id"));
  const name = normalizeString(formData.get("name"), 100);
  const shortName = normalizeString(formData.get("short_name"), 12);
  const accentColor = normalizeString(formData.get("accent_color"), 24) || "#20c8ff";

  if (!Number.isInteger(seasonId) || !name) {
    finishAction("Choose a season and add the team name.", "error");
  }

  try {
    await createCgsTeamForSeason({ seasonId, name, shortName, accentColor });
  } catch (error) {
    console.error("Create Top Dog team action error:", error);
    finishAction("That team could not be added to the season.", "error");
  }

  finishAction(`${name} is ready for fixtures.`);
}

export async function createTopDogRoundAction(formData: FormData) {
  await requireAdminAuthenticated();

  const seasonId = Number(formData.get("season_id"));
  const roundNumber = Number(formData.get("round_number"));
  const name = normalizeString(formData.get("name"), 100) || `Round ${roundNumber}`;
  const venue = normalizeString(formData.get("venue"), 100) || "The Tee Lounge";
  const courseName = normalizeString(formData.get("course_name"), 120);
  const scoreDirectionValue = normalizeString(formData.get("score_direction"), 20);
  const scoreDirection =
    scoreDirectionValue === "higher_wins" || scoreDirectionValue === "lower_wins"
      ? scoreDirectionValue
      : null;
  const differentialDivisor = Math.min(
    Math.max(Number(formData.get("differential_divisor")) || 1, 0.01),
    100
  );
  const scheduledAt = parseBrisbaneDateTime(
    normalizeString(formData.get("scheduled_at"), 40)
  );

  if (
    !Number.isInteger(seasonId) ||
    !Number.isInteger(roundNumber) ||
    roundNumber < 1 ||
    roundNumber > 99
  ) {
    finishAction("Add a valid round number.", "error");
  }

  try {
    const roundId = await createTopDogRound({
      seasonId,
      roundNumber,
      name,
      scheduledAt,
      venue,
      courseName,
      scoreDirection,
      differentialDivisor,
      isCurrent: formData.get("is_current") === "on",
    });
    await initializeTopDogRoundProduction(seasonId, roundId);
  } catch (error) {
    console.error("Create Top Dog round action error:", error);
    finishAction("That round could not be created. Its number may already exist.", "error");
  }

  finishAction(`${name} created.`);
}

export async function createTopDogFixtureAction(formData: FormData) {
  await requireAdminAuthenticated();

  const seasonId = Number(formData.get("season_id"));
  const roundId = Number(formData.get("round_id"));
  const homeTeamId = Number(formData.get("home_team_id"));
  const awayTeamId = Number(formData.get("away_team_id"));
  const holesTotal = Math.min(
    Math.max(Number(formData.get("holes_total")) || 9, 1),
    36
  );
  const scheduledAt = parseBrisbaneDateTime(
    normalizeString(formData.get("scheduled_at"), 40)
  );
  const simulatorBay = normalizeString(formData.get("simulator_bay"), 40);

  if (
    ![seasonId, roundId, homeTeamId, awayTeamId].every(Number.isInteger) ||
    homeTeamId === awayTeamId
  ) {
    finishAction("Choose two different teams for the fixture.", "error");
  }

  try {
    await createTopDogFixture({
      seasonId,
      roundId,
      homeTeamId,
      awayTeamId,
      scheduledAt,
      simulatorBay,
      holesTotal,
    });
  } catch (error) {
    console.error("Create Top Dog fixture action error:", error);
    finishAction("That fixture could not be added. Check the teams and round.", "error");
  }

  finishAction("Fixture added to League Night Control.");
}
