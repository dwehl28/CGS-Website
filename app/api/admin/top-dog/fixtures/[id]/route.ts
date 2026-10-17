import { z } from "zod";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  applyTopDogFixtureCommand,
  deleteTopDogFixture,
  getAdminTopDogSnapshot,
  updateTopDogFixture,
} from "@/lib/top-dog";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const fixtureCommandSchema = z
  .object({
    command: z.enum([
      "start",
      "set_score",
      "adjust_score",
      "next_hole",
      "previous_hole",
      "finish",
      "reopen",
      "match_of_night",
      "undo",
    ]),
    payload: z
      .object({
        home_score: z.number().int().min(-99).max(99).optional(),
        away_score: z.number().int().min(-99).max(99).optional(),
        home_score_confirmed: z.boolean().optional(),
        away_score_confirmed: z.boolean().optional(),
        home_delta: z.number().int().min(-10).max(10).optional(),
        away_delta: z.number().int().min(-10).max(10).optional(),
      })
      .strict()
      .optional(),
    seasonSlug: z.string().trim().min(1).max(80),
    roundId: z.number().int().positive().nullable().optional(),
  })
  .strict();

const fixtureEditSchema = z
  .object({
    seasonId: z.number().int().positive(),
    seasonSlug: z.string().trim().min(1).max(80),
    selectedRoundId: z.number().int().positive().nullable().optional(),
    roundId: z.number().int().positive(),
    homeTeamId: z.number().int().positive(),
    awayTeamId: z.number().int().positive(),
    scheduledAt: z.string().datetime({ offset: true }).nullable(),
    simulatorBay: z.string().trim().max(40),
    holesTotal: z.number().int().min(1).max(36),
    displayOrder: z.number().int().min(1).max(999),
  })
  .strict()
  .refine((value) => value.homeTeamId !== value.awayTeamId, {
    message: "Choose two different teams.",
  });

const fixtureDeleteSchema = z
  .object({
    seasonId: z.number().int().positive(),
    seasonSlug: z.string().trim().min(1).max(80),
    selectedRoundId: z.number().int().positive().nullable().optional(),
  })
  .strict();

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).host === new URL(request.url).host;
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isSameOrigin(request) || !(await isAdminAuthenticated())) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const fixtureId = Number(id);

  if (!Number.isInteger(fixtureId) || fixtureId <= 0) {
    return Response.json({ message: "Invalid fixture." }, { status: 400 });
  }

  let parsedBody: z.infer<typeof fixtureCommandSchema>;

  try {
    parsedBody = fixtureCommandSchema.parse(await request.json());
  } catch (error) {
    return Response.json(
      { message: "The fixture update was not valid.", detail: String(error) },
      { status: 400 }
    );
  }

  try {
    await applyTopDogFixtureCommand({
      fixtureId,
      command: parsedBody.command,
      payload: parsedBody.payload,
    });
    const feed = await getAdminTopDogSnapshot({
      seasonSlug: parsedBody.seasonSlug,
      roundId: parsedBody.roundId,
    });

    return Response.json(feed, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Top Dog fixture command route error:", error);
    return Response.json(
      { message: "The fixture update could not be saved." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  if (!isSameOrigin(request) || !(await isAdminAuthenticated())) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const fixtureId = Number(id);

  if (!Number.isInteger(fixtureId) || fixtureId <= 0) {
    return Response.json({ message: "Invalid fixture." }, { status: 400 });
  }

  let parsedBody: z.infer<typeof fixtureEditSchema>;

  try {
    parsedBody = fixtureEditSchema.parse(await request.json());
  } catch (error) {
    return Response.json(
      { message: "The fixture details were not valid.", detail: String(error) },
      { status: 400 }
    );
  }

  try {
    await updateTopDogFixture({ fixtureId, ...parsedBody });
    const feed = await getAdminTopDogSnapshot({
      seasonSlug: parsedBody.seasonSlug,
      roundId: parsedBody.selectedRoundId,
    });

    return Response.json(feed, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Top Dog fixture edit route error:", error);
    return Response.json(
      { message: "The fixture details could not be saved." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!isSameOrigin(request) || !(await isAdminAuthenticated())) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const fixtureId = Number(id);

  if (!Number.isInteger(fixtureId) || fixtureId <= 0) {
    return Response.json({ message: "Invalid fixture." }, { status: 400 });
  }

  let parsedBody: z.infer<typeof fixtureDeleteSchema>;

  try {
    parsedBody = fixtureDeleteSchema.parse(await request.json());
  } catch (error) {
    return Response.json(
      { message: "The fixture removal request was not valid.", detail: String(error) },
      { status: 400 }
    );
  }

  try {
    await deleteTopDogFixture({ fixtureId, seasonId: parsedBody.seasonId });
    const feed = await getAdminTopDogSnapshot({
      seasonSlug: parsedBody.seasonSlug,
      roundId: parsedBody.selectedRoundId,
    });

    return Response.json(feed, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Top Dog fixture delete route error:", error);
    return Response.json(
      { message: "The fixture could not be removed." },
      { status: 500 }
    );
  }
}
