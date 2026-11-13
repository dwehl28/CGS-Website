import { timingSafeEqual } from "node:crypto";
import { CglSgtError, runCglSgtSync } from "@/lib/cgl-sgt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: Request) {
  const expected = process.env.CGL_SGT_SYNC_SECRET?.trim() ?? "";
  const actual = (request.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  return (
    expected.length >= 32 &&
    actual.length === expected.length &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  );
}

export async function POST(request: Request) {
  if (!authorised(request))
    return Response.json(
      { status: "forbidden", message: "This sync request is not authorised." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );

  try {
    return Response.json(
      await runCglSgtSync({
        trigger: "schedule",
        actor: "supabase-cron",
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const failure =
      error instanceof CglSgtError
        ? error
        : new CglSgtError(
            "The scheduled SGT sync failed. Cached data remains available.",
          );
    return Response.json(
      { status: failure.code, message: failure.message },
      {
        status: failure.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
