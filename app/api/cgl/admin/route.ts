import {
  cglApiFailure,
  cglCsv,
  CglApiError,
  executeCglAdminAction,
  getCglAdminActor,
  getCglAdminSnapshot,
  readCglBody,
  verifyCglOrigin,
  type CglData,
} from "@/lib/cgl-platform";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const actor = await getCglAdminActor(request),
      snapshot = await getCglAdminSnapshot(actor);
    const exportName = new URL(request.url).searchParams.get("export");
    if (exportName) {
      if (
        actor.role === "results_admin" ||
        ![
          "payments",
          "credit_transactions",
          "orders",
          "gifts",
          "prizes",
          "audit_events",
        ].includes(exportName)
      )
        throw new CglApiError(
          "This report requires league administrator access.",
          403,
        );
      return new Response(
        cglCsv((snapshot as unknown as Record<string, CglData[]>)[exportName]),
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="cgl-${exportName}.csv"`,
            "Cache-Control": "no-store",
          },
        },
      );
    }
    return Response.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return cglApiFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    verifyCglOrigin(request);
    const actor = await getCglAdminActor(request);
    return Response.json(
      {
        status: "completed",
        result: await executeCglAdminAction(actor, await readCglBody(request)),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return cglApiFailure(error);
  }
}
