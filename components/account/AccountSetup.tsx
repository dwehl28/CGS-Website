"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

import styles from "./AccountSetup.module.css";

type Phase = "checking" | "ready" | "unavailable" | "success";

const expiredMessage =
  "This setup link is missing, has expired, or has already been used. Ask CGS for a new account setup link, or sign in if you have already chosen a password.";

function clearAuthFragment() {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  if (fragment.has("access_token") || fragment.has("error") || fragment.has("error_code")) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
}

export default function AccountSetup() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const verifiedUserId = useRef<string | null>(null);
  const linkHasError = useRef<boolean | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    async function checkSetupSession() {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const query = new URLSearchParams(window.location.search);
      linkHasError.current ??= [fragment, query].some(
        (params) => params.has("error") || params.has("error_code"),
      );

      if (linkHasError.current) {
        clearAuthFragment();
        if (active) {
          setError(expiredMessage);
          setPhase("unavailable");
        }
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (active) {
          setError("Account setup is temporarily unavailable. Please contact CGS for help.");
          setPhase("unavailable");
        }
        return;
      }

      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (active && event === "SIGNED_OUT") {
          verifiedUserId.current = null;
          setError(expiredMessage);
          setPhase("unavailable");
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();

      try {
        // getSession waits for the browser client to consume the invitation or recovery URL.
        const sessionResult = await supabase.auth.getSession();
        clearAuthFragment();
        if (sessionResult.error || !sessionResult.data.session) {
          if (active) {
            setError(expiredMessage);
            setPhase("unavailable");
          }
          return;
        }

        const userResult = await supabase.auth.getUser();
        if (!active) return;
        if (userResult.error || !userResult.data.user) {
          setError(expiredMessage);
          setPhase("unavailable");
          return;
        }

        verifiedUserId.current = userResult.data.user.id;
        setEmail(userResult.data.user.email ?? "");
        setPhase("ready");
      } catch {
        clearAuthFragment();
        if (active) {
          setError("We couldn't check your setup link. Check your connection and open the link again.");
          setPhase("unavailable");
        }
      }
    }

    void checkSetupSession();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || phase !== "ready") return;
    setError("");

    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Your passwords don't match. Please enter them again.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Account setup is temporarily unavailable. Please contact CGS for help.");
      return;
    }

    setSaving(true);
    try {
      const userResult = await supabase.auth.getUser();
      if (
        userResult.error ||
        !userResult.data.user ||
        userResult.data.user.id !== verifiedUserId.current
      ) {
        setError(expiredMessage);
        setPhase("unavailable");
        return;
      }

      const result = await supabase.auth.updateUser({ password });
      if (result.error) {
        if (result.error.code === "weak_password") {
          setError("Choose a stronger password. Try a longer password with uppercase and lowercase letters, numbers and symbols.");
        } else if (result.error.code === "same_password") {
          setError("Choose a different password from the one you already use for CGS.");
        } else if (result.error.status === 401 || result.error.status === 403) {
          setError("Your session needs to be verified again. Reopen your setup email or ask CGS for a fresh link.");
          setPhase("unavailable");
        } else {
          setError("We couldn't save your password. Please try again, or contact CGS if this continues.");
        }
        return;
      }

      setPassword("");
      setConfirmation("");
      setPhase("success");
    } catch {
      setError("We couldn't save your password. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="account-setup-title">
        <p className={styles.eyebrow}>CGS Golf</p>
        <h1 id="account-setup-title">
          {phase === "success" ? "You're ready to sign in" : "Set your CGS password"}
        </h1>

        {phase === "checking" && <p role="status">Checking your account setup link…</p>}

        {phase === "ready" && (
          <>
            <p>
              Choose a password for your CGS account
              {email ? <>: <strong className={styles.email}>{email}</strong></> : "."}
            </p>
            <form onSubmit={savePassword} className={styles.form} noValidate aria-busy={saving}>
              <label htmlFor="setup-password">New password</label>
              <input
                id="setup-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby="password-guidance"
                disabled={saving}
              />
              <p id="password-guidance" className={styles.hint}>
                Use at least 8 characters. A long, unique password is best.
              </p>

              <label htmlFor="setup-confirmation">Confirm password</label>
              <input
                id="setup-confirmation"
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={saving}
              />

              {error && <p className={styles.error} role="alert">{error}</p>}
              <button type="submit" disabled={saving}>
                {saving ? "Saving your password…" : "Save password"}
              </button>
            </form>
          </>
        )}

        {phase === "unavailable" && (
          <p className={styles.error} role="alert">{error}</p>
        )}

        {phase === "success" && (
          <div role="status">
            <p>
              Your password has been saved. Use your email address and this password
              whenever you sign in to CGS.
            </p>
            <Link href="/play" className={styles.primaryLink}>
              Continue to your CGS account
            </Link>
          </div>
        )}

        {phase !== "success" && (
          <Link href="/play" className={styles.signInLink}>Already set up? Sign in</Link>
        )}
      </section>
    </main>
  );
}
