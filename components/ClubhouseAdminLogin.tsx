"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { AdminActionState } from "@/app/clubhouse-admin/actions";
import { loginAdminAction } from "@/app/clubhouse-admin/actions";
import FormStatusMessage from "@/components/FormStatusMessage";

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
      <div className="page-split-card rounded-[1.35rem] p-5">
        <label className="field-label" htmlFor="admin-username">
          Username
        </label>
        <input
          id="admin-username"
          type="text"
          name="username"
          className="field-control"
          placeholder="admin"
          autoComplete="username"
          required
        />
      </div>

      <div className="page-split-card rounded-[1.35rem] p-5">
        <label className="field-label" htmlFor="admin-password">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          name="password"
          className="field-control"
          placeholder="admin"
          autoComplete="current-password"
          required
        />
        <p className="field-hint">
          This hidden route is for quick homepage notices and scoreboard control.
        </p>
      </div>

      <LoginButton />

      {state.message ? (
        <FormStatusMessage kind="error" message={state.message} />
      ) : null}
    </form>
  );
}
