"use client";

import Link from "next/link";
import { useState } from "react";

import type { SelectOption } from "@/lib/site-content";

type ContactFormProps = {
  enquiryOptions: SelectOption[];
};

export default function ContactForm({ enquiryOptions }: ContactFormProps) {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    enquiry_type: enquiryOptions[0]?.value ?? "general",
    preferred_contact: "email",
    subject: "",
    message: "",
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
      const response = await fetch("/api/contact", {
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

      setStatus("Thanks. Your message has been sent to CGS.");
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        enquiry_type: enquiryOptions[0]?.value ?? "general",
        preferred_contact: "email",
        subject: "",
        message: "",
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
      <h2 className="text-3xl">Send a message</h2>
      <p className="mt-3 text-sm leading-7 text-zinc-400">
        Use this form for enquiries about events, sponsorships, merch, content,
        or anything else CGS-related.
      </p>

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

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Preferred Contact
            </label>
            <select
              name="preferred_contact"
              value={formData.preferred_contact}
              onChange={handleChange}
              className="field-control"
            >
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="either">Either</option>
            </select>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Enquiry Type
            </label>
            <select
              name="enquiry_type"
              value={formData.enquiry_type}
              onChange={handleChange}
              className="field-control"
            >
              {enquiryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">Subject</label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              className="field-control"
              placeholder="What do you need help with?"
              required
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">Message</label>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            rows={6}
            className="field-control"
            placeholder="Tell CGS what you're after"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full border-0 disabled:opacity-70"
        >
          {loading ? "Sending..." : "Send message"}
        </button>

        <p className="text-center text-sm leading-7 text-zinc-500">
          By sending a message, you are happy for CGS to use your details to
          reply about this enquiry. Read the{" "}
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
