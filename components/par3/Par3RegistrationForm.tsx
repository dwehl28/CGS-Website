"use client";

import {
  type FormEvent,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { Check, LoaderCircle, TicketCheck } from "lucide-react";

import type { Par3Snapshot } from "@/lib/par3-showdown-types";

type RegistrationFormProps = {
  maxPlayers: number;
  initialConfirmedPlayers: number;
  registrationsOpen: boolean;
  entryFeeCents: number;
};

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export default function Par3RegistrationForm({
  maxPlayers,
  initialConfirmedPlayers,
  registrationsOpen,
  entryFeeCents,
}: RegistrationFormProps) {
  const [confirmedPlayers, setConfirmedPlayers] = useState(
    initialConfirmedPlayers
  );
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const remainingSpots = Math.max(0, maxPlayers - confirmedPlayers);
  const soldOut = remainingSpots === 0;
  const acceptingRegistrations = registrationsOpen && !soldOut;
  const feeLabel = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(entryFeeCents / 100);

  const refreshAvailability = useEffectEvent(async () => {
    try {
      const response = await fetch("/api/par3-showdown", { cache: "no-store" });

      if (!response.ok) {
        return;
      }

      const snapshot = (await response.json()) as Par3Snapshot;
      setConfirmedPlayers(
        snapshot.players.filter((player) => !player.isWithdrawn).length
      );
    } catch {
      // The server-rendered availability remains visible if polling is interrupted.
    }
  });

  useEffect(() => {
    const interval = window.setInterval(
      () => void refreshAvailability(),
      10_000
    );

    return () => window.clearInterval(interval);
  }, []);

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setState({ status: "submitting" });

    try {
      const response = await fetch("/api/par3-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          phone: formData.get("phone"),
          teeCategory: formData.get("tee_category"),
          consent: formData.get("consent") === "on",
          website: formData.get("website"),
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        remainingSpots?: number;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Registration could not be saved.");
      }

      const nextRemaining = payload.remainingSpots ?? Math.max(0, remainingSpots - 1);
      setConfirmedPlayers(maxPlayers - nextRemaining);
      setState({
        status: "success",
        message: "You are on the Championship II list. CGS will confirm payment and event details with you.",
      });
      form.reset();
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Registration could not be saved.",
      });
    }
  }

  return (
    <div className="par3-v2-registration-card">
      <div className="par3-v2-availability" aria-live="polite">
        <span>{soldOut ? "Field status" : "Live availability"}</span>
        <strong>{soldOut ? "Sold out" : `${remainingSpots} spots left`}</strong>
        <p>
          {confirmedPlayers} of {maxPlayers} places claimed <i /> {feeLabel} entry
        </p>
        <div aria-hidden="true">
          <span
            style={{
              width: `${Math.min(100, (confirmedPlayers / maxPlayers) * 100)}%`,
            }}
          />
        </div>
      </div>

      {state.status === "success" ? (
        <div className="par3-v2-registration-success">
          <Check />
          <strong>Registration received</strong>
          <p>{state.message}</p>
          <button type="button" onClick={() => setState({ status: "idle" })}>
            Add another player
          </button>
        </div>
      ) : (
        <form onSubmit={submitRegistration}>
          <div className="par3-v2-form-heading">
            <TicketCheck />
            <div>
              <span>Join the field</span>
              <strong>Register for Championship II</strong>
            </div>
          </div>
          <label>
            Player name
            <input name="name" required minLength={2} maxLength={60} />
          </label>
          <label>
            Mobile number
            <input name="phone" type="tel" required />
          </label>
          <label>
            Tee category
            <select name="tee_category" defaultValue="championship">
              <option value="championship">Championship tees</option>
              <option value="ladies">Ladies - red tees</option>
              <option value="junior">Junior - front tees</option>
            </select>
          </label>
          <label className="par3-v2-honeypot" aria-hidden="true">
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <label className="par3-v2-consent">
            <input name="consent" type="checkbox" required />
            I consent to CGS using these details to organise this event.
          </label>
          {state.status === "error" ? (
            <p className="par3-v2-form-error" role="alert">
              {state.message}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={!acceptingRegistrations || state.status === "submitting"}
          >
            {state.status === "submitting" ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <TicketCheck />
            )}
            {soldOut
              ? "Sold out"
              : registrationsOpen
                ? `Claim a ${feeLabel} spot`
                : "Registrations closed"}
          </button>
        </form>
      )}
    </div>
  );
}
