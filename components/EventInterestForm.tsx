"use client";

import Link from "next/link";
import { useState } from "react";

import FormStatusMessage from "@/components/FormStatusMessage";
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
  const [statusKind, setStatusKind] = useState<"success" | "error">("success");

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
    setStatusKind("success");

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
        setStatusKind("error");
        setStatus(data.error || "Something went wrong.");
        return;
      }

      setStatusKind("success");
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
      setStatusKind("error");
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
          <div className="page-split-card rounded-[1.35rem] p-5">
            <label className="field-label">Full Name</label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              className="field-control"
              placeholder="Enter your name"
              autoComplete="name"
              required
            />
            <p className="field-hint">The name CGS should use when following up.</p>
          </div>

          <div className="page-split-card rounded-[1.35rem] p-5">
            <label className="field-label">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="field-control"
              placeholder="Enter your email"
              autoComplete="email"
              required
            />
            <p className="field-hint">This is the main contact point for event updates.</p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="page-split-card rounded-[1.35rem] p-5">
            <label className="field-label">Interest Type</label>
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
            <p className="field-hint">Choose whether you want to play, watch, or support.</p>
          </div>

          <div className="page-split-card rounded-[1.35rem] p-5">
            <label className="field-label">Phone Number</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="field-control"
              placeholder="Optional"
              autoComplete="tel"
            />
            <p className="field-hint">Optional, in case CGS needs a faster reply channel.</p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="page-split-card rounded-[1.35rem] p-5">
            <label className="field-label">Membership Status</label>
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
            <p className="field-hint">This helps CGS understand your current place in the club.</p>
          </div>

          {showHandicap ? (
            <div className="page-split-card rounded-[1.35rem] p-5">
              <label className="field-label">Handicap</label>
              <input
                type="text"
                name="handicap"
                value={formData.handicap}
                onChange={handleChange}
                className="field-control"
                placeholder="Optional"
              />
              <p className="field-hint">Only add this if it helps for the event format.</p>
            </div>
          ) : (
            <div className="page-split-card rounded-[1.35rem] p-5">
              <label className="field-label">Best role for you</label>
              <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-400">
                Tell CGS how you want to help in the notes below.
              </div>
              <p className="field-hint">Use the notes field to explain where you best fit.</p>
            </div>
          )}
        </div>

        <div className="page-split-card rounded-[1.35rem] p-5">
          <label className="field-label">Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={5}
            className="field-control"
            placeholder="Anything CGS should know?"
          />
          <p className="field-hint">
            Add availability, questions, or anything else that helps with follow-up.
          </p>
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

        {status ? <FormStatusMessage kind={statusKind} message={status} /> : null}
      </form>
    </div>
  );
}
