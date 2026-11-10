const test = require("node:test");
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

let rpcCalls, queue, dbRows, queryCalls, rpcOverride, requests, overrides;
const originalFetch = global.fetch;
const savedEnv = { ...process.env };
const fakeEnv = { CGL_SQUARE_ENVIRONMENT: "sandbox", CGL_SQUARE_ACCESS_TOKEN: "unit-test-token", CGL_SQUARE_MERCHANT_ID: "merchant", CGL_SQUARE_LOCATION_ID: "location", CGL_SQUARE_WEBHOOK_SIGNATURE_KEY: "unit-test-key", CGL_SQUARE_WEBHOOK_URL: "https://example.test/api/cgl/square-webhook", CGL_SQUARE_CHECKOUT_ENABLED: "true", CGL_SQUARE_SANDBOX_TESTING_ENABLED: "true", CGL_SQUARE_TERMS_APPROVED: "false", CGL_SQUARE_APPLICATION_ID: "sandbox-sq0idb-coifDq2jybhW8YXqBoxAyw" };
const intent = { id: "bc403e80-2279-46de-89f5-7a036d3f5c74", member_id: "b83e731e-7613-4249-9684-e41c587ea305", membership_id: "f3b9af69-323f-443f-a451-ce8e7782ab1b", plan_code: "monthly", amount_cents: 2995, recurring: true, square_plan_variation_id: "variation", payment_link_url: null, square_order_id: "template", season_id: null };
const variation = { id: "variation", type: "SUBSCRIPTION_PLAN_VARIATION", present_at_all_locations: true, subscription_plan_variation_data: { subscription_plan_id: "plan", phases: [{ cadence: "MONTHLY", pricing: { type: "STATIC", price: { amount: 2995, currency: "AUD" } } }] } };
const subscription = { id: "subscription", location_id: "location", customer_id: "customer", plan_variation_id: "variation", start_date: "2027-01-31", charged_through_date: "2027-03-30", status: "ACTIVE", timezone: "UTC", version: 3, monthly_billing_anchor_date: 31, invoice_ids: ["invoice2", "invoice1"], phases: [{ ordinal: 0, order_template_id: "template" }] };
function invoice(id, dueDate) { return { id, location_id: "location", order_id: `order${id.slice(-1)}`, subscription_id: "subscription", primary_recipient: { customer_id: "customer", email_address: "never-authorize@example.test" }, timezone: "UTC", status: "PAID", version: 2, created_at: `${dueDate}T00:00:00Z`, updated_at: "2027-02-28T00:10:00Z", payment_requests: [{ request_type: "BALANCE", due_date: dueDate, automatic_payment_source: "CARD_ON_FILE", computed_amount_money: { amount: 2995, currency: "AUD" }, total_completed_amount_money: { amount: 2995, currency: "AUD" } }] }; }
function payment(id) { return { id, location_id: "location", customer_id: "customer", order_id: `order${id.slice(-1)}`, amount_money: { amount: 2995, currency: "AUD" }, status: "COMPLETED", updated_at: "2027-03-05T00:00:00Z", version_token: "latest", note: `CGL checkout ${intent.id}`, processing_fee: [{ amount_money: { amount: 50, currency: "AUD" } }] }; }
async function rpc(name, args) {
  rpcCalls.push([name, args]);
  if (rpcOverride) { const result = await rpcOverride(name, args); if (result !== undefined) return result; }
  if (name === "cgl_enqueue_square_event") {
    const old = queue.get(args.p_event_id);
    if (old && old.body_hash !== args.p_body_hash) return { data: null, error: { message: "hash mismatch" } };
    if (!old) queue.set(args.p_event_id, { event_id: args.p_event_id, event_type: args.p_event_type, occurred_at: args.p_occurred_at, body_hash: args.p_body_hash, event_data: args.p_event_data, lease_token: null, state: "queued" });
    return { data: { event_id: args.p_event_id, state: old?.state ?? "queued", duplicate: Boolean(old), queued: !old }, error: null };
  }
  if (name === "cgl_claim_square_events") {
    const jobs = [...queue.values()].filter(job => (!args.p_event_id || job.event_id === args.p_event_id) && job.state === "queued").slice(0, args.p_limit);
    for (const job of jobs) { job.state = "processing"; job.lease_token = "a5400f5c-6be5-4d5a-bded-cf204c245d8d"; }
    return { data: jobs.map(job => ({ ...job })), error: null };
  }
  if (name === "cgl_reconcile_square_event") { if (queue.has(args.p_event_id)) queue.get(args.p_event_id).state = "reconciled"; return { data: { state: "reconciled" }, error: null }; }
  if (name === "cgl_fail_square_event") { if (queue.has(args.p_event_id)) queue.get(args.p_event_id).state = args.p_retryable ? "retry" : "review"; return { data: { state: args.p_retryable ? "retry" : "review" }, error: null }; }
  return { data: null, error: null };
}
const sourcePath = path.resolve(__dirname, "../lib/cgl-square.ts");
const loaded = new Module(sourcePath, module);
loaded.filename = sourcePath;
loaded.paths = module.paths;
loaded.require = name => {
  if (name === "server-only") return {};
  if (name === "@/lib/supabase-admin") return { getSupabaseAdmin: () => ({ rpc, from(table) {
    const call = { table, filters: [], limit: null }; queryCalls.push(call);
    const builder = { select() { return builder; }, eq(key, value) { call.filters.push([key, value]); return builder; }, order() { return builder; }, limit(value) { call.limit = value; return builder; }, then(resolve, reject) { const rows = dbRows.filter(row => call.filters.every(([key, value]) => row[key] === value)); return Promise.resolve({ data: rows.slice(0, call.limit ?? rows.length), error: null }).then(resolve, reject); } };
    return builder;
  } }) };
  return module.require(name);
};
loaded._compile(ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, sourcePath);
const square = loaded.exports;
function template() { const body = square.buildCglSquareCheckout(intent, "location", "https://example.test/cgl/dashboard"); return { ...body.order, id: "template", state: "OPEN" }; }
function standardResources() {
  return {
    "/merchants/merchant": { merchant: { id: "merchant", status: "ACTIVE", country: "AU" } },
    "/locations/location": { location: { id: "location", merchant_id: "merchant", status: "ACTIVE", country: "AU", currency: "AUD", timezone: "UTC" } },
    "/catalog/object/variation": { object: variation }, "/catalog/object/plan": { object: { id: "plan", type: "SUBSCRIPTION_PLAN" } },
    "/orders/template": { order: template() },
    "/subscriptions/subscription?include=actions": { subscription },
    "/subscriptions/search": { subscriptions: [subscription] },
    "/subscriptions/subscription/events?limit=100": { subscription_events: [{ subscription_event_type: "START_SUBSCRIPTION", effective_date: "2027-01-31" }] },
    "/invoices/invoice1": { invoice: invoice("invoice1", "2027-01-31") }, "/invoices/invoice2": { invoice: invoice("invoice2", "2027-02-28") },
    "/orders/order1": { order: { id: "order1", location_id: "location", tenders: [{ payment_id: "payment1" }] } },
    "/orders/order2": { order: { id: "order2", location_id: "location", tenders: [{ payment_id: "payment2" }] } },
    "/payments/payment1": { payment: payment("payment1") }, "/payments/payment2": { payment: payment("payment2") },
    "/refunds/refund": { refund: { id: "refund", payment_id: "payment1", location_id: "location" } },
  };
}
test.beforeEach(() => {
  for (const key of Object.keys(process.env)) if (key.startsWith("CGL_SQUARE_")) delete process.env[key];
  Object.assign(process.env, fakeEnv);
  rpcCalls = []; queue = new Map(); dbRows = []; queryCalls = []; requests = []; overrides = {}; rpcOverride = null;
  global.fetch = async (url, options = {}) => {
    const base = "https://connect.squareupsandbox.com/v2";
    assert(String(url).startsWith(base), "every request is Sandbox-only");
    assert.equal(options.headers.Authorization, "Bearer unit-test-token");
    assert.equal(options.headers["Square-Version"], "2026-09-16");
    const endpoint = String(url).slice(base.length); requests.push([endpoint, options]);
    const resource = Object.hasOwn(overrides, endpoint) ? overrides[endpoint] : standardResources()[endpoint];
    if (typeof resource === "function") return resource(options);
    assert.notEqual(resource, undefined, `unexpected request ${endpoint}`);
    return Response.json(structuredClone(resource));
  };
});
test.afterEach(() => { global.fetch = originalFetch; for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key]; Object.assign(process.env, savedEnv); });
async function receive(kind = "subscription.updated", id = "subscription", changes = {}) {
  const raw = JSON.stringify({ event_id: "event", type: kind, merchant_id: "merchant", created_at: "2027-03-01T00:00:00Z", data: { id, type: kind.split(".")[0] }, ...changes });
  const signature = createHmac("sha256", "unit-test-key").update(fakeEnv.CGL_SQUARE_WEBHOOK_URL + raw).digest("base64");
  return square.receiveCglSquareWebhook(raw, signature, "Sandbox");
}
function reconciled() { return rpcCalls.findLast(([name]) => name === "cgl_reconcile_square_event")?.[1].p_normalized; }

test("Sandbox test permission is separate from real terms and production is locked out", () => {
  assert.equal(square.getCglSquareReadiness({}).ready, false);
  const ready = square.getCglSquareReadiness(fakeEnv);
  assert.equal(ready.ready, true); assert.equal(ready.termsApproved, false); assert.equal(ready.subscriptionActionsEnabled, false);
  for (const change of [{ CGL_SQUARE_ENVIRONMENT: "production" }, { CGL_SQUARE_APPLICATION_ID: "sq0idp-D7j5iaD6eNFS0_KiNk3YEA" }, { CGL_SQUARE_SANDBOX_TESTING_ENABLED: "false", CGL_SQUARE_TERMS_APPROVED: "true" }, { CGL_SQUARE_WEBHOOK_URL: "http://example.test/hook" }]) assert.equal(square.getCglSquareReadiness({ ...fakeEnv, ...change }).ready, false);
});
test("webhook signature binds exact body and URL, including trailing slash", () => {
  const raw = '{"x":1}', key = "key", url = "https://example.test/hook", sig = createHmac("sha256", key).update(url + raw).digest("base64");
  assert(square.verifyCglSquareSignature(raw, sig, key, url));
  assert(!square.verifyCglSquareSignature(raw + " ", sig, key, url)); assert(!square.verifyCglSquareSignature(raw, sig, key, url + "/")); assert(!square.verifyCglSquareSignature(raw, "short", key, url));
});
test("provider connection validates seller, active AU/AUD location and timezone without webhook credentials", async () => {
  delete process.env.CGL_SQUARE_WEBHOOK_SIGNATURE_KEY; delete process.env.CGL_SQUARE_WEBHOOK_URL;
  assert.equal((await square.verifyCglSquareConnection()).timezone, "UTC");
  overrides["/locations/location"] = { location: { id: "location", merchant_id: "another", status: "ACTIVE", country: "AU", currency: "AUD", timezone: "UTC" } };
  await assert.rejects(square.verifyCglSquareConnection(), /does not match/);
});
test("canonical STATIC pricing.price, exact AUD price and each cadence are verified", () => {
  for (const [plan_code, cadence] of [["annual", "ANNUAL"], ["monthly", "MONTHLY"], ["weekly", "WEEKLY"]]) { const value = structuredClone(variation); value.subscription_plan_variation_data.phases[0].cadence = cadence; square.validateCglSquareVariation(value, { plan_code, amount_cents: 2995 }); }
  for (const mutation of [v => v.subscription_plan_variation_data.can_prorate = true, v => v.subscription_plan_variation_data.monthly_billing_anchor_date = 1, v => v.subscription_plan_variation_data.phases[0].periods = 13, v => v.subscription_plan_variation_data.phases.push(v.subscription_plan_variation_data.phases[0]), v => v.subscription_plan_variation_data.phases[0].pricing.price.currency = "USD", v => v.is_deleted = true]) { const value = structuredClone(variation); mutation(value); assert.throws(() => square.validateCglSquareVariation(value, intent)); }
  assert.throws(() => square.validateCglSquareVariation(variation, { ...intent, amount_cents: 1 }));
});
test("hosted checkout carries stable authenticated identities without forwarding an email", () => {
  const body = square.buildCglSquareCheckout(intent, "location", "https://example.test/dashboard", "member@example.test");
  assert.equal(body.quick_pay, undefined); assert.equal(body.order.reference_id, `cgl:${intent.id}`); assert.equal(body.order.metadata.cgl_member_id, intent.member_id); assert.equal(body.order.customer_id, undefined); assert.equal(body.checkout_options.subscription_plan_id, "variation"); assert.equal(body.order.line_items[0].base_price_money.amount, 2995);
  assert.equal(body.pre_populated_data, undefined); assert(!JSON.stringify(body).includes("member@example.test"));
  for (const plan_code of ["casual_registration", "casual_season"]) assert.equal(square.buildCglSquareCheckout({ ...intent, plan_code, recurring: false, square_plan_variation_id: null }, "location", "https://example.test").checkout_options.subscription_plan_id, undefined);
  assert.throws(() => square.buildCglSquareCheckout({ ...intent, member_id: "another" }, "location", "https://example.test"));
  assert.throws(() => square.buildCglSquareCheckout({ ...intent, amount_cents: 0 }, "location", "https://example.test"));
});
test("redirect allowlist rejects spoofed domains, userinfo and unrelated Square sites", () => {
  for (const url of ["https://square.link/u/test", "https://checkout.squareupsandbox.com/test"]) assert(square.isCglSquareCheckoutUrl(url));
  for (const url of ["https://square.link.evil.test/", "http://square.link/u/x", "https://evil-square.link/", "https://square.site/my-store", "https://user:pass@square.link/u/x", "javascript:alert(1)"]) assert(!square.isCglSquareCheckoutUrl(url));
});
test("payment normalizer ignores note identity and omits card/buyer details", () => {
  const value = square.normalizeCglSquarePayment({ ...payment("payment1"), buyer_email_address: "private@example.test", card_details: { card: { last_4: "1111" } } });
  assert.equal(value.intent_id, null); assert.equal(value.fee_cents, 50); assert.equal(value.updated_at, "2027-03-05T00:00:00Z"); assert(!JSON.stringify(value).includes("private@example.test")); assert(!JSON.stringify(value).includes("1111"));
  assert.throws(() => square.normalizeCglSquarePayment({ id: "x", amount_money: { amount: -1 } }));
});
test("billing dates retain Jan31, leap anniversaries and weekly calendar periods", () => {
  assert.equal(square.getCglSquareBillingBoundary("2027-01-31", "monthly", 1), "2027-02-28"); assert.equal(square.getCglSquareBillingBoundary("2027-01-31", "monthly", 2), "2027-03-31"); assert.equal(square.getCglSquareBillingBoundary("2028-02-29", "annual", 1), "2029-02-28"); assert.equal(square.getCglSquareBillingBoundary("2028-02-29", "annual", 4), "2032-02-29"); assert.equal(square.getCglSquareBillingBoundary("2027-03-28", "weekly", 1), "2027-04-04"); assert.throws(() => square.getCglSquareBillingBoundary("2027-02-31", "monthly", 1));
});

test("webhook acknowledgement durably records only safe IDs without any provider request", async () => {
  const result = await receive();
  assert.equal(result.eventId, "event"); assert.equal(result.event_id, "event"); assert.equal(result.queued, true); assert.equal(requests.length, 0);
  assert.deepEqual(rpcCalls[0][1].p_event_data, { environment: "sandbox", merchant_id: "merchant", object_id: "subscription", object_type: "subscription" });
  assert.equal((await receive()).duplicate, true);
});
test("wrong environment, merchant and forged signatures never enter the queue", async () => {
  await assert.rejects(receive("payment.updated", "payment1", { merchant_id: "another" }));
  await assert.rejects(square.receiveCglSquareWebhook("{}", "forged", "Sandbox"));
  const raw = JSON.stringify({ event_id: "event", type: "payment.updated", merchant_id: "merchant", created_at: "2027-01-01T00:00:00Z", data: { id: "payment1" } });
  const sig = createHmac("sha256", "unit-test-key").update(fakeEnv.CGL_SQUARE_WEBHOOK_URL + raw).digest("base64");
  await assert.rejects(square.receiveCglSquareWebhook(raw, sig, "Production"));
  assert.equal(rpcCalls.length, 0); assert.equal(requests.length, 0);
});
test("subscription-first delivery recovers original template, invoices and verified payments", async () => {
  await receive();
  const result = await square.processQueuedCglSquareEvents({ eventId: "event" });
  assert.equal(result.processed, 1);
  const normalized = reconciled();
  assert.equal(normalized.checkout_link.order_id, "template"); assert.equal(normalized.checkout_link.intent_id, intent.id); assert.equal(normalized.checkout_link.member_id, intent.member_id);
  assert.equal(normalized.subscription.paid_through_date_exclusive, "2027-03-31"); assert.equal(normalized.subscription.next_billing_date, "2027-03-31"); assert.equal(normalized.subscription.billing_supported, true); assert.equal(normalized.subscription.coverage_complete, true);
  assert.equal(normalized.payments.length, 2); assert(normalized.payments.every(item => item.subscription_id === "subscription" && item.intent_id === intent.id));
  assert(normalized.invoices.every(item => item.paid && item.payment_ids.length === 1));
  assert.equal(rpcCalls.findLast(([name]) => name === "cgl_reconcile_square_event")[1].p_lease_token, "a5400f5c-6be5-4d5a-bded-cf204c245d8d");
  assert(!JSON.stringify(normalized).includes("never-authorize@example.test"));
});
test("payment-first delivery finds the exact subscription via invoice order, not customer+plan", async () => {
  await receive("payment.updated", "payment1");
  const result = await square.processQueuedCglSquareEvents({ eventId: "event" });
  assert.equal(result.processed, 1);
  assert.equal(reconciled().subscription.id, "subscription");
  const search = requests.find(([endpoint]) => endpoint === "/subscriptions/search");
  assert.deepEqual(JSON.parse(search[1].body).query.filter, { customer_ids: ["customer"], location_ids: ["location"] });
  assert.equal(reconciled().invoices.find(item => item.id === "invoice1").order_id, "order1");
});
test("invoice-first delivery can reconcile an actual payment whose customer ID is omitted", async () => {
  overrides["/payments/payment1"] = { payment: { ...payment("payment1"), customer_id: null } };
  await receive("invoice.payment_made", "invoice1");
  assert.equal((await square.processQueuedCglSquareEvents({ eventId: "event" })).processed, 1);
  assert.equal(reconciled().payments.find(item => item.id === "payment1").customer_id, null);
  assert.equal(reconciled().subscription.customer_id, "customer"); assert.equal(reconciled().subscription.paid_through_date_exclusive, "2027-03-31");
});
test("completed payment with no proven subscription does not invent one from a note", async () => {
  overrides["/subscriptions/search"] = { subscriptions: [] };
  await receive("payment.updated", "payment1");
  await square.processQueuedCglSquareEvents({ eventId: "event" });
  assert.equal(reconciled().subscription, null); assert.equal(reconciled().checkout_link, null); assert.equal(reconciled().payments[0].intent_id, null);
});
test("invoiced but unpaid cycles cannot extend coverage or skip an unpaid gap", async () => {
  const first = invoice("invoice1", "2027-01-31"); first.status = "UNPAID"; first.payment_requests[0].total_completed_amount_money.amount = 0;
  overrides["/invoices/invoice1"] = { invoice: first };
  overrides["/orders/order1"] = { order: { id: "order1", location_id: "location", tenders: [] } };
  await receive(); await square.processQueuedCglSquareEvents({ eventId: "event" });
  assert.equal(reconciled().subscription.paid_through_date_exclusive, null); assert.equal(reconciled().subscription.coverage_reason, "unpaid_billing_gap");
  assert.equal(reconciled().subscription.next_billing_date, "2027-03-31");
});
test("a failed future invoice preserves the last fully paid contiguous period", async () => {
  const second = invoice("invoice2", "2027-02-28"); second.status = "UNPAID"; second.payment_requests[0].total_completed_amount_money.amount = 0;
  overrides["/invoices/invoice2"] = { invoice: second };
  overrides["/orders/order2"] = { order: { id: "order2", location_id: "location", tenders: [] } };
  await receive("invoice.scheduled_charge_failed", "invoice2"); await square.processQueuedCglSquareEvents({ eventId: "event" });
  assert.equal(reconciled().subscription.paid_through_date_exclusive, "2027-02-28"); assert.equal(reconciled().invoice_failed, true);
});
test("refund revokes its paid-invoice proof and never creates another period", async () => {
  overrides["/payments/payment1"] = { payment: { ...payment("payment1"), refunded_money: { amount: 2995, currency: "AUD" } } };
  await receive("refund.updated", "refund"); await square.processQueuedCglSquareEvents({ eventId: "event" });
  assert.equal(reconciled().payments.find(item => item.id === "payment1").refunded_cents, 2995); assert.equal(reconciled().subscription.paid_through_date_exclusive, null); assert.equal(reconciled().invoices.find(item => item.id === "invoice1").paid, false);
});
test("billing-history modifications and misaligned invoice dates require review", async () => {
  overrides["/subscriptions/subscription/events?limit=100"] = { subscription_events: [{ subscription_event_type: "RESUME_SUBSCRIPTION" }] };
  await receive(); await square.processQueuedCglSquareEvents({ eventId: "event" });
  assert.equal(reconciled().subscription.billing_supported, false); assert.equal(reconciled().subscription.paid_through_date_exclusive, null);
  overrides["/subscriptions/subscription/events?limit=100"] = { subscription_events: [{ subscription_event_type: "START_SUBSCRIPTION" }] };
  const changed = invoice("invoice2", "2027-02-27"); overrides["/invoices/invoice2"] = { invoice: changed };
  queue.get("event").state = "queued";
  await square.processQueuedCglSquareEvents({ eventId: "event" });
  assert.equal(reconciled().subscription.billing_supported, false); assert.equal(reconciled().subscription.coverage_reason, "invoice_period_requires_review");
});
test("forged template markers and wrong-location invoice payments never reach reconciliation", async () => {
  const changed = template(); changed.metadata.cgl_member_id = "forged"; overrides["/orders/template"] = { order: changed };
  await receive(); const first = await square.processQueuedCglSquareEvents({ eventId: "event" });
  assert.equal(first.results[0].state, "review"); assert.equal(reconciled(), undefined);
  overrides["/orders/template"] = { order: template() }; overrides["/payments/payment2"] = { payment: { ...payment("payment2"), location_id: "another-location" } }; queue.get("event").state = "queued";
  assert.equal((await square.processQueuedCglSquareEvents({ eventId: "event" })).results[0].state, "review"); assert.equal(reconciled(), undefined);
});
test("temporary provider failure releases a retryable lease with a safe error code", async () => {
  overrides["/subscriptions/subscription?include=actions"] = () => Response.json({ errors: [{ detail: "secret must not be saved" }] }, { status: 503 });
  await receive(); const result = await square.processQueuedCglSquareEvents({ eventId: "event" });
  assert.equal(result.results[0].state, "retry");
  const failure = rpcCalls.find(([name]) => name === "cgl_fail_square_event")[1];
  assert.equal(failure.p_error_code, "square_unavailable"); assert.equal(failure.p_retryable, true); assert(!JSON.stringify(failure).includes("secret"));
});
test("reusing a saved checkout retrieves its current provider link and prevents completed-order reuse", async () => {
  overrides["/online-checkout/payment-links/link"] = { payment_link: { id: "link", order_id: "template", url: "https://sandbox.square.link/u/test" } };
  const value = { ...intent, square_link_id: "link", payment_link_url: "https://sandbox.square.link/u/test" };
  assert.equal(await square.createCglSquareCheckout(value), value.payment_link_url);
  overrides["/orders/template"] = { order: { ...template(), state: "COMPLETED" } };
  await assert.rejects(square.createCglSquareCheckout(value), /no longer payable/);
  assert(!requests.some(([, options]) => options.method === "POST"));
});
test("read-only catalog mapping checks existing IDs without catalog mutations", async () => {
  const result = await square.auditCglSquareCatalogMappings([{ code: "monthly", amountCents: 2995, variationId: "variation" }]);
  assert.equal(result.mappings[0].parentId, "plan"); assert(requests.every(([, options]) => !options.method));
});
test("member sync filters owned checkout UUIDs, bounds work and never drains other queued jobs", async () => {
  dbRows = [{ ...intent, state: "pending" }, { ...intent, id: "fe8d1d1e-7f91-4aeb-8e94-6a78048d4449", member_id: "92022f0c-6f81-46bf-98c2-55158bca502f", state: "pending" }];
  queue.set("another-member-event", { event_id: "another-member-event", state: "queued" });
  const result = await square.syncCglSquareMember(intent.member_id, intent.id);
  assert.equal(result.checkouts.length, 1); assert.equal(result.checkouts[0].id, intent.id); assert.equal(queue.get("another-member-event").state, "queued");
  assert(queryCalls[0].filters.some(([key, value]) => key === "member_id" && value === intent.member_id)); assert.equal(queryCalls[0].limit, 5);
  assert(!JSON.stringify(result).includes("customer")); assert(!JSON.stringify(result).includes("subscription"));
  await assert.rejects(square.syncCglSquareMember(intent.member_id, "provider-subscription-id"));
});
test("minimum-term subscription actions remain disabled without provider writes", async () => {
  assert.equal((await square.processDueCglSquareCancellations()).processed, 0); assert.equal(requests.length, 0);
  assert.equal(square.getCglSquareCancellationDate("2027-06-06T14:00:00.000Z", "Australia/Brisbane"), "2027-06-07");
  assert.throws(() => square.getCglSquareCancellationDate("2027-06-07T00:00:00.000Z", "Australia/Brisbane")); assert.throws(() => square.getCglSquareCancellationDate("2027-06-06T14:00:00.000Z", "UTC"));
});
test("retrieving a different template ID is rejected for new and saved checkout links", async () => {
  overrides["/orders/template"] = { order: { ...template(), id: "another-template" } };
  overrides["/online-checkout/payment-links/link"] = { payment_link: { id: "link", order_id: "template", url: "https://sandbox.square.link/u/test" } };
  overrides["/online-checkout/payment-links"] = { payment_link: { id: "link", order_id: "template", url: "https://sandbox.square.link/u/test" } };
  await assert.rejects(square.createCglSquareCheckout({ ...intent, square_link_id: "link", payment_link_url: "https://sandbox.square.link/u/test" }), /no longer payable/);
  await assert.rejects(square.createCglSquareCheckout(intent), /did not preserve/);
  assert(!rpcCalls.some(([name]) => name === "cgl_attach_square_checkout"));
});
test("timezone aliases reconcile while truly different billing timezones require review", async () => {
  overrides["/subscriptions/subscription?include=actions"] = { subscription: { ...subscription, timezone: "Etc/UTC" } };
  await receive(); assert.equal((await square.processQueuedCglSquareEvents({ eventId: "event" })).processed, 1);
  assert.equal(reconciled().subscription.timezone, "Etc/UTC"); assert.equal(reconciled().subscription.paid_through_date_exclusive, "2027-03-31");
  overrides["/subscriptions/subscription?include=actions"] = { subscription: { ...subscription, timezone: "Australia/Brisbane" } }; queue.get("event").state = "queued";
  const result = await square.processQueuedCglSquareEvents({ eventId: "event" }); assert.equal(result.results[0].state, "review"); assert.equal(result.results[0].error_code, "square_identity_mismatch");
});
test("worker claims one event immediately before processing, without leasing later work", async () => {
  for (const event_id of ["event1", "event2", "event3"]) await receive("customer.updated", "customer", { event_id });
  rpcOverride = async (name, args) => {
    if (name === "cgl_claim_square_events") {
      assert.equal(args.p_limit, 1);
      assert.equal([...queue.values()].filter(job => job.state === "processing").length, 0);
    }
    if (name === "cgl_reconcile_square_event") assert.equal([...queue.values()].filter(job => job.state === "processing").length, 1);
  };
  assert.equal((await square.processQueuedCglSquareEvents({ limit: 3 })).processed, 3);
  assert.equal(rpcCalls.filter(([name]) => name === "cgl_claim_square_events").length, 3);
  assert([...queue.values()].every(job => job.state === "reconciled"));
});
test("worker stops new claims after forty seconds and leaves unprocessed events unleased", async () => {
  for (const event_id of ["event1", "event2", "event3"]) await receive("customer.updated", "customer", { event_id });
  const originalNow = Date.now, started = originalNow();
  let elapsed = 0;
  Date.now = () => started + elapsed;
  rpcOverride = async name => { if (name === "cgl_reconcile_square_event") elapsed = 40_001; };
  try {
    assert.equal((await square.processQueuedCglSquareEvents({ limit: 3 })).processed, 1);
    assert.equal(rpcCalls.filter(([name]) => name === "cgl_claim_square_events").length, 1);
    for (const event_id of ["event2", "event3"]) { assert.equal(queue.get(event_id).state, "queued"); assert.equal(queue.get(event_id).lease_token, null); }
  } finally { Date.now = originalNow; }
});
test("an explicitly requested event is claimed once even with a larger batch limit", async () => {
  for (const event_id of ["event1", "event2", "event3"]) await receive("customer.updated", "customer", { event_id });
  assert.equal((await square.processQueuedCglSquareEvents({ eventId: "event2", limit: 10 })).processed, 1);
  const claims = rpcCalls.filter(([name]) => name === "cgl_claim_square_events");
  assert.equal(claims.length, 1); assert.equal(claims[0][1].p_event_id, "event2"); assert.equal(claims[0][1].p_limit, 1);
  for (const event_id of ["event1", "event3"]) { assert.equal(queue.get(event_id).state, "queued"); assert.equal(queue.get(event_id).lease_token, null); }
});
test("new hosted payment links omit optional email prefill even if an old caller supplies it", async () => {
  overrides["/online-checkout/payment-links"] = options => {
    const body = JSON.parse(options.body);
    assert.equal(body.pre_populated_data, undefined); assert(!JSON.stringify(body).includes("blocked@example.invalid"));
    assert.equal(body.order.metadata.cgl_member_id, intent.member_id);
    return Response.json({ payment_link: { id: "link", order_id: "template", url: "https://sandbox.square.link/u/test" } });
  };
  assert.equal(await square.createCglSquareCheckout(intent, "blocked@example.invalid"), "https://sandbox.square.link/u/test");
  assert(rpcCalls.some(([name]) => name === "cgl_attach_square_checkout"));
});

function recoveredLink(id = "recovered-link", orderId = "template") {
  return { id, order_id: orderId, url: "https://sandbox.square.link/u/original", checkout_options: { allow_tipping: false, subscription_plan_id: "variation", redirect_url: `https://example.test/cgl/dashboard?checkout=${intent.id}` } };
}
function setupIdempotencyRecovery() {
  overrides["/online-checkout/payment-links"] = () => Response.json({ errors: [{ code: "IDEMPOTENCY_KEY_REUSED", detail: "This idempotency key has already been used to create a Payment Link" }] }, { status: 400 });
  overrides["/online-checkout/payment-links?limit=100"] = { payment_links: [recoveredLink()] };
  overrides["/online-checkout/payment-links/recovered-link"] = { payment_link: recoveredLink() };
}
test("idempotency replay recovers the original hosted link after its order changed to OPEN", async () => {
  setupIdempotencyRecovery();
  assert.equal(await square.createCglSquareCheckout({ ...intent, square_order_id: null }), "https://sandbox.square.link/u/original");
  const writes = requests.filter(([endpoint, options]) => endpoint === "/online-checkout/payment-links" && options.method === "POST");
  assert.equal(writes.length, 1); assert.equal(JSON.parse(writes[0][1].body).idempotency_key, `cgl-checkout-${intent.id}`);
  assert(requests.some(([endpoint]) => endpoint === "/online-checkout/payment-links/recovered-link"));
  const attach = rpcCalls.find(([name]) => name === "cgl_attach_square_checkout")[1];
  assert.deepEqual(attach, { p_intent_id: intent.id, p_link_id: "recovered-link", p_order_id: "template", p_url: "https://sandbox.square.link/u/original" });
});
test("recovery follows pagination and proves exact template ownership instead of a matching note", async () => {
  setupIdempotencyRecovery();
  overrides["/online-checkout/payment-links?limit=100"] = { payment_links: [{ id: "unrelated", order_id: "unrelated-order", payment_note: `CGL checkout ${intent.id}` }], cursor: "page2" };
  overrides["/orders/unrelated-order"] = { order: { ...template(), id: "unrelated-order", reference_id: "unrelated", metadata: {} } };
  overrides["/online-checkout/payment-links?limit=100&cursor=page2"] = { payment_links: [{ ...recoveredLink(), payment_note: "a note is not identity" }] };
  assert.equal(await square.createCglSquareCheckout({ ...intent, square_order_id: null }), "https://sandbox.square.link/u/original");
  assert(requests.some(([endpoint]) => endpoint.includes("cursor=page2")));
  assert.equal(rpcCalls.find(([name]) => name === "cgl_attach_square_checkout")[1].p_order_id, "template");
});
test("recovery rejects multiple exact matches without choosing the first or creating another purchase", async () => {
  setupIdempotencyRecovery();
  overrides["/online-checkout/payment-links?limit=100"] = { payment_links: [recoveredLink(), recoveredLink("duplicate-link", "duplicate-order")] };
  overrides["/orders/duplicate-order"] = { order: { ...template(), id: "duplicate-order" } };
  await assert.rejects(square.createCglSquareCheckout({ ...intent, square_order_id: null }), error => error.code === "square_recovery_ambiguous");
  assert(!rpcCalls.some(([name]) => name === "cgl_attach_square_checkout"));
  assert.equal(requests.filter(([, options]) => options.method === "POST").length, 1);
});
test("recovery rejects wrong ownership, amount, variation, redirect and unexpected adjustments", async () => {
  for (const mutation of [
    order => { order.metadata.cgl_member_id = "92022f0c-6f81-46bf-98c2-55158bca502f"; },
    order => { order.line_items[0].base_price_money.amount = 1; },
    order => { order.total_tax_money = { amount: 10, currency: "AUD" }; },
  ]) {
    setupIdempotencyRecovery(); const changed = template(); mutation(changed); overrides["/orders/template"] = { order: changed };
    await assert.rejects(square.createCglSquareCheckout({ ...intent, square_order_id: null }), error => error.code === "square_identity_mismatch");
  }
  overrides["/orders/template"] = { order: template() };
  for (const options of [{ subscription_plan_id: "wrong-variation" }, { redirect_url: "https://evil.test/" }]) {
    setupIdempotencyRecovery(); const changed = recoveredLink(); Object.assign(changed.checkout_options, options); overrides["/online-checkout/payment-links/recovered-link"] = { payment_link: changed };
    await assert.rejects(square.createCglSquareCheckout({ ...intent, square_order_id: null }), error => error.code === "square_identity_mismatch");
  }
  assert(!rpcCalls.some(([name]) => name === "cgl_attach_square_checkout"));
});
test("a partial pagination scan cannot prove unique ownership even after finding a match", async () => {
  setupIdempotencyRecovery();
  overrides["/online-checkout/payment-links?limit=100"] = { payment_links: [recoveredLink()], cursor: "more" };
  overrides["/online-checkout/payment-links?limit=100&cursor=more"] = { payment_links: [], cursor: "more" };
  await assert.rejects(square.createCglSquareCheckout({ ...intent, square_order_id: null }), error => error.code === "square_recovery_limit");
  assert(!rpcCalls.some(([name]) => name === "cgl_attach_square_checkout"));
});
test("no matching link fails closed without another POST or idempotency key", async () => {
  setupIdempotencyRecovery(); overrides["/online-checkout/payment-links?limit=100"] = { payment_links: [] };
  await assert.rejects(square.createCglSquareCheckout({ ...intent, square_order_id: null }), error => error.code === "square_recovery_unmatched");
  assert.equal(requests.filter(([, options]) => options.method === "POST").length, 1);
  assert(!rpcCalls.some(([name]) => name === "cgl_attach_square_checkout"));
});
test("a completed original checkout is attached for reconciliation but never returned as payable", async () => {
  setupIdempotencyRecovery(); overrides["/orders/template"] = { order: { ...template(), state: "COMPLETED" } };
  await assert.rejects(square.createCglSquareCheckout({ ...intent, square_order_id: null }), /already finished/);
  assert(rpcCalls.some(([name]) => name === "cgl_attach_square_checkout"));
});
test("provider rejections unrelated to idempotency never initiate recovery", async () => {
  overrides["/online-checkout/payment-links"] = () => Response.json({ errors: [{ code: "INVALID_REQUEST_ERROR", detail: "buyer contact must not be logged" }] }, { status: 400 });
  await assert.rejects(square.createCglSquareCheckout({ ...intent, square_order_id: null }), error => error.code === "square_provider_rejected");
  assert(!requests.some(([endpoint]) => endpoint.startsWith("/online-checkout/payment-links?")));
});
test("saved OPEN checkout with a payment-bearing tender is withheld pending owned billing reconciliation", async () => {
  overrides["/online-checkout/payment-links/link"] = { payment_link: { id: "link", order_id: "template", url: "https://sandbox.square.link/u/test" } };
  overrides["/orders/template"] = { order: { ...template(), state: "OPEN", tenders: [{ payment_id: "recorded-attempt" }] } };
  await assert.rejects(square.createCglSquareCheckout({ ...intent, square_link_id: "link", payment_link_url: "https://sandbox.square.link/u/test" }), error => error.status === 409 && error.code === "square_checkout_payment_recorded" && /Refresh your CGL billing/.test(error.message));
  assert(!requests.some(([, options]) => options.method === "POST"));
  assert(!rpcCalls.some(([name]) => name === "cgl_attach_square_checkout"));
});
test("recovered OPEN checkout with a payment attempt is attached but never returned as payable", async () => {
  setupIdempotencyRecovery();
  overrides["/orders/template"] = { order: { ...template(), state: "OPEN", tenders: [{ payment_id: "unknown-or-failed-attempt" }] } };
  await assert.rejects(square.createCglSquareCheckout({ ...intent, square_order_id: null }), error => error.status === 409 && error.code === "square_checkout_payment_recorded" && /Refresh your CGL billing/.test(error.message));
  const attach = rpcCalls.filter(([name]) => name === "cgl_attach_square_checkout");
  assert.equal(attach.length, 1); assert.equal(attach[0][1].p_order_id, "template"); assert.equal(attach[0][1].p_link_id, "recovered-link");
  const posts = requests.filter(([, options]) => options.method === "POST");
  assert.equal(posts.length, 1); assert.equal(JSON.parse(posts[0][1].body).idempotency_key, `cgl-checkout-${intent.id}`);
});
