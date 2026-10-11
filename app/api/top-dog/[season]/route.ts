import { getPublishedTopDogSnapshot } from "@/lib/top-dog";

type RouteContext = {
  params: Promise<{ season: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext) {
  const { season } = await context.params;
  const url = new URL(request.url);
  const requestedRoundId = Number(url.searchParams.get("round"));
  const roundId = Number.isInteger(requestedRoundId) ? requestedRoundId : null;
  const snapshot = await getPublishedTopDogSnapshot(season, roundId);

  if (!snapshot) {
    return Response.json({ message: "Top Dog season not found." }, { status: 404 });
  }

  return Response.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}
