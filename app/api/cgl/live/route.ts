import { getCglSgtPublicSnapshot } from "@/lib/cgl-platform";

export const dynamic = "force-dynamic";

function feedEtag(snapshot: Awaited<ReturnType<typeof getCglSgtPublicSnapshot>>) {
  const connection = snapshot.sgt.connection;
  const version = [
    connection?.status,
    connection?.source_updated_at,
    connection?.last_live_success_at,
    snapshot.sgt.tours.length,
    snapshot.sgt.tournaments.length,
  ].join("|");
  return `W/"${Buffer.from(version).toString("base64url")}"`;
}

export async function GET(request: Request) {
  try {
    const snapshot = await getCglSgtPublicSnapshot();
    const etag = feedEtag(snapshot);
    const headers = {
      "Cache-Control": "no-store",
      ETag: etag,
      "X-CGL-Feed-Version": String(
        snapshot.sgt.connection?.source_updated_at ?? "not-synced",
      ),
    };
    if (request.headers.get("if-none-match") === etag)
      return new Response(null, { status: 304, headers });
    return Response.json(snapshot, { headers });
  } catch {
    return Response.json(
      {
        status: "error",
        message: "Live tournament data could not be loaded. Please retry.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
