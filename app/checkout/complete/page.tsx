import type { Metadata } from "next";

import CheckoutStatus from "@/components/payments/CheckoutStatus";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Checkout Return",
  description:
    "Return page for the CGS Stripe checkout flow once a payment is submitted or redirected back.",
  path: "/checkout/complete",
});

export default function CheckoutCompletePage() {
  return (
    <main className="min-h-screen text-white">
      <section className="mx-auto max-w-4xl px-6 py-16">
        <CheckoutStatus />
      </section>
    </main>
  );
}
