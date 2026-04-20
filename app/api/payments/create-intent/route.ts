import { NextResponse } from "next/server";

import { normalizeString } from "@/lib/form-utils";
import {
  getPaymentProductBySlug,
  isPaymentProductReady,
} from "@/lib/payments-catalog";
import { getStripeServer, hasStripeSecretKey } from "@/lib/stripe-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const slug = normalizeString(body.slug, 80);

    if (!slug) {
      return NextResponse.json(
        { error: "A payment option slug is required." },
        { status: 400 }
      );
    }

    const product = getPaymentProductBySlug(slug);

    if (!product) {
      return NextResponse.json(
        { error: "That payment option could not be found." },
        { status: 404 }
      );
    }

    if (!hasStripeSecretKey()) {
      return NextResponse.json(
        {
          error:
            "Stripe is not connected yet. Add STRIPE_SECRET_KEY to enable payments.",
        },
        { status: 503 }
      );
    }

    if (!isPaymentProductReady(product)) {
      return NextResponse.json(
        {
          error:
            "This CGS payment option is still in draft mode. Add pricing before turning it on.",
        },
        { status: 409 }
      );
    }

    const stripe = getStripeServer();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: product.amountInCents,
      currency: product.currency,
      automatic_payment_methods: {
        enabled: true,
      },
      description: product.title,
      metadata: {
        product_slug: product.slug,
        ...product.metadata,
      },
    });

    if (!paymentIntent.client_secret) {
      return NextResponse.json(
        { error: "Stripe did not return a client secret for this payment." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Stripe payment intent route error:", error);
    return NextResponse.json(
      { error: "Unable to prepare the Stripe payment right now." },
      { status: 500 }
    );
  }
}
