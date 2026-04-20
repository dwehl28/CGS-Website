"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { AdminActionState } from "@/app/clubhouse-admin/actions";
import { loginAdminAction } from "@/app/clubhouse-admin/actions";

const initialAdminActionState: AdminActionState = {
  message: "",
};

function LoginButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full border-0 disabled:opacity-70"
    >
      {pending ? "Checking..." : "Open admin"}
    </button>
  );
}

export default function ClubhouseAdminLogin() {
  const [state, formAction] = useActionState(
    loginAdminAction,
    initialAdminActionState
  );

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <label className="mb-2 block text-sm text-zinc-300">
          Admin passcode
        </label>
        <input
          type="password"
          name="secret"
          className="field-control"
          placeholder="Enter the CGS admin passcode"
          required
        />
      </div>

      <LoginButton />

      {state.message ? (
        <p className="text-center text-sm leading-7 text-zinc-400">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
