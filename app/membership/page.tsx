"use client";

import { useState } from "react";

export default function MembershipPage() {
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
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
    <main className="min-h-screen bg-black text-white">
      <section className="px-6 py-16 max-w-6xl mx-auto">
        <h1 className="text-5xl font-black mb-4 text-center">Membership</h1>

        <p className="text-zinc-400 text-center max-w-2xl mx-auto mb-12">
          Join the Crossodog Golf Society community. Stay involved online or
          become a playing member for in-person events and member pricing.
        </p>

        <div className="grid md:grid-cols-2 gap-8 mb-14">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <p className="text-zinc-400 text-sm uppercase tracking-wide mb-2">
              Free Tier
            </p>
            <h2 className="text-3xl font-bold mb-3">Online Social</h2>
            <p className="text-zinc-300 mb-6">
              Perfect for people who want to follow CGS content, keep up with
              events, and be part of the online community.
            </p>

            <ul className="space-y-3 text-zinc-300 text-sm">
              <li>• Follow CGS updates</li>
              <li>• Stay in the loop with events</li>
              <li>• Connect with the CGS brand and content</li>
            </ul>
          </div>

          <div className="bg-zinc-900 border border-sky-400 rounded-2xl p-8">
            <p className="text-sky-400 text-sm uppercase tracking-wide mb-2">
              Paid Tier
            </p>
            <h2 className="text-3xl font-bold mb-3">Playing Member</h2>
            <p className="text-zinc-300 mb-6">
              Best for golfers who want to play in CGS events, access member
              pricing, and take part in the in-person side of the society.
            </p>

            <ul className="space-y-3 text-zinc-300 text-sm">
              <li>• Play in CGS events</li>
              <li>• Discounted event entry</li>
              <li>• Priority access to selected events</li>
            </ul>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">Join CGS</h2>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm text-zinc-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="Enter your full name"
                className="w-full rounded-xl bg-black border border-zinc-700 px-4 py-3 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                className="w-full rounded-xl bg-black border border-zinc-700 px-4 py-3 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-300 mb-2">
                Membership Type
              </label>
              <select
                name="membership_type"
                value={formData.membership_type}
                onChange={handleChange}
                className="w-full rounded-xl bg-black border border-zinc-700 px-4 py-3 text-white"
              >
                <option>Online Social</option>
                <option>Playing Member</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-zinc-300 mb-2">
                Handicap
              </label>
              <input
                type="text"
                name="handicap"
                value={formData.handicap}
                onChange={handleChange}
                placeholder="Enter your handicap"
                className="w-full rounded-xl bg-black border border-zinc-700 px-4 py-3 text-white"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-300 mb-2">
                Handicap Type
              </label>
              <select
                name="handicap_type"
                value={formData.handicap_type}
                onChange={handleChange}
                className="w-full rounded-xl bg-black border border-zinc-700 px-4 py-3 text-white"
              >
                <option>Real</option>
                <option>Sim</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-zinc-300 mb-2">
                Interested in playing events?
              </label>
              <select
                name="interested_in_events"
                value={formData.interested_in_events}
                onChange={handleChange}
                className="w-full rounded-xl bg-black border border-zinc-700 px-4 py-3 text-white"
              >
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-400 text-black py-3 rounded-full font-semibold disabled:opacity-70"
            >
              {loading ? "Submitting..." : "Submit Interest"}
            </button>

            {status && (
              <p className="text-center text-sm text-zinc-300">{status}</p>
            )}
          </form>
        </div>
      </section>
    </main>
  );
}