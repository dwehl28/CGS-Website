"use client";

import Link from "next/link";
import { useState } from "react";

import FAQSection from "@/components/FAQSection";
import {
  clubhouseStats,
  membershipFaqs,
  membershipSteps,
  membershipTiers,
} from "@/lib/site-content";

export default function MembershipPageClient() {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    membership_type: "Online Social",
    handicap: "",
    handicap_type: "Real",
    interested_in_events: "Yes",
  });

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    try {
      const response = await fetch("/api/membership", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || "Something went wrong.");
      } else {
        setStatus("Thanks! Your membership interest has been submitted.");
        setFormData({
          full_name: "",
          email: "",
          membership_type: "Online Social",
          handicap: "",
          handicap_type: "Real",
          interested_in_events: "Yes",
        });
      }
    } catch (error) {
      console.error(error);
      setStatus("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen text-white">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-start">
          <div>
            <div className="eyebrow">Join the clubhouse</div>
            <h1 className="mt-6 text-5xl md:text-6xl">Membership</h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
              Join the Crossodog Golf Society community. Stay involved online or
              become a playing member for Season 2, in-person events, better
              access, and a deeper seat in the CGS story.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {clubhouseStats.slice(0, 4).map((stat) => (
                <div
                  key={stat.label}
                  className="stat-pill rounded-[1.35rem] px-4 py-4"
                >
                  <p className="text-2xl font-semibold text-white">{stat.value}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
            {membershipTiers.map((tier) => (
              <div
                key={tier.name}
                className={`panel rounded-[1.75rem] p-8 ${
                  tier.featured ? "panel-accent" : ""
                }`}
              >
                <p
                  className={`mb-2 text-sm uppercase tracking-wide ${
                    tier.featured ? "text-[var(--accent)]" : "text-zinc-400"
                  }`}
                >
                  {tier.featured ? "Paid tier" : "Free tier"}
                </p>
                <h2 className="mb-3 text-4xl">{tier.name}</h2>
                <p className="mb-4 text-[var(--tan)]">{tier.price}</p>
                <p className="mb-6 leading-7 text-zinc-300">{tier.summary}</p>

                <ul className="list-inside list-disc space-y-3 text-sm text-zinc-300">
                  {tier.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="panel rounded-[1.75rem] p-8">
            <div className="eyebrow">How joining works</div>
            <h2 className="mt-4 text-4xl">A simple path into CGS</h2>
            <p className="mt-4 max-w-xl leading-7 text-zinc-300">
              The goal is to make joining feel approachable. You do not need to
              know every event detail before raising your hand, especially with
              Season 2 already underway.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {membershipSteps.map((step, index) => (
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

        <div className="panel mx-auto mt-12 max-w-3xl rounded-[2rem] p-8 md:p-10">
          <h2 className="text-center text-3xl">Join CGS</h2>
          <p className="mt-3 text-center text-zinc-400">
            Submit your interest and the CGS team can follow up with the right
            membership and event details.
          </p>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Full Name
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  className="field-control"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  className="field-control"
                  required
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Membership Type
                </label>
                <select
                  name="membership_type"
                  value={formData.membership_type}
                  onChange={handleChange}
                  className="field-control"
                >
                  {membershipTiers.map((tier) => (
                    <option key={tier.name}>{tier.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Interested in playing events?
                </label>
                <select
                  name="interested_in_events"
                  value={formData.interested_in_events}
                  onChange={handleChange}
                  className="field-control"
                >
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Handicap
                </label>
                <input
                  type="text"
                  name="handicap"
                  value={formData.handicap}
                  onChange={handleChange}
                  placeholder="Enter your handicap"
                  className="field-control"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-300">
                  Handicap Type
                </label>
                <select
                  name="handicap_type"
                  value={formData.handicap_type}
                  onChange={handleChange}
                  className="field-control"
                >
                  <option>Real</option>
                  <option>Sim</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full border-0 disabled:opacity-70"
            >
              {loading ? "Submitting..." : "Submit Interest"}
            </button>

            <p className="text-center text-sm leading-7 text-zinc-500">
              CGS uses these details to follow up about membership and event
              interest. Read the{" "}
              <Link href="/privacy" className="text-[var(--accent)]">
                privacy note
              </Link>
              .
            </p>

            {status && (
              <p className="text-center text-sm text-zinc-300">{status}</p>
            )}
          </form>
        </div>

        <div className="mt-12">
          <FAQSection
            title="Membership FAQs"
            intro="A few quick answers for people deciding whether CGS is the right fit."
            items={membershipFaqs}
          />
        </div>
      </section>
    </main>
  );
}
