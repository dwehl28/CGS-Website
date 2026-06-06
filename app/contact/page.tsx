import type { Metadata } from "next";

import ContactForm from "@/components/ContactForm";
import FAQSection from "@/components/FAQSection";
import PageIntro from "@/components/PageIntro";
import { buildMetadata } from "@/lib/seo";
import {
  contactFaqs,
  contactEnquiryOptions,
  partnershipReasons,
  siteConfig,
  socialLinks,
} from "@/lib/site-content";
import { buildFaqJsonLd, createJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = buildMetadata({
  title: "Contact",
  description:
    "Get in touch with Crossodog Golf Society about events, sponsorships, memberships, merch, and collaborations.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <main className="min-h-screen text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={createJsonLd(buildFaqJsonLd(contactFaqs))}
      />

      <section className="page-shell">
        <PageIntro
          eyebrow="Open line to CGS"
          title="Contact CGS"
          description="Use this page for event questions, memberships, sponsorships, merch, or general enquiries."
          align="center"
        />

        <div className="grid gap-8 md:grid-cols-2">
          <div className="panel rounded-[2rem] p-8">
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
              Email
            </p>
            <h2 className="mb-3 text-4xl">General enquiries</h2>
            <p className="mb-6 leading-7 text-zinc-300">
              For quick questions about CGS, membership, events, or general
              contact.
            </p>

            <a
              href={`mailto:${siteConfig.email}`}
              className="btn-primary"
            >
              {siteConfig.email}
            </a>
          </div>

          <div className="panel rounded-[2rem] p-8">
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.24em] text-[var(--tan)]">
              Partnerships
            </p>
            <h2 className="mb-3 text-4xl">Sponsors and collaborators</h2>
            <p className="mb-6 leading-7 text-zinc-300">
              Interested in partnering with CGS, sponsoring an event, or
              building branded content together? This is the lane for it.
            </p>

            <div className="grid gap-4">
              {partnershipReasons.map((reason) => (
                <div
                  key={reason.title}
                  className="subtle-grid-card rounded-[1.2rem] px-4 py-4"
                >
                  <h3 className="text-2xl">{reason.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">
                    {reason.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
          <ContactForm enquiryOptions={contactEnquiryOptions} />

          <div className="panel rounded-[2rem] p-8">
            <h2 className="text-3xl">Follow CGS</h2>

            <div className="mt-6 grid gap-4">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="subtle-grid-card rounded-[1.25rem] px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-wide text-[var(--accent)]">
                        {link.category}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {link.label}
                      </p>
                    </div>
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: link.accent }}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">
                    {link.description}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">{link.handle}</p>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12">
          <FAQSection
            title="Contact FAQs"
            intro="If you are not sure whether your question fits, this should help."
            items={contactFaqs}
          />
        </div>
      </section>
    </main>
  );
}
