import { z } from "zod";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  pruneCgsPlayerPhotoDirectory,
  uploadCgsPlayerPhotoAsset,
} from "@/lib/player-photo-storage";
import {
  createTopDogManagedProfile,
  deleteTopDogManagedProfile,
  getAdminTopDogProductionFeed,
  updateTopDogProfile,
  updateTopDogProfileAvatar,
} from "@/lib/top-dog-production";
import { getAdminTopDogSnapshot } from "@/lib/top-dog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const profileSchema = z.object({
  seasonId: z.number().int().positive(),
  seasonSlug: z.string().trim().min(1).max(80),
  roundId: z.number().int().positive(),
  profileId: z.string().uuid().optional(),
  displayName: z.string().trim().min(1).max(120),
  nickname: z.string().trim().max(80),
  handle: z.string().trim().max(80),
  avatarUrl: z.string().trim().max(2000).refine((value) => {
    if (!value) {
      return true;
    }

    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Player photo URLs must be valid HTTPS links."),
  handicap: z.number().min(-10).max(80).nullable(),
  teamId: z.number().int().positive().nullable(),
  roleLabel: z.string().trim().min(1).max(80),
});

const deleteSchema = z.object({
  seasonId: z.number().int().positive(),
  seasonSlug: z.string().trim().min(1).max(80),
  roundId: z.number().int().positive(),
  profileId: z.string().uuid(),
}).strict();

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).host === new URL(request.url).host;
}

function nullableNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseProfileForm(formData: FormData) {
  return profileSchema.parse({
    seasonId: Number(formData.get("season_id")),
    seasonSlug: String(formData.get("season_slug") ?? ""),
    roundId: Number(formData.get("round_id")),
    profileId: String(formData.get("profile_id") ?? "") || undefined,
    displayName: String(formData.get("display_name") ?? ""),
    nickname: String(formData.get("nickname") ?? ""),
    handle: String(formData.get("handle") ?? ""),
    avatarUrl: String(formData.get("avatar_url") ?? ""),
    handicap: nullableNumber(formData.get("handicap")),
    teamId: nullableNumber(formData.get("team_id")),
    roleLabel: String(formData.get("role_label") ?? "Player"),
  });
}

async function loadContext(seasonSlug: string, seasonId: number, roundId: number) {
  const coreFeed = await getAdminTopDogSnapshot({ seasonSlug, roundId });
  const core = coreFeed.snapshot;

  if (!core || core.season.id !== seasonId || core.selectedRound?.id !== roundId) {
    throw new Error("The selected Top Dog league night is no longer available.");
  }

  return core;
}

function errorResponse(error: unknown, fallback: string) {
  const invalid = error instanceof z.ZodError;
  return Response.json(
    { message: invalid ? "Check the player details and try again." : error instanceof Error ? error.message : fallback },
    { status: invalid ? 400 : 500 }
  );
}

export async function POST(request: Request) {
  if (!isSameOrigin(request) || !(await isAdminAuthenticated())) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  let profileId = "";
  let input: z.infer<typeof profileSchema> | null = null;

  try {
    const formData = await request.formData();
    input = parseProfileForm(formData);
    const core = await loadContext(input.seasonSlug, input.seasonId, input.roundId);
    profileId = await createTopDogManagedProfile(input);

    const photoDirectory = `top-dog/profiles/${profileId}`;
    const photo = formData.get("avatar_file");
    let finalAvatarUrl = input.avatarUrl;
    if (photo instanceof File && photo.size > 0) {
      finalAvatarUrl = await uploadCgsPlayerPhotoAsset(photoDirectory, photo);
      await updateTopDogProfileAvatar(profileId, finalAvatarUrl);
    }

    try {
      await pruneCgsPlayerPhotoDirectory(photoDirectory, finalAvatarUrl);
    } catch (cleanupError) {
      console.error("Top Dog profile photo cleanup error:", cleanupError);
    }

    return Response.json(await getAdminTopDogProductionFeed(core), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (profileId && input) {
      try {
        await deleteTopDogManagedProfile({
          seasonId: input.seasonId,
          roundId: input.roundId,
          profileId,
        });
      } catch (cleanupError) {
        console.error("Top Dog profile create cleanup error:", cleanupError);
      }
    }
    console.error("Top Dog profile POST error:", error);
    return errorResponse(error, "The player profile could not be created.");
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request) || !(await isAdminAuthenticated())) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const input = profileSchema.extend({ profileId: z.string().uuid() }).parse(
      parseProfileForm(formData)
    );
    const core = await loadContext(input.seasonSlug, input.seasonId, input.roundId);

    await updateTopDogProfile(input);

    const photoDirectory = `top-dog/profiles/${input.profileId}`;
    const photo = formData.get("avatar_file");
    let finalAvatarUrl = input.avatarUrl;
    if (photo instanceof File && photo.size > 0) {
      finalAvatarUrl = await uploadCgsPlayerPhotoAsset(photoDirectory, photo);
      await updateTopDogProfileAvatar(input.profileId, finalAvatarUrl);
    }

    try {
      await pruneCgsPlayerPhotoDirectory(photoDirectory, finalAvatarUrl);
    } catch (cleanupError) {
      console.error("Top Dog profile photo cleanup error:", cleanupError);
    }

    return Response.json(await getAdminTopDogProductionFeed(core), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Top Dog profile PATCH error:", error);
    return errorResponse(error, "The player profile could not be updated.");
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request) || !(await isAdminAuthenticated())) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const input = deleteSchema.parse(await request.json());
    const core = await loadContext(input.seasonSlug, input.seasonId, input.roundId);
    await deleteTopDogManagedProfile(input);
    return Response.json(await getAdminTopDogProductionFeed(core), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Top Dog profile DELETE error:", error);
    return errorResponse(error, "The player profile could not be deleted.");
  }
}
