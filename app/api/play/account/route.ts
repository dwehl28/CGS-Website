import { deleteOwnCgsAccount } from "@/lib/ambrose-events";
import { getAuthenticatedPlayerFromRequest } from "@/lib/player-auth";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const { user, isAdmin, error } = await getAuthenticatedPlayerFromRequest(request);

  if (!user) {
    return Response.json({ message: error }, { status: 401 });
  }

  if (isAdmin) {
    return Response.json(
      { message: "The admin app login cannot be deleted from the player app." },
      { status: 403 }
    );
  }

  try {
    await deleteOwnCgsAccount(user.id);

    return Response.json({
      message: "Your CGS Golf account has been deleted.",
    });
  } catch (requestError) {
    console.error("Player account deletion API error:", requestError);
    return Response.json(
      {
        message:
          "Your account could not be deleted right now. Try again or contact CGS support.",
      },
      { status: 500 }
    );
  }
}
