import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminTopDogSnapshot } from "@/lib/top-dog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const seasonSlug = url.searchParams.get("season");
  const requestedRoundId = Number(url.searchParams.get("round"));
  const roundId = Number.isInteger(requestedRoundId) ? requestedRoundId : null;
  const feed = await getAdminTopDogSnapshot({ seasonSlug, roundId });

  return Response.json(feed, {
    headers: { "Cache-Control": "no-store" },
  });
}
