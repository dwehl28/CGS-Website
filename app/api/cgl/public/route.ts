import { cglApiFailure, getCglPublicSnapshot } from "@/lib/cgl-platform";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(await getCglPublicSnapshot(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return cglApiFailure(error);
  }
}
