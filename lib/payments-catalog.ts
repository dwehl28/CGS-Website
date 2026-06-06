export type PaymentProduct = {
  slug: string;
  title: string;
  description: string;
  checkoutTitle: string;
  checkoutSummary: string;
  amountInCents: number | null;
  currency: "aud";
  status: "draft" | "ready";
  buttonLabel: string;
  successMessage: string;
  metadata: Record<string, string>;
};

export const paymentCatalog: PaymentProduct[] = [
  {
    slug: "playing-member",
    title: "Playing Member",
    description:
      "A future on-site checkout option for golfers stepping into the paid CGS membership lane.",
    checkoutTitle: "CGS Playing Member Checkout",
    checkoutSummary:
      "This Stripe checkout route is ready to be connected to paid membership once the final pricing is locked in.",
    amountInCents: null,
    currency: "aud",
    status: "draft",
    buttonLabel: "Pay membership",
    successMessage:
      "Your CGS Playing Member payment has been submitted successfully.",
    metadata: {
      product_type: "membership",
    },
  },
  {
    slug: "season-3-entry",
    title: "Season 3 Entry",
    description:
      "A future on-site checkout option for paid entry into the current CGS season.",
    checkoutTitle: "Season 3 Entry Checkout",
    checkoutSummary:
      "This embedded payment route is ready for Season 3 once the final public and member pricing are confirmed.",
    amountInCents: null,
    currency: "aud",
    status: "draft",
    buttonLabel: "Pay event entry",
    successMessage: "Your Season 3 payment has been submitted successfully.",
    metadata: {
      product_type: "event",
      event_slug: "season-3",
    },
  },
  {
    slug: "movember-support",
    title: "Movember Support",
    description:
      "A future on-site payment option for charity support connected to the Movember stream.",
    checkoutTitle: "Movember Support Checkout",
    checkoutSummary:
      "This route is reserved for a future Movember support payment once the structure and amount options are finalised.",
    amountInCents: null,
    currency: "aud",
    status: "draft",
    buttonLabel: "Support the stream",
    successMessage: "Your support payment has been submitted successfully.",
    metadata: {
      product_type: "charity",
      event_slug: "movember-charity-stream",
    },
  },
];

export function getPaymentProductBySlug(slug: string) {
  return paymentCatalog.find((product) => product.slug === slug);
}

export type ReadyPaymentProduct = PaymentProduct & {
  amountInCents: number;
  status: "ready";
};

export function isPaymentProductReady(
  product: PaymentProduct
): product is ReadyPaymentProduct {
  return product.status === "ready" && typeof product.amountInCents === "number";
}

export function formatPaymentAmount(product: PaymentProduct) {
  if (typeof product.amountInCents !== "number") {
    return "Pricing coming soon";
  }

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: product.currency.toUpperCase(),
  }).format(product.amountInCents / 100);
}
