"use client";

import Link from "next/link";
import { useState } from "react";

import type { SelectOption } from "@/lib/site-content";

type EventInterestFormProps = {
  eventName: string;
  eventSlug: string;
  title: string;
  description: string;
  buttonLabel: string;
  options: SelectOption[];
  showHandicap: boolean;
};

export default function EventInterestForm({
  eventName,
  eventSlug,
  title,
  description,
  buttonLabel,
  options,
  showHandicap,
}: EventInterestFormProps) {
  const [formData, setFormData] = useState({
    event_name: eventName,
    event_slug: eventSlug,
    enquiry_type: options[0]?.value ?? "supporter",
    full_name: "",
    email: "",
    phone: "",
    membership_status: "not-a-member",
    handicap: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  function handleChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
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
      const response = await fetch("/api/event-interest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || "Something went wrong.");
        return;
      }

      setStatus(`Thanks. Your ${eventName} enquiry has been sent.`);
      setFormData({
        event_name: eventName,
        event_slug: eventSlug,
        enquiry_type: options[0]?.value ?? "supporter",
        full_name: "",
        email: "",
        phone: "",
        membership_status: "not-a-member",
        handicap: "",
        notes: "",
      });
    } catch (error) {
      console.error(error);
      setStatus("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel rounded-[2rem] p-8">
      <h2 className="text-3xl">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-zinc-400">{description}</p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Full Name
            </label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              className="field-control"
              placeholder="Enter your name"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="field-control"
              placeholder="Enter your email"
              required
            />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Interest Type
            </label>
            <select
              name="enquiry_type"
              value={formData.enquiry_type}
              onChange={handleChange}
              className="field-control"
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="field-control"
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Membership Status
            </label>
            <select
              name="membership_status"
              value={formData.membership_status}
              onChange={handleChange}
              className="field-control"
            >
              <option value="not-a-member">Not yet a member</option>
              <option value="online-social">Online Social member</option>
              <option value="playing-member">Playing member</option>
            </select>
          </div>

          {showHandicap ? (
            <div>
              <label className="mb-2 block text-sm text-zinc-300">
                Handicap
              </label>
              <input
                type="text"
                name="handicap"
                value={formData.handicap}
                onChange={handleChange}
                className="field-control"
                placeholder="Optional"
              />
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-sm text-zinc-300">
                Best role for you
              </label>
              <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-400">
                Tell CGS how you want to help in the notes below.
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={5}
            className="field-control"
            placeholder="Anything CGS should know?"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full border-0 disabled:opacity-70"
        >
          {loading ? "Sending..." : buttonLabel}
        </button>

        <p className="text-center text-sm leading-7 text-zinc-500">
          Your details are used so CGS can follow up about this event interest.
          Read the{" "}
          <Link href="/privacy" className="text-[var(--accent)]">
            privacy note
          </Link>
          .
        </p>

        {status && <p className="text-center text-sm text-zinc-300">{status}</p>}
      </form>
    </div>
  );
}
