"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Radio, ShieldCheck, UserRoundCheck } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CglHeading } from "./CglPublicExperience";
import { aud, date, rows, str, type CglSnapshot } from "./cgl-ui";
import s from "./Cgl2027.module.css";

const planCodes = ["annual", "monthly", "weekly", "casual_registration", "casual_season"];
const checkoutPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const accessPattern = /^[A-Za-z0-9_-]{43}$/;

function requiresSeason(planCode: string) {
  return planCode === "casual_season";
}

function requestKey(storageKey: string) {
  try {
    const saved = sessionStorage.getItem(storageKey);
    if (saved && checkoutPattern.test(saved)) return saved;
  } catch { /* Server idempotency remains authoritative without browser storage. */ }
  const key = crypto.randomUUID();
  try { sessionStorage.setItem(storageKey, key); } catch { /* Retain this request key in memory. */ }
  return key;
}

function squareUrl(value: string) {
  try {
    const target = new URL(value);
    return target.protocol === "https:" && (
      target.hostname === "square.link" ||
      target.hostname === "sandbox.square.link" ||
      target.hostname.endsWith(".square.site") ||
      target.hostname.endsWith(".squareup.com")
    );
  } catch {
    return false;
  }
}

function PaymentReview({ quote, accepted, onAccepted }: {
  quote: CglSnapshot;
  accepted: boolean;
  onAccepted: (accepted: boolean) => void;
}) {
  const intervals: Record<string, string> = { annual: "year", monthly: "month", weekly: "week" };
  const monthly = quote.planCode === "monthly" && quote.recurring === true;
  return (
    <div className={s.notice}>
      <strong>Payment summary</strong>
      <p>{monthly ? "Standard monthly price" : "Charge today"}: {aud(quote.amountCents)}</p>
      <p>Currency: AUD</p>
      <p>{monthly
        ? `Square may prorate today's first charge to the next first of the month. It then renews at ${aud(quote.amountCents)} on the first of each month until cancelled. Square shows the exact first charge before authorisation.`
        : quote.recurring === true
          ? `Automatic renewal: ${aud(quote.amountCents)} every ${intervals[str(quote.billingInterval)] ?? "confirmed billing period"}. Square shows the exact next billing date before authorisation.`
          : "One-off payment. This purchase does not automatically renew."}</p>
      <p>{str(quote.notice, "Review the amount and membership disclosures before authorising this payment.")}</p>
      <p>Terms: {str(quote.termsVersion, "Current published membership terms")}</p>
      <label className={s.termsConfirmation} htmlFor="cgl-guest-checkout-terms">
        <input required checked={accepted} id="cgl-guest-checkout-terms" type="checkbox" onChange={(event) => onAccepted(event.currentTarget.checked)} />
        <span>I have reviewed the displayed payment and <Link href="/cgl/terms">membership terms</Link>.</span>
      </label>
    </div>
  );
}

export default function CglGuestCheckout() {
  const [publicData, setPublicData] = useState<CglSnapshot>({ status: "loading" });
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [sgtUsername, setSgtUsername] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("casual_registration");
  const [selectedSeason, setSelectedSeason] = useState("");
  const [quote, setQuote] = useState<CglSnapshot | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [returnStatus, setReturnStatus] = useState<CglSnapshot | null>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const inMemoryKeys = useRef(new Map<string, string>());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedPlan = params.get("plan");
    if (requestedPlan && planCodes.includes(requestedPlan)) setSelectedPlan(requestedPlan);

    const controller = new AbortController();
    void fetch("/api/cgl/public", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((result) => setPublicData(result))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPublicData({ status: "error" });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutId = params.get("checkout") ?? "";
    let accessKey = params.get("guest") ?? "";
    if (!checkoutPattern.test(checkoutId)) return;
    if (accessPattern.test(accessKey)) {
      try { sessionStorage.setItem(`cgl-guest-access:${checkoutId}`, accessKey); } catch { /* The private return URL remains usable. */ }
      params.delete("guest");
      const cleaned = `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", cleaned);
    } else {
      try { accessKey = sessionStorage.getItem(`cgl-guest-access:${checkoutId}`) ?? ""; } catch { /* Missing key handled below. */ }
    }
    if (!accessPattern.test(accessKey)) {
      setFailed(true);
      setMessage("This checkout return is missing its private confirmation key. Use your Square receipt or contact CGS for help.");
      return;
    }

    let cancelled = false;
    const check = async () => {
      setBusy(true);
      for (let attempt = 0; attempt < 6 && !cancelled; attempt += 1) {
        try {
          const response = await fetch("/api/cgl/guest-checkout/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ checkoutId, accessKey }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Payment confirmation is unavailable.");
          if (cancelled) return;
          setReturnStatus(result);
          setFailed(false);
          setMessage(str(result.message));
          if (result.confirmed === true) break;
        } catch (error) {
          if (cancelled) return;
          setFailed(true);
          setMessage(error instanceof Error ? error.message : "Payment confirmation is unavailable.");
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }
      if (!cancelled) setBusy(false);
    };
    void check();
    return () => { cancelled = true; };
  }, []);

  const plans = rows(publicData.plans);
  const seasons = rows(publicData.seasons).filter((season) =>
    ["registration", "published", "active"].includes(str(season.status)),
  );

  const resetReview = (plan = selectedPlan) => {
    setQuote(null);
    setTermsAccepted(false);
    setMessage("");
    setFailed(false);
    if (!requiresSeason(plan)) setSelectedSeason("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      if (!quote || str(quote.planCode) !== selectedPlan) {
        const response = await fetch(`/api/cgl/checkout?planCode=${encodeURIComponent(selectedPlan)}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? result.message ?? "This membership quote is unavailable.");
        setQuote(result);
        setTermsAccepted(false);
        window.setTimeout(() => reviewRef.current?.focus(), 0);
        return;
      }
      if (!termsAccepted) throw new Error("Review the payment summary and accept the membership terms before continuing.");
      if (quote.purchaseEnabled !== true) throw new Error("Square checkout is temporarily unavailable for this membership.");
      const scope = `cgl-guest-square:v1:${email.trim().toLowerCase()}:${selectedPlan}:${selectedSeason || "none"}`;
      const key = inMemoryKeys.current.get(scope) ?? requestKey(scope);
      inMemoryKeys.current.set(scope, key);
      const response = await fetch("/api/cgl/guest-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          email,
          sgtUsername,
          planCode: selectedPlan,
          ...(requiresSeason(selectedPlan) ? { seasonId: selectedSeason } : {}),
          requestKey: key,
          termsAccepted: true,
          termsVersion: quote.termsVersion,
          acceptedAmountCents: quote.amountCents,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Secure checkout could not be opened.");
      if (!checkoutPattern.test(str(result.checkoutId)) || !accessPattern.test(str(result.accessKey)) || !squareUrl(str(result.url))) {
        throw new Error("Square returned an incomplete checkout. No payment has been assumed.");
      }
      try { sessionStorage.setItem(`cgl-guest-access:${result.checkoutId}`, result.accessKey); } catch { /* Return URL carries the private key. */ }
      window.location.assign(result.url);
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Secure checkout could not be opened.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.page}>
      <CglHeading label="Account optional" title="Join CGL your way.">
        Purchase a membership without creating a CGS account. Your exact SGT
        username connects eligible tournament results and live statistics to
        the same CGL participant profile.
      </CglHeading>

      {returnStatus ? (
        <section className={`${s.panel} ${returnStatus.confirmed === true ? s.guestSuccess : ""}`} aria-live="polite">
          {returnStatus.confirmed === true ? <CheckCircle2 size={30} aria-hidden="true" /> : <Radio size={30} aria-hidden="true" />}
          <span className={s.badge}>{returnStatus.confirmed === true ? "PAYMENT CONFIRMED" : "CONFIRMING WITH SQUARE"}</span>
          <h2>{returnStatus.confirmed === true ? "Your CGL membership is ready." : "Your payment is still being checked."}</h2>
          <p>{str(returnStatus.message)}</p>
          <dl className={s.guestSummary}>
            <div><dt>Participant</dt><dd>{str(returnStatus.displayName)}</dd></div>
            <div><dt>SGT username</dt><dd>{str(returnStatus.sgtUsername)}</dd></div>
            <div><dt>Membership</dt><dd>{str(returnStatus.planCode).replaceAll("_", " ")}</dd></div>
            <div><dt>Paid through</dt><dd>{returnStatus.paidThrough ? date(returnStatus.paidThrough) : "Awaiting confirmation"}</dd></div>
          </dl>
          <p className={s.fine}>Keep your Square receipt. A CGS account is optional and can be created later without losing this purchase or your linked SGT history.</p>
        </section>
      ) : null}

      {message ? <div className={`${s.notice} ${failed ? s.error : s.success}`} role={failed ? "alert" : "status"}>{busy && !failed ? "Checking Square… " : ""}{message}</div> : null}

      <div className={`${s.grid2} ${s.guestCheckout}`}>
        <form className={s.panel} onSubmit={submit}>
          <span className={s.badge}>SECURE SQUARE CHECKOUT · AUD</span>
          <h2 style={{ marginTop: 16 }}>Membership details</h2>
          <p>These details identify your CGL entry. You do not need a CGS website login.</p>
          <div className={s.formGrid}>
            <label className={s.field}>Participant name<input required autoComplete="name" maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.currentTarget.value)} /></label>
            <label className={s.field}>Purchase email<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.currentTarget.value)} /><small>Used for payment support and matching a future CGS account.</small></label>
            <label className={s.field}>Exact SGT username<input required autoComplete="off" maxLength={64} value={sgtUsername} onChange={(event) => setSgtUsername(event.currentTarget.value)} /><small>This automatically matches your SGT tournament data. Never enter your SGT password.</small></label>
            <label className={s.field}>Membership<select value={selectedPlan} onChange={(event) => { const plan = event.currentTarget.value; setSelectedPlan(plan); resetReview(plan); }}>
              {plans.length ? plans.map((plan) => <option key={str(plan.code)} value={str(plan.code)}>{str(plan.name)} · {aud(plan.price_cents)}{plan.auto_renew === true ? ` / ${str(plan.billing_interval)}` : " once"}</option>) : <option value="casual_registration">Casual Registration · $29.00 once</option>}
            </select></label>
            {requiresSeason(selectedPlan) ? <label className={s.field}>Season<select required value={selectedSeason} onChange={(event) => { setSelectedSeason(event.currentTarget.value); resetReview(selectedPlan); }}><option value="">Choose an open season</option>{seasons.map((season) => <option key={str(season.id)} value={str(season.id)}>{str(season.name)}</option>)}</select></label> : null}
          </div>
          <p className={s.fine}>{requiresSeason(selectedPlan) ? "The Season Pass is the only purchase tied to a season and requires a current Casual Registration." : "This membership can be purchased at any time and is not tied to a season."}</p>
          {quote ? <div ref={reviewRef} tabIndex={-1} className={s.paymentReview} aria-live="polite"><p className={s.reviewStep}>FINAL REVIEW · STEP 2 OF 2</p><PaymentReview quote={quote} accepted={termsAccepted} onAccepted={setTermsAccepted} /></div> : <p className={s.reviewHint}>Step 1 of 2: enter your details and review the exact AUD charge before opening Square.</p>}
          <div className={s.actions}>
            <button className={s.primary} disabled={busy || publicData.status === "loading" || (quote ? quote.purchaseEnabled !== true || !termsAccepted : false)}>{busy ? "Please wait…" : quote ? "Continue to secure Square checkout" : "Review payment"}<ArrowRight size={14} aria-hidden="true" /></button>
            <Link className={s.textLink} href="/cgl/terms">Read membership terms</Link>
          </div>
        </form>

        <aside className={`${s.panel} ${s.guestAssurance}`}>
          <UserRoundCheck size={30} aria-hidden="true" />
          <span className={s.eyebrow}>No compulsory CGS account</span>
          <h2>Play first. Create an account only if you want one.</h2>
          <p>Your membership belongs to your CGL participant record, not to a website password. SGT remains the source used to match eligible competition rounds.</p>
          <div className={s.guestPoint}><ShieldCheck size={20} /><div><strong>Square handles payment</strong><p>Card details never pass through the CGS website.</p></div></div>
          <div className={s.guestPoint}><Radio size={20} /><div><strong>Automatic SGT matching</strong><p>Use the exact SGT username shown on your profile.</p></div></div>
          <div className={s.guestPoint}><CheckCircle2 size={20} /><div><strong>One participant history</strong><p>A future CGS account using this email keeps the same purchase and results.</p></div></div>
          <div className={s.notice}>Already have or want a CGS account? It gives you a private dashboard, self-service cancellation, reward history and saved results, but it is not required to buy.</div>
          <Link href="/cgl/dashboard" className={s.secondary}>Sign in or create an optional account <ArrowRight size={14} /></Link>
        </aside>
      </div>
    </div>
  );
}
