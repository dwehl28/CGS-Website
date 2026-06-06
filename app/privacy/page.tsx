import type { Metadata } from "next";
import Link from "next/link";

import FAQSection from "@/components/FAQSection";
import PageIntro from "@/components/PageIntro";
import { buildMetadata } from "@/lib/seo";
import {
  privacyFaqs,
  privacyPrinciples,
  siteConfig,
  supportLinks,
} from "@/lib/site-content";
import { buildFaqJsonLd, createJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = buildMetadata({
  title: "Privacy",
  description:
    "Read the plain-English privacy summary for Crossodog Golf Society and how site enquiries are handled.",
  path: "/privacy",
});

const lastUpdated = "4 April 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={createJsonLd(buildFaqJsonLd(privacyFaqs))}
      />

      <section className="page-shell">
        <PageIntro
          eyebrow="Plain-English privacy"
          title="Privacy at CGS"
          description="This site collects the information you choose to send through membership, contact, and event-interest forms so CGS can reply and manage those enquiries properly."
          align="center"
        >
          <p className="mt-4 text-sm uppercase tracking-[0.18em] text-zinc-500">
            Last updated {lastUpdated}
          </p>
        </PageIntro>

        <div className="grid gap-6 md:grid-cols-3">
          {privacyPrinciples.map((principle) => (
            <div
              key={principle.title}
              className="subtle-grid-card rounded-[1.75rem] p-6"
            >
              <h2 className="text-3xl">{principle.title}</h2>
              <p className="mt-4 text-sm leading-7 text-zinc-300">
                {principle.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.04fr_0.96fr]">
          <div className="panel rounded-[2rem] p-8">
            <h2 className="text-4xl">What this means in practice</h2>
            <div className="mt-6 space-y-5 text-sm leading-7 text-zinc-300">
              <p>
                When you fill out a CGS form, the details you provide are stored
                so the team can respond to your enquiry, organise membership or
                event follow-up, and keep the conversation connected to the
                reason you reached out.
              </p>
              <p>
                CGS is not trying to collect unnecessary information. The forms
                focus on the basics needed to respond properly, such as your
                name, contact details, and any notes relevant to the membership,
                event, or enquiry you submitted.
              </p>
              <p>
                If you want to ask what information is being held or request
                that your submitted contact details be removed, you can email{" "}
                <a
                  href={`mailto:${siteConfig.email}`}
                  className="text-[var(--accent)]"
                >
                  {siteConfig.email}
                </a>
                .
              </p>
            </div>
          </div>

          <div className="panel rounded-[2rem] p-8">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--accent)]">
              Useful links
            </p>
            <div className="mt-5 grid gap-3">
              {supportLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="subtle-grid-card rounded-[1.2rem] px-4 py-4"
                >
                  <p className="text-lg font-semibold text-white">{link.label}</p>
                  <p className="mt-2 text-sm leading-7 text-zinc-400">
                    {link.href === "/about"
                      ? "Read what CGS is building and how the brand is positioned."
                      : link.href === "/contact"
                        ? "Use the contact page for questions, sponsorships, or support."
                        : "Review how CGS handles the information submitted through the site."}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12">
          <FAQSection
            title="Privacy FAQs"
            intro="A few quick answers about how details submitted through the site are handled."
            items={privacyFaqs}
          />
        </div>
      </section>
    </main>
  );
}
