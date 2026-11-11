const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function compile(relative, overrides = {}) {
  const filename = path.resolve(__dirname, "..", relative);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = (name) => Object.hasOwn(overrides, name) ? overrides[name] : module.require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return loaded.exports;
}

const ui = compile("components/cgl/cgl-ui.ts");
function portalModule(react = React) {
  const Plain = ({ children, title }) => React.createElement("div", null, title, children);
  return compile("components/cgl/CglMemberPortal.tsx", {
    react,
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/image": { default: () => null },
    "@/lib/supabase-browser": { getSupabaseBrowserClient: () => null },
    "@/lib/cgl-engine": { annualRanking: () => ({ status: "pending_approval" }) },
    "./CglPublicExperience": { CglEmpty: Plain, CglHeading: Plain, CglPerformanceHighlights: Plain },
    "./cgl-ui": ui,
    "./Cgl2027.module.css": { default: new Proxy({}, { get: (_, name) => String(name) }) },
  });
}
const portal = portalModule();
const render = (View, props) => renderToStaticMarkup(React.createElement(View, props));
const TEST_PAYMENT = "square:sandbox-payment";

test("Sandbox billing is visibly TEST, includes confirmed dates and never promises a receipt or real eligibility", () => {
  const html = render(portal.CglSandboxBilling, {
    ready: true, busy: false, syncing: false, message: "", onRefresh() {},
    billing: {
      readiness: { configured: true },
      memberships: [{ id: "test-sub", plan_code: "monthly", state: "active", paid_through: "2027-02-01T00:00:00Z", next_billing_at: "2027-02-01T00:00:00Z" }],
      payments: [{ id: "payment", external_id: TEST_PAYMENT, amount_cents: 2995, state: "completed", paid_at: "2027-01-01T00:00:00Z" }],
      checkouts: [{ id: "checkout", state: "completed", plan_code: "monthly", amount_cents: 2995 }],
    },
  });
  assert.match(html, /TEST · Square Sandbox/);
  assert.match(html, /Test paid-through/);
  assert.match(html, /Next test payment/);
  assert.match(html, /1 Feb 2027/);
  assert.match(html, /\$29\.95/);
  assert.match(html, /TEST · completed/);
  assert.match(html, /square:sandbox-payment/);
  assert.match(html, /do not activate a real membership, competition access, gifts or rewards/);
  assert.match(html, /does not send receipt emails/);
});

test("failed Sandbox payment offers review help without promising card replacement or changing real competition access", () => {
  const html = render(portal.CglSandboxBilling, {
    ready: true, busy: false, syncing: false, message: "Pending check", onRefresh() {},
    billing: { readiness: { configured: false }, memberships: [{ id: "failed", state: "past_due", plan_code: "weekly" }] },
  });
  assert.match(html, /Your test payment needs attention/);
  assert.match(html, /does not change real competition eligibility/);
  assert.match(html, /replacement-card flow is not yet available/);
  assert.match(html, /role="status"/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>.*Refresh Square test payments/);
});

test("recurring quote discloses the exact amount and correct interval; one-off quotes never suggest automatic renewal", () => {
  for (const [billingInterval, label] of [["annual", "year"], ["monthly", "month"], ["weekly", "week"]]) {
    const html = render(portal.CglSquareQuoteSummary, { quote: { amountCents: 2995, recurring: true, billingInterval, readiness: { ready: true } } });
    assert.match(html, new RegExp(`Automatic test renewal: \\$29\\.95 every ${label}`));
    assert.doesNotMatch(html, /does not automatically renew/);
    assert.doesNotMatch(html, /payment confirmation is unavailable/);
  }
  const html = render(portal.CglSquareQuoteSummary, { quote: { amountCents: 2900, recurring: false, readiness: { ready: false } } });
  assert.match(html, /Initial test charge: \$29/);
  assert.match(html, /One-off test payment. This purchase does not automatically renew/);
  assert.match(html, /payment confirmation is unavailable/);
  assert.match(html, /required=""[^>]*name="terms"/);
});

test("checkout recovery keys survive refresh but are isolated by account, plan and season", () => {
  const saved = new Map();
  const storage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  const scope = portal.cglCheckoutStorageKey("account-a", "casual_season", "season-a");
  const key = portal.getCglCheckoutRequestKey(storage, scope);
  assert.equal(portal.getCglCheckoutRequestKey(storage, scope), key);
  for (const alternative of [
    portal.cglCheckoutStorageKey("account-b", "casual_season", "season-a"),
    portal.cglCheckoutStorageKey("account-a", "casual_season", "season-b"),
    portal.cglCheckoutStorageKey("account-a", "annual"),
  ]) assert.notEqual(portal.getCglCheckoutRequestKey(storage, alternative), key);
  const unavailable = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  assert.equal(portal.getCglCheckoutRequestKey(unavailable, scope, key), key);
  saved.set(scope, "invalid");
  assert.notEqual(portal.getCglCheckoutRequestKey(storage, scope), "invalid");
});

test("the actual checkout form redirects to sandbox.square.link and rejects lookalike suffix hosts", async () => {
  const original = { fetch: global.fetch, window: global.window, FormData: global.FormData };
  const findCheckout = (node) => {
    if (!node || typeof node !== "object") return null;
    if (node.type === "form" && node.props.onSubmit?.name === "checkout") return node;
    for (const child of React.Children.toArray(node.props?.children)) {
      const match = findCheckout(child);
      if (match) return match;
    }
    return null;
  };
  try {
    for (const [url, accepted] of [
      ["https://sandbox.square.link/u/test-only", true],
      ["https://square.link/u/test-only", true],
      ["https://sandbox.square.link.evil.example/u/test-only", false],
      ["https://evil-sandbox.square.link/u/test-only", false],
      ["http://sandbox.square.link/u/test-only", false],
    ]) {
      let stateIndex = 0;
      const redirected = [], changed = [];
      const state = [
        { user: { id: "fixture-account" }, access_token: "fixture-token" }, true,
        { status: "ready", joined: true }, "Membership", "login", false, "", false, null,
        { planCode: "monthly", amountCents: 2995, recurring: true, billingInterval: "monthly", readiness: { ready: true } },
      ];
      const { default: Portal } = portalModule({
        ...React, useEffect() {}, useCallback(callback) { return callback; },
        useRef(initial) { return { current: initial }; },
        useState(initial) { const index = stateIndex++; return [index < state.length ? state[index] : initial, (value) => changed.push(value)]; },
      });
      const saved = new Map();
      global.window = { sessionStorage: { getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value) }, location: { assign: (value) => redirected.push(value) } };
      global.FormData = class { constructor(form) { this.values = form; } get(key) { return this.values[key] ?? null; } };
      global.fetch = async (_url, options) => {
        assert.equal(options.headers.Authorization, "Bearer fixture-token");
        assert.equal(JSON.parse(options.body).acceptedAmountCents, 2995);
        return { ok: true, json: async () => ({ url }) };
      };
      const form = findCheckout(Portal({}));
      assert.ok(form, "real member checkout form exists");
      await form.props.onSubmit({ preventDefault() {}, currentTarget: { plan: "monthly", terms: "on" } });
      assert.deepEqual(redirected, accepted ? [url] : []);
      if (!accepted) assert.ok(changed.includes("Square returned an unexpected checkout address."));
    }
  } finally {
    Object.assign(global, original);
  }
});

test("a completed Sandbox membership never replaces real membership status or the real payment history", () => {
  let stateIndex = 0;
  const snapshot = {
    status: "ready", joined: true, member: { sgt_username: "FixturePlayer" }, memberships: [], payments: [], seasons: [],
    billing: { environment: "sandbox", livePaymentsEnabled: false, cancellationPolicyApproved: false, readiness: { configured: true },
      memberships: [{ id: "test-membership", plan_code: "annual", state: "active", paid_through: "2028-01-01T00:00:00Z" }],
      payments: [{ id: "test-payment", external_id: TEST_PAYMENT, amount_cents: 24900, state: "completed" }] },
  };
  const state = [{ user: { id: "fixture-account" }, access_token: "fixture-token" }, true, snapshot, "Membership"];
  const { default: Portal } = portalModule({
    ...React,
    useEffect() {},
    useState(initial) {
      const current = stateIndex++;
      return React.useState(current < state.length ? state[current] : initial);
    },
  });
  const html = render(Portal, {});
  assert.match(html, /No paid CGL membership is recorded/);
  assert.match(html, /TEST payment history/);
  assert.match(html, /No payments recorded/);
  assert.equal(html.split(TEST_PAYMENT).length - 1, 1);
  assert.match(html, /confirmed cancellation policy has not yet been published/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Review cancellation<\/button>/);
});

test("checkout return checks require a UUID, stop after confirmation and poll pending payments at most six times", async () => {
  const original = { fetch: global.fetch, window: global.window, setTimeout: global.setTimeout, clearTimeout: global.clearTimeout };
  const checkoutId = "11111111-1111-4111-8111-111111111111";
  async function run(value, completed) {
    let stateIndex = 0;
    const effects = [], timers = [], requests = [], changes = [];
    const snapshot = { status: "ready", joined: true, billing: { checkouts: [{ id: checkoutId, state: completed ? "completed" : "pending" }] } };
    const state = [{ user: { id: "fixture-account" }, access_token: "fixture-token" }, true, snapshot, "Membership"];
    const { default: Portal } = portalModule({
      ...React,
      useEffect(effect) { effects.push(effect); },
      useCallback(callback) { return callback; },
      useRef(initial) { return { current: initial }; },
      useState(initial) {
        const current = stateIndex++;
        return [current < state.length ? state[current] : initial, (value) => changes.push(value)];
      },
    });
    global.window = { location: { search: `?checkout=${encodeURIComponent(value)}` } };
    global.setTimeout = (callback, delay) => { timers.push({ callback, delay }); return timers.length; };
    global.clearTimeout = () => {};
    global.fetch = async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => url === "/api/cgl/member" ? snapshot : { status: "checked" } };
    };
    render(Portal, {});
    const cleanup = effects[1]();
    let executed = 0;
    while (timers.length) {
      assert.ok(++executed <= 6, "return checking must not schedule an unbounded loop");
      const timer = timers.shift();
      assert.equal(timer.delay, executed === 1 ? 0 : 3000);
      timer.callback();
      await new Promise(setImmediate);
    }
    cleanup?.();
    return { requests, changes };
  }
  try {
    const invalid = await run("not-a-checkout", false);
    assert.equal(invalid.requests.length, 0);
    const pending = await run(checkoutId, false);
    const checks = pending.requests.filter(({ url }) => url === "/api/cgl/billing/sync");
    assert.equal(checks.length, 6);
    assert.ok(checks.every(({ options }) => options.method === "POST" && options.headers.Authorization === "Bearer fixture-token" && JSON.parse(options.body).checkoutId === checkoutId));
    assert.ok(pending.changes.some((value) => typeof value === "string" && value.includes("still pending")));
    const confirmed = await run(checkoutId, true);
    assert.equal(confirmed.requests.filter(({ url }) => url === "/api/cgl/billing/sync").length, 1);
    assert.ok(confirmed.changes.some((value) => typeof value === "string" && value.includes("does not activate a real membership")));
  } finally {
    Object.assign(global, original);
  }
});
