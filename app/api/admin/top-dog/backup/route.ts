import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminTopDogProductionFeed } from "@/lib/top-dog-production";
import { getAdminTopDogSnapshot } from "@/lib/top-dog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const seasonSlug = url.searchParams.get("season") ?? "";
  const roundId = Number(url.searchParams.get("round"));

  if (!seasonSlug || !Number.isInteger(roundId)) {
    return Response.json({ message: "Select a valid league night." }, { status: 400 });
  }

  const coreFeed = await getAdminTopDogSnapshot({ seasonSlug, roundId });
  const core = coreFeed.snapshot;

  if (!core || core.selectedRound?.id !== roundId) {
    return Response.json({ message: "League night not found." }, { status: 404 });
  }

  const production = await getAdminTopDogProductionFeed(core);
  const filename = `${seasonSlug}-round-${core.selectedRound.roundNumber}-backup.json`;

  return new Response(
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        core,
        production: production.snapshot,
      },
      null,
      2
    ),
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/json; charset=utf-8",
      },
    }
  );
}
