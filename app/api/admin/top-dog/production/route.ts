import { z } from "zod";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  assignTopDogTeamMember,
  generateTopDogNightRecap,
  getAdminTopDogProductionFeed,
  markTopDogContentClip,
  runTopDogJackpotCommand,
  saveTopDogInterview,
  saveTopDogPrize,
  saveTopDogSegment,
  saveTopDogSponsor,
  saveTopDogSponsorActivation,
  setTopDogInterviewStatus,
  showTopDogNightRecap,
  showTopDogPrize,
  showTopDogSegment,
  showTopDogSponsor,
  toggleTopDogChecklistItem,
  toggleTopDogSponsorFulfilment,
  TOP_DOG_CLIP_TAGS,
  TOP_DOG_INTERVIEW_TYPES,
  TOP_DOG_PRIZE_CATEGORIES,
  TOP_DOG_SEGMENT_TYPES,
} from "@/lib/top-dog-production";
import { getAdminTopDogSnapshot } from "@/lib/top-dog";

export const dynamic = "force-dynamic";

const requestContextSchema = {
  seasonId: z.number().int().positive(),
  seasonSlug: z.string().trim().min(1).max(80),
  roundId: z.number().int().positive(),
} as const;

const nullableId = z.number().int().positive().nullable();
const optionalNullableId = z.number().int().positive().nullable().optional();
const optionalProfileId = z.string().uuid().nullable().optional();

const mutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("assign_team_member"),
    ...requestContextSchema,
    profileId: z.string().uuid(),
    teamId: z.number().int().positive(),
    roleLabel: z.string().trim().max(80),
  }).strict(),
  z.object({
    action: z.literal("save_sponsor"),
    ...requestContextSchema,
    sponsorId: z.number().int().positive().optional(),
    name: z.string().trim().min(1).max(120),
    logoUrl: z.string().trim().max(500),
    websiteUrl: z.string().trim().max(500),
    promoCode: z.string().trim().max(100),
    prizeSupplied: z.string().trim().max(240),
    campaign: z.string().trim().max(240),
    notes: z.string().trim().max(1000),
  }).strict(),
  z.object({
    action: z.literal("save_prize"),
    ...requestContextSchema,
    prizeId: z.number().int().positive().optional(),
    category: z.enum(TOP_DOG_PRIZE_CATEGORIES),
    customCategory: z.string().trim().max(100),
    profileId: z.string().uuid().nullable(),
    teamId: nullableId,
    displayName: z.string().trim().max(120),
    resultValue: z.string().trim().max(120),
    prize: z.string().trim().max(240),
    sponsorId: nullableId,
    notes: z.string().trim().max(1000),
    winnerStatus: z.enum(["tracking", "leader", "winner"]),
  }).strict(),
  z.object({
    action: z.literal("show_prize"),
    ...requestContextSchema,
    prizeId: z.number().int().positive(),
  }).strict(),
  z.object({
    action: z.literal("save_activation"),
    ...requestContextSchema,
    sponsorId: z.number().int().positive(),
    campaign: z.string().trim().max(240),
    prizeSupplied: z.string().trim().max(240),
    notes: z.string().trim().max(1000),
  }).strict(),
  z.object({
    action: z.literal("toggle_activation"),
    ...requestContextSchema,
    activationId: z.number().int().positive(),
    field: z.enum([
      "logo_displayed",
      "verbal_mention",
      "product_shown",
      "promo_code_shown",
      "winner_photographed",
      "sponsor_tagged",
      "social_post_completed",
    ]),
    value: z.boolean(),
  }).strict(),
  z.object({
    action: z.literal("show_sponsor"),
    ...requestContextSchema,
    sponsorId: z.number().int().positive(),
  }).strict(),
  z.object({
    action: z.literal("jackpot"),
    ...requestContextSchema,
    command: z.enum([
      "random",
      "select",
      "reveal",
      "start",
      "success",
      "miss",
      "rollover",
      "reset",
      "set_amount",
    ]),
    profileId: optionalProfileId,
    teamId: optionalNullableId,
    playerName: z.string().trim().max(120).optional(),
    amount: z.number().min(0).max(100000).optional(),
  }).strict(),
  z.object({
    action: z.literal("save_interview"),
    ...requestContextSchema,
    fixtureId: nullableId,
    profileId: z.string().uuid().nullable(),
    teamId: nullableId,
    playerName: z.string().trim().min(1).max(120),
    teamLabel: z.string().trim().max(120),
    interviewType: z.enum(TOP_DOG_INTERVIEW_TYPES),
    notes: z.string().trim().max(1000),
  }).strict(),
  z.object({
    action: z.literal("interview_status"),
    ...requestContextSchema,
    interviewId: z.number().int().positive(),
    status: z.enum(["queued", "live", "complete"]),
  }).strict(),
  z.object({
    action: z.literal("mark_clip"),
    ...requestContextSchema,
    fixtureId: nullableId,
    profileId: z.string().uuid().nullable(),
    teamId: nullableId,
    playerName: z.string().trim().max(120),
    tag: z.enum(TOP_DOG_CLIP_TAGS),
    note: z.string().trim().max(1000),
  }).strict(),
  z.object({
    action: z.literal("save_segment"),
    ...requestContextSchema,
    segmentType: z.enum(TOP_DOG_SEGMENT_TYPES),
    title: z.string().trim().max(120),
    primaryText: z.string().trim().max(240),
    secondaryText: z.string().trim().max(500),
    status: z.enum(["draft", "confirmed"]),
  }).strict(),
  z.object({
    action: z.literal("show_segment"),
    ...requestContextSchema,
    segmentType: z.enum(TOP_DOG_SEGMENT_TYPES),
  }).strict(),
  z.object({
    action: z.literal("toggle_checklist"),
    ...requestContextSchema,
    itemId: z.number().int().positive(),
    isComplete: z.boolean(),
  }).strict(),
  z.object({
    action: z.literal("generate_recap"),
    ...requestContextSchema,
  }).strict(),
  z.object({
    action: z.literal("show_recap"),
    ...requestContextSchema,
  }).strict(),
]);

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).host === new URL(request.url).host;
}

async function loadContext(seasonSlug: string, seasonId: number, roundId: number) {
  const coreFeed = await getAdminTopDogSnapshot({ seasonSlug, roundId });
  const core = coreFeed.snapshot;

  if (!core || core.season.id !== seasonId || core.selectedRound?.id !== roundId) {
    throw new Error("The selected Top Dog league night is no longer available.");
  }

  return core;
}

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const seasonSlug = url.searchParams.get("season") ?? "";
  const seasonId = Number(url.searchParams.get("seasonId"));
  const roundId = Number(url.searchParams.get("round"));

  if (!seasonSlug || !Number.isInteger(seasonId) || !Number.isInteger(roundId)) {
    return Response.json({ message: "Select a valid league night." }, { status: 400 });
  }

  try {
    const core = await loadContext(seasonSlug, seasonId, roundId);
    return Response.json(await getAdminTopDogProductionFeed(core), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Top Dog production GET error:", error);
    return Response.json(
      { message: error instanceof Error ? error.message : "The production desk could not load." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request) || !(await isAdminAuthenticated())) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  let input: z.infer<typeof mutationSchema>;

  try {
    input = mutationSchema.parse(await request.json());
  } catch (error) {
    return Response.json(
      { message: "The production update was not valid.", detail: String(error) },
      { status: 400 }
    );
  }

  try {
    const core = await loadContext(input.seasonSlug, input.seasonId, input.roundId);

    switch (input.action) {
      case "assign_team_member":
        await assignTopDogTeamMember(input);
        break;
      case "save_sponsor":
        await saveTopDogSponsor({
          seasonId: input.seasonId,
          roundId: input.roundId,
          id: input.sponsorId,
          name: input.name,
          logoUrl: input.logoUrl,
          websiteUrl: input.websiteUrl,
          promoCode: input.promoCode,
          prizeSupplied: input.prizeSupplied,
          campaign: input.campaign,
          notes: input.notes,
        });
        break;
      case "save_prize":
        await saveTopDogPrize({
          id: input.prizeId,
          seasonId: input.seasonId,
          roundId: input.roundId,
          category: input.category,
          customCategory: input.customCategory,
          profileId: input.profileId,
          teamId: input.teamId,
          displayName: input.displayName,
          resultValue: input.resultValue,
          prize: input.prize,
          sponsorId: input.sponsorId,
          notes: input.notes,
          winnerStatus: input.winnerStatus,
        });
        break;
      case "show_prize":
        await showTopDogPrize(input);
        break;
      case "save_activation":
        await saveTopDogSponsorActivation(input);
        break;
      case "toggle_activation":
        await toggleTopDogSponsorFulfilment(input);
        break;
      case "show_sponsor":
        await showTopDogSponsor(input);
        break;
      case "jackpot":
        await runTopDogJackpotCommand(input);
        break;
      case "save_interview":
        await saveTopDogInterview(input);
        break;
      case "interview_status":
        await setTopDogInterviewStatus(input);
        break;
      case "mark_clip":
        await markTopDogContentClip(input);
        break;
      case "save_segment":
        await saveTopDogSegment(input);
        break;
      case "show_segment":
        await showTopDogSegment(input);
        break;
      case "toggle_checklist":
        await toggleTopDogChecklistItem(input);
        break;
      case "generate_recap": {
        const productionFeed = await getAdminTopDogProductionFeed(core);
        if (!productionFeed.snapshot) {
          throw new Error(productionFeed.warningMessage ?? "The production recap data is unavailable.");
        }
        await generateTopDogNightRecap({ core, production: productionFeed.snapshot });
        break;
      }
      case "show_recap":
        await showTopDogNightRecap(input);
        break;
    }

    return Response.json(await getAdminTopDogProductionFeed(core), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Top Dog production PATCH error:", error);
    return Response.json(
      { message: error instanceof Error ? error.message : "The production update could not be saved." },
      { status: 500 }
    );
  }
}
