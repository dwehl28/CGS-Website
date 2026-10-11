import { z } from "zod";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  getAdminTopDogSnapshot,
  updateTopDogStreamState,
} from "@/lib/top-dog";

const overlayNames = [
  "none",
  "match",
  "match_of_night",
  "live_ladder",
  "results_hold",
  "best_team",
  "longest_drive",
  "ctp",
  "bunker_boy",
  "one_putt_jackpot",
  "sponsor",
  "subscribe",
  "player_interview",
  "up_next",
  "match_result",
  "shot_of_night",
  "doghouse",
  "butters_board",
  "night_wrap_up",
  "stat_of_week",
] as const;

const tickerCategories = [
  "scores",
  "ladder",
  "longest_drive",
  "ctp",
  "bunker_boy",
  "one_putt_jackpot",
  "next_match",
  "sponsor",
] as const;

const streamStateSchema = z
  .object({
    seasonId: z.number().int().positive(),
    seasonSlug: z.string().trim().min(1).max(80),
    selectedRoundId: z.number().int().positive().nullable().optional(),
    updates: z
      .object({
        roundId: z.number().int().positive().nullable().optional(),
        featuredFixtureId: z.number().int().positive().nullable().optional(),
        scorebugFixtureId: z.number().int().positive().nullable().optional(),
        scorebugVisible: z.boolean().optional(),
        tickerVisible: z.boolean().optional(),
        tickerPaused: z.boolean().optional(),
        tickerIntervalSeconds: z.number().int().min(4).max(120).optional(),
        tickerCategories: z.array(z.enum(tickerCategories)).min(1).optional(),
        tickerManualMessage: z.string().max(240).optional(),
        centralOverlay: z.enum(overlayNames).optional(),
        centralOverlayVisible: z.boolean().optional(),
        overlayPayload: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
  })
  .strict();

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).host === new URL(request.url).host;
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request) || !(await isAdminAuthenticated())) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  let parsedBody: z.infer<typeof streamStateSchema>;

  try {
    parsedBody = streamStateSchema.parse(await request.json());
  } catch (error) {
    return Response.json(
      { message: "The stream update was not valid.", detail: String(error) },
      { status: 400 }
    );
  }

  try {
    await updateTopDogStreamState(parsedBody.seasonId, parsedBody.updates);
    const feed = await getAdminTopDogSnapshot({
      seasonSlug: parsedBody.seasonSlug,
      roundId: parsedBody.selectedRoundId,
    });

    return Response.json(feed, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Top Dog stream state route error:", error);
    return Response.json(
      { message: "The stream control could not be saved." },
      { status: 500 }
    );
  }
}
