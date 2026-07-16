import { ensureCgsProfileForAuthUser, upsertAmbroseEntry } from "@/lib/ambrose-events";
import { getAuthenticatedPlayerFromRequest } from "@/lib/player-auth";

export const dynamic = "force-dynamic";

function parseRequiredInteger(value: unknown) {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) ? parsedValue : null;
}

function parseNullableInteger(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return parseRequiredInteger(value);
}

function parseNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function parseNullableBoolean(value: unknown) {
  if (value === true || value === "yes") {
    return true;
  }

  if (value === false || value === "no") {
    return false;
  }

  return null;
}

function normalizeString(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  const { user, isAdmin, error } = await getAuthenticatedPlayerFromRequest(request);

  if (!user) {
    return Response.json({ message: error }, { status: 401 });
  }

  try {
    const profile = isAdmin ? null : await ensureCgsProfileForAuthUser(user);
    const body = (await request.json()) as Record<string, unknown>;
    const eventId = parseRequiredInteger(body.eventId);
    const teamId = parseRequiredInteger(body.teamId);
    const holeId = parseRequiredInteger(body.holeId);
    const grossStrokes = parseRequiredInteger(body.grossStrokes);
    const putts = parseNullableInteger(body.putts);
    const driveDistanceMeters = parseNullableNumber(body.driveDistanceMeters);
    const ironDistanceMeters = parseNullableNumber(body.ironDistanceMeters);

    if (!eventId || !teamId || !holeId || !grossStrokes) {
      return Response.json(
        { message: "Event, team, hole, and strokes are required." },
        { status: 400 }
      );
    }

    if (grossStrokes < 1 || grossStrokes > 20) {
      return Response.json(
        { message: "Strokes must be between 1 and 20." },
        { status: 400 }
      );
    }

    if (putts !== null && (putts < 0 || putts > 10)) {
      return Response.json(
        { message: "Putts must be between 0 and 10, or left blank." },
        { status: 400 }
      );
    }

    if (
      driveDistanceMeters !== null &&
      (driveDistanceMeters < 0 || driveDistanceMeters > 500)
    ) {
      return Response.json(
        { message: "Drive distance must be between 0 and 500 metres." },
        { status: 400 }
      );
    }

    if (
      ironDistanceMeters !== null &&
      (ironDistanceMeters < 0 || ironDistanceMeters > 300)
    ) {
      return Response.json(
        { message: "Iron distance must be between 0 and 300 metres." },
        { status: 400 }
      );
    }

    await upsertAmbroseEntry({
      eventId,
      teamId,
      holeId,
      grossStrokes,
      putts,
      fairwayHit: parseNullableBoolean(body.fairwayHit),
      greenInRegulation: parseNullableBoolean(body.greenInRegulation),
      penalties: 0,
      drivePlayerId: normalizeString(body.drivePlayerId, 80),
      driveDistanceMeters,
      approachPlayerId: normalizeString(body.approachPlayerId, 80),
      ironClub: normalizeString(body.ironClub, 40),
      ironDistanceMeters,
      puttPlayerId: "",
      notes: "",
      actorProfileId: profile?.id ?? null,
      updatedByAdmin: isAdmin,
    });

    return Response.json({ message: "Team score saved." });
  } catch (requestError) {
    console.error("Player Ambrose entry API error:", requestError);
    return Response.json(
      {
        message:
          requestError instanceof Error
            ? requestError.message
            : "The Ambrose score could not be saved.",
      },
      { status: 500 }
    );
  }
}
