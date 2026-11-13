const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const MEMBER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const SEASON = "33333333-3333-4333-8333-333333333333";
const WEEK = "44444444-4444-4444-8444-444444444444";

function compileModule(relative, overrides = {}) {
  const sourcePath = path.resolve(__dirname, "..", relative);
  const loaded = new Module(sourcePath, module);
  loaded.filename = sourcePath;
  loaded.paths = module.paths;
  loaded.require = (name) =>
    Object.hasOwn(overrides, name) ? overrides[name] : module.require(name);
  loaded._compile(
    ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    sourcePath,
  );
  return loaded.exports;
}
const engine = compileModule("lib/cgl-engine.ts");

function platformHarness(tables = {}, options = {}) {
  const calls = { rpc: [], auth: [], reads: [], sgt: [] };
  class TestSgtError extends Error {
    constructor(message, status = 503, code = "sgt_unavailable") {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  const database = {
    from(table) {
      const filters = [];
      let selected = "*",
        offset = 0,
        limit = 1000,
        order = "id";
      const query = {
        select(columns) {
          selected = columns;
          return query;
        },
        range(start, end) {
          offset = start;
          limit = end - start + 1;
          return query;
        },
        order(column) {
          order = column;
          return query;
        },
        eq(column, value) {
          filters.push([column, value]);
          return query;
        },
        is(column, value) {
          filters.push([column, value]);
          return query;
        },
        then(resolve, reject) {
          calls.reads.push({ table, selected, filters });
          let data = [...(tables[table] ?? [])]
            .filter((row) =>
              filters.every(([column, value]) => row[column] === value),
            )
            .sort((a, b) => String(a[order]).localeCompare(String(b[order])))
            .slice(offset, offset + limit);
          if (selected !== "*")
            data = data.map((row) =>
              Object.fromEntries(
                selected.split(",").map((column) => [column, row[column]]),
              ),
            );
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(name, args) {
      calls.rpc.push([name, args]);
      return { data: options.rpcResult ?? { processed: true }, error: null };
    },
    auth: {
      async getUser(token) {
        calls.auth.push(token);
        const user = options.users?.[token];
        return user
          ? { data: { user }, error: null }
          : { data: { user: null }, error: { message: "Invalid session" } };
      },
    },
  };
  const platform = compileModule("lib/cgl-platform.ts", {
    "server-only": {},
    "@/lib/cgl-engine": engine,
    "@/lib/supabase-admin": { getSupabaseAdmin: () => database },
    "@/lib/cgl-sgt": {
      CglSgtError: TestSgtError,
      sanitizeSgtPublic: (value) => value,
      connectCglSgt: async (input) => {
        calls.sgt.push(["connect", input]);
        return { connected: true };
      },
      runCglSgtSync: async (input) => {
        calls.sgt.push(["sync", input]);
        return { status: "completed" };
      },
      setCglSgtSyncEnabled: async (input) => {
        calls.sgt.push(["enabled", input]);
        return { enabled: input.enabled };
      },
    },
    "@/lib/admin-auth": {
      isAdminAuthenticated: async () => options.cookieAdmin === true,
      isValidAdminAppAccessToken: (token) => token === "legacy-token",
    },
  });
  return { platform, calls };
}

test("invalid annual/cancellation policy settings cannot reach the database", async () => {
  const { platform, calls } = platformHarness();
  for (const record of [
    {
      key: "annual_formula",
      value: { approved: true, method: "best_seasons", counted_seasons: 0 },
    },
    { key: "cancellation_policy", value: { approved: true, mode: "invalid" } },
    { key: "legal", value: { approved: true } },
  ]) {
    await assert.rejects(
      platform.executeCglAdminAction(
        { id: "test-admin", role: "super_admin" },
        {
          action: "save_settings",
          record,
          reason: "Validate proposed configuration before saving",
        },
      ),
    );
  }
  assert.equal(calls.rpc.length, 0);
});

function request(token, extraHeaders = {}) {
  return new Request("https://example.test/api/cgl/member", {
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
  });
}
function user(extras = {}) {
  return {
    id: MEMBER,
    email: "member@example.invalid",
    user_metadata: {},
    app_metadata: {},
    ...extras,
  };
}
function season() {
  return {
    id: SEASON,
    name: "Isolated test season",
    status: "active",
    starts_at: "2027-03-01T00:00:00Z",
    ends_at: "2027-05-31T00:00:00Z",
  };
}
function week(number = 4, extras = {}) {
  return {
    id: WEEK,
    season_id: SEASON,
    week_number: number,
    championship_week: number - 3,
    phase: "championship",
    status: "open",
    opens_at: "2027-03-22T00:00:00Z",
    closes_at: "2027-05-31T00:00:00Z",
    results_published: false,
    ...extras,
  };
}
function membership(extras = {}) {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    member_id: MEMBER,
    plan_code: "weekly",
    state: "active",
    starts_at: "2027-03-01T00:00:00Z",
    paid_through: "2027-06-01T00:00:00Z",
    failed_at: null,
    ...extras,
  };
}
function eligibilityTables(member = {}, memberMembership = {}) {
  return {
    cgl_members: [
      {
        id: MEMBER,
        handicap_status: "verified",
        eligibility: "active",
        ...member,
      },
    ],
    cgl_memberships: [membership(memberMembership)],
    cgl_seasons: [season()],
    cgl_plans: [{ code: "weekly", full_member: true }],
    cgl_season_entries: [],
  };
}
async function withAdminSecret(secret, run, configuredCredentials = false) {
  const keys = ["CGS_ADMIN_SECRET", "CGS_ADMIN_USERNAME", "CGS_ADMIN_PASSWORD"];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    if (secret == null) delete process.env.CGS_ADMIN_SECRET;
    else process.env.CGS_ADMIN_SECRET = secret;
    if (configuredCredentials) {
      process.env.CGS_ADMIN_USERNAME = "fixture-league-operator";
      process.env.CGS_ADMIN_PASSWORD = "test-only-long-administrator-password";
    } else {
      delete process.env.CGS_ADMIN_USERNAME;
      delete process.env.CGS_ADMIN_PASSWORD;
    }
    await run();
  } finally {
    for (const key of keys)
      if (saved[key] == null) delete process.env[key];
      else process.env[key] = saved[key];
  }
}

test("member API requires a verified Auth user and refuses the legacy admin app token as a member identity", async () => {
  const { platform, calls } = platformHarness();
  await assert.rejects(platform.getCglMemberIdentity(request()), {
    status: 401,
  });
  await assert.rejects(platform.getCglMemberIdentity(request("legacy-token")), {
    status: 401,
  });
  assert.deepEqual(calls.auth, ["legacy-token"]);
});

test("a member cannot obtain an administrator role by editing user metadata", async () => {
  const { platform } = platformHarness(
    {},
    {
      users: {
        injected: user({
          user_metadata: { cgl_role: "super_admin", role: "admin" },
        }),
      },
    },
  );
  await assert.rejects(platform.getCglAdminActor(request("injected")), {
    status: 403,
  });
});

test("CGL administrator roles are accepted only from verified app metadata", async () => {
  for (const role of ["super_admin", "league_admin", "results_admin"]) {
    const { platform } = platformHarness(
      {},
      { users: { trusted: user({ app_metadata: { cgl_role: role } }) } },
    );
    assert.deepEqual(await platform.getCglAdminActor(request("trusted")), {
      id: MEMBER,
      role,
    });
  }
});

test("existing Clubhouse Admin sessions and app tokens require the configured strong CGS session secret", async () => {
  const { platform } = platformHarness({}, { cookieAdmin: true });
  await withAdminSecret(null, async () => {
    await assert.rejects(platform.getCglAdminActor(), { status: 403 });
    await assert.rejects(platform.getCglAdminActor(request("legacy-token")), {
      status: 401,
    });
  });
  await withAdminSecret(
    "test-only-strong-admin-secret-at-least-32-characters",
    async () => {
      assert.equal((await platform.getCglAdminActor()).role, "super_admin");
      assert.equal(
        (await platform.getCglAdminActor(request("legacy-token"))).role,
        "super_admin",
      );
    },
  );
});

test("member commands bind account ownership to the verified identity rather than a supplied member ID", async () => {
  const { platform, calls } = platformHarness();
  const identity = {
    id: MEMBER,
    email: "member@example.invalid",
    displayName: "Fixture member",
    appMetadata: {},
  };
  await platform.executeCglMemberAction(identity, {
    action: "join",
    member_id: OTHER,
    email: "forged@example.invalid",
    displayName: "Forged",
  });
  assert.equal(calls.rpc[0][1].p_actor, MEMBER);
  assert.equal(calls.rpc[0][1].p_payload.member_id, MEMBER);
  assert.equal(calls.rpc[0][1].p_payload.email, identity.email);
  assert.equal(calls.rpc[0][1].p_payload.display_name, identity.displayName);
});

test("member SGT links preserve long numeric IDs as strings and reject unsafe links or numeric truncation", async () => {
  const { platform, calls } = platformHarness();
  const identity = {
    id: MEMBER,
    email: "member@example.invalid",
    displayName: "Fixture",
    appMetadata: {},
  };
  const body = {
    action: "link_sgt",
    sgtUsername: "FixtureGolfer",
    sgtId: "90000000000000001",
  };
  await platform.executeCglMemberAction(identity, body);
  assert.equal(calls.rpc[0][1].p_payload.sgt_id, "90000000000000001");
  await assert.rejects(
    platform.executeCglMemberAction(identity, {
      ...body,
      sgtId: 90000000000000001,
    }),
  );
  await assert.rejects(
    platform.executeCglMemberAction(identity, {
      ...body,
      sgtUsername: "https://evil.example",
    }),
  );
});

test("results administrators cannot change billing, settings, members or credits", async () => {
  const { platform, calls } = platformHarness();
  const actor = { id: MEMBER, role: "results_admin" };
  for (const action of [
    "save_plan",
    "save_settings",
    "update_member",
    "adjust_credits",
    "allocate_gift",
  ]) {
    await assert.rejects(
      platform.executeCglAdminAction(actor, {
        action,
        reason: "Isolated role test",
        record: {},
      }),
      { status: 403 },
    );
  }
  assert.equal(calls.rpc.length, 0);
});

test("SGT controls preserve role boundaries and pass audited server-only actions", async () => {
  const results = platformHarness();
  await results.platform.executeCglAdminAction(
    { id: MEMBER, role: "results_admin" },
    { action: "sync_sgt", reason: "Refresh official club data for review" },
  );
  assert.equal(results.calls.sgt[0][0], "sync");
  await assert.rejects(
    results.platform.executeCglAdminAction(
      { id: MEMBER, role: "results_admin" },
      {
        action: "connect_sgt",
        username: "club-admin",
        password: "private-password",
        reason: "Attempt a restricted SGT connection",
      },
    ),
    { status: 403 },
  );

  const owner = platformHarness();
  await owner.platform.executeCglAdminAction(
    { id: MEMBER, role: "super_admin" },
    {
      action: "connect_sgt",
      username: "club-admin",
      password: "private-password",
      reason: "Connect the official CGSBunker club account",
    },
  );
  assert.deepEqual(owner.calls.sgt[0], [
    "connect",
    {
      username: "club-admin",
      password: "private-password",
      actor: MEMBER,
      reason: "Connect the official CGSBunker club account",
    },
  ]);
});

test("CGL mutations reject cross-origin requests and oversized or invalid JSON", async () => {
  const { platform } = platformHarness();
  assert.throws(
    () =>
      platform.verifyCglOrigin(
        request(null, { origin: "https://evil.example" }),
      ),
    { status: 403 },
  );
  assert.throws(
    () =>
      platform.verifyCglOrigin(
        request(null, { "sec-fetch-site": "cross-site" }),
      ),
    { status: 403 },
  );
  assert.doesNotThrow(() =>
    platform.verifyCglOrigin(request(null, { origin: "https://example.test" })),
  );
  await assert.rejects(
    platform.readCglBody(
      new Request("https://example.test", { method: "POST", body: "[]" }),
    ),
    /valid JSON object/,
  );
  await assert.rejects(
    platform.readCglBody(
      new Request("https://example.test", {
        method: "POST",
        body: "{}",
        headers: { "content-length": "1000001" },
      }),
    ),
    { status: 413 },
  );
});

test("public snapshots omit draft/unpublished results, account identities, contact details and arbitrary source metadata", async () => {
  const tables = {
    cgl_seasons: [season(), { ...season(), id: OTHER, status: "draft" }],
    cgl_weeks: [
      week(4, { results_published: true }),
      week(5, { id: OTHER, results_published: false }),
    ],
    cgl_members: [
      {
        id: MEMBER,
        sgt_username: "FixtureGolfer",
        handicap: 6.2,
        email: "private@example.invalid",
        sgt_id: "90000000000000001",
        private_notes: "PRIVATE-ADMIN-NOTE",
      },
    ],
    cgl_results: [
      {
        id: "published-result",
        member_id: MEMBER,
        week_id: WEEK,
        state: "verified",
        net: 70,
        gross: 76,
        division: "A",
        handicap: 6.2,
        holes: [{ strokeIndex: 1, net: 3, gross: 4 }],
        stats: {
          ctp_metres: 0.5,
          putts: 31,
          email: "source-private@example.invalid",
          sgt_id: "90000000000000001",
          admin_note: "PRIVATE-SOURCE-NOTE",
          customer: { card: "PRIVATE-CARD" },
        },
      },
      {
        id: "hidden-result",
        member_id: MEMBER,
        week_id: OTHER,
        state: "verified",
        net: 68,
        gross: 74,
        division: "A",
        stats: {},
      },
    ],
  };
  const { platform } = platformHarness(tables);
  const snapshot = await platform.getCglPublicSnapshot();
  assert.equal(snapshot.results.length, 1);
  assert.equal(snapshot.results[0].sgt_username, "FixtureGolfer");
  assert.equal(snapshot.results[0].stats.ctp_metres, 0.5);
  assert.equal(snapshot.seasons.length, 1);
  const json = JSON.stringify(snapshot);
  for (const privateValue of [
    MEMBER,
    "private@example.invalid",
    "source-private@example.invalid",
    "90000000000000001",
    "PRIVATE-ADMIN-NOTE",
    "PRIVATE-SOURCE-NOTE",
    "PRIVATE-CARD",
    "hidden-result",
  ])
    assert.equal(
      json.includes(privateValue),
      false,
      `Public snapshot leaked ${privateValue}`,
    );
});

test("member snapshots expose only the signed-in account's balances and history and omit private admin notes", async () => {
  const tables = {
    cgl_members: [
      {
        id: MEMBER,
        sgt_username: "FixtureGolfer",
        email: "member@example.invalid",
        private_notes: "ADMIN-ONLY",
      },
      {
        id: OTHER,
        sgt_username: "OtherGolfer",
        email: "other-private@example.invalid",
      },
    ],
    cgl_credit_lots: [
      {
        id: "own-lot",
        member_id: MEMBER,
        remaining_amount: 20,
        expires_at: "2099-01-01",
      },
      {
        id: "other-lot",
        member_id: OTHER,
        remaining_amount: 999,
        expires_at: "2099-01-01",
      },
    ],
    cgl_payments: [
      { id: "own-payment", member_id: MEMBER },
      { id: "other-payment", member_id: OTHER },
    ],
  };
  const { platform } = platformHarness(tables);
  const snapshot = await platform.getCglMemberSnapshot({
    id: MEMBER,
    email: "member@example.invalid",
    displayName: "Fixture",
    appMetadata: {},
  });
  assert.equal(snapshot.credits.available, 20);
  assert.equal(snapshot.payments.length, 1);
  const json = JSON.stringify(snapshot);
  for (const privateValue of [
    "other-private@example.invalid",
    "other-lot",
    "other-payment",
    "ADMIN-ONLY",
  ])
    assert.equal(json.includes(privateValue), false);
});

test("a failed first payment never grants grace entry without a prior confirmed membership start", async () => {
  const { platform } = platformHarness(
    eligibilityTables(
      {},
      {
        starts_at: null,
        paid_through: null,
        state: "past_due",
        failed_at: "2027-03-25T00:00:00Z",
      },
    ),
  );
  const eligibility = await platform.getCglEligibility(
    MEMBER,
    week(4),
    "2027-03-26T00:00:00Z",
  );
  assert.equal(eligibility.eligible, false);
});

test("failed-payment grace uses the actual season week, even when four fixture windows were published together", async () => {
  const { platform } = platformHarness(
    eligibilityTables(
      {},
      {
        state: "past_due",
        failed_at: "2027-03-25T00:00:00Z",
        paid_through: "2027-03-22T00:00:00Z",
      },
    ),
  );
  assert.equal(
    (await platform.getCglEligibility(MEMBER, week(4), "2027-03-26T00:00:00Z"))
      .eligible,
    true,
  );
  assert.equal(
    (await platform.getCglEligibility(MEMBER, week(5), "2027-03-26T00:00:00Z"))
      .eligible,
    false,
  );
  assert.equal(
    (await platform.getCglEligibility(MEMBER, week(7), "2027-03-26T00:00:00Z"))
      .eligible,
    false,
  );
});

test("a later payment failure does not invalidate a historically paid result submitted for verification", async () => {
  const { platform } = platformHarness(
    eligibilityTables(
      {},
      {
        state: "past_due",
        failed_at: "2027-03-25T00:00:00Z",
        paid_through: "2027-03-29T00:00:00Z",
      },
    ),
  );
  assert.equal(
    (await platform.getCglEligibility(MEMBER, week(4), "2027-03-23T00:00:00Z"))
      .eligible,
    true,
  );
});

test("suspended members are blocked server-side while accepted qualifying play does not invent a handicap", async () => {
  const suspended = platformHarness(
    eligibilityTables({ eligibility: "suspended" }),
  );
  assert.equal(
    (
      await suspended.platform.getCglEligibility(
        MEMBER,
        week(4),
        "2027-03-23T00:00:00Z",
      )
    ).eligible,
    false,
  );
  const qualifying = platformHarness(
    eligibilityTables({ handicap_status: "qualifying" }),
  );
  assert.equal(
    (
      await qualifying.platform.getCglEligibility(
        MEMBER,
        week(4),
        "2027-03-23T00:00:00Z",
      )
    ).eligible,
    false,
  );
  assert.equal(
    (
      await qualifying.platform.getCglEligibility(
        MEMBER,
        week(3, {
          phase: "qualification",
          championship_week: null,
          opens_at: "2027-03-15T00:00:00Z",
        }),
        "2027-03-20T00:00:00Z",
      )
    ).eligible,
    true,
  );
});

test("scheduler refuses missing or wrong secrets without invoking expiry RPCs", async () => {
  const saved = process.env.CGL_JOB_SECRET;
  try {
    process.env.CGL_JOB_SECRET =
      "test-only-scheduler-secret-at-least-32-characters";
    const { platform, calls } = platformHarness();
    await assert.rejects(platform.runCglScheduledJobs(request()), {
      status: 403,
    });
    await assert.rejects(
      platform.runCglScheduledJobs(request("wrong-secret")),
      { status: 403 },
    );
    assert.equal(calls.rpc.length, 0);
  } finally {
    if (saved == null) delete process.env.CGL_JOB_SECRET;
    else process.env.CGL_JOB_SECRET = saved;
  }
});

test("CSV exports neutralise formula injection and preserve quoted cells", () => {
  const { platform } = platformHarness();
  const csv = platform.cglCsv([
    {
      username: '=HYPERLINK("https://evil.example")',
      value: 'Quoted "text"',
      newline: "first\nsecond",
    },
  ]);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /Quoted ""text""/);
  assert.match(csv, /first\nsecond/);
});

test("Sandbox full and casual payments cannot qualify a member for real league entry", async () => {
  const full = eligibilityTables({}, { metadata: { environment: "sandbox" } });
  const fullApi = platformHarness(full).platform;
  assert.equal((await fullApi.getCglEligibility(MEMBER, week(4), "2027-03-23T00:00:00Z")).eligible, false);
  const casual = eligibilityTables({}, { plan_code: "casual_registration", metadata: { environment: "sandbox" } });
  casual.cgl_season_entries = [{ id: "test-pass", member_id: MEMBER, season_id: SEASON, state: "active", paid_at: "2027-03-01", source: "square_sandbox" }];
  assert.equal((await platformHarness(casual).platform.getCglEligibility(MEMBER, week(4), "2027-03-23T00:00:00Z")).eligible, false);
});

test("Square billing records are classified by their explicit environment only", () => {
  const { platform } = platformHarness();
  assert.equal(platform.isCglSquareEnvironmentRecord({ metadata: { environment: "sandbox" } }, "sandbox"), true);
  assert.equal(platform.isCglSquareEnvironmentRecord({ external_id: "square:production:payment" }, "production"), true);
  assert.equal(platform.isCglSquareEnvironmentRecord({ metadata: { environment: "production" } }, "sandbox"), false);
  assert.equal(platform.isCglSquareEnvironmentRecord({ id: "manual-payment" }, "production"), false);
});

test("a member sees owned Sandbox billing in a separate test history, without granting gifts or exposing another account", async () => {
  const tables = eligibilityTables({}, { metadata: { environment: "sandbox" }, starts_at: "2026-01-01", paid_through: "2099-01-01" });
  tables.cgl_payments = [
    { id: "test-payment", member_id: MEMBER, metadata: { environment: "sandbox" }, state: "completed", amount_cents: 895 },
    { id: "real-payment", member_id: MEMBER, state: "completed", amount_cents: 895 },
    { id: "other-private-payment", member_id: OTHER, metadata: { environment: "sandbox" } },
  ];
  const api = platformHarness(tables).platform;
  const value = await api.getCglMemberSnapshot({ id: MEMBER, email: "member@example.invalid", displayName: "Member", appMetadata: {} });
  assert.equal(value.memberships.length, 0);
  assert.deepEqual(value.payments.map(p => p.id), ["real-payment"]);
  assert.deepEqual(value.billing.payments.map(p => p.id), ["test-payment"]);
  assert.equal(value.billing.livePaymentsEnabled, false);
  assert.equal(JSON.stringify(value).includes("other-private-payment"), false);
  await assert.rejects(api.executeCglMemberAction({ id: MEMBER }, { action: "quote_cancellation", membershipId: tables.cgl_memberships[0].id }), { code: "policy_pending" });
});

test("Sandbox money and memberships are excluded from real revenue and subscriber totals", async () => {
  const tables = eligibilityTables({}, { metadata: { environment: "sandbox" }, starts_at: "2026-01-01", paid_through: "2099-01-01" });
  const now = new Date().toISOString();
  tables.cgl_payments = [
    { id: "test", amount_cents: 24900, fee_cents: 0, state: "completed", paid_at: now, metadata: { environment: "sandbox" } },
    { id: "real", amount_cents: 10000, fee_cents: 200, state: "completed", paid_at: now },
  ];
  const value = await platformHarness(tables).platform.getCglAdminSnapshot({ id: "admin", role: "super_admin" });
  assert.equal(value.overview.annual_revenue_cents, 10000);
  assert.equal(value.overview.processing_fees_cents, 200);
  assert.equal(value.overview.active_subscribers, 0);
});
