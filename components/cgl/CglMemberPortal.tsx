"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CreditCard,
  Gift,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Wallet,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { annualRanking } from "@/lib/cgl-engine";
import {
  CglEmpty,
  CglHeading,
  CglPerformanceHighlights,
} from "./CglPublicExperience";
import {
  aud,
  date,
  num,
  row,
  rows,
  str,
  availableWeek,
  type CglSnapshot,
} from "./cgl-ui";
import s from "./Cgl2027.module.css";

const tabs = [
  "Overview",
  "Performance",
  "Membership",
  "Rewards",
  "Profile",
  "Notifications",
];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Browser persistence is only for request recovery, never proof of payment. */
export function cglCheckoutStorageKey(accountId: string, planCode: string, seasonId = "") {
  return `cgl-square:v1:${accountId}:${planCode}:${seasonId || "none"}`;
}

export function cglPlanRequiresSeason(planCode: string) {
  return planCode === "casual_season";
}

export function getCglCheckoutRequestKey(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  scope: string,
  fallback?: string,
) {
  try {
    const saved = storage?.getItem(scope);
    if (saved && uuidPattern.test(saved)) return saved;
  } catch { /* Storage may be disabled; server idempotency remains authoritative. */ }
  const key = fallback && uuidPattern.test(fallback) ? fallback : crypto.randomUUID();
  try { storage?.setItem(scope, key); } catch { /* Retain the in-memory key. */ }
  return key;
}

export function isCglSquareHostedCheckoutUrl(value: string) {
  try {
    const target = new URL(value);
    return target.protocol === "https:" && (
      target.hostname === "square.link" ||
      target.hostname === "sandbox.square.link" ||
      target.hostname.endsWith(".square.site") ||
      target.hostname.endsWith(".squareup.com") ||
      target.hostname.endsWith(".squareupsandbox.com") ||
      target.hostname === "squareupsandbox.com"
    );
  } catch {
    return false;
  }
}

export function CglSandboxBilling({ billing, ready, busy, syncing, message, onRefresh }: {
  billing: CglSnapshot;
  ready: boolean;
  busy: boolean;
  syncing: boolean;
  message: string;
  onRefresh: () => void;
}) {
  const memberships = rows(billing.memberships);
  const payments = rows(billing.payments);
  const checkouts = rows(billing.checkouts);
  const seasonEntitlements = rows(billing.seasonEntitlements);
  const isTest = str(billing.environment, "sandbox") !== "production";
  const prefix = isTest ? "TEST · " : "";
  return (
    <section className={s.section} aria-labelledby="cgl-square-billing-title">
      <div className={s.sectionHead}>
        <div>
          <span className={s.badge}>{isTest ? "TEST · Square Sandbox" : "Square · Secure live payments"}</span>
          <h2 id="cgl-square-billing-title" style={{ fontSize: 25, marginTop: 12 }}>{isTest ? "Your test billing" : "Your Square billing"}</h2>
        </div>
        <button type="button" className={s.smallButton} disabled={syncing || busy || !ready || row(billing.readiness).configured !== true} onClick={onRefresh}>
          <RefreshCw size={14} aria-hidden="true" />
          {syncing ? "Checking Square…" : `Refresh Square ${isTest ? "test " : ""}payments`}
        </button>
      </div>
      <div className={s.notice}>{isTest
        ? "Test subscriptions and payments do not activate a real membership, competition access, gifts or rewards. They are excluded from real revenue."
        : "Square confirms each payment before CGL updates your access. Returning from checkout alone is not proof of payment."}</div>
      {message ? <p className={s.notice} role="status" aria-live="polite">{message}</p> : null}
      {memberships.length ? (
        <div className={s.grid2}>
          {memberships.map((membership) => (
            <article className={s.panel} key={str(membership.id)}>
              <span className={s.badge}>{isTest ? "TEST" : "SQUARE"}</span>
              <h3 style={{ marginTop: 12 }}>{str(membership.plan_code).replaceAll("_", " ")}</h3>
              <p>{isTest ? "Test status" : "Status"}: <strong>{str(membership.state)}</strong></p>
              <dl className={s.muted}>
                <dt>{isTest ? "Test paid-through" : "Paid-through"}</dt><dd>{date(membership.paid_through)}</dd>
                <dt>{isTest ? "Next test payment" : "Next payment"}</dt><dd>{membership.next_billing_at ? date(membership.next_billing_at) : isTest ? "No confirmed recurring test date" : "No recurring payment scheduled"}</dd>
              </dl>
              {membership.state === "past_due" || membership.failed_at ? (
                <p className={s.notice}>Your {isTest ? "test " : ""}payment needs attention. Refresh the records or contact CGS for review.{isTest ? " A replacement-card flow is not yet available, and this does not change real competition eligibility." : ""}</p>
              ) : null}
            </article>
          ))}
        </div>
      ) : <p className={s.muted}>No Square {isTest ? "test " : ""}membership has been recorded for your account.</p>}
      {checkouts.length ? (
        <div className={s.tableWrap} style={{ marginTop: 20 }}>
          <table className={s.table}>
            <caption className={s.fine}>Your {isTest ? "TEST " : ""}checkout requests</caption>
            <thead><tr>{["Created", "Plan", "Amount", isTest ? "Test status" : "Status"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{checkouts.map((intent) => (
              <tr key={str(intent.id)}><td>{date(intent.created_at, true)}</td><td>{str(intent.plan_code).replaceAll("_", " ")}</td><td>{aud(intent.amount_cents)}</td><td>{prefix}{str(intent.state)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
      <h3 style={{ marginTop: 25 }}>{isTest ? "TEST payment history" : "Square payment history"}</h3>
      <p className={s.fine}>{isTest ? "These are test payment records, not receipts. Square Sandbox does not send receipt emails." : "Confirmed Square payments are also included in your main payment history below."}</p>
      {payments.length ? (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr>{["Date", isTest ? "Test amount" : "Amount", isTest ? "Test status" : "Status", "Reference"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{payments.map((payment) => (
              <tr key={str(payment.id)}><td>{date(payment.paid_at ?? payment.created_at)}</td><td>{aud(payment.amount_cents)}</td><td>{prefix}{str(payment.state)}</td><td>{str(payment.external_id ?? payment.id)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className={s.muted}>No {isTest ? "TEST " : ""}payments recorded. Returning from Square does not confirm payment.</p>}
      {seasonEntitlements.length ? (
        <>
          <h3 style={{ marginTop: 25 }}>{isTest ? "TEST season purchases" : "Season purchases"}</h3>
          <p className={s.fine}>{isTest ? "These test purchases do not enter you into a real CGL season." : "These purchases provide access only to the named season and do not automatically renew."}</p>
          <ul>{seasonEntitlements.map((entry) => (
            <li key={str(entry.id ?? entry.season_id)}>{prefix}{str(entry.season_name ?? entry.season_id, "Selected season")} · {str(entry.state, "confirmed")}</li>
          ))}</ul>
        </>
      ) : null}
    </section>
  );
}

export function CglSquareQuoteSummary({ quote }: { quote: CglSnapshot }) {
  const intervals: Record<string, string> = { annual: "year", monthly: "month", weekly: "week" };
  const isTest = str(quote.environment ?? row(quote.readiness).environment, "sandbox") !== "production";
  return (
    <div className={s.notice}>
      <strong>Payment summary{isTest ? " · TEST" : ""}</strong>
      <p>{isTest ? "Initial test charge" : "Charge today"}: {aud(quote.amountCents)}</p>
      <p>Currency: AUD</p>
      <p>{quote.recurring === true
        ? `Automatic ${isTest ? "test " : ""}renewal: ${aud(quote.amountCents)} every ${intervals[str(quote.billingInterval)] ?? "confirmed billing period"}. Square shows the exact next billing date before authorisation.`
        : `One-off ${isTest ? "test " : ""}payment. This purchase does not automatically renew.`}</p>
      <p>{str(quote.notice ?? quote.disclosure, `Review the amount and membership disclosures before authorising this ${isTest ? "test " : ""}payment.`)}</p>
      {row(quote.readiness).ready !== true ? <p>Square {isTest ? "Sandbox " : "production "}configuration or approval is still pending. You can review this quote, but payment confirmation is unavailable.</p> : null}
      <label style={{ display: "flex", gap: 10 }}>
        <input required type="checkbox" name="terms" />I have reviewed the displayed payment and membership terms.
      </label>
    </div>
  );
}

export default function CglMemberPortal({ join = false }: { join?: boolean }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const [data, setData] = useState<CglSnapshot>({ status: "loading" });
  const [tab, setTab] = useState("Overview");
  const [mode, setMode] = useState(join ? "register" : "login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [cancelQuote, setCancelQuote] = useState<CglSnapshot | null>(null);
  const [checkoutQuote, setCheckoutQuote] = useState<CglSnapshot | null>(null);
  const [billingSyncing, setBillingSyncing] = useState(false);
  const [billingMessage, setBillingMessage] = useState("");
  const checkoutKeys = useRef(new Map<string, string>());
  const accountId = useRef<string | null>(null);
  const returnSync = useRef({ owner: "", checkoutId: "", attempts: 0 });
  const [redeemItem, setRedeemItem] = useState("");
  const [redemptionKey, setRedemptionKey] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("annual");
  const [selectedSeason, setSelectedSeason] = useState("");
  const loadSequence = useRef(0);
  const load = useCallback(async (token: string, signal?: AbortSignal) => {
    const sequence = ++loadSequence.current;
    try {
      const response = await fetch("/api/cgl/member", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal,
      });
      const result = await response.json();
      if (sequence === loadSequence.current) setData(result);
      return result as CglSnapshot;
    } catch (error) {
      if (
        sequence === loadSequence.current &&
        !(error instanceof Error && error.name === "AbortError")
      )
        setData({
          status: "error",
          message: "Your clubhouse could not be loaded. Please try again.",
        });
      return null;
    }
  }, []);
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setTimeout(() => {
        setChecked(true);
        setMessage("Account sign-in is not configured in this environment.");
        setFailed(true);
      }, 0);
      return;
    }
    const controller = new AbortController();
    let active = true;
    client.auth.getSession().then(({ data: auth }) => {
      if (!active) return;
      accountId.current = auth.session?.user.id ?? null;
      setSession(auth.session);
      setChecked(true);
      if (auth.session) void load(auth.session.access_token, controller.signal);
    });
    const { data: subscription } = client.auth.onAuthStateChange(
      (_event, current) => {
        if (accountId.current !== (current?.user.id ?? null)) {
          setCheckoutQuote(null);
          setCancelQuote(null);
          setBillingMessage("");
          setBillingSyncing(false);
        }
        accountId.current = current?.user.id ?? null;
        ++loadSequence.current;
        setData({ status: "loading" });
        setSession(current);
        setChecked(true);
        if (current) void load(current.access_token, controller.signal);
      },
    );
    const requested = new URLSearchParams(window.location.search).get("tab");
    const requestedPlan = new URLSearchParams(window.location.search).get(
      "plan",
    );
    if (
      requestedPlan &&
      [
        "annual",
        "monthly",
        "weekly",
        "casual_registration",
        "casual_season",
      ].includes(requestedPlan)
    )
      setTimeout(() => {
        setSelectedPlan(requestedPlan);
        if (!cglPlanRequiresSeason(requestedPlan)) setSelectedSeason("");
        setTab("Membership");
      }, 0);
    if (requested)
      setTimeout(
        () =>
          setTab(tabs.find((t) => t.toLowerCase() === requested) ?? "Overview"),
        0,
      );
    return () => {
      active = false;
      controller.abort();
      subscription.subscription.unsubscribe();
    };
  }, [load]);
  useEffect(() => {
    const checkoutId = new URLSearchParams(window.location.search).get("checkout");
    if (!session || !checkoutId || !uuidPattern.test(checkoutId)) return;
    const owner = session.user.id;
    const token = session.access_token;
    if (returnSync.current.owner !== owner || returnSync.current.checkoutId !== checkoutId) {
      returnSync.current = { owner, checkoutId, attempts: 0 };
    }
    if (returnSync.current.attempts >= 6) return;
    const controller = new AbortController();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (cancelled || returnSync.current.attempts >= 6) return;
      returnSync.current.attempts += 1;
      setBillingSyncing(true);
      try {
        const response = await fetch("/api/cgl/billing/sync", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ checkoutId }),
          signal: controller.signal,
        });
        const result = await response.json();
        const isTest = result.environment !== "production";
        if (!response.ok) throw new Error(str(result.message ?? result.error, `Your Square ${isTest ? "test " : ""}payment could not be checked. Refresh it below or contact CGS.`));
        const snapshot = await load(token, controller.signal);
        if (cancelled) return;
        const intent = rows(row(snapshot?.billing).checkouts).find((item) => item.id === checkoutId);
        if (intent && ["completed", "review", "cancelled"].includes(str(intent.state))) {
          setBillingMessage(intent.state === "completed"
            ? isTest ? "Your Square test payment is confirmed. This test does not activate a real membership." : "Your Square payment is confirmed and your account has been updated."
            : `Your Square ${isTest ? "test " : ""}checkout needs CGS review.`);
          return;
        }
        if (returnSync.current.attempts < 6) {
          setBillingMessage(`Checking your Square ${isTest ? "test " : ""}payment. Returning from checkout is not confirmation of payment.`);
          timer = setTimeout(() => { void poll(); }, 3_000);
        } else {
          setBillingMessage(`Your Square ${isTest ? "test " : ""}payment is still pending. Use Refresh Square payments below to check again.`);
        }
      } catch (error) {
        if (!cancelled) setBillingMessage(error instanceof Error ? error.message : "Your Square test payment could not be checked. Refresh it below.");
      } finally {
        if (!cancelled) setBillingSyncing(false);
      }
    };
    timer = setTimeout(() => {
      setTab("Membership");
      setBillingMessage("Checking your Square payment. Returning from checkout is not confirmation of payment.");
      void poll();
    }, 0);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [session, load]);

  async function refreshSquareTestPayments() {
    if (!session || billingSyncing) return;
    const owner = session.user.id;
    setBillingSyncing(true);
    setBillingMessage("");
    try {
      const response = await fetch("/api/cgl/billing/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      const isTest = result.environment !== "production";
      if (!response.ok) throw new Error(str(result.message ?? result.error, `Square ${isTest ? "test " : ""}payments could not be refreshed.`));
      if (accountId.current !== owner) return;
      await load(session.access_token);
      if (accountId.current === owner) setBillingMessage(str(result.message, isTest ? "Square test payment check completed. Review the current TEST records below; no real membership has been activated." : "Square payment check completed. Review the confirmed records below."));
    } catch (error) {
      if (accountId.current === owner) setBillingMessage(error instanceof Error ? error.message : "Square test payments could not be refreshed.");
    } finally {
      if (accountId.current === owner) setBillingSyncing(false);
    }
  }
  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setFailed(false);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("CGS sign-in is not configured.");
      if (mode === "register") {
        if (password !== String(form.get("confirm_password") ?? ""))
          throw new Error("Your passwords do not match.");
        const { data: auth, error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/cgl/dashboard`,
          },
        });
        if (error) throw error;
        if (!auth.session)
          setMessage(
            "Check your email to verify your CGS account, then sign in here. Existing testers can use their account setup invitation.",
          );
        else
          setMessage("Your CGS account is ready. Add your CGL profile below.");
      } else {
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setMessage("");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Sign-in could not be completed.",
      );
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  async function command(action: string, values: Record<string, unknown> = {}) {
    if (!session) return null;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const response = await fetch("/api/cgl/member", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, ...values }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          str(result.message ?? result.error, "The change could not be saved."),
        );
      setMessage(
        action === "quote_cancellation"
          ? ""
          : str(result.message, "Saved to your CGS account."),
      );
      await load(session.access_token);
      return { ...row(result.result), message: result.message } as CglSnapshot;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The change could not be saved.",
      );
      setFailed(true);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const planCode = String(form.get("plan"));
      const seasonId =
        cglPlanRequiresSeason(planCode) ? String(form.get("season") ?? "") : "";
      if (cglPlanRequiresSeason(planCode) && !uuidPattern.test(seasonId)) {
        throw new Error("Choose an open season for the $100 Season Pass.");
      }
      if (checkoutQuote && row(checkoutQuote.readiness).ready !== true) {
        throw new Error("Square setup or the required payment disclosures are still pending. No payment has been taken.");
      }
      const scope = cglCheckoutStorageKey(session.user.id, planCode, seasonId);
      let storage: Storage | null = null;
      try { storage = window.sessionStorage; } catch { /* Private browsing may restrict storage. */ }
      const requestKey = getCglCheckoutRequestKey(storage, scope, checkoutKeys.current.get(scope));
      checkoutKeys.current.set(scope, requestKey);
      const response = await fetch(
        checkoutQuote
          ? "/api/cgl/checkout"
          : `/api/cgl/checkout?${new URLSearchParams({ planCode, ...(seasonId ? { seasonId } : {}) })}`,
        checkoutQuote
          ? {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                planCode,
                seasonId: seasonId || undefined,
                requestKey,
                termsAccepted: form.get("terms") === "on",
                acceptedAmountCents: checkoutQuote.amountCents,
              }),
            }
          : {
              headers: { Authorization: `Bearer ${session.access_token}` },
              cache: "no-store",
            },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          str(result.message ?? result.error, "Checkout is not yet available."),
        );
      const url = result.checkoutUrl ?? result.url;
      if (typeof url === "string") {
        if (!isCglSquareHostedCheckoutUrl(url))
          throw new Error("Square returned an unexpected checkout address.");
        window.location.assign(url);
      } else {
        setCheckoutQuote(result);
        setMessage(
          str(
            result.message,
            `Review your payment details before continuing to Square${result.environment === "sandbox" ? " Sandbox" : ""}.`,
          ),
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Checkout could not be prepared.",
      );
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  const member = row(data.member);
  const billing = row(data.billing);
  const billingIsTest = str(billing.environment, "sandbox") !== "production";
  const checkoutReadiness = row(checkoutQuote?.readiness ?? billing.readiness);
  const cancellationPolicyApproved = billing.cancellationPolicyApproved === true;
  const memberships = rows(data.memberships);
  const membership =
    memberships.find((m) =>
      ["active", "past_due", "cancel_scheduled"].includes(str(m.state, "")),
    ) ?? memberships[0];
  const credits = row(data.credits);
  const division = rows(data.divisions)[0];
  const results = rows(data.results);
  const standings = rows(data.standings)[0];
  const available = rows(data.weeks).filter(availableWeek);
  const ready = data.status === "ready";
  const formula = row(row(data.settings).annual_formula);
  const annualYear = Math.max(
    2027,
    ...rows(data.seasons).map((season) => num(season.year)),
  );
  const annualPoints = annualRanking(
    rows(data.standings)
      .filter((standing) =>
        rows(data.seasons).some(
          (season) =>
            season.id === standing.season_id && season.year === annualYear,
        ),
      )
      .map((standing) => ({
        seasonId: str(standing.season_id),
        points: num(standing.total_points),
      })),
    {
      approved: formula.approved === true,
      method:
        formula.method === "sum" || formula.method === "best_seasons"
          ? formula.method
          : "pending",
      countedSeasons: num(formula.counted_seasons) || 4,
    },
  );
  const notice = message ? (
    <div
      role={failed ? "alert" : "status"}
      className={`${s.notice} ${failed ? s.error : s.success}`}
    >
      {message}
    </div>
  ) : null;
  if (!checked)
    return (
      <div className={s.page}>
        <CglEmpty title="Opening your clubhouse…">
          Checking your CGS account securely.
        </CglEmpty>
      </div>
    );
  if (!session)
    return (
      <div className={s.page}>
        <CglHeading
          label="Your CGS account"
          title={
            join
              ? "Your next season starts here."
              : "Welcome to your clubhouse."
          }
        >
          Use your CGS account to follow your CGL results, manage membership and
          enjoy your rewards.
        </CglHeading>
        <div className={`${s.panel} ${s.login}`}>
          <div
            className={s.authToggle}
            role="tablist"
            aria-label="Account access"
          >
            <button
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => setMode("login")}
            >
              Sign in
            </button>
            <button
              role="tab"
              aria-selected={mode === "register"}
              onClick={() => setMode("register")}
            >
              Create CGS account
            </button>
          </div>
          <form className={s.vertical} onSubmit={authenticate}>
            <label className={s.field}>
              Email address
              <input
                required
                type="email"
                name="email"
                autoComplete="email"
                maxLength={254}
              />
            </label>
            <label className={s.field}>
              Password
              <input
                required
                type="password"
                name="password"
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                minLength={8}
                maxLength={128}
              />
              <small>At least eight characters.</small>
            </label>
            {mode === "register" ? (
              <>
                <label className={s.field}>
                  Confirm password
                  <input
                    required
                    type="password"
                    name="confirm_password"
                    autoComplete="new-password"
                    minLength={8}
                  />
                </label>
                <p className={s.muted}>
                  Creating a CGS account does not start a paid membership. Final
                  CGL membership terms and checkout are reviewed separately.
                </p>
              </>
            ) : null}
            <button className={s.primary} disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "register"
                  ? "Create account"
                  : "Sign in"}
              <ArrowRight size={14} />
            </button>
          </form>
          {notice}
          <p className={s.fine}>
            Trial player? Use the password you chose through your CGS setup
            invitation. An invitation without a chosen password does not give
            you a sign-in password.
          </p>
          <div className={s.actions}>
            <Link className={s.textLink} href="/account/setup">
              Account setup help
            </Link>
            <Link className={s.textLink} href="/cgl/trial">
              Browse public trial results
            </Link>
          </div>
        </div>
      </div>
    );
  return (
    <div className={s.page}>
      <div className={s.sectionHead}>
        <CglHeading
          label="My clubhouse"
          title={`Welcome${member.sgt_username ? `, ${str(member.sgt_username)}` : " to CGL"}.`}
        >
          Your season, your results and everything you have earned along the
          way.
        </CglHeading>
        <button
          className={s.smallButton}
          onClick={() => {
            void getSupabaseBrowserClient()?.auth.signOut();
            setData({ status: "loading" });
            setMessage("");
          }}
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
      <div className={s.tabs} role="tablist" aria-label="Your clubhouse">
        {tabs.map((t) => (
          <button
            role="tab"
            key={t}
            aria-selected={tab === t}
            onClick={() => {
              setTab(t);
              setCancelQuote(null);
            }}
          >
            {t}
            {t === "Notifications" &&
            rows(data.notifications).some((n) => n.state !== "read")
              ? " •"
              : ""}
          </button>
        ))}
      </div>
      {notice}
      {!ready ? (
        <div className={s.notice} role="status">
          {data.status === "loading"
            ? "Loading your member information…"
            : str(
                data.message,
                "The CGL 2027 database is awaiting setup in this environment. Your existing CGS account and trial access are preserved.",
              )}
        </div>
      ) : null}
      {ready && data.joined !== true ? (
        <article className={s.panel}>
          <h2>Make it your clubhouse.</h2>
          <p>
            Add a CGL profile to this CGS account. This does not purchase a
            membership or change your trial results.
          </p>
          <div className={s.actions}>
            <button
              className={s.primary}
              disabled={busy}
              onClick={() => void command("join")}
            >
              Create my CGL profile
              <ArrowRight size={14} />
            </button>
          </div>
        </article>
      ) : null}
      {tab === "Overview" ? (
        <>
          <div className={s.miniStats}>
            {[
              [
                "Membership",
                membership ? str(membership.state) : ready ? "Not joined" : "—",
                membership
                  ? str(membership.plan_code)
                  : "Choose a plan when sales open",
              ],
              [
                "Division / handicap",
                `${str(division?.division ?? division?.division_code)} / ${str(member.verified_handicap ?? member.handicap)}`,
                str(
                  member.handicap_verified_at
                    ? `Verified ${date(member.handicap_verified_at)}`
                    : "Handicap verification pending",
                ),
              ],
              [
                "Championship points",
                str(standings?.total_points ?? standings?.points),
                standings?.position
                  ? `Division position #${str(standings.position)} · Best eight of ten`
                  : "Best eight of ten weekly results",
              ],
              [
                "CGS Credits",
                ready ? str(credits.available, "0") : "—",
                "Your balance stays with your account",
              ],
            ].map(([title, value, detail]) => (
              <article key={title} className={s.metric}>
                <span>{title}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </div>
          <div className={s.grid2}>
            <article className={s.panel}>
              <div className={s.eyebrow}>On the tee</div>
              <h2>
                {available.length
                  ? str(available[0].name, "Your next competition")
                  : "Your next challenge is coming."}
              </h2>
              <p>
                {available.length
                  ? `Closes ${date(available[0].closes_at, true)}. Check your membership and handicap eligibility before playing.`
                  : "Available rounds will appear here when the season opens. You can follow the separate SGT trial now."}
              </p>
              <div className={s.actions}>
                <Link
                  href={available.length ? "/cgl/competition" : "/cgl/trial"}
                  className={s.primary}
                >
                  {available.length ? "View competition" : "Open trial hub"}
                  <ArrowRight size={14} />
                </Link>
              </div>
            </article>
            <article className={s.panel}>
              <div className={s.eyebrow}>The championship</div>
              <h2>Your best eight</h2>
              <p>
                {results.length
                  ? `${results.length} imported weekly result${results.length === 1 ? "" : "s"}. Points are counted after verification and publication.`
                  : "No published 2027 results yet. Your two lowest weekly points totals will be discarded."}
              </p>
              <div
                className={s.progress}
                aria-label={`${Math.min(num(standings?.rounds_counted), 8)} of eight results counted`}
              >
                {Array.from({ length: 10 }, (_, i) => (
                  <span
                    key={i}
                    data-counted={
                      i < Math.min(num(standings?.rounds_counted), 8)
                    }
                  />
                ))}
              </div>
              <Link className={s.textLink} href="/cgl/leaderboard">
                View your division
                <ArrowRight size={13} />
              </Link>
            </article>
            <article className={s.panel}>
              <ShieldCheck size={22} />
              <h2 style={{ marginTop: 15 }}>Your SGT connection</h2>
              <p>
                {member.sgt_username
                  ? `${str(member.sgt_username)} · ${str(member.sgt_verified_at ? "Verified" : "Awaiting verification", "Awaiting verification")}`
                  : "Connect the SGT identity you use in GSPro so your official CGL results can be matched."}
              </p>
              <div className={s.actions}>
                <button
                  className={s.smallButton}
                  onClick={() => setTab("Profile")}
                >
                  Manage connection
                </button>
              </div>
            </article>
            <article className={s.panel}>
              <Gift size={22} />
              <h2 style={{ marginTop: 15 }}>Your seasonal gift</h2>
              <p>
                {rows(data.gifts).length
                  ? rows(data.gifts)
                      .map(
                        (g) =>
                          `${str(g.name ?? g.item_name, "Season gift")} · ${str(g.state)}`,
                      )
                      .join("; ")
                  : rows(data.gift_eligibility).length
                    ? rows(data.gift_eligibility)
                        .map((g) => str(g.reason))
                        .join(" ")
                    : "Full-member gifts are released after the plan's payment and season eligibility requirements are met. Casual entrants do not receive a complimentary gift."}
              </p>
              <div className={s.actions}>
                <button
                  className={s.smallButton}
                  onClick={() => setTab("Rewards")}
                >
                  Gifts & rewards
                </button>
              </div>
            </article>
          </div>
        </>
      ) : null}
      {tab === "Performance" ? (
        <>
          <CglPerformanceHighlights
            results={results.filter((r) => r.state === "verified")}
            personal
          />
          <div className={s.sectionHead}>
            <div>
              <h2 style={{ fontSize: 26, fontWeight: 800 }}>
                Your CGL performance
              </h2>
              <p className={s.muted}>
                Only verified CGL rounds contribute to your history. Missing
                statistics stay blank.
              </p>
            </div>
            <Trophy size={25} />
          </div>
          {results.length ? (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    {[
                      "Week",
                      "Gross",
                      "Net",
                      "Points",
                      "Status",
                      "Scorecard",
                    ].map((h) => (
                      <th key={h} scope="col">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={str(r.id)}>
                      <td>{str(r.week_name ?? r.week_id)}</td>
                      <td>{str(r.gross ?? r.gross_score)}</td>
                      <td>{str(r.net ?? r.net_score)}</td>
                      <td>{str(r.points)}</td>
                      <td>{str(r.state)}</td>
                      <td>
                        {typeof r.scorecard_url === "string" &&
                        r.scorecard_url.startsWith(
                          "https://simulatorgolftour.com/",
                        ) ? (
                          <a
                            href={r.scorecard_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open SGT card
                          </a>
                        ) : (
                          "Not linked"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <CglEmpty title="Your CGL story starts with your first verified round">
              Your gross/net results, points and scorecards will appear here
              after import and verification. The separate trial hub still has
              your linked trial cards.
            </CglEmpty>
          )}
          <div className={s.panel} style={{ marginTop: 20 }}>
            <h3>Annual ranking</h3>
            <p>
              {annualPoints.status === "calculated"
                ? `${annualYear}: ${annualPoints.points} points under the approved annual formula.`
                : "The annual aggregation formula is awaiting CGS approval. No annual rank is being calculated yet."}
            </p>
            <Link className={s.textLink} href="/cgl/annual">
              View annual rankings
              <ArrowRight size={13} />
            </Link>
          </div>
        </>
      ) : null}
      {tab === "Profile" ? (
        <article className={s.panel}>
          <h2>Connect your SGT identity</h2>
          <p>
            Your SGT username is public on results. Your numeric ID is used
            privately to match your competition records. A link request requires
            verification.
          </p>
          <form
            className={s.vertical}
            style={{ maxWidth: 600, marginTop: 25 }}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void command("link_sgt", {
                username: f.get("username"),
                sgtId: f.get("sgt_id"),
                sgt_username: f.get("username"),
                sgt_id: f.get("sgt_id"),
              });
            }}
          >
            <label className={s.field}>
              SGT username
              <input
                name="username"
                required
                maxLength={100}
                defaultValue={str(member.sgt_username, "")}
                placeholder="Your exact SGT username"
              />
            </label>
            <label className={s.field}>
              SGT ID
              <input
                name="sgt_id"
                inputMode="numeric"
                pattern="[0-9]{8,30}"
                required
                maxLength={30}
                defaultValue={str(member.sgt_id, "")}
              />
              <small>
                Copy the long numeric ID from your SGT profile. We never need
                your SGT password.
              </small>
            </label>
            <button
              disabled={busy || !ready || data.joined !== true}
              className={s.primary}
            >
              Submit for verification
            </button>
          </form>
          <p className={s.fine}>
            Current verified handicap:{" "}
            {str(member.verified_handicap ?? member.handicap)} · Qualifying
            holes: {str(member.qualifying_holes, "0")} / 54 · Last verification:{" "}
            {member.handicap_verified_at
              ? date(member.handicap_verified_at)
              : "Pending"}
          </p>
        </article>
      ) : null}
      {tab === "Membership" ? (
        <>
          <div className={s.grid2}>
            <article className={s.panel}>
              <CreditCard size={24} />
              <h2 style={{ marginTop: 16 }}>Membership status</h2>
              <p>
                {membership
                  ? `${str(membership.plan_code)} · ${str(membership.state)}`
                  : "No paid CGL membership is recorded."}
              </p>
              {membership ? (
                <dl className={s.muted}>
                  <dt>Paid membership period</dt>
                  <dd>
                    {date(membership.starts_at)} —{" "}
                    {date(membership.paid_through)}
                  </dd>
                  <dt>Next payment</dt>
                  <dd>
                    {membership.next_billing_at
                      ? date(membership.next_billing_at)
                      : "See confirmed billing records"}
                  </dd>
                  <dt>Effective cancellation</dt>
                  <dd>
                    {membership.cancel_effective_at
                      ? date(membership.cancel_effective_at)
                      : "No cancellation scheduled"}
                  </dd>
                </dl>
              ) : null}
              {membership?.state === "past_due" ? (
                <div className={`${s.notice} ${s.error}`}>
                  A payment is overdue. The current competition week remains
                  available; the next week is blocked until payment is
                  confirmed. Contact CGS to resolve your billing record.
                </div>
              ) : null}
            </article>
            <article className={s.panel}>
              <h2>Request cancellation</h2>
              <p>
                Review the exact effective date and any remaining payments
                before confirming. Credits and score histories remain with your
                account.
              </p>
              {cancelQuote ? (
                <div className={s.notice}>
                  <strong>
                    {cancelQuote.status === "review_required"
                      ? "Proposed date, awaiting review:"
                      : "Requested effective date:"}{" "}
                    {date(cancelQuote.effectiveAt ?? cancelQuote.effective_at)}
                  </strong>
                  <p>
                    {str(
                      cancelQuote.message,
                      "The request and disclosed payments will be retained for CGS review. Provider cancellation must be confirmed separately.",
                    )}
                  </p>
                  <p>
                    Future payments:{" "}
                    {rows(cancelQuote.futurePayments)
                      .map(
                        (p) =>
                          `${date(p.dueAt ?? p.date ?? p.at)} · ${aud(p.amountCents)}`,
                      )
                      .join("; ") || aud(cancelQuote.futureAmountCents)}
                  </p>
                  <button
                    disabled={busy || !cancellationPolicyApproved}
                    className={s.smallButton}
                    onClick={() =>
                      void command("request_cancellation", {
                        membershipId: membership?.id,
                        reason:
                          "Member requested cancellation through their clubhouse",
                        acknowledged: true,
                        acceptedEffectiveAt: cancelQuote.effectiveAt,
                        acceptedFutureAmountCents:
                          cancelQuote.futureAmountCents,
                      }).then((r) => {
                        if (r) setCancelQuote(null);
                      })
                    }
                  >
                    Submit cancellation request
                  </button>
                </div>
              ) : (
                <div className={s.actions}>
                  <button
                    className={s.secondary}
                    disabled={busy || !ready || !membership || !cancellationPolicyApproved}
                    onClick={() =>
                      void command("quote_cancellation", {
                        membershipId: membership?.id,
                      }).then((r) => {
                        if (r) setCancelQuote(r);
                      })
                    }
                  >
                    Review cancellation
                  </button>
                  {!cancellationPolicyApproved ? <p className={s.fine}>The confirmed cancellation policy has not yet been published to this environment. Contact CGS for membership help; no request can be submitted here yet.</p> : null}
                </div>
              )}
            </article>
          </div>
          <CglSandboxBilling billing={billing} ready={ready} busy={busy} syncing={billingSyncing} message={billingMessage} onRefresh={() => { void refreshSquareTestPayments(); }} />
          <section className={s.section}>
            <h2 style={{ fontSize: 25, fontWeight: 800, marginBottom: 20 }}>
              Choose your membership
            </h2>
            <form className={s.panel} onSubmit={checkout}>
              <div className={s.notice}>{billingIsTest
                ? "Square Sandbox only. All test prices are AUD. Test payments do not activate real membership access."
                : "Secure live Square checkout in AUD. Recurring memberships remain unavailable until their renewal flow completes final verification."}</div>
              <div className={s.formGrid}>
                <label className={s.field}>
                  Plan
                  <select
                    name="plan"
                    value={selectedPlan}
                    onChange={(e) => {
                      const planCode = e.target.value;
                      setSelectedPlan(planCode);
                      if (!cglPlanRequiresSeason(planCode)) setSelectedSeason("");
                      setCheckoutQuote(null);
                    }}
                  >
                    {rows(data.plans).map((p) => (
                      <option key={str(p.code)} value={str(p.code)}>
                        {str(p.name)} · {aud(p.price_cents)} /{" "}
                        {str(p.billing_interval)}
                      </option>
                    ))}
                  </select>
                </label>
                {cglPlanRequiresSeason(selectedPlan) ? (
                  <label className={s.field}>
                    Season for the $100 Season Pass
                    <select
                      required
                      name="season"
                      value={selectedSeason}
                      onChange={(e) => {
                        setSelectedSeason(e.target.value);
                        setCheckoutQuote(null);
                      }}
                    >
                      <option value="">Choose an open season</option>
                      {rows(data.seasons).map((se) => (
                        <option key={str(se.id)} value={str(se.id)}>
                          {str(se.name)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              <p className={s.fine}>
                {cglPlanRequiresSeason(selectedPlan)
                  ? "The $100 Season Pass is the only purchase linked to a specific season. A current Casual Registration is also required."
                  : "This membership can be purchased at any time and is not linked to a specific season."}
              </p>
              {checkoutQuote ? <CglSquareQuoteSummary quote={checkoutQuote} /> : null}
              <div className={s.actions}>
                <button
                  className={s.primary}
                  disabled={busy || billingSyncing || !ready || data.joined !== true || (Boolean(checkoutQuote) && checkoutReadiness.ready !== true)}
                >
                  {busy
                    ? "Preparing…"
                    : checkoutQuote
                      ? `Continue to Square${billingIsTest ? " Sandbox" : ""}`
                      : "Review payment"}
                  <ArrowRight size={14} />
                </button>
                <Link className={s.textLink} href="/cgl/terms">
                  Read membership terms
                </Link>
              </div>
            </form>
          </section>
          <section className={s.section}>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 18 }}>
              Payment history
            </h2>
            {rows(data.payments).length ? (
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      {["Date", "Amount", "Status", "Reference"].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows(data.payments).map((p) => (
                      <tr key={str(p.id)}>
                        <td>{date(p.paid_at ?? p.created_at)}</td>
                        <td>{aud(p.amount_cents)}</td>
                        <td>{str(p.state)}</td>
                        <td>{str(p.square_payment_id ?? p.id)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <CglEmpty title="No payments recorded">
                Only confirmed CGL payment records appear here. Choosing a plan
                does not activate membership.
              </CglEmpty>
            )}
          </section>
        </>
      ) : null}
      {tab === "Rewards" ? (
        <>
          <div className={s.miniStats}>
            <article className={s.metric}>
              <span>Available credits</span>
              <strong>{ready ? str(credits.available, "0") : "—"}</strong>
              <small>Spend your earliest-expiring credits first</small>
            </article>
            <article className={s.metric}>
              <span>Expiring soon</span>
              <strong>{ready ? str(credits.expiringSoon, "0") : "—"}</strong>
              <small>Each award expires 18 months after issue</small>
            </article>
          </div>
          <section>
            <div className={s.sectionHead}>
              <div>
                <h2 style={{ fontSize: 26, fontWeight: 800 }}>
                  Your Rewards Store
                </h2>
                <p className={s.muted}>
                  Available items, their credit price and fulfilment status.
                </p>
              </div>
              <Wallet size={25} />
            </div>
            {rows(data.catalogue).length ? (
              <div className={s.grid3}>
                {rows(data.catalogue).map((item) => (
                  <article className={s.panel} key={str(item.id)}>
                    {typeof item.image_url === "string" &&
                    item.image_url.startsWith("https://") ? (
                      <Image
                        src={item.image_url}
                        alt={str(item.name)}
                        width={320}
                        height={180}
                        unoptimized
                        style={{
                          width: "100%",
                          height: 160,
                          objectFit: "contain",
                          marginBottom: 15,
                        }}
                      />
                    ) : (
                      <Gift style={{ color: "#2380a2", marginBottom: 15 }} />
                    )}
                    <h3>{str(item.name)}</h3>
                    <p>{str(item.description, "")}</p>
                    <p>
                      <strong>
                        {str(item.credit_price ?? item.required_credits)}{" "}
                        credits
                      </strong>{" "}
                      · {str(item.stock_quantity ?? item.stock, "0")} available
                    </p>
                    {redeemItem === item.id ? (
                      <div className={s.notice}>
                        <p>
                          Use {str(item.credit_price ?? item.required_credits)}{" "}
                          credits for {str(item.name)}? Your earliest-expiring
                          credits will be spent first.
                        </p>
                        <div className={s.actions}>
                          <button
                            className={s.primary}
                            disabled={busy}
                            onClick={() =>
                              void command("redeem", {
                                catalogueId: item.id,
                                requestKey: redemptionKey,
                              }).then((r) => {
                                if (r) setRedeemItem("");
                              })
                            }
                          >
                            Confirm redemption
                          </button>
                          <button
                            className={s.smallButton}
                            onClick={() => setRedeemItem("")}
                          >
                            Go back
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className={s.smallButton}
                        disabled={
                          busy ||
                          !ready ||
                          num(credits.available) <
                            num(item.credit_price ?? item.required_credits) ||
                          num(item.stock_quantity ?? item.stock) < 1
                        }
                        onClick={() => {
                          setRedemptionKey(crypto.randomUUID());
                          setRedeemItem(str(item.id));
                        }}
                      >
                        Review redemption
                      </button>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <CglEmpty title="The catalogue is being prepared">
                Available merchandise and sponsor rewards will appear here with
                their exact credit price. Your credits cannot be withdrawn as
                cash.
              </CglEmpty>
            )}
          </section>
          <section className={s.section}>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 18 }}>
              Your reward orders & gifts
            </h2>
            {[...rows(data.orders), ...rows(data.gifts)].length ? (
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Reward</th>
                      <th>Date</th>
                      <th>Credits</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows(data.orders), ...rows(data.gifts)].map((o) => (
                      <tr key={str(o.id)}>
                        <td>
                          {str(
                            o.product_name ?? o.item_name ?? o.catalogue_id,
                            "Seasonal gift",
                          )}
                        </td>
                        <td>{date(o.created_at)}</td>
                        <td>{str(o.credits_spent ?? o.credits, "Gift")}</td>
                        <td>{str(o.state)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={s.muted}>
                No orders or gifts have been allocated yet.
              </p>
            )}
          </section>
          <section className={s.section}>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 18 }}>
              Credit activity
            </h2>
            {rows(credits.transactions).length ? (
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Activity</th>
                      <th>Credits</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows(credits.transactions).map((t) => (
                      <tr key={str(t.id)}>
                        <td>{date(t.created_at)}</td>
                        <td>{str(t.kind ?? t.type)}</td>
                        <td>{str(t.amount)}</td>
                        <td>{str(t.reason ?? t.source)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <CglEmpty title="A good round could be your first reward">
                Credits appear automatically after an authorised award is
                verified and published. Your earning and redemption history will
                stay here.
              </CglEmpty>
            )}
          </section>
        </>
      ) : null}
      {tab === "Notifications" ? (
        <div className={s.vertical}>
          {rows(data.notifications).length ? (
            rows(data.notifications).map((n) => (
              <article className={s.panel} key={str(n.id)}>
                <h3>{str(n.title)}</h3>
                <p>{str(n.body ?? n.message)}</p>
                <p className={s.fine}>{date(n.created_at, true)}</p>
                {n.state !== "read" ? (
                  <button
                    className={s.smallButton}
                    disabled={busy}
                    onClick={() =>
                      void command("mark_notification_read", { id: n.id })
                    }
                  >
                    Mark as read
                  </button>
                ) : (
                  <span className={s.badge}>Read</span>
                )}
              </article>
            ))
          ) : (
            <CglEmpty title="You're all caught up">
              Season reminders, verified awards and membership notices will
              appear here.
            </CglEmpty>
          )}
        </div>
      ) : null}
    </div>
  );
}
