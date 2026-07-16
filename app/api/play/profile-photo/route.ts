import {
  ensureCgsProfileForAuthUser,
  updateCgsProfilePhoto,
  uploadCgsProfilePhoto,
} from "@/lib/ambrose-events";
import { getAuthenticatedPlayerFromRequest } from "@/lib/player-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { user, isAdmin, error } = await getAuthenticatedPlayerFromRequest(request);

  if (!user) {
    return Response.json({ message: error }, { status: 401 });
  }

  if (isAdmin) {
    return Response.json(
      { message: "Admin app profile photos are managed in clubhouse admin." },
      { status: 403 }
    );
  }

  try {
    const profile = await ensureCgsProfileForAuthUser(user);
    const formData = await request.formData();
    const photo = formData.get("avatar_file");

    if (!(photo instanceof File) || photo.size <= 0) {
      return Response.json(
        { message: "Choose a player photo to upload." },
        { status: 400 }
      );
    }

    const avatarUrl = await uploadCgsProfilePhoto(profile.id, photo);
    const updatedProfile = await updateCgsProfilePhoto(profile.id, avatarUrl);

    return Response.json({
      avatarUrl,
      profile: updatedProfile,
    });
  } catch (requestError) {
    console.error("Player profile photo upload API error:", requestError);
    return Response.json(
      { message: "The player photo could not be uploaded." },
      { status: 500 }
    );
  }
}
