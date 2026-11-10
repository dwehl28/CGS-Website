import { cglApiFailure, runCglScheduledJobs } from "@/lib/cgl-platform";
import { processDueCglSquareCancellations, processQueuedCglSquareEvents } from "@/lib/cgl-square";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const results = await runCglScheduledJobs(request);
    const square = await processQueuedCglSquareEvents({ limit: 5 });
    const cancellations = await processDueCglSquareCancellations();
    return Response.json(
      { ...results, square, cancellations },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return cglApiFailure(error);
  }
}
