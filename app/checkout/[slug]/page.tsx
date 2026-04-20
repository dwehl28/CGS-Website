import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import CheckoutPanel from "@/components/payments/CheckoutPanel";
import {
  formatPaymentAmount,
  getPaymentProductBySlug,
  isPaymentProductReady,
} from "@/lib/payments-catalog";
import { buildMetadata } from "@/lib/seo";
import { hasStripePublishableKey } from "@/lib/stripe-client";
import { hasStripeSecretKey } from "@/lib/stripe-server";

type CheckoutPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: CheckoutPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getPaymentProductBySlug(slug);

  if (!product) {
    return buildMetadata({
      title: "Checkout",
      description: "CGS checkout",
      path: `/checkout/${slug}`,
    });
  }

  return buildMetadata({
    title: product.checkoutTitle,
    description: product.checkoutSummary,
    path: `/checkout/${slug}`,
  });
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { slug } = await params;
  const product = getPaymentProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const isStripeConfigured = hasStripePublishableKey() && hasStripeSecretKey();
  const isProductReady = isPaymentProductReady(product);

  return (
    <main className="min-h-screen text-white">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="panel rounded-[2rem] p-8 md:p-10">
            <div className="eyebrow">On-site Stripe checkout</div>
            <h1 className="mt-6 text-4xl md:text-5xl">{product.checkoutTitle}</h1>
            <p className="mt-5 max-w-2xl leading-8 text-zinc-300">
              {product.checkoutSummary}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.3rem] border border-white/8 bg-black/18 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Status
                </p>
                <p className="mt-2 text-lg text-white">
                  {isProductReady ? "Ready for payment" : "Draft until priced"}
                </p>
              </div>
              <div className="rounded-[1.3rem] border border-white/8 bg-black/18 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Current amount
                </p>
                <p className="mt-2 text-lg text-white">
                  {formatPaymentAmount(product)}
                </p>
              </div>
              <div className="rounded-[1.3rem] border border-white/8 bg-black/18 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Stripe keys
                </p>
                <p className="mt-2 text-lg text-white">
                  {isStripeConfigured ? "Connection ready" : "Still needed"}
                </p>
              </div>
              <div className="rounded-[1.3rem] border border-white/8 bg-black/18 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Product type
                </p>
                <p className="mt-2 text-lg text-white">{product.title}</p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/membership" className="btn-secondary">
                Back to membership
              </Link>
              <Link href="/contact" className="btn-secondary">
                Ask a payment question
              </Link>
            </div>
          </div>

          <div className="panel rounded-[2rem] p-8 md:p-10">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--accent)]">
              Payment form
            </p>
            <h2 className="mt-4 text-3xl">Stripe connection foundation</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              This route is intentionally hidden from the public navigation for
              now. Once we add final pricing and switch links over, it can
              become the on-site payment flow for CGS.
            </p>

            <div className="mt-8">
              <CheckoutPanel
                product={product}
                isStripeConfigured={isStripeConfigured}
                isProductReady={isProductReady}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
