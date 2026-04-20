import Stripe from "stripe";

let cachedStripe: Stripe | null = null;

export function hasStripeSecretKey() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripeServer() {
  if (cachedStripe) {
    return cachedStripe;
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    throw new Error(
      "Stripe secret key is missing. Set STRIPE_SECRET_KEY to enable payments."
    );
  }

  cachedStripe = new Stripe(stripeSecretKey);
  return cachedStripe;
}
