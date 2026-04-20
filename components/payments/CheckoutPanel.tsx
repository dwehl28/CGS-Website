"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useEffect, useState } from "react";

import type { PaymentProduct } from "@/lib/payments-catalog";
import { getStripeJs } from "@/lib/stripe-client";

type CheckoutPanelProps = {
  product: PaymentProduct;
  isStripeConfigured: boolean;
  isProductReady: boolean;
};

const stripePromise = getStripeJs();

function EmbeddedPaymentForm({ product }: { product: PaymentProduct }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/complete?slug=${product.slug}`,
      },
    });

    if (error) {
      setMessage(error.message ?? "Stripe could not confirm that payment.");
      setIsSubmitting(false);
      return;
    }

    setMessage("Redirecting to finalise the payment...");
    setIsSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />

      <button
        type="submit"
        disabled={!stripe || isSubmitting}
        className="btn-primary w-full border-0 disabled:opacity-70"
      >
        {isSubmitting ? "Processing..." : product.buttonLabel}
      </button>

      {message ? (
        <p className="text-center text-sm leading-7 text-zinc-400">{message}</p>
      ) : null}
    </form>
  );
}

export default function CheckoutPanel({
  product,
  isStripeConfigured,
  isProductReady,
}: CheckoutPanelProps) {
  const [clientSecret, setClientSecret] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadClientSecret() {
      if (!isStripeConfigured || !isProductReady) {
        return;
      }

      setIsLoading(true);
      setStatusMessage("");

      try {
        const response = await fetch("/api/payments/create-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            slug: product.slug,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setStatusMessage(
            data.error ?? "Stripe could not prepare the payment form."
          );
          return;
        }

        setClientSecret(data.clientSecret);
      } catch (error) {
        console.error(error);
        setStatusMessage("Stripe could not prepare the payment form.");
      } finally {
        setIsLoading(false);
      }
    }

    loadClientSecret();
  }, [isProductReady, isStripeConfigured, product.slug]);

  if (!isStripeConfigured) {
    return (
      <div className="rounded-[1.35rem] border border-[var(--tan)]/30 bg-[rgba(202,147,103,0.12)] px-5 py-5 text-sm leading-7 text-zinc-200">
        Stripe keys have not been added yet, so the on-site payment form is
        connected in code but not live.
      </div>
    );
  }

  if (!isProductReady) {
    return (
      <div className="rounded-[1.35rem] border border-white/8 bg-black/18 px-5 py-5 text-sm leading-7 text-zinc-300">
        This checkout route is ready for Stripe, but pricing and live purchase
        details still need to be added before payments can open.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="loading-bar h-3 rounded-full" />
        <div className="loading-bar h-3 rounded-full" />
        <p className="text-sm text-zinc-400">Preparing Stripe checkout...</p>
      </div>
    );
  }

  if (statusMessage) {
    return (
      <div className="rounded-[1.35rem] border border-[var(--tan)]/30 bg-[rgba(202,147,103,0.12)] px-5 py-5 text-sm leading-7 text-zinc-200">
        {statusMessage}
      </div>
    );
  }

  if (!clientSecret) {
    return null;
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#f4b41b",
            colorBackground: "#102737",
            colorText: "#f7f3eb",
            colorDanger: "#ff8f8f",
            colorSuccess: "#5cd2ff",
          },
        },
      }}
    >
      <EmbeddedPaymentForm product={product} />
    </Elements>
  );
}
