import {
  createPlayerAmbroseTeam,
  ensureCgsProfileForAuthUser,
  joinPlayerAmbroseTeam,
} from "@/lib/ambrose-events";
import { getAuthenticatedPlayerFromRequest } from "@/lib/player-auth";

export const dynamic = "force-dynamic";

function parseRequiredInteger(value: unknown) {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) ? parsedValue : null;
}

function normalizeString(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  const { user, isAdmin, error } = await getAuthenticatedPlayerFromRequest(request);

  if (!user) {
    return Response.json({ message: error }, { status: 401 });
  }

  if (isAdmin) {
    return Response.json(
      { message: "Admin team setup is managed in clubhouse admin." },
      { status: 403 }
    );
  }

  try {
    const profile = await ensureCgsProfileForAuthUser(user);
    const body = (await request.json()) as Record<string, unknown>;
    const action = normalizeString(body.action, 20);
    const eventId = parseRequiredInteger(body.eventId);
    const joinCode = normalizeString(body.joinCode, 80);

    if (!eventId) {
      return Response.json(
        { message: "Competition is required." },
        { status: 400 }
      );
    }

    if (action === "create") {
      await createPlayerAmbroseTeam({
        eventId,
        profileId: profile.id,
        name: normalizeString(body.name, 80),
        joinCode,
      });

      return Response.json({ message: "Team created." });
    }

    if (action === "join") {
      const teamId = parseRequiredInteger(body.teamId);

      if (!teamId) {
        return Response.json({ message: "Team is required." }, { status: 400 });
      }

      await joinPlayerAmbroseTeam({
        eventId,
        teamId,
        profileId: profile.id,
        joinCode,
      });

      return Response.json({ message: "Team joined." });
    }

    return Response.json({ message: "Unknown team action." }, { status: 400 });
  } catch (requestError) {
    console.error("Player Ambrose team API error:", requestError);
    return Response.json(
      {
        message:
          requestError instanceof Error
            ? requestError.message
            : "The team could not be updated.",
      },
      { status: 500 }
    );
  }
}
