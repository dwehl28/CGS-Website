"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import type { ScoreboardAdminActionState } from "@/app/clubhouse-admin/scoreboard/actions";
import { createCompetitionScoreboardAction } from "@/app/clubhouse-admin/scoreboard/actions";

const initialScoreboardAdminActionState: ScoreboardAdminActionState = {
  message: "",
};

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full border-0 disabled:opacity-70"
    >
      {pending ? "Saving..." : "Create scoreboard"}
    </button>
  );
}

export default function ScoreboardCompetitionComposer() {
  const [state, formAction] = useActionState(
    createCompetitionScoreboardAction,
    initialScoreboardAdminActionState
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message === "Competition scoreboard saved and ready for live scoring.") {
      formRef.current?.reset();
    }
  }, [state.message]);

  return (
    <form ref={formRef} action={formAction} className="mt-6 space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm text-zinc-300">Competition title</label>
          <input
            type="text"
            name="title"
            className="field-control"
            placeholder="Example: CGS Major"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">Slug</label>
          <input
            type="text"
            name="slug"
            className="field-control"
            placeholder="cgs-major-live"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm text-zinc-300">Summary</label>
        <textarea
          name="summary"
          rows={3}
          className="field-control"
          placeholder="Short intro for the public scoreboard page."
          required
        />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm text-zinc-300">Status label</label>
          <input
            type="text"
            name="status_label"
            className="field-control"
            placeholder="Live scoring"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">Round label</label>
          <input
            type="text"
            name="round_label"
            className="field-control"
            placeholder="Round 1"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">Format</label>
          <input
            type="text"
            name="format_label"
            className="field-control"
            placeholder="Stroke play"
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm text-zinc-300">Venue</label>
          <input
            type="text"
            name="location"
            className="field-control"
            placeholder="Waste Management Course"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">Start time</label>
          <input type="datetime-local" name="starts_at" className="field-control" />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm text-zinc-300">CTA label</label>
          <input
            type="text"
            name="cta_label"
            className="field-control"
            placeholder="View event"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">CTA link</label>
          <input
            type="text"
            name="cta_href"
            className="field-control"
            placeholder="/events/cgs-major"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-black/18 px-4 py-4 text-sm text-zinc-300">
          <input
            type="checkbox"
            name="is_live"
            className="h-4 w-4 accent-[var(--gold)]"
          />
          Mark this board as live right away.
        </label>

        <label className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-black/18 px-4 py-4 text-sm text-zinc-300">
          <input
            type="checkbox"
            name="is_published"
            className="h-4 w-4 accent-[var(--gold)]"
          />
          Publish it publicly as soon as it is saved.
        </label>
      </div>

      <SaveButton />

      {state.message ? (
        <p className="text-center text-sm leading-7 text-zinc-400">{state.message}</p>
      ) : null}
    </form>
  );
}
