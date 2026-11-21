import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { cglApiFailure, verifyCglOrigin } from "@/lib/cgl-platform";
import {
  CglSquareError,
  createCglSquareCheckout,
  getCglSquareOperationalReadiness,
  retireStaleCglSquareCheckout,
  type CglSquareCheckout,
} from "@/lib/cgl-square";
import { CGL_MEMBERSHIP_TERMS_VERSION } from "@/lib/cgl-terms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const guestPurchase = z
  .object({
    displayName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    sgtUsername: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .regex(/^[^\s/\\?#\u0000-\u001f]+$/),
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

function secret() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!value) {
    throw new CglSquareError(
      "Secure guest checkout is temporarily unavailable. No payment has been taken.",
    );
  }
  return value;
}

function guestAccessKey(requestKey: string) {
  return createHmac("sha256", secret())
    .update(`cgl-guest-access:v1:${requestKey}`)
    .digest("base64url");
}

function requestFingerprint(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    forwarded ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  ).slice(0, 128);
  return createHmac("sha256", secret())
    .update(`cgl-guest-rate:v1:${address}`)
    .digest("hex");
}

function acceptedTermsVersion(checkout: CglSquareCheckout) {
  const snapshot = checkout.terms_snapshot;
  return snapshot && typeof snapshot === "object"
    ? snapshot.terms_version
    : null;
}

export async function POST(request: Request) {
  try {
    verifyCglOrigin(request);
    const readiness = await getCglSquareOperationalReadiness();
    if (readiness.environment !== "production" || !readiness.ready) {
      throw new CglSquareError(
        "Live guest checkout is temporarily unavailable. No payment has been taken.",
      );
    }
    if (Number(request.headers.get("content-length") ?? 0) > 8192) {
      return Response.json({ error: "Checkout request is too large." }, { status: 413 });
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 8192) {
      return Response.json({ error: "Checkout request is too large." }, { status: 413 });
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(raw);
    } catch {
      return Response.json({ error: "Send a valid checkout request." }, { status: 400 });
    }
    const parsed = guestPurchase.safeParse(decoded);
    if (!parsed.success) {
      return Response.json(
        { error: "Enter your purchase details, exact SGT username, and review the current payment terms." },
        { status: 400 },
      );
    }
    const purchase = parsed.data;
    if (["annual", "monthly", "weekly"].includes(purchase.planCode) && !readiness.subscriptionActionsEnabled) {
      throw new CglSquareError(
        "Recurring memberships are temporarily unavailable. Choose a one-off casual option or retry later.",
        409,
        "square_recurring_disabled",
      );
    }
    const seasonId = purchase.planCode === "casual_season" ? purchase.seasonId ?? null : null;
    if (purchase.planCode === "casual_season" && !seasonId) {
      return Response.json({ error: "Choose an open season for the $100 Season Pass." }, { status: 400 });
    }
    const accessKey = guestAccessKey(purchase.requestKey);
    const accessHash = createHash("sha256").update(accessKey).digest("hex");
    const accessExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const prepareCheckout = () => getSupabaseAdmin().rpc(
      "cgl_prepare_guest_square_checkout",
      {
        p_email: purchase.email.toLowerCase(),
        p_display_name: purchase.displayName,
        p_sgt_username: purchase.sgtUsername,
        p_plan_code: purchase.planCode,
        p_season_id: seasonId,
        p_request_key: purchase.requestKey,
        p_accepted_amount_cents: purchase.acceptedAmountCents,
        p_access_key_hash: accessHash,
        p_access_expires_at: accessExpiresAt,
        p_rate_fingerprint: requestFingerprint(request),
      },
    );

    let { data, error } = await prepareCheckout();
    if (error) {
      return Response.json(
        {
          error: error.message.includes("Too many checkout attempts")
            ? "Too many checkout attempts. Please wait before trying again."
            : "We could not safely match these purchase and SGT details. Check the email and exact SGT username, or sign in if they already belong to a CGS account.",
        },
        { status: error.message.includes("Too many") ? 429 : 409 },
      );
    }
    let checkout = data as CglSquareCheckout;
    if (!checkout?.id || checkout.checkout_channel !== "guest") {
      throw new CglSquareError("The guest checkout could not be prepared. No payment has been taken.");
    }
    if (acceptedTermsVersion(checkout) !== CGL_MEMBERSHIP_TERMS_VERSION) {
      await retireStaleCglSquareCheckout(checkout);
      ({ data, error } = await prepareCheckout());
      if (error) {
        throw new CglSquareError("The old checkout was closed, but a fresh checkout could not be prepared. Retry safely.");
      }
      checkout = data as CglSquareCheckout;
    }
    if (checkout.amount_cents !== purchase.acceptedAmountCents) {
      throw new CglSquareError(
        "The membership price has changed. Review the current quote before confirming payment.",
        409,
      );
    }
    const url = await createCglSquareCheckout(checkout, { guestAccessKey: accessKey });
    return Response.json(
      {
        url,
        checkoutId: checkout.id,
        accessKey,
        amountCents: checkout.amount_cents,
        currency: "AUD",
        recurring: checkout.recurring,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof CglSquareError) {
      return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    return cglApiFailure(error);
  }
}
