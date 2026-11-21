import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCglMemberIdentity, cglApiFailure, verifyCglOrigin } from "@/lib/cgl-platform";
import {
  CglSquareError,
  createCglSquareCheckout,
  getCglSquareOperationalReadiness,
  retireStaleCglSquareCheckout,
  type CglSquareCheckout,
} from "@/lib/cgl-square";
import { CGL_MEMBERSHIP_TERMS_VERSION } from "@/lib/cgl-terms";

export const runtime = "nodejs";

const purchaseInput = z
  .object({
    planCode: z.enum([
      "annual",
      "monthly",
      "weekly",
      "casual_registration",
      "casual_season",
    ]),
    seasonId: z.uuid().optional(),
    requestKey: z.uuid(),
    termsAccepted: z.literal(true),
    termsVersion: z.literal(CGL_MEMBERSHIP_TERMS_VERSION),
    acceptedAmountCents: z.number().int().positive(),
  })
  .strict();

const resumeInput = z
  .object({
    action: z.literal("resume"),
    checkoutId: z.uuid(),
  })
  .strict();

const input = z.union([purchaseInput, resumeInput]);

function acceptedTermsVersion(checkout: CglSquareCheckout) {
  const snapshot = checkout.terms_snapshot;
  return snapshot && typeof snapshot === "object"
    ? snapshot.terms_version
    : null;
}

export async function GET(request: Request) {
  try {
    const planCode = new URL(request.url).searchParams.get("planCode");
    const { data: plan, error } = await getSupabaseAdmin()
      .from("cgl_plans")
      .select("code,price_cents,auto_renew,billing_interval,config")
      .eq("code", planCode ?? "")
      .eq("active", true)
      .maybeSingle();
    if (error || !plan)
      return Response.json(
        { error: "Choose an available CGL plan." },
        { status: 404 },
      );
    const readiness = await getCglSquareOperationalReadiness();
    const purchaseEnabled = plan.auto_renew
      ? readiness.subscriptionActionsEnabled
      : readiness.oneOffActionsEnabled;
    return Response.json(
      {
        planCode: plan.code,
        amountCents: plan.price_cents,
        currency: "AUD",
        recurring: plan.auto_renew,
        billingInterval: plan.billing_interval,
        environment: readiness.environment,
        readiness,
        purchaseEnabled,
        termsVersion: CGL_MEMBERSHIP_TERMS_VERSION,
        prorationAvailable: plan.code === "monthly",
        creditsAvailable: false,
        seasonRequired: plan.code === "casual_season",
        notice:
          plan.code === "casual_season"
            ? "This AUD quote is for a one-off Season Pass linked to the season you select."
            : plan.code === "monthly"
              ? "The standard price is $29.95 AUD per month. Square may prorate the first charge to the next first of the month, then renews at $29.95 on the first until cancelled."
              : plan.code === "annual"
                ? "This membership is charged in AUD when purchased and renews yearly on the purchase anniversary until cancelled."
                : plan.code === "weekly"
                  ? "This membership is charged in AUD when purchased and renews every seven days until cancelled."
              : "This one-off AUD purchase is not linked to a specific season and does not automatically renew.",
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
    // Bearer authentication is verified by Supabase; the existing shared admin token cannot buy a membership.
    const member = await getCglMemberIdentity(request);
    const memberId = member.memberId ?? member.id;
    const readiness = await getCglSquareOperationalReadiness();
    if (!readiness.ready)
      throw new CglSquareError(
        readiness.environment === "sandbox"
          ? "CGL test payments are awaiting Square Sandbox setup and testing activation. No payment has been taken."
          : "CGL live payments are awaiting verified Square production setup and launch activation. No payment has been taken.",
      );
    if (Number(request.headers.get("content-length") ?? 0) > 4096)
      return Response.json(
        { error: "Checkout request is too large." },
        { status: 413 },
      );
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 4096)
      return Response.json({ error: "Checkout request is too large." }, { status: 413 });
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch { return Response.json({ error: "Send a valid checkout request." }, { status: 400 }); }
    const body = input.safeParse(parsed);
    if (!body.success)
      return Response.json(
        {
          error:
            "Choose a CGL plan, accept the published terms and use a valid checkout request.",
        },
        { status: 400 },
      );
    if ("action" in body.data) {
      const { data: saved, error: savedError } = await getSupabaseAdmin()
        .from("cgl_square_checkout_intents")
        .select("id,member_id,membership_id,environment,plan_code,season_id,amount_cents,recurring,square_plan_variation_id,square_link_id,square_order_id,payment_link_url,state,terms_snapshot")
        .eq("id", body.data.checkoutId)
        .eq("member_id", memberId)
        .eq("environment", readiness.environment)
        .eq("state", "pending")
        .maybeSingle();
      if (savedError || !saved)
        return Response.json(
          { error: "This saved checkout is no longer available. Refresh your membership page to start again safely." },
          { status: 404 },
        );
      const termsSnapshot = saved.terms_snapshot && typeof saved.terms_snapshot === "object"
        ? saved.terms_snapshot as Record<string, unknown>
        : {};
      if (termsSnapshot.terms_version !== CGL_MEMBERSHIP_TERMS_VERSION) {
        await retireStaleCglSquareCheckout(saved as CglSquareCheckout);
        return Response.json(
          {
            error: "The membership terms changed, so the old unpaid Square link was closed. Review the current payment details to start a fresh checkout.",
            staleCheckoutRetired: true,
          },
          { status: 409 },
        );
      }
      if (readiness.environment === "production" && saved.recurring && !readiness.subscriptionActionsEnabled)
        throw new CglSquareError(
          "Recurring Square memberships are still in controlled verification. Choose a one-off casual option for now.",
          409,
          "square_recurring_disabled",
        );
      const checkout = {
        ...saved,
        environment: readiness.environment,
      } as CglSquareCheckout;
      const url = await createCglSquareCheckout(checkout);
      return Response.json(
        {
          url,
          checkoutId: checkout.id,
          amountCents: checkout.amount_cents,
          currency: "AUD",
          environment: readiness.environment,
          recurring: checkout.recurring,
          resumed: true,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const purchase = body.data;
    if (readiness.environment === "production" && ["annual", "monthly", "weekly"].includes(purchase.planCode) && !readiness.subscriptionActionsEnabled)
      throw new CglSquareError(
        "Recurring Square memberships are still in controlled verification. Choose a one-off casual option for now.",
        409,
        "square_recurring_disabled",
      );
    const seasonId =
      purchase.planCode === "casual_season" ? purchase.seasonId ?? null : null;
    if (purchase.planCode === "casual_season" && !seasonId)
      return Response.json(
        { error: "Choose an open season for the $100 Season Pass." },
        { status: 400 },
      );
    const prepareCheckout = () => getSupabaseAdmin().rpc(
      readiness.environment === "production"
        ? "cgl_prepare_square_live_checkout"
        : "cgl_prepare_square_checkout",
      {
        p_member_id: memberId,
        p_plan_code: purchase.planCode,
        p_season_id: seasonId,
        p_request_key: purchase.requestKey,
        p_accepted_amount_cents: purchase.acceptedAmountCents,
      },
    );
    let { data, error } = await prepareCheckout();
    if (error)
      return Response.json(
        {
          error:
            "This checkout is unavailable. Check your membership, registration and season eligibility, or ask CGS to review it.",
        },
        { status: 409 },
      );
    let checkout = data as CglSquareCheckout;
    if (!checkout?.id)
      throw new CglSquareError(
        "The checkout could not be prepared. No payment has been taken.",
      );
    if (acceptedTermsVersion(checkout) !== CGL_MEMBERSHIP_TERMS_VERSION) {
      await retireStaleCglSquareCheckout(checkout);
      ({ data, error } = await prepareCheckout());
      if (error)
        throw new CglSquareError(
          "The old checkout was closed, but a fresh checkout could not be prepared. Retry safely.",
        );
      checkout = data as CglSquareCheckout;
      if (!checkout?.id || acceptedTermsVersion(checkout) !== CGL_MEMBERSHIP_TERMS_VERSION)
        throw new CglSquareError(
          "The fresh checkout did not preserve the current membership terms. No payment has been taken.",
          409,
          "square_terms_mismatch",
        );
    }
    if (checkout.amount_cents !== purchase.acceptedAmountCents)
      throw new CglSquareError(
        "The membership price has changed. Review the current quote before confirming payment.",
        409,
      );
    const url = await createCglSquareCheckout(checkout);
    return Response.json(
      {
        url,
        checkoutId: checkout.id,
        amountCents: checkout.amount_cents,
        currency: "AUD",
        environment: readiness.environment,
        recurring: checkout.recurring,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof CglSquareError)
      return Response.json({ error: error.message }, { status: error.status });
    return cglApiFailure(error);
  }
}
