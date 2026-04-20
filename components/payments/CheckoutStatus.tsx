"use client";

import { useSearchParams } from "next/navigation";

import {
  formatPaymentAmount,
  getPaymentProductBySlug,
} from "@/lib/payments-catalog";

export default function CheckoutStatus() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") ?? "";
  const product = getPaymentProductBySlug(slug);

  if (!product) {
    return (
      <div className="panel rounded-[2rem] p-8">
        <h1 className="text-4xl">Payment update</h1>
        <p className="mt-4 leading-7 text-zinc-300">
          Stripe returned to CGS, but the payment option could not be matched to
          a configured product.
        </p>
      </div>
    );
  }

  return (
    <div className="panel rounded-[2rem] p-8 md:p-10">
      <div className="eyebrow">Payment return</div>
      <h1 className="mt-6 text-4xl md:text-5xl">{product.title}</h1>
      <p className="mt-5 max-w-2xl leading-8 text-zinc-300">
        Stripe has returned the customer to CGS. This result page is now ready
        for the final post-payment flow once real pricing and product links are
        switched on.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[1.3rem] border border-white/8 bg-black/18 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Payment option
          </p>
          <p className="mt-2 text-lg text-white">{product.title}</p>
        </div>
        <div className="rounded-[1.3rem] border border-white/8 bg-black/18 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Current amount
          </p>
          <p className="mt-2 text-lg text-white">{formatPaymentAmount(product)}</p>
        </div>
      </div>
    </div>
  );
}
