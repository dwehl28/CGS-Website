import {
  getCglSgtPublicSnapshot,
  verifyCglOrigin,
} from "@/lib/cgl-platform";
import { CglSgtError, runCglSgtLiveSync } from "@/lib/cgl-sgt";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    verifyCglOrigin(request);
  } catch {
    return Response.json(
      {
        status: "forbidden",
        message: "Live refreshes must be requested from the CGS website.",
      },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  let pulse: Record<string, unknown>;
  try {
    pulse = await runCglSgtLiveSync({ actor: "public-live-pulse" });
  } catch (error) {
    pulse = {
      status: "delayed",
      message:
        error instanceof CglSgtError
          ? error.message
          : "SGT could not refresh just now. Last confirmed data is still available.",
    };
  }

  try {
    return Response.json(
      { ...(await getCglSgtPublicSnapshot()), pulse },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        status: "error",
        message: "The live tournament feed could not be loaded.",
        pulse,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
