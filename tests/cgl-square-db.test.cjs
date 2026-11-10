const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
let db;
test.before(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);",
  );
  for (const name of [
    "20261106202122_cgl_2027_platform_foundation.sql",
    "20261106202134_cgl_square_sandbox_billing.sql",
  ])
    await db.exec(
      fs.readFileSync(
        path.resolve(__dirname, "../supabase/migrations", name),
        "utf8",
      ),
    );
  await db.exec(
    `update cgl_settings set value='{"testing_enabled":true,"environment":"sandbox"}' where key='square_sandbox'; update cgl_plans set config=jsonb_build_object('square_plan_variation_id','variation-'||code) where auto_renew;`,
  );
});
test.after(async () => db?.close());
async function member() {
  const id = randomUUID();
  await db.query("insert into auth.users values($1)", [id]);
  await db.query(
    "insert into cgl_members(id,email,display_name) values($1,$2,'Isolated payment fixture')",
    [id, `${id}@example.test`],
  );
  return id;
}
async function prepare(
  id,
  plan = "monthly",
  season = null,
  key = randomUUID(),
  accepted = null,
) {
  return (
    await db.query("select cgl_prepare_square_checkout($1,$2,$3,$4,$5) value", [
      id,
      plan,
      season,
      key,
      accepted,
    ])
  ).rows[0].value;
}
async function fixture(plan = "monthly", id = null, season = null) {
  const intent = await prepare(id ?? (await member()), plan, season);
  await db.query("select cgl_attach_square_checkout($1,$2,$3,$4)", [
    intent.id,
    `link-${intent.id}`,
    `order-${intent.id}`,
    "https://square.link/u/fixture",
  ]);
  intent.square_order_id = `order-${intent.id}`;
  return intent;
}
async function membership(id) {
  return (await db.query("select * from cgl_memberships where id=$1", [id]))
    .rows[0];
}
function payload(intent, opts = {}) {
  const paymentId = opts.paymentId ?? randomUUID(),
    orderId = opts.orderId ?? intent.square_order_id,
    invoiceId = opts.invoiceId ?? `invoice-${orderId}`;
  const subId = `sub-${intent.id}`,
    customer = `customer-${intent.member_id}`,
    recurring = intent.recurring;
  const until = opts.until ?? "2026-12-01",
    start = opts.start ?? "2026-11-01",
    version = opts.version ?? 1;
  const subscription =
    recurring && !opts.noSubscription
      ? {
          id: subId,
          customer_id: customer,
          plan_variation_id: `variation-${intent.plan_code}`,
          state: opts.subscriptionState ?? "ACTIVE",
          version,
          start_date: start,
          timezone: opts.timezone ?? "UTC",
          paid_until_date: until,
          charged_through_date: opts.chargedThrough ?? until,
          template_order_ids: [intent.square_order_id],
          intent_id: intent.id,
          billing_supported: opts.supported ?? true,
          coverage_complete: opts.coverage ?? true,
          paid_through_date_exclusive: until,
          next_billing_date: until,
        }
      : null;
  const state = opts.state ?? "COMPLETED";
  const invoice = subscription
    ? {
        id: invoiceId,
        order_id: orderId,
        subscription_id: subId,
        customer_id: customer,
        status:
          opts.invoiceState ?? (state === "COMPLETED" ? "PAID" : "UNPAID"),
        version,
        updated_at: opts.updated ?? "2026-11-06T00:00:00Z",
        created_at: "2026-11-01T00:00:00Z",
        currency: "AUD",
        amount_cents: intent.amount_cents,
        completed_cents: state === "COMPLETED" ? intent.amount_cents : 0,
        payment_ids: [paymentId],
        paid: state === "COMPLETED",
        period_start_date: start,
        period_end_date_exclusive: until,
      }
    : null;
  return {
    environment: "sandbox",
    merchant_id: "isolated-merchant",
    location_id: "isolated-location",
    payments: opts.noPayments
      ? []
      : [
          {
            id: paymentId,
            order_id: orderId,
            customer_id: customer,
            state,
            amount_cents: opts.amount ?? intent.amount_cents,
            refunded_cents: opts.refunded ?? 0,
            currency: opts.currency ?? "AUD",
            fee_cents: 10,
            paid_at: opts.paidAt ?? "2026-11-01T00:00:01Z",
            updated_at: opts.updated ?? "2026-11-06T00:00:00Z",
            version_token: `version-${version}`,
            intent_id: intent.id,
            receipt_url: null,
          },
        ],
    subscription,
    invoices: invoice ? [invoice] : [],
    checkout_link: subscription
      ? {
          intent_id: intent.id,
          order_id: intent.square_order_id,
          member_id: intent.member_id,
          membership_id: intent.membership_id,
          customer_id: customer,
          subscription_id: subId,
        }
      : null,
    invoice_failed: opts.failed ?? false,
    invoice_order_id: orderId,
  };
}
async function event(intent, opts = {}) {
  const eventId = opts.eventId ?? randomUUID(),
    normalized = opts.payload ?? payload(intent, opts);
  const params = [
    eventId,
    opts.type ?? "payment.updated",
    opts.occurredAt ?? "2026-11-06T00:00:00Z",
    `hash-${eventId}-isolated`,
    normalized,
  ];
  const value = (
    await db.query(
      "select cgl_reconcile_square_event($1,$2,$3,$4,$5) value",
      params,
    )
  ).rows[0].value;
  return { value, params, normalized, paymentId: normalized.payments[0]?.id };
}
test("Sandbox testing is separate from legal approval and default legal terms stay unapproved", async () => {
  const intent = await fixture();
  assert.equal(intent.terms_snapshot.test_only, true);
  assert.equal(intent.terms_snapshot.legal.approved, false);
  assert.equal(
    (
      await db.query(
        "select value->>'approved' value from cgl_settings where key='legal'",
      )
    ).rows[0].value,
    "false",
  );
});
test("accepted price mismatch rolls back before creating an intent or membership", async () => {
  const id = await member();
  await assert.rejects(prepare(id, "monthly", null, randomUUID(), 1));
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from cgl_memberships where member_id=$1",
        [id],
      )
    ).rows[0].n,
    0,
  );
});
test("refresh reuses one pending intent and cannot create parallel full subscriptions", async () => {
  const id = await member(),
    first = await prepare(id);
  assert.equal((await prepare(id)).id, first.id);
  await assert.rejects(prepare(id, "annual"));
});
test("verified initial payment activates only provider-confirmed paid coverage; delivery and payment replays do not extend", async () => {
  const intent = await fixture(),
    first = await event(intent);
  assert.equal(first.value.state, "reconciled");
  const row = await membership(intent.membership_id);
  assert.equal(row.state, "active");
  assert.equal(
    new Date(row.paid_through).toISOString(),
    "2026-12-01T00:00:00.000Z",
  );
  assert.equal(
    (
      await db.query(
        "select cgl_reconcile_square_event($1,$2,$3,$4,$5) value",
        first.params,
      )
    ).rows[0].value.duplicate,
    true,
  );
  await event(intent, { paymentId: first.paymentId });
  assert.equal(
    String((await membership(intent.membership_id)).paid_through),
    String(row.paid_through),
  );
});
test("pending then completed snapshots of the same payment activate exactly once", async () => {
  const intent = await fixture(),
    id = randomUUID();
  await event(intent, { paymentId: id, state: "PENDING", coverage: false });
  assert.equal((await membership(intent.membership_id)).paid_through, null);
  await event(intent, {
    paymentId: id,
    version: 2,
    updated: "2026-11-06T01:00:00Z",
  });
  assert.equal((await membership(intent.membership_id)).state, "active");
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from cgl_payments where membership_id=$1",
        [intent.membership_id],
      )
    ).rows[0].n,
    1,
  );
});
test("subscription ACTIVE and invoiced-through dates alone never grant access", async () => {
  const intent = await fixture();
  await event(intent, { noPayments: true });
  assert.equal((await membership(intent.membership_id)).paid_through, null);
  assert.equal(
    (await event(intent, { coverage: false, chargedThrough: "2030-01-01" }))
      .value.state,
    "review",
  );
  assert.equal((await membership(intent.membership_id)).paid_through, null);
});
test("out-of-order distinct invoice payments use coverage bounds rather than payment counts", async () => {
  const intent = await fixture();
  await event(intent, { until: "2027-02-01", version: 4 });
  await event(intent, {
    until: "2026-12-01",
    version: 1,
    orderId: "old-invoice-order",
    invoiceId: "old-invoice",
    updated: "2026-11-02T00:00:00Z",
  });
  assert.equal(
    new Date(
      (await membership(intent.membership_id)).paid_through,
    ).toISOString(),
    "2027-02-01T00:00:00.000Z",
  );
});
test("month-end and leap-year provider boundaries retain their real calendar dates and timezone", async () => {
  const monthly = await fixture();
  await event(monthly, {
    start: "2027-01-31",
    until: "2027-02-28",
    timezone: "Australia/Brisbane",
  });
  assert.equal(
    new Date(
      (await membership(monthly.membership_id)).paid_through,
    ).toISOString(),
    "2027-02-27T14:00:00.000Z",
  );
  const annual = await fixture("annual");
  await event(annual, { start: "2028-02-29", until: "2029-02-28" });
  await event(annual, {
    orderId: "leap-renewal",
    start: "2028-02-29",
    until: "2032-02-29",
    version: 5,
  });
  assert.equal(
    new Date(
      (await membership(annual.membership_id)).paid_through,
    ).toISOString(),
    "2032-02-29T00:00:00.000Z",
  );
});
test("amount, currency and unsupported billing mismatches grant no entitlement", async () => {
  for (const opts of [
    { amount: 1 },
    { currency: "USD" },
    { supported: false },
  ]) {
    const intent = await fixture();
    assert.equal((await event(intent, opts)).value.state, "review");
    assert.equal((await membership(intent.membership_id)).paid_through, null);
  }
});
test("identity is linked through the actual immutable provider template, never a payment note or email", async () => {
  const intent = await prepare(await member());
  const body = payload(
    { ...intent, square_order_id: "unattached-order" },
    { noSubscription: true },
  );
  assert.equal(
    (await event(intent, { payload: body })).value.state,
    "unmatched",
  );
  assert.equal((await membership(intent.membership_id)).paid_through, null);
  const attached = await fixture(),
    bad = payload(attached);
  bad.checkout_link.member_id = randomUUID();
  bad.payments[0].order_id = "unknown-order";
  assert.equal((await event(attached, { payload: bad })).value.state, "review");
  assert.equal(
    (await membership(attached.membership_id)).square_subscription_id,
    null,
  );
});
test("optional payment customer ID is not guessed when its verified invoice and order prove the owner", async () => {
  const intent = await fixture(),
    body = payload(intent);
  body.payments[0].customer_id = null;
  assert.equal(
    (await event(intent, { payload: body })).value.state,
    "reconciled",
  );
  assert.equal((await membership(intent.membership_id)).state, "active");
});
test("an existing payment cannot be rebound to a different account, customer, order or amount", async () => {
  const first = await fixture(),
    paid = await event(first),
    second = await fixture();
  assert.equal(
    (await event(second, { paymentId: paid.paymentId })).value.state,
    "review",
  );
  assert.equal((await membership(second.membership_id)).paid_through, null);
  await assert.rejects(
    db.query(
      "update cgl_square_checkout_intents set member_id=$1 where id=$2",
      [second.member_id, first.id],
    ),
  );
});
test("failed first payment creates no paid access; same payment recovery activates once", async () => {
  const intent = await fixture(),
    id = randomUUID();
  await event(intent, { paymentId: id, state: "FAILED", failed: true });
  assert.equal((await membership(intent.membership_id)).state, "past_due");
  assert.equal((await membership(intent.membership_id)).paid_through, null);
  await event(intent, {
    paymentId: id,
    version: 2,
    updated: "2026-11-06T02:00:00Z",
  });
  assert.equal((await membership(intent.membership_id)).state, "active");
});
test("fresh paid invoice recovery clears failure; delayed stale failures do not regress paid access", async () => {
  const intent = await fixture(),
    id = randomUUID();
  await event(intent, {
    paymentId: id,
    state: "FAILED",
    failed: true,
    version: 1,
  });
  await event(intent, {
    paymentId: id,
    version: 3,
    updated: "2026-11-06T03:00:00Z",
  });
  await event(intent, {
    paymentId: id,
    state: "FAILED",
    failed: true,
    version: 1,
    updated: "2026-11-06T00:00:00Z",
  });
  const row = await membership(intent.membership_id);
  assert.equal(row.state, "active");
  assert.equal(row.failed_at, null);
});
test("a genuinely newer failed renewal preserves paid history and flags overdue test membership", async () => {
  const intent = await fixture();
  await event(intent);
  await event(intent, {
    orderId: "failed-renewal",
    state: "FAILED",
    failed: true,
    version: 2,
    updated: "2026-12-01T01:00:00Z",
  });
  const row = await membership(intent.membership_id);
  assert.equal(row.state, "past_due");
  assert.equal(
    new Date(row.paid_through).toISOString(),
    "2026-12-01T00:00:00.000Z",
  );
});
test("stale subscription status cannot cancel a newer recovered subscription", async () => {
  const intent = await fixture();
  await event(intent, { version: 5 });
  await event(intent, {
    subscriptionState: "CANCELED",
    version: 2,
    noPayments: true,
  });
  assert.equal((await membership(intent.membership_id)).state, "active");
});
test("refund-first and later refund snapshots never create paid access and preserve financial review", async () => {
  const first = await fixture("casual_registration");
  assert.equal(
    (await event(first, { refunded: first.amount_cents })).value.state,
    "review",
  );
  assert.equal((await membership(first.membership_id)).paid_through, null);
  await assert.rejects(prepare(first.member_id, "casual_registration", null, first.request_key));
  const second = await fixture("casual_registration"),
    paid = await event(second);
  await event(second, {
    paymentId: paid.paymentId,
    refunded: second.amount_cents,
    version: 2,
    updated: "2026-11-06T02:00:00Z",
  });
  const payment = (
    await db.query(
      "select state,metadata from cgl_payments where external_id=$1",
      [`square:sandbox:${paid.paymentId}`],
    )
  ).rows[0];
  assert.equal(payment.state, "refunded");
  assert.equal(payment.metadata.refunded_cents, second.amount_cents);
  assert.equal(
    (await membership(second.membership_id)).metadata
      .entitlement_review_required,
    true,
  );
});
test("Sandbox casual purchases never renew and isolated season entitlements do not overwrite a real entry", async () => {
  const id = await member(),
    registration = await fixture("casual_registration", id);
  await event(registration, { paidAt: new Date().toISOString() });
  assert.equal(
    (await membership(registration.membership_id)).next_billing_at,
    null,
  );
  const season = randomUUID();
  await db.query(
    "insert into cgl_seasons(id,slug,name,year,season_number,format,status,starts_at,ends_at) values($1,$2,'Fixture',2098,1,'aggregate','registration',now(),now()+interval '91 days')",
    [season, `fixture-${season}`],
  );
  await db.query(
    "insert into cgl_season_entries(member_id,season_id,state,source,metadata) values($1,$2,'active','real-registration','{\"real\":true}')",
    [id, season],
  );
  const intent = await fixture("casual_season", id, season);
  await event(intent, { paidAt: new Date().toISOString() });
  const real = (
    await db.query(
      "select source,metadata from cgl_season_entries where member_id=$1 and season_id=$2",
      [id, season],
    )
  ).rows[0];
  assert.equal(real.source, "real-registration");
  assert.equal(real.metadata.real, true);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from cgl_square_season_entitlements where member_id=$1 and season_id=$2",
        [id, season],
      )
    ).rows[0].n,
    1,
  );
  assert.equal((await membership(intent.membership_id)).next_billing_at, null);
});
test("production-labelled notifications cannot mutate Sandbox or real entitlement records", async () => {
  const intent = await fixture(),
    body = payload(intent);
  body.environment = "production";
  await assert.rejects(event(intent, { payload: body }));
  assert.equal((await membership(intent.membership_id)).paid_through, null);
  await assert.rejects(
    db.query("update cgl_memberships set metadata='{}' where id=$1", [
      intent.membership_id,
    ]),
  );
});
test("a payment received before the subscription invoice waits for verified linkage and then activates", async () => {
  const intent = await fixture(),
    paymentId = randomUUID();
  assert.equal(
    (await event(intent, { paymentId, noSubscription: true })).value.state,
    "review",
  );
  assert.equal((await membership(intent.membership_id)).paid_through, null);
  await event(intent, {
    paymentId,
    version: 2,
    updated: "2026-11-06T02:00:00Z",
  });
  assert.equal((await membership(intent.membership_id)).state, "active");
});
test("Sandbox memberships and Sandbox payment counts cannot unlock real member-only rewards or seasonal gifts", async () => {
  const intent = await fixture();
  await event(intent, { start: "2026-09-01", until: "2027-01-01" });
  await db.query(
    "select cgl_issue_credits($1,100,$2,'{}','Real fixture credits','test-admin')",
    [intent.member_id, randomUUID()],
  );
  const item = randomUUID();
  await db.query(
    "insert into cgl_catalogue(id,name,credit_price,stock,active,restrictions) values($1,'Full member test',20,1,true,'{\"full_members_only\":true}')",
    [item],
  );
  await assert.rejects(
    db.query("select cgl_redeem($1,$2,1,$3)", [
      intent.member_id,
      item,
      randomUUID(),
    ]),
  );
  const season = randomUUID(),
    gift = randomUUID();
  await db.query(
    "insert into cgl_seasons(id,slug,name,year,season_number,format,status,starts_at,ends_at) values($1,$2,'Gift fixture',2097,1,'aggregate','active',now()-interval '35 days',now()+interval '56 days')",
    [season, `gift-${season}`],
  );
  await db.query(
    "insert into cgl_gift_items(id,season_id,name,unit_cost_cents,stock) values($1,$2,'Real seasonal gift',1700,1)",
    [gift, season],
  );
  await assert.rejects(
    db.query(
      "select cgl_allocate_gift($1,$2,'admin','Check Sandbox is excluded')",
      [intent.member_id, gift],
    ),
  );
});
test("durable inbox stores only object IDs, leases once and safely retries transient provider failures", async () => {
  const id = randomUUID(),
    data = {
      environment: "sandbox",
      object_id: "opaque-payment-id",
      object_type: "payment",
      merchant_id: "opaque-merchant",
      email: "must-not-store@example.test",
    };
  const args = [
    id,
    "payment.updated",
    "2026-11-06T00:00:00Z",
    "valid-isolated-body-hash",
    data,
  ];
  assert.equal(
    (await db.query("select cgl_enqueue_square_event($1,$2,$3,$4,$5) v", args))
      .rows[0].v.queued,
    true,
  );
  assert.equal(
    (await db.query("select cgl_enqueue_square_event($1,$2,$3,$4,$5) v", args))
      .rows[0].v.duplicate,
    true,
  );
  assert.equal(
    JSON.stringify(
      (
        await db.query(
          "select event_data from cgl_square_webhook_events where event_id=$1",
          [id],
        )
      ).rows[0],
    ).includes("must-not-store"),
    false,
  );
  const claim = (await db.query("select cgl_claim_square_events($1,1) v", [id]))
    .rows[0].v;
  assert.equal(claim.length, 1);
  assert.equal(
    (await db.query("select cgl_claim_square_events($1,1) v", [id])).rows[0].v
      .length,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select cgl_fail_square_event($1,$2,'provider_timeout',true) v",
        [id, claim[0].lease_token],
      )
    ).rows[0].v.state,
    "retry",
  );
  assert.equal(
    (
      await db.query(
        "select cgl_fail_square_event($1,$2,'old_worker',true) v",
        [id, claim[0].lease_token],
      )
    ).rows[0].v.state,
    "lease_lost",
  );
  await db.query(
    "update cgl_square_webhook_events set next_attempt_at=now()-interval '1 second' where event_id=$1",
    [id],
  );
  assert.equal(
    (await db.query("select cgl_claim_square_events($1,1) v", [id])).rows[0]
      .v[0].attempts,
    2,
  );
});
test("queued worker completion rejects an obsolete lease and deduplicates after durable success", async () => {
  const intent = await fixture(),
    id = randomUUID(),
    hash = "valid-isolated-worker-hash";
  await db.query("select cgl_enqueue_square_event($1,$2,$3,$4,$5)", [
    id,
    "payment.updated",
    "2026-11-06T00:00:00Z",
    hash,
    { environment: "sandbox", object_id: "opaque-payment" },
  ]);
  const claim = (await db.query("select cgl_claim_square_events($1,1) v", [id]))
    .rows[0].v[0];
  await assert.rejects(
    db.query("select cgl_reconcile_square_event($1,$2,$3,$4,$5,$6)", [
      id,
      "payment.updated",
      "2026-11-06T00:00:00Z",
      hash,
      payload(intent),
      randomUUID(),
    ]),
  );
  assert.equal(
    (
      await db.query("select cgl_reconcile_square_event($1,$2,$3,$4,$5,$6) v", [
        id,
        "payment.updated",
        "2026-11-06T00:00:00Z",
        hash,
        payload(intent),
        claim.lease_token,
      ])
    ).rows[0].v.state,
    "reconciled",
  );
  assert.equal(
    (await db.query("select cgl_claim_square_events($1,1) v", [id])).rows[0].v
      .length,
    0,
  );
});
test("Sandbox records and all privileged RPCs are inaccessible to browser roles", async () => {
  for (const name of [
    "cgl_square_checkout_intents",
    "cgl_square_webhook_events",
    "cgl_square_invoice_states",
    "cgl_square_season_entitlements",
  ])
    assert.equal(
      (
        await db.query(
          "select has_table_privilege('authenticated',$1,'select') allowed",
          [name],
        )
      ).rows[0].allowed,
      false,
    );
  for (const signature of [
    "cgl_prepare_square_checkout(uuid,text,uuid,uuid,integer)",
    "cgl_reconcile_square_event(text,text,timestamptz,text,jsonb,uuid)",
    "cgl_enqueue_square_event(text,text,timestamptz,text,jsonb)",
    "cgl_claim_square_events(text,integer)",
    "cgl_fail_square_event(text,uuid,text,boolean)",
  ])
    assert.equal(
      (
        await db.query(
          "select has_function_privilege('anon',$1,'execute') allowed",
          [signature],
        )
      ).rows[0].allowed,
      false,
    );
});
