import {
  ensureCgsProfileForAuthUser,
  getAdminPlayerAmbroseDashboard,
  getPlayerAmbroseDashboard,
  updateOwnCgsProfile,
} from "@/lib/ambrose-events";
import { getAuthenticatedPlayerFromRequest } from "@/lib/player-auth";

export const dynamic = "force-dynamic";

function parseNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function normalizeString(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET(request: Request) {
  const { user, isAdmin, error } = await getAuthenticatedPlayerFromRequest(request);

  if (!user) {
    return Response.json({ message: error }, { status: 401 });
  }

  try {
    if (isAdmin) {
      const dashboard = await getAdminPlayerAmbroseDashboard();
      return Response.json(dashboard);
    }

    const profile = await ensureCgsProfileForAuthUser(user);
    const dashboard = await getPlayerAmbroseDashboard(profile.id);

    return Response.json(dashboard);
  } catch (requestError) {
    console.error("Player dashboard API error:", requestError);
    return Response.json(
      { message: "The CGS player dashboard could not be loaded." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const { user, isAdmin, error } = await getAuthenticatedPlayerFromRequest(request);

  if (!user) {
    return Response.json({ message: error }, { status: 401 });
  }

  if (isAdmin) {
    return Response.json(
      { message: "Admin app profile details are managed in clubhouse admin." },
      { status: 403 }
    );
  }

  try {
    const profile = await ensureCgsProfileForAuthUser(user);
    const body = (await request.json()) as Record<string, unknown>;
    const handicap = parseNullableNumber(body.handicap);
    const avatarUrl = normalizeString(body.avatarUrl, 500);

    if (handicap !== null && (handicap < -10 || handicap > 54)) {
      return Response.json(
        { message: "Handicap must be between -10 and 54." },
        { status: 400 }
      );
    }

    if (
      avatarUrl &&
      !avatarUrl.startsWith("/") &&
      !/^https:\/\/.+/i.test(avatarUrl)
    ) {
      return Response.json(
        { message: "Photo URL must start with https:// or /." },
        { status: 400 }
      );
    }

    const updatedProfile = await updateOwnCgsProfile(profile.id, {
      handle: normalizeString(body.handle, 64),
      displayName: normalizeString(body.displayName, 120),
      nickname: normalizeString(body.nickname, 80),
      avatarUrl,
      handicap,
      isPublic: Boolean(body.isPublic),
      broadcastStats: {
        averageDrive: normalizeString(body.averageDrive, 80),
        goToIron: normalizeString(body.goToIron, 80),
        bestResult: normalizeString(body.bestResult, 120),
        biggestWeakness: normalizeString(body.biggestWeakness, 140),
      },
    });

    return Response.json({ profile: updatedProfile });
  } catch (requestError) {
    console.error("Player profile update API error:", requestError);
    return Response.json(
      {
        message:
          "The profile could not be saved. Check the handle is unique and try again.",
      },
      { status: 500 }
    );
  }
}
