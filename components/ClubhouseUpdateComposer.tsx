"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import type { AdminActionState } from "@/app/clubhouse-admin/actions";
import { createClubhouseUpdateAction } from "@/app/clubhouse-admin/actions";

const initialAdminActionState: AdminActionState = {
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
      {pending ? "Saving..." : "Publish clubhouse update"}
    </button>
  );
}

export default function ClubhouseUpdateComposer() {
  const [state, formAction] = useActionState(
    createClubhouseUpdateAction,
    initialAdminActionState
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message === "Clubhouse update saved and pushed into the live feed.") {
      formRef.current?.reset();
    }
  }, [state.message]);

  return (
    <form ref={formRef} action={formAction} className="mt-6 space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm text-zinc-300">Title</label>
          <input
            type="text"
            name="title"
            className="field-control"
            placeholder="Example: Season 3 is underway"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">Status label</label>
          <input
            type="text"
            name="status_label"
            className="field-control"
            placeholder="Club update"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm text-zinc-300">Summary</label>
        <textarea
          name="summary"
          rows={4}
          className="field-control"
          placeholder="Short plain-English context for the live noticeboard."
          required
        />
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
            placeholder="/events/cgs-major or https://..."
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm text-zinc-300">
            Start date and time
          </label>
          <input
            type="datetime-local"
            name="starts_at"
            className="field-control"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-300">
            End date and time
          </label>
          <input
            type="datetime-local"
            name="ends_at"
            className="field-control"
          />
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-black/18 px-4 py-4 text-sm text-zinc-300">
        <input
          type="checkbox"
          name="is_pinned"
          className="h-4 w-4 accent-[var(--gold)]"
        />
        Pin this update so it stays near the top of the live noticeboard.
      </label>

      <SaveButton />

      {state.message ? (
        <p className="text-center text-sm leading-7 text-zinc-400">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
