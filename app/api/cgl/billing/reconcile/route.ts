import { timingSafeEqual } from "node:crypto";
import { CglSquareError, getCglSquareReadiness, processQueuedCglSquareEvents } from "@/lib/cgl-square";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET ?? "";
  const actual = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/, "");
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  if (expected.length < 32 || expectedBytes.length !== actualBytes.length || !timingSafeEqual(expectedBytes, actualBytes))
    return Response.json({ error: "The billing scheduler is not authorised." }, { status: 403 });
  try {
    const readiness = getCglSquareReadiness();
    if (!readiness.configured)
      return Response.json({ status: "disabled", environment: readiness.environment, livePaymentsEnabled: false });
    return Response.json(await processQueuedCglSquareEvents({ limit: 5 }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json({ error: error instanceof CglSquareError ? error.message : "Square recovery is pending." }, {
      status: error instanceof CglSquareError ? error.status : 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
