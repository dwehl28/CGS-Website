import {
  cglApiFailure,
  executeCglMemberAction,
  getCglMemberIdentity,
  getCglMemberSnapshot,
  isCglSquareEnvironmentRecord,
  readCglBody,
  verifyCglOrigin,
} from "@/lib/cgl-platform";
import { getCglSquareOperationalReadiness } from "@/lib/cgl-square";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const identity = await getCglMemberIdentity(request);
    const snapshot = await getCglMemberSnapshot(identity);
    const readiness = await getCglSquareOperationalReadiness();
    const [{ data: checkouts, error }, { data: seasonEntitlements }] = await Promise.all([getSupabaseAdmin()
      .from("cgl_square_checkout_intents")
      .select("id,plan_code,season_id,amount_cents,recurring,state,environment,created_at,completed_at")
      .eq("member_id", identity.id)
      .eq("environment", readiness.environment)
      .order("created_at", { ascending: false })
      .limit(25), getSupabaseAdmin()
        .from("cgl_square_season_entitlements")
        .select("checkout_id,season_id,paid_at,expires_at,environment")
        .eq("member_id", identity.id)
        .eq("environment", readiness.environment)
        .limit(25)]);
    return Response.json(
      {
        ...snapshot,
        billing: {
          ...snapshot.billing,
          environment: readiness.environment,
          livePaymentsEnabled: readiness.livePaymentsEnabled,
          memberships: (readiness.environment === "sandbox"
            ? snapshot.billing.memberships
            : snapshot.memberships
          ).filter((record) =>
            isCglSquareEnvironmentRecord(record, readiness.environment),
          ),
          payments: (readiness.environment === "sandbox"
            ? snapshot.billing.payments
            : snapshot.payments
          ).filter((record) =>
            isCglSquareEnvironmentRecord(record, readiness.environment),
          ),
          readiness,
          checkouts: error ? [] : checkouts ?? [],
          seasonEntitlements: seasonEntitlements ?? [],
          ...(error ? { notice: "Square billing setup is not yet available." } : {}),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return cglApiFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    verifyCglOrigin(request);
    const identity = await getCglMemberIdentity(request);
    return Response.json(
      {
        status: "completed",
        result: await executeCglMemberAction(
          identity,
          await readCglBody(request),
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return cglApiFailure(error);
  }
}
