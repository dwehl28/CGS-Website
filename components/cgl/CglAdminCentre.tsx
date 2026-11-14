"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import ClubhouseAdminLogin from "@/components/ClubhouseAdminLogin";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { financialScenario, CGL_DEFAULT_PLANS } from "@/lib/cgl-engine";
import { CglHeading, CglEmpty } from "./CglPublicExperience";
import {
  aud,
  date,
  num,
  row,
  rows,
  str,
  type CglRow,
  type CglSnapshot,
} from "./cgl-ui";
import s from "./Cgl2027.module.css";

type Field = {
  key: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "datetime"
    | "select"
    | "json"
    | "checkbox"
    | "textarea";
  options?: { value: string; label: string }[];
  required?: boolean;
  initial?: string | number | boolean;
  help?: string;
};
type Send = (action: string, payload: CglRow) => Promise<boolean>;
const options = (values: string[]) =>
  values.map((value) => ({ value, label: value.replaceAll("_", " ") }));
function toLocalInput(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    return "";
  return new Date(Date.parse(value) + 10 * 3600000).toISOString().slice(0, 16);
}
function OperationForm({
  title,
  description,
  action,
  fields,
  send,
  record,
  busy,
  label = "Save",
  envelope = true,
  settingKey,
}: {
  title: string;
  description?: string;
  action: string;
  fields: Field[];
  send: Send;
  record?: CglRow;
  busy: boolean;
  label?: string;
  envelope?: boolean;
  settingKey?: string;
}) {
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const f = new FormData(event.currentTarget);
      const payload: CglRow = {};
      for (const field of fields) {
        const value = f.get(field.key);
        if (field.type === "checkbox") payload[field.key] = value === "on";
        else if (field.type === "number")
          payload[field.key] = value === "" ? undefined : Number(value);
        else if (field.type === "json")
          payload[field.key] = JSON.parse(String(value || "{}"));
        else if (field.type === "datetime")
          payload[field.key] = value
            ? new Date(`${value}:00+10:00`).toISOString()
            : null;
        else payload[field.key] = value === "" ? undefined : value;
      }
      if (record?.id) payload.id = record.id;
      if (record?.code) payload.code = record.code;
      const completed = await send(
        action,
        envelope
          ? {
              record: settingKey
                ? { key: settingKey, value: { ...record, ...payload } }
                : payload,
              reason: f.get("reason"),
            }
          : {
              ...payload,
              reason: f.get("reason"),
              requestKey,
            },
      );
      if (completed) setRequestKey(crypto.randomUUID());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please check the form.");
    }
  }
  return (
    <form className={s.panel} onSubmit={submit}>
      <h3>{title}</h3>
      {description ? <p style={{ marginBottom: 20 }}>{description}</p> : null}
      <div className={s.formGrid}>
        {fields.map((field) => {
          const value = record?.[field.key] ?? field.initial ?? "";
          return (
            <label
              key={field.key}
              className={`${s.field} ${field.type === "json" || field.type === "textarea" ? s.full : ""}`}
            >
              {field.label}
              {field.type === "select" ? (
                <select
                  name={field.key}
                  required={field.required}
                  defaultValue={String(value)}
                >
                  <option value="">Select…</option>
                  {field.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "checkbox" ? (
                <input
                  type="checkbox"
                  name={field.key}
                  defaultChecked={!!value}
                  style={{ minHeight: 20, width: 20 }}
                />
              ) : field.type === "json" || field.type === "textarea" ? (
                <textarea
                  name={field.key}
                  required={field.required}
                  defaultValue={
                    field.type === "json"
                      ? typeof value === "string"
                        ? value
                        : JSON.stringify(value, null, 2)
                      : String(value)
                  }
                  spellCheck={false}
                />
              ) : (
                <input
                  name={field.key}
                  type={
                    field.type === "datetime"
                      ? "datetime-local"
                      : (field.type ?? "text")
                  }
                  required={field.required}
                  defaultValue={
                    field.type === "datetime"
                      ? toLocalInput(value)
                      : String(value)
                  }
                  step={field.type === "number" ? "any" : undefined}
                />
              )}{" "}
              {field.help ? <small>{field.help}</small> : null}
            </label>
          );
        })}
        <label className={`${s.field} ${s.full}`}>
          Reason for this change
          <input
            name="reason"
            required
            minLength={5}
            maxLength={1000}
            placeholder="Record the decision for the audit log"
          />
        </label>
      </div>
      {error ? (
        <div role="alert" className={`${s.notice} ${s.error}`}>
          {error}
        </div>
      ) : null}
      <div className={s.actions}>
        <button disabled={busy} className={s.primary}>
          {busy ? "Saving…" : label}
          <ArrowRight size={13} />
        </button>
      </div>
    </form>
  );
}
function RecordList({
  items,
  columns,
  onSelect,
}: {
  items: CglRow[];
  columns: string[];
  onSelect?: (r: CglRow) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = items.filter((r) =>
    columns.some((c) =>
      str(r[c], "").toLowerCase().includes(search.toLowerCase()),
    ),
  );
  return (
    <>
      <label className={s.field} style={{ maxWidth: 380, marginBottom: 17 }}>
        Search records
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a record"
        />
      </label>
      {filtered.length ? (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th scope="col" key={c}>
                    {c.replaceAll("_", " ")}
                  </th>
                ))}
                {onSelect ? <th scope="col">Manage</th> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((r, i) => (
                <tr key={str(r.id ?? r.code, String(i))}>
                  {columns.map((c) => (
                    <td key={c}>{str(r[c])}</td>
                  ))}
                  {onSelect ? (
                    <td>
                      <button
                        className={s.smallButton}
                        onClick={() => onSelect(r)}
                      >
                        Open
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <CglEmpty title="No matching records">
          New records will appear here after they are saved.
        </CglEmpty>
      )}
    </>
  );
}

function PublishBlock({
  weeks,
  send,
  busy,
}: {
  weeks: CglRow[];
  send: Send;
  busy: boolean;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await send("publish_block", {
      weekIds: data.getAll("week"),
      reason: data.get("reason"),
    });
  }
  return (
    <form className={s.panel} onSubmit={submit}>
      <h3>Release a block of rounds</h3>
      <p>
        Select the fixtures to publish together. Their configured opening times
        and deadlines still apply.
      </p>
      <div className={s.vertical} style={{ marginTop: 18 }}>
        {weeks
          .filter((w) => w.status !== "locked" && !w.results_published)
          .map((w) => (
            <label
              key={str(w.id)}
              style={{ display: "flex", gap: 10, fontSize: 12 }}
            >
              <input type="checkbox" name="week" value={str(w.id)} />
              {str(w.name)} · {str(w.status)}
            </label>
          ))}
        <label className={s.field}>
          Reason
          <input name="reason" required minLength={5} />
        </label>
        <button className={s.primary} disabled={busy || !weeks.length}>
          Publish selected fixtures
          <ArrowRight size={13} />
        </button>
      </div>
    </form>
  );
}
function exportCsv(items: CglRow[], name: string) {
  const columns = [...new Set(items.flatMap((r) => Object.keys(r)))];
  const cell = (v: unknown) => {
    let value = typeof v === "object" ? JSON.stringify(v) : str(v, "");
    if (/^[=+\-@]/.test(value)) value = `'${value}`;
    return `"${value.replaceAll('"', '""')}"`;
  };
  const blob = new Blob(
    [
      [
        columns.map(cell).join(","),
        ...items.map((r) => columns.map((c) => cell(r[c])).join(",")),
      ].join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cgl-${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
const sections = [
  "Overview",
  "SGT live sync",
  "Members",
  "Seasons & fixtures",
  "Results & imports",
  "Rewards & prizes",
  "Merchandise",
  "Finance",
  "Communications",
  "Settings",
  "Audit log",
];

function SgtLiveSync({
  data,
  send,
  busy,
}: {
  data: CglSnapshot;
  send: Send;
  busy: boolean;
}) {
  const connection = rows(data.sgt_connections)[0] ?? {};
  const tours = rows(data.sgt_tours);
  const tournaments = rows(data.sgt_tournaments);
  const runs = rows(data.sgt_sync_runs).sort((a, b) =>
    str(b.started_at, "").localeCompare(str(a.started_at, "")),
  );
  const connected = connection.status === "connected";
  const enabled = connection.sync_enabled === true;
  const canConfigure = data.role !== "results_admin";
  const [formError, setFormError] = useState("");
  const sgtUsernameRef = useRef<HTMLInputElement>(null);
  const sgtPasswordRef = useRef<HTMLInputElement>(null);

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const form = event.currentTarget;
    const values = new FormData(form);
    const completed = await send("connect_sgt", {
      username: sgtUsernameRef.current?.value ?? "",
      password: sgtPasswordRef.current?.value ?? "",
      reason: values.get("reason"),
    });
    if (completed) form.reset();
  }

  return (
    <div className={s.vertical}>
      <div className={s.miniStats}>
        <article className={s.metric}>
          <span>Club connection</span>
          <strong>{connected ? "Live" : str(connection.status, "Not connected")}</strong>
          <small>CGSBunker · official SGT Club API</small>
        </article>
        <article className={s.metric}>
          <span>Last successful sync</span>
          <strong>{connection.last_success_at ? date(connection.last_success_at, true) : "Not yet"}</strong>
          <small>{enabled ? "Automatic refresh every 30 minutes" : "Automatic refresh paused"}</small>
        </article>
        <article className={s.metric}>
          <span>Tracked tours</span>
          <strong>{tours.length}</strong>
          <small>{tournaments.length} tournaments cached</small>
        </article>
        <article className={s.metric}>
          <span>API key renewal</span>
          <strong>{connection.api_key_expires_at ? date(connection.api_key_expires_at, true) : "Awaiting connection"}</strong>
          <small>The key is encrypted and never sent to the browser</small>
        </article>
      </div>

      <div className={s.notice}>
        SGT remains the official source. This page copies read-only club,
        tournament, scorecard and statistics data into CGL for reliable public
        display. CGL awards still require the existing review and publish step.
      </div>

      {canConfigure ? (
        <form className={s.panel} onSubmit={connect}>
          <h3>{connected ? "Renew the SGT connection" : "Connect CGSBunker"}</h3>
          <p>
            Enter the SGT club administrator login once. The password is sent
            directly to SGT to create a rotating key and is never saved by CGS.
          </p>
          <div className={s.formGrid}>
            <label className={s.field}>
              SGT administrator username
              <input
                ref={sgtUsernameRef}
                name="username"
                required
                autoComplete="username"
              />
            </label>
            <label className={s.field}>
              SGT administrator password
              <input
                ref={sgtPasswordRef}
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
              />
            </label>
            <label className={`${s.field} ${s.full}`}>
              Reason for this connection
              <input
                name="reason"
                required
                minLength={5}
                maxLength={1000}
                defaultValue="Connect the official CGSBunker Club API and run the first sync"
              />
            </label>
          </div>
          {formError ? <div className={`${s.notice} ${s.error}`}>{formError}</div> : null}
          <div className={s.actions}>
            <button className={s.primary} disabled={busy}>
              {busy ? "Connecting…" : connected ? "Renew connection" : "Connect & sync now"}
              <ArrowRight size={13} />
            </button>
          </div>
        </form>
      ) : null}

      <article className={s.panel}>
        <h3>Automatic data refresh</h3>
        <p>
          A manual sync refreshes the same protected cache used by the public
          Live SGT page. If SGT is briefly unavailable, the last successful data
          remains on screen.
        </p>
        {connection.last_error ? (
          <div className={`${s.notice} ${s.error}`}>{str(connection.last_error)}</div>
        ) : null}
        <div className={s.actions}>
          <button
            type="button"
            className={s.primary}
            disabled={busy || !connected || !enabled}
            onClick={() =>
              void send("sync_sgt", {
                reason: "Refresh the official SGT club data from the admin control centre",
              })
            }
          >
            <RefreshCw size={13} />
            Sync now
          </button>
          {canConfigure ? (
            <button
              type="button"
              className={s.secondary}
              disabled={busy || (!connected && !connection.api_key_expires_at)}
              onClick={() =>
                void send("set_sgt_sync", {
                  enabled: !enabled,
                  reason: enabled
                    ? "Pause automatic SGT refresh from the admin control centre"
                    : "Resume automatic SGT refresh from the admin control centre",
                })
              }
            >
              {enabled ? "Pause automatic sync" : "Resume automatic sync"}
            </button>
          ) : null}
          <Link className={s.textLink} href="/cgl/live" target="_blank">
            Open public Live SGT page
            <ArrowRight size={13} />
          </Link>
        </div>
      </article>

      <div className={s.grid2}>
        <article className={s.panel}>
          <h3>Official tours</h3>
          <RecordList
            items={tours}
            columns={["name", "start_date", "end_date", "synced_at"]}
          />
        </article>
        <article className={s.panel}>
          <h3>Tournaments</h3>
          <RecordList
            items={tournaments}
            columns={["name", "course_name", "status", "synced_at"]}
          />
        </article>
      </div>
      <article className={s.panel}>
        <h3>Recent sync history</h3>
        <RecordList
          items={runs.slice(0, 30)}
          columns={["started_at", "trigger", "state", "error"]}
        />
      </article>
    </div>
  );
}

function Finance({
  data,
  send,
  busy,
}: {
  data: CglSnapshot;
  send: Send;
  busy: boolean;
}) {
  const stored = row(row(data.settings_map).financial);
  const configured = (key: string, fallback: number) =>
    typeof stored[key] === "number" &&
    Number.isSafeInteger(stored[key]) &&
    num(stored[key]) >= 0
      ? num(stored[key])
      : fallback;
  const [input, setInput] = useState({
    annualMembers: configured(
      "annualMembers",
      configured("annual_members", 10),
    ),
    monthlyMembers: configured(
      "monthlyMembers",
      configured("monthly_members", 6),
    ),
    weeklyMembers: configured("weeklyMembers", configured("weekly_members", 4)),
    casualRegistrations: configured("casualRegistrations", 0),
    casualSeasonEntries: configured("casualSeasonEntries", 0),
    retentionMonths: configured("retentionMonths", 12),
    retentionWeeks: configured("retentionWeeks", 52),
    sgtCostCents: configured("sgtCostCents", 150000),
    cashPrizesCents: configured("cashPrizesCents", 120000),
    creditExposureCents: configured("creditExposureCents", 160000),
    merchandiseCostCents: configured("merchandiseCostCents", 72000),
    contingencyCents: configured("contingencyCents", 30000),
    feeBasisPoints: configured("feeBasisPoints", 0),
    fixedFeeCents: configured("fixedFeeCents", 0),
    profitGoalCents: configured("profitGoalCents", 100000),
  });
  const prices = Object.fromEntries(
    CGL_DEFAULT_PLANS.map((plan) => [
      plan.id,
      rows(data.plans).find((item) => item.code === plan.id)?.price_cents ??
        plan.priceCents,
    ]),
  );
  const forecast = financialScenario({ ...input, prices });
  const payments = rows(data.payments);
  const testBilling = row(data.billing);
  const billingIsTest = str(testBilling.environment, "sandbox") !== "production";
  const overview = row(data.overview);
  const actual = num(overview.annual_revenue_cents);
  const labels: Record<string, string> = {
    annualMembers: "Annual members",
    monthlyMembers: "Monthly members",
    weeklyMembers: "Weekly members",
    casualRegistrations: "Casual registrations",
    casualSeasonEntries: "Casual season entries",
    retentionMonths: "Monthly retention (months)",
    retentionWeeks: "Weekly retention (weeks)",
    sgtCostCents: "SGT annual cost (cents)",
    cashPrizesCents: "Annual cash prizes (cents)",
    creditExposureCents: "Credit redemption exposure (cents)",
    merchandiseCostCents: "Merchandise cost (cents)",
    contingencyCents: "Contingency (cents)",
    feeBasisPoints: "Square fee (basis points)",
    fixedFeeCents: "Fixed fee per payment (cents)",
    profitGoalCents: "Surplus goal (cents)",
  };
  return (
    <div className={s.vertical}>
      <div className={s.miniStats}>
        <article className={s.metric}>
          <span>Annual paid revenue</span>
          <strong>{aud(actual)}</strong>
          <small>Confirmed records, accounting for refunds</small>
        </article>
        <article className={s.metric}>
          <span>Forecast annual revenue</span>
          <strong>{aud(forecast.forecastRevenueCents)}</strong>
          <small>Scenario, not collected income</small>
        </article>
        <article className={s.metric}>
          <span>Forecast operating surplus</span>
          <strong>{aud(forecast.forecastSurplusCents)}</strong>
          <small>Before tax and unbudgeted expenses</small>
        </article>
        <article className={s.metric}>
          <span>Gap to surplus target</span>
          <strong>{aud(forecast.targetGapCents)}</strong>
          <small>Includes maximum configured reward exposure</small>
        </article>
      </div>
      <div className={s.miniStats}>
        {[
          ["Credits issued", str(overview.credits_issued, "0")],
          ["Credits redeemed", str(overview.credits_redeemed, "0")],
          ["Credits expired", str(overview.credits_expired, "0")],
          ["Credits outstanding", str(overview.credits_outstanding, "0")],
          [
            "Maximum redemption exposure",
            aud(overview.maximum_redemption_value_cents),
          ],
          [
            "Actual merchandise cost",
            aud(overview.actual_merchandise_cost_cents),
          ],
          ["Recorded processing fees", aud(overview.processing_fees_cents)],
        ].map(([label, value]) => (
          <article className={s.metric} key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className={s.notice}>
        Planning scenario only. Enter the applicable Square rates; zero means
        fees have not been configured. Issued credits remain a potential
        redemption obligation. Actual merchandise costs and prize fulfilment
        must be recorded separately.
      </div>
      <article className={s.panel}>
        <h3>Scenario & break-even planning</h3>
        <div className={s.formGrid}>
          {Object.entries(input).map(([key, value]) => (
            <label className={s.field} key={key}>
              {labels[key]}
              <input
                type="number"
                min={0}
                step={1}
                value={value}
                onChange={(e) =>
                  setInput({
                    ...input,
                    [key]: Math.max(0, Math.floor(Number(e.target.value))),
                  })
                }
              />
            </label>
          ))}
        </div>
        <p style={{ marginTop: 20 }}>
          Forecast fees {aud(forecast.estimatedFeesCents)} · Total budgeted
          costs {aud(forecast.budgetedCostsCents)} · Break-even revenue at these
          costs {aud(forecast.budgetedCostsCents)}.
        </p>
        <div className={s.actions}>
          <button
            className={s.secondary}
            disabled={busy}
            onClick={() =>
              void send("save_settings", {
                record: { key: "financial", value: input },
                reason:
                  "Save the financial planning scenario from the admin finance tool",
              })
            }
          >
            Save planning assumptions
          </button>
          <button
            className={s.smallButton}
            onClick={() => exportCsv(payments, "payments")}
          >
            <Download size={13} />
            Export payments
          </button>
        </div>
      </article>
      <RecordList
        items={payments}
        columns={["created_at", "member_id", "kind", "amount_cents", "state"]}
      />
      <article className={s.panel}>
        <h3>{billingIsTest ? "Square Sandbox — test billing" : "Square production — live billing"}</h3>
        <p className={s.muted}>
          {billingIsTest
            ? "Test payments are excluded from real revenue, competition entry and gifts."
            : "Confirmed production payments are included in live revenue and eligible access."}
          {" "}Failed or unmatched notifications remain visible for reconciliation.
          {!billingIsTest && testBilling.recurringEnabled !== true ? " Recurring memberships remain intentionally disabled for the staged launch." : ""}
        </p>
        <div className={s.actions}>
          <button
            type="button"
            className={s.secondary}
            disabled={busy}
            onClick={() =>
              void send("verify_square_connection", {
                reason:
                  "Verify the configured Square seller and active AUD location without creating a payment",
              })
            }
          >
            <ShieldCheck size={13} />
            Verify Square connection
          </button>
          <button
            type="button"
            className={s.secondary}
            disabled={busy}
            onClick={() =>
              void send("audit_square_catalog", {
                reason:
                  "Read-only verification of the mapped Square recurring products, AUD prices and billing cadence",
              })
            }
          >
            <ShieldCheck size={13} />
            Audit Square plan prices
          </button>
        </div>
        <h4>{billingIsTest ? "Test memberships" : "Square memberships"}</h4>
        <RecordList items={rows(testBilling.memberships)} columns={["member_id", "plan_code", "state", "paid_through", "next_billing_at"]} />
        <h4>{billingIsTest ? "Test payment history" : "Square payment history"}</h4>
        <RecordList items={rows(testBilling.payments)} columns={["created_at", "member_id", "kind", "amount_cents", "state", "external_id"]} />
        <h4>Webhook recovery queue</h4>
        <RecordList items={rows(testBilling.events).filter(event => !["reconciled", "ignored"].includes(str(event.state)))} columns={["event_id", "event_type", "state", "attempts", "next_attempt_at", "review_reason"]} />
      </article>
    </div>
  );
}

export default function CglAdminCentre() {
  const [data, setData] = useState<CglSnapshot>({ status: "loading" });
  const [tab, setTab] = useState("Overview");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<CglRow>({});
  const billing = row(data.billing);
  const billingIsTest = str(billing.environment, "sandbox") !== "production";
  const load = useCallback(async (accessToken?: string) => {
    try {
      const response = await fetch("/api/cgl/admin", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        cache: "no-store",
      });
      const result = await response.json();
      setData({ ...result, httpStatus: response.status });
    } catch {
      setData({
        status: "error",
        message: "The CGL admin service could not be reached.",
      });
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const client = getSupabaseBrowserClient();
    if (client)
      client.auth.getSession().then(({ data: auth }) => {
        if (active) {
          const t = auth.session?.access_token ?? "";
          setToken(t);
          void load(t);
        }
      });
    else void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [load]);
  const send: Send = async (action, payload) => {
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const response = await fetch("/api/cgl/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          str(result.error ?? result.message, "The change could not be saved."),
        );
      const actionResult = row(result.result);
      setMessage(
        str(
          result.message ?? actionResult.message,
          "Saved. The change has been recorded in the CGL audit log.",
        ),
      );
      await load(token);
      return true;
    } catch (e) {
      setFailed(true);
      setMessage(
        e instanceof Error ? e.message : "The change could not be saved.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const list = (key: string) => rows(data[key]);
  const config = row(data.settings_map);
  const seasonOptions = list("seasons").map((r) => ({
    value: str(r.id),
    label: str(r.name),
  }));
  const memberOptions = list("members").map((r) => ({
    value: str(r.id),
    label: str(r.sgt_username ?? r.display_name ?? r.email),
  }));
  const weekOptions = list("weeks").map((r) => ({
    value: str(r.id),
    label: str(r.name),
  }));
  const idField = (
    key: string,
    label: string,
    values: { value: string; label: string }[],
  ): Field => ({ key, label, type: "select", options: values, required: true });
  const reasonRecord = (r: CglRow) => setSelected(r);
  const notice = message ? (
    <div
      className={`${s.notice} ${failed ? s.error : s.success}`}
      role={failed ? "alert" : "status"}
    >
      {message}
    </div>
  ) : null;
  if (data.status === "loading")
    return (
      <div className={s.page}>
        <CglEmpty title="Checking CGL administrator access…">
          Your permissions are verified on the server.
        </CglEmpty>
      </div>
    );
  if (data.httpStatus === 401 || data.httpStatus === 403)
    return (
      <div className={s.page}>
        <CglHeading
          label="Private CGS operations"
          title="CGL league administration"
        >
          Sign in with your existing CGS admin access or an authorised CGL role.
        </CglHeading>
        <div className={`${s.panel} ${s.login}`}>
          <ShieldCheck size={27} />
          <h2 style={{ marginTop: 20 }}>Administrator access required</h2>
          <p>
            Member contact details, payments and league controls are private.
          </p>
          <ClubhouseAdminLogin />
          <div className={s.actions}>
            <Link className={s.textLink} href="/cgl/dashboard">
              Sign in with a CGS member account
            </Link>
          </div>
        </div>
      </div>
    );
  return (
    <div className={s.page}>
      <div className={s.sectionHead}>
        <CglHeading label="CGS operations / CGL" title="Run the league.">
          Manage the season, verify results and look after your players.
        </CglHeading>
        <button className={s.smallButton} onClick={() => void load(token)}>
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>
      <div className={s.actions} style={{ margin: "0 0 25px" }}>
        <Link className={s.textLink} href="/clubhouse-admin">
          <ArrowLeft size={13} />
          CGS operations
        </Link>
        <Link className={s.textLink} href="/cgl">
          Public clubhouse
          <ArrowRight size={13} />
        </Link>
        <Link className={s.textLink} href="/cgl/preview/season-1">
          Review Season 1 design
          <ArrowRight size={13} />
        </Link>
        <span className={s.badge}>{billingIsTest
          ? "Square Sandbox · Live billing disabled"
          : `Square production · ${billing.livePaymentsEnabled === true ? "One-off payments enabled" : "Launch disabled"}`}</span>
      </div>
      {data.status !== "ready" ? (
        <div className={s.notice} role="status">
          {str(
            data.message,
            "CGL database setup is required before these controls can save records. No existing CGS data has been changed.",
          )}
        </div>
      ) : null}
      {notice}
      <div className={s.adminLayout}>
        <nav className={s.adminNav} aria-label="CGL administration">
          {(data.role === "results_admin"
            ? ["Overview", "Results & imports"]
            : sections
          ).map((section) => (
            <button
              key={section}
              aria-current={section === tab ? "page" : undefined}
              onClick={() => {
                setTab(section);
                setSelected({});
                setMessage("");
              }}
            >
              {section}
            </button>
          ))}
        </nav>
        <div className={s.adminContent}>
          {tab === "Overview" && data.role === "results_admin" ? (
            <article className={s.panel}>
              <h2>Results administration</h2>
              <p>
                Review imported scoring evidence, resolve data mismatches and
                calculate provisional results. Publishing rewards and membership
                operations require a league administrator.
              </p>
              <div className={s.actions}>
                <button
                  className={s.primary}
                  onClick={() => setTab("Results & imports")}
                >
                  Review results
                  <ArrowRight size={13} />
                </button>
              </div>
            </article>
          ) : null}
          {tab === "Overview" && data.role !== "results_admin" ? (
            <>
              <div className={s.miniStats}>
                {[
                  ["Registered players", list("members").length],
                  [
                    "Active memberships",
                    list("memberships").filter((m) => m.state === "active")
                      .length,
                  ],
                  [
                    "Failed payments",
                    list("payments").filter((p) => p.state === "failed").length,
                  ],
                  [
                    "Pending prizes",
                    list("prizes").filter((p) => p.state === "pending").length,
                  ],
                ].map(([title, value]) => (
                  <article className={s.metric} key={String(title)}>
                    <span>{title}</span>
                    <strong>
                      {data.status === "ready" ? String(value) : "—"}
                    </strong>
                  </article>
                ))}
              </div>
              <div className={s.grid2}>
                <article className={s.panel}>
                  <h2>Season readiness</h2>
                  <ul>
                    <li>{list("seasons").length} seasons configured</li>
                    <li>
                      {
                        list("weeks").filter(
                          (w) =>
                            w.status === "published" || w.status === "open",
                        ).length
                      }{" "}
                      published events
                    </li>
                    <li>
                      {
                        list("results").filter(
                          (r) => r.state === "pending" || r.state === "review",
                        ).length
                      }{" "}
                      results awaiting review
                    </li>
                    <li>
                      {
                        list("orders").filter((o) => o.state === "pending")
                          .length
                      }{" "}
                      reward orders to fulfil
                    </li>
                  </ul>
                  <div className={s.actions}>
                    <button
                      className={s.smallButton}
                      onClick={() => setTab("Seasons & fixtures")}
                    >
                      Manage fixtures
                    </button>
                  </div>
                </article>
                <article className={s.panel}>
                  <h2>Before opening the season</h2>
                  <p>
                    Approve competition and membership terms, complete the
                    controlled Square launch, verify the SGT import process, and publish
                    confirmed dates. Annual rankings and C Grade remain inactive
                    until explicitly configured.
                  </p>
                  <div className={s.actions}>
                    <button
                      className={s.smallButton}
                      onClick={() => setTab("Settings")}
                    >
                      Review settings
                    </button>
                    <Link className={s.textLink} href="/cgl/terms">
                      Draft policies
                    </Link>
                  </div>
                </article>
              </div>
            </>
          ) : null}
          {tab === "SGT live sync" ? (
            <SgtLiveSync data={data} send={send} busy={busy} />
          ) : null}
          {tab === "Members" ? (
            <div className={s.vertical}>
              <h3 style={{ fontSize: 22, fontWeight: 800 }}>
                SGT connection reviews
              </h3>
              <RecordList
                items={list("sgt_link_requests")}
                columns={["sgt_username", "sgt_id", "state"]}
                onSelect={(r) => setSelected({ ...r, _sgt: true })}
              />
              <OperationForm
                key={`sgt-${selected._sgt ? str(selected.id) : "new"}`}
                title="Verify an SGT identity"
                description="Compare the requested username and long ID with the official SGT profile. This does not verify a handicap automatically."
                action="verify_sgt"
                envelope={false}
                busy={busy}
                send={send}
                fields={[
                  {
                    key: "id",
                    label: "Link request ID",
                    initial: selected._sgt ? str(selected.id, "") : "",
                    required: true,
                  },
                  {
                    key: "state",
                    label: "Decision",
                    type: "select",
                    options: options(["verified", "rejected"]),
                    required: true,
                  },
                ]}
              />
              <RecordList
                items={list("members")}
                columns={[
                  "sgt_username",
                  "email",
                  "handicap",
                  "handicap_status",
                  "eligibility",
                ]}
                onSelect={reasonRecord}
              />
              <OperationForm
                key={`member-${str(selected.id, "")}`}
                title={
                  selected.id
                    ? `Manage ${str(selected.sgt_username ?? selected.display_name)}`
                    : "Member eligibility & handicap"
                }
                description="Select a player above. Verified handicap and eligibility changes require an explanation."
                action="update_member"
                send={send}
                record={selected}
                busy={busy}
                fields={[
                  { key: "id", label: "Member ID", required: true },
                  {
                    key: "handicap",
                    label: "Verified handicap",
                    type: "number",
                  },
                  {
                    key: "handicap_status",
                    label: "Handicap status",
                    type: "select",
                    options: options(["unverified", "qualifying", "verified"]),
                  },
                  {
                    key: "qualifying_holes",
                    label: "Eligible qualifying holes",
                    type: "number",
                  },
                  {
                    key: "eligibility",
                    label: "League eligibility",
                    type: "select",
                    options: options(["active", "suspended"]),
                  },
                  {
                    key: "handicap_verified_at",
                    label: "Handicap verified at (Brisbane)",
                    type: "datetime",
                  },
                  {
                    key: "private_notes",
                    label: "Internal notes",
                    type: "textarea",
                  },
                ]}
              />
              <OperationForm
                title="Assign or override a division"
                description="The division locks for a championship. Every override needs a recorded reason."
                action="assign_division"
                envelope={false}
                send={send}
                busy={busy}
                fields={[
                  idField("memberId", "Player", memberOptions),
                  idField("seasonId", "Season", seasonOptions),
                  {
                    key: "division",
                    label: "Division",
                    type: "select",
                    options: options(["A", "B"]),
                  },
                ]}
              />
            </div>
          ) : null}
          {tab === "Seasons & fixtures" ? (
            <div className={s.vertical}>
              <OperationForm
                title="Generate a complete season fixture"
                description="Creates 13 draft weeks: three qualification and ten championship. Set exact 13-week season dates first. Existing fixtures are preserved."
                action="generate_fixtures"
                envelope={false}
                busy={busy}
                send={send}
                fields={[idField("seasonId", "Season", seasonOptions)]}
              />
              <PublishBlock weeks={list("weeks")} busy={busy} send={send} />
              <RecordList
                items={list("seasons")}
                columns={["name", "year", "format", "starts_at", "status"]}
                onSelect={(r) => setSelected({ ...r, _season: true })}
              />
              <OperationForm
                key={`season-${selected._season ? str(selected.id) : "new"}`}
                title={selected._season ? "Edit season" : "Create a season"}
                action={selected._season ? "save_season" : "create_season"}
                record={selected._season ? selected : undefined}
                busy={busy}
                send={send}
                fields={[
                  { key: "name", label: "Season name", required: true },
                  { key: "slug", label: "URL label", required: true },
                  {
                    key: "year",
                    label: "Year",
                    type: "number",
                    initial: 2027,
                    required: true,
                  },
                  {
                    key: "season_number",
                    label: "Season number (1–4)",
                    type: "number",
                    initial: 1,
                    required: true,
                  },
                  {
                    key: "format",
                    label: "Scoring format",
                    type: "select",
                    options: options([
                      "aggregate",
                      "redemption",
                      "world_tour",
                      "elements",
                    ]),
                    required: true,
                  },
                  {
                    key: "status",
                    label: "Season status",
                    type: "select",
                    initial: "draft",
                    options: options([
                      "draft",
                      "registration",
                      "published",
                      "active",
                      "closed",
                      "archived",
                    ]),
                  },
                  {
                    key: "starts_at",
                    label: "Starts (Brisbane)",
                    type: "datetime",
                    required: true,
                  },
                  {
                    key: "qualification_ends_at",
                    label: "Qualification ends (Brisbane)",
                    type: "datetime",
                    required: true,
                  },
                  {
                    key: "ends_at",
                    label: "Season ends (Brisbane)",
                    type: "datetime",
                    required: true,
                  },
                ]}
              />
              <h3 style={{ fontSize: 23, fontWeight: 800 }}>Fixtures</h3>
              <RecordList
                items={list("weeks")}
                columns={["name", "phase", "opens_at", "closes_at", "status"]}
                onSelect={(r) => setSelected({ ...r, _fixture: true })}
              />
              <OperationForm
                key={`week-${selected._fixture ? str(selected.id) : "new"}`}
                title={
                  selected._fixture
                    ? "Edit fixture / extend deadline"
                    : "Create fixture"
                }
                action="save_week"
                record={selected._fixture ? selected : undefined}
                busy={busy}
                send={send}
                fields={[
                  idField("season_id", "Season", seasonOptions),
                  {
                    key: "week_number",
                    label: "Season week (1–13)",
                    type: "number",
                    required: true,
                  },
                  {
                    key: "championship_week",
                    label: "Championship week (1–10, blank for qualifying)",
                    type: "number",
                  },
                  { key: "name", label: "Event name", required: true },
                  {
                    key: "phase",
                    label: "Phase",
                    type: "select",
                    options: options(["qualification", "championship"]),
                    required: true,
                  },
                  {
                    key: "status",
                    label: "Publishing status",
                    type: "select",
                    options: options([
                      "draft",
                      "published",
                      "closed",
                      "locked",
                    ]),
                    initial: "draft",
                  },
                  {
                    key: "opens_at",
                    label: "Opens (Brisbane)",
                    type: "datetime",
                    required: true,
                  },
                  {
                    key: "closes_at",
                    label: "Closes (Brisbane)",
                    type: "datetime",
                    required: true,
                  },
                  { key: "course_name", label: "First course" },
                  { key: "second_course_name", label: "Second course" },
                  { key: "sgt_tournament_id", label: "SGT tournament ID" },
                  { key: "sgt_tour_id", label: "SGT tour ID" },
                  {
                    key: "conditions",
                    label: "Conditions / settings",
                    type: "json",
                    initial: "{}",
                  },
                ]}
              />
            </div>
          ) : null}
          {tab === "Results & imports" ? (
            <div className={s.vertical}>
              <div className={s.notice}>
                The official SGT Club API is available in SGT live sync. Its
                read-only scorecards and statistics can assist review, but CGL
                results remain unpublished until an administrator verifies and
                publishes them. Do not invent scorecard details to resolve ties.
              </div>
              <RecordList
                items={list("results")}
                columns={[
                  "sgt_username",
                  "gross",
                  "net",
                  "state",
                  "external_id",
                ]}
                onSelect={reasonRecord}
              />
              <OperationForm
                title="Import official SGT results"
                description="Use the documented JSON import format from the CGL operations guide. Each record needs its source identity and verified scoring evidence. Reimporting the same source does not duplicate awards."
                action="import_results"
                envelope={false}
                busy={busy}
                send={send}
                fields={[
                  idField("weekId", "Fixture", weekOptions),
                  {
                    key: "sourceUrl",
                    label: "Official SGT source URL",
                    required: true,
                  },
                  {
                    key: "rows",
                    label: "Result records (JSON array)",
                    type: "json",
                    initial: "[]",
                    required: true,
                  },
                  {
                    key: "correction",
                    label: "Authorised correction of a verified source",
                    type: "checkbox",
                  },
                ]}
              />
              <OperationForm
                key={`review-${str(selected.id, "")}`}
                title="Review a result"
                action="review_result"
                envelope={false}
                busy={busy}
                send={send}
                fields={[
                  {
                    key: "id",
                    label: "Result ID",
                    initial: str(selected.id, ""),
                    required: true,
                  },
                  {
                    key: "state",
                    label: "Review decision",
                    type: "select",
                    options: options(["verified", "excluded", "pending"]),
                    required: true,
                  },
                ]}
              />
              <div className={s.grid2}>
                {[
                  ["recalculate", "Recalculate points"],
                  ["publish_results", "Verify & publish results"],
                  ["unpublish_results", "Unpublish results"],
                ]
                  .filter(
                    ([action]) =>
                      data.role !== "results_admin" ||
                      action !== "publish_results",
                  )
                  .map(([action, title]) => (
                    <OperationForm
                      key={action}
                      title={title}
                      action={action}
                      envelope={false}
                      busy={busy}
                      send={send}
                      fields={[idField("weekId", "Fixture", weekOptions)]}
                    />
                  ))}
              </div>
              <RecordList
                items={list("imports")}
                columns={["created_at", "source_url", "state", "error"]}
              />
            </div>
          ) : null}
          {tab === "Rewards & prizes" ? (
            <div className={s.vertical}>
              <OperationForm
                title="Reverse an awarded credit prize"
                description="Records an authorised reversal against remaining credits. A spent balance cannot be forced negative. Recalculate and republish corrected results after review."
                action="reverse_prize"
                envelope={false}
                busy={busy}
                send={send}
                fields={[{ key: "id", label: "Prize ID", required: true }]}
              />
              <OperationForm
                title="Create a championship or manual prize"
                description="Record the proposed award, then review and approve it. Cash values use cents; credit values use credits. Physical prizes need a claim deadline."
                action="save_prize"
                busy={busy}
                send={send}
                fields={[
                  idField("member_id", "Player", memberOptions),
                  idField("season_id", "Season", seasonOptions),
                  { key: "category", label: "Award category", required: true },
                  {
                    key: "kind",
                    label: "Prize type",
                    type: "select",
                    options: options(["credits", "cash", "physical"]),
                    required: true,
                  },
                  {
                    key: "amount",
                    label: "Amount / quantity",
                    type: "number",
                    required: true,
                  },
                  {
                    key: "source_key",
                    label: "Unique award reference",
                    required: true,
                    help: "At least 12 characters. Reuse the same reference when retrying the same award.",
                  },
                  {
                    key: "claim_deadline",
                    label: "Physical prize claim deadline (Brisbane)",
                    type: "datetime",
                  },
                ]}
              />
              <RecordList
                items={list("prizes")}
                columns={["category", "member_id", "amount", "state"]}
                onSelect={reasonRecord}
              />
              <OperationForm
                key={`prize-${str(selected.id, "")}`}
                title="Review / approve a prize"
                description="An approved credit prize is issued once. Cash and physical prizes require tracked fulfilment."
                action="review_prize"
                envelope={false}
                busy={busy}
                send={send}
                fields={[
                  {
                    key: "id",
                    label: "Prize ID",
                    initial: str(selected.id, ""),
                    required: true,
                  },
                  {
                    key: "state",
                    label: "Prize status",
                    type: "select",
                    options: options([
                      "verified",
                      "approved",
                      "awarded",
                      "claimed",
                    ]),
                    required: true,
                  },
                ]}
              />
              <OperationForm
                title="Authorised credit adjustment"
                description="Use a positive value to issue credits or a negative value for a documented adjustment. Credits cannot become negative."
                action="adjust_credits"
                envelope={false}
                busy={busy}
                send={send}
                fields={[
                  idField("memberId", "Player", memberOptions),
                  {
                    key: "amount",
                    label: "Credit adjustment",
                    type: "number",
                    required: true,
                  },
                ]}
              />
              <h3 style={{ fontSize: 23, fontWeight: 800 }}>
                Rewards catalogue
              </h3>
              <RecordList
                items={list("catalogue")}
                columns={["name", "credit_price", "stock", "active"]}
                onSelect={(r) => setSelected({ ...r, _catalogue: true })}
              />
              <OperationForm
                key={`catalogue-${selected._catalogue ? str(selected.id) : "new"}`}
                title={selected._catalogue ? "Edit reward" : "Add reward"}
                action="save_catalogue"
                record={selected._catalogue ? selected : undefined}
                busy={busy}
                send={send}
                fields={[
                  { key: "name", label: "Reward name", required: true },
                  {
                    key: "description",
                    label: "Description",
                    type: "textarea",
                  },
                  {
                    key: "credit_price",
                    label: "Credit price",
                    type: "number",
                    required: true,
                  },
                  {
                    key: "retail_cents",
                    label: "Retail price (cents)",
                    type: "number",
                  },
                  {
                    key: "cost_cents",
                    label: "CGS unit purchase cost (cents)",
                    type: "number",
                  },
                  {
                    key: "stock",
                    label: "Available stock",
                    type: "number",
                    initial: 0,
                  },
                  {
                    key: "active",
                    label: "Available for redemption",
                    type: "checkbox",
                  },
                  {
                    key: "fulfilment_method",
                    label: "Fulfilment",
                    type: "select",
                    options: options(["pickup", "dispatch", "digital"]),
                    initial: "pickup",
                  },
                  {
                    key: "available_from",
                    label: "Available from (Brisbane)",
                    type: "datetime",
                  },
                  {
                    key: "available_until",
                    label: "Available until (Brisbane)",
                    type: "datetime",
                  },
                ]}
              />
              <h3 style={{ fontSize: 23, fontWeight: 800 }}>Orders</h3>
              <RecordList
                items={list("orders")}
                columns={[
                  "member_id",
                  "catalogue_id",
                  "credits_spent",
                  "state",
                ]}
                onSelect={(r) => setSelected({ ...r, _order: true })}
              />
              <OperationForm
                key={`order-${str(selected.id, "")}`}
                title="Fulfil a reward order"
                action="fulfil_order"
                envelope={false}
                busy={busy}
                send={send}
                fields={[
                  {
                    key: "id",
                    label: "Order ID",
                    initial: selected._order ? str(selected.id, "") : "",
                    required: true,
                  },
                  {
                    key: "state",
                    label: "Fulfilment status",
                    type: "select",
                    options: options(["ready", "dispatched", "collected"]),
                    required: true,
                  },
                ]}
              />
            </div>
          ) : null}
          {tab === "Merchandise" ? (
            <div className={s.vertical}>
              <RecordList
                items={list("gift_items")}
                columns={["name", "season_id", "unit_cost_cents", "stock"]}
                onSelect={reasonRecord}
              />
              <OperationForm
                key={`giftitem-${str(selected.id, "")}`}
                title="Seasonal gift catalogue"
                action="save_gift_item"
                record={selected}
                busy={busy}
                send={send}
                fields={[
                  idField("season_id", "Season", seasonOptions),
                  { key: "name", label: "Gift name", required: true },
                  {
                    key: "unit_cost_cents",
                    label: "Unit cost (cents)",
                    type: "number",
                    required: true,
                  },
                  {
                    key: "stock",
                    label: "Available stock",
                    type: "number",
                    required: true,
                  },
                  {
                    key: "active",
                    label: "Active",
                    type: "checkbox",
                    initial: true,
                  },
                ]}
              />
              <OperationForm
                title="Review & allocate a member gift"
                description="Eligibility is checked against the membership, payment history and season. Duplicate allocations are blocked."
                action="allocate_gift"
                envelope={false}
                busy={busy}
                send={send}
                fields={[
                  idField("memberId", "Player", memberOptions),
                  idField(
                    "giftItemId",
                    "Gift",
                    list("gift_items").map((r) => ({
                      value: str(r.id),
                      label: str(r.name),
                    })),
                  ),
                ]}
              />
              <RecordList
                items={list("gifts")}
                columns={["member_id", "gift_item_id", "state", "created_at"]}
                onSelect={(r) => setSelected({ ...r, _gift: true })}
              />
              <OperationForm
                key={`gift-${str(selected.id, "")}`}
                title="Gift pickup / dispatch"
                action="fulfil_gift"
                envelope={false}
                busy={busy}
                send={send}
                fields={[
                  {
                    key: "id",
                    label: "Gift allocation ID",
                    initial: selected._gift ? str(selected.id, "") : "",
                    required: true,
                  },
                  {
                    key: "state",
                    label: "Fulfilment status",
                    type: "select",
                    options: options(["ready", "dispatched", "collected"]),
                    required: true,
                  },
                ]}
              />
            </div>
          ) : null}
          {tab === "Finance" ? (
            <Finance data={data} send={send} busy={busy} />
          ) : null}
          {tab === "Communications" ? (
            <div className={s.vertical}>
              <div className={s.notice}>
                In-app notices are supported. Outgoing email is not connected to
                a transactional provider for CGL; no email is sent from this
                screen.
              </div>
              <OperationForm
                title="Publish a member notification"
                description="Preview the text here before adding it to a player's private clubhouse."
                action="notification"
                busy={busy}
                send={send}
                fields={[
                  idField("member_id", "Player", memberOptions),
                  { key: "title", label: "Subject", required: true },
                  {
                    key: "body",
                    label: "Message",
                    type: "textarea",
                    required: true,
                  },
                  {
                    key: "source_key",
                    label: "Unique notification reference",
                    required: true,
                    help: "Use a unique reference of at least 12 characters to prevent duplicate notices.",
                  },
                  {
                    key: "kind",
                    label: "Notice type",
                    type: "select",
                    options: options([
                      "welcome",
                      "payment",
                      "cancellation",
                      "season",
                      "qualifying",
                      "results",
                      "credits",
                      "expiry",
                      "prize",
                      "gift",
                    ]),
                    required: true,
                  },
                ]}
              />
              <article className={s.panel}>
                <h3>Communication templates</h3>
                <p>
                  Welcome: “Welcome to CGL. Connect your SGT identity and check
                  your handicap status in your clubhouse.”
                </p>
                <p>
                  Payment reminder: “A membership payment needs attention. Open
                  Membership to review your confirmed billing record.”
                </p>
                <p>
                  Expiry reminder: “You have CGS Credits nearing their
                  individual expiry dates. Open Rewards to review your available
                  balance.”
                </p>
                <p>
                  Gift available: “Your seasonal gift is ready. Check the pickup
                  or dispatch details in Rewards.”
                </p>
              </article>
            </div>
          ) : null}
          {tab === "Settings" ? (
            <div className={s.vertical}>
              <OperationForm
                title="Cancellation policy"
                settingKey="cancellation_policy"
                record={row(config.cancellation_policy)}
                action="save_settings"
                busy={busy}
                send={send}
                fields={[
                  {
                    key: "mode",
                    label: "When cancellation takes effect",
                    type: "select",
                    options: options([
                      "season_boundary",
                      "paid_term",
                      "immediate",
                    ]),
                    required: true,
                  },
                  {
                    key: "approved",
                    label:
                      "CGS owner has confirmed this operating policy",
                    type: "checkbox",
                  },
                ]}
              />
              <OperationForm
                title="Annual championship formula"
                settingKey="annual_formula"
                record={row(config.annual_formula)}
                action="save_settings"
                busy={busy}
                send={send}
                fields={[
                  {
                    key: "method",
                    label: "Method",
                    type: "select",
                    options: options(["pending", "sum", "best_seasons"]),
                    required: true,
                  },
                  {
                    key: "counted_seasons",
                    label: "Counted seasons for best-seasons method",
                    type: "number",
                    initial: 4,
                  },
                  {
                    key: "approved",
                    label: "CGS has approved this annual formula",
                    type: "checkbox",
                  },
                ]}
              />
              <OperationForm
                title="Division configuration"
                settingKey="divisions"
                record={row(config.divisions)}
                action="save_settings"
                busy={busy}
                send={send}
                fields={[
                  {
                    key: "c_grade_enabled",
                    label:
                      "Explicitly activate future C Grade after participation review",
                    type: "checkbox",
                  },
                ]}
              />
              <OperationForm
                title="Membership terms approval"
                description="Record the reviewed document version. An approval here does not itself enable Square checkout or production billing."
                settingKey="legal"
                record={row(config.legal)}
                action="save_settings"
                busy={busy}
                send={send}
                fields={[
                  {
                    key: "version",
                    label: "Approved terms version / document reference",
                    required: true,
                  },
                  {
                    key: "approved",
                    label:
                      "Final terms approved by CGS after the required review",
                    type: "checkbox",
                  },
                ]}
              />
              <RecordList
                items={list("plans")}
                columns={[
                  "code",
                  "name",
                  "price_cents",
                  "billing_interval",
                  "active",
                ]}
                onSelect={reasonRecord}
              />
              <OperationForm
                key={`plan-${str(selected.code, "")}`}
                title="Membership pricing"
                action="save_plan"
                record={selected.code ? selected : undefined}
                busy={busy}
                send={send}
                fields={[
                  {
                    key: "code",
                    label: "Plan",
                    type: "select",
                    options: options([
                      "annual",
                      "monthly",
                      "weekly",
                      "casual_registration",
                      "casual_season",
                    ]),
                    required: true,
                  },
                  { key: "name", label: "Display name", required: true },
                  {
                    key: "price_cents",
                    label: "AUD price (cents)",
                    type: "number",
                    required: true,
                  },
                  {
                    key: "billing_interval",
                    label: "Billing interval",
                    type: "select",
                    options: options(["annual", "monthly", "weekly", "once"]),
                    required: true,
                  },
                  {
                    key: "full_member",
                    label: "Full membership",
                    type: "checkbox",
                  },
                  {
                    key: "auto_renew",
                    label: "Automatic renewal",
                    type: "checkbox",
                  },
                  {
                    key: "active",
                    label: "Plan active",
                    type: "checkbox",
                    initial: true,
                  },
                  {
                    key: "config",
                    label: "Square variation / billing configuration",
                    type: "json",
                    initial: "{}",
                  },
                ]}
              />
              <OperationForm
                key={`settings-${selected._setting ? str(selected.key) : "new"}`}
                title="League settings"
                description="Version and review rule changes before using them in a published competition. Approved customer terms are an independent requirement before production checkout can be enabled."
                action="save_settings"
                record={
                  selected._setting
                    ? { key: selected.key, value: selected.value }
                    : undefined
                }
                busy={busy}
                send={send}
                fields={[
                  {
                    key: "key",
                    label: "Configuration",
                    type: "select",
                    options: options([
                      "points",
                      "divisions",
                      "rewards",
                      "prizes",
                      "gifts",
                      "cancellation_policy",
                      "annual_formula",
                      "legal",
                      "sgt",
                      "financial",
                    ]),
                    required: true,
                  },
                  {
                    key: "value",
                    label: "Configuration values (JSON)",
                    type: "json",
                    initial: "{}",
                    required: true,
                  },
                ]}
              />
              <RecordList
                items={list("settings")}
                columns={["key", "updated_at"]}
                onSelect={(r) => setSelected({ ...r, _setting: true })}
              />
              {selected._setting ? (
                <pre className={s.json}>
                  {JSON.stringify(selected.value, null, 2)}
                </pre>
              ) : null}
              <div className={s.notice}>
                Do not enable C Grade or an annual aggregation formula without
                CGS approval. Fully credit-funded recurring Square invoices
                remain disabled until a supported reconciliation flow is
                implemented.
              </div>
            </div>
          ) : null}
          {tab === "Audit log" ? (
            <>
              <div className={s.actions} style={{ margin: "0 0 20px" }}>
                <button
                  className={s.smallButton}
                  onClick={() => exportCsv(list("audit_events"), "audit")}
                >
                  <Download size={13} />
                  Export audit log
                </button>
              </div>
              <RecordList
                items={list("audit_events")}
                columns={["created_at", "actor", "action", "reason"]}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
