import type { Metadata } from "next";
import Link from "next/link";

import FAQSection from "@/components/FAQSection";
import { buildMetadata } from "@/lib/seo";
import {
  merchFaqs,
  merchItems,
  merchPrinciples,
  merchSteps,
  siteConfig,
} from "@/lib/site-content";
import { buildFaqJsonLd, createJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = buildMetadata({
  title: "Merch",
  description:
    "Browse current CGS merch and head to the official store for shirts, golf balls, and future drops.",
  path: "/merch",
});

export default function MerchPage() {
  return (
    <main className="min-h-screen text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={createJsonLd(buildFaqJsonLd(merchFaqs))}
      />

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="eyebrow">Clubhouse uniform</div>
            <h1 className="mt-6 text-5xl md:text-6xl">CGS Merch</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
              The merch side of CGS should feel wearable, clean, and properly
              tied to the identity of the club, not like an afterthought.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={siteConfig.merchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-lg"
              >
                Shop Official Merch
              </a>
              <Link href="/about" className="btn-secondary text-lg">
                Why CGS merch exists
              </Link>
            </div>
          </div>

          <div className="panel rounded-[2rem] p-6 md:p-8">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--accent)]">
              Why merch matters
            </p>
            <div className="mt-5 grid gap-4">
              {merchPrinciples.map((principle) => (
                <div
                  key={principle.title}
                  className="interactive-card rounded-[1.35rem] border border-white/8 bg-black/18 p-5"
                >
                  <h2 className="text-2xl">{principle.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">
                    {principle.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {merchItems.map((item) => (
            <div
              key={item.name}
              className="panel interactive-card rounded-[2rem] p-8 text-left"
            >
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.24em] text-[var(--tan)]">
                Current item
              </p>
              <h2 className="mb-3 text-4xl">{item.name}</h2>
              <p className="mb-4 leading-7 text-zinc-300">{item.description}</p>
              <p className="text-sm leading-7 text-zinc-500">{item.note}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="panel rounded-[1.75rem] p-8">
            <div className="eyebrow">Ordering guide</div>
            <h2 className="mt-4 text-4xl">How the merch side works</h2>
            <p className="mt-4 max-w-xl leading-7 text-zinc-300">
              The official CGS store is where the current drop, sizing, and
              checkout details live, while the merch page keeps the direction
              of CGS releases clear.
            </p>

            <div className="mt-6 flex flex-wrap gap-4">
              <a
                href={siteConfig.merchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
              >
                Open official store
              </a>
              <Link href="/contact" className="btn-secondary">
                Ask a merch question
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {merchSteps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-[1.5rem] border border-white/8 bg-black/18 p-5"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
                  0{index + 1}
                </p>
                <h3 className="mt-3 text-2xl">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-400">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12">
          <FAQSection
            title="Merch FAQs"
            intro="A few quick answers if you are deciding whether to buy now or wait for future drops."
            items={merchFaqs}
          />
        </div>
      </section>
    </main>
  );
}
