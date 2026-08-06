import { NextResponse } from "next/server";

import { getPublicPar3Snapshot } from "@/lib/par3-showdown";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getPublicPar3Snapshot();

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
