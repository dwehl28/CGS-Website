import { after } from "next/server";
import { CglSquareError, receiveCglSquareWebhook, processQueuedCglSquareEvents } from "@/lib/cgl-square";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 1_048_576)
      return Response.json(
        { error: "Notification too large." },
        { status: 413 },
      );
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody) > 1_048_576)
      return Response.json(
        { error: "Notification too large." },
        { status: 413 },
      );
    const result = await receiveCglSquareWebhook(
      rawBody,
      request.headers.get("x-square-hmacsha256-signature"),
      request.headers.get("square-environment"),
    );
    // Acknowledge only after durable receipt; provider calls run outside Square's ten-second response window.
    after(async () => {
      try {
        await processQueuedCglSquareEvents({ eventId: result.eventId, limit: 1 });
      } catch {
        // The saved event and expiring worker lease remain recoverable by the maintenance job.
        console.error("CGL Square event is pending recovery.");
      }
    });
    return Response.json(
      { received: true, result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof CglSquareError)
      return Response.json({ error: error.message }, { status: error.status });
    return Response.json(
      { error: "The notification could not be reconciled. Retry delivery." },
      { status: 503 },
    );
  }
}
