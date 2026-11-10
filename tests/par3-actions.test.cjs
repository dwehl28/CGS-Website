const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

function compile(relative, overrides = {}) {
  const filename = path.resolve(__dirname, "..", relative);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = (name) => Object.hasOwn(overrides, name) ? overrides[name] : module.require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return loaded.exports;
}

class RedirectSignal extends Error {
  constructor(location) {
    super(`Redirect to ${location}`);
    this.location = location;
  }
}

function harness({ authenticated = true, handlers = {} } = {}) {
  const mutations = [];
  const revalidations = [];
  const redirects = [];
  let authChecks = 0;
  const backend = new Proxy({}, {
    get(_target, name) {
      return async (...args) => {
        mutations.push({ name, args });
        return handlers[name]?.(...args);
      };
    },
  });
  const actions = compile("app/clubhouse-admin/par3/actions.ts", {
    "next/cache": { revalidatePath: (value) => revalidations.push(value) },
    "next/navigation": {
      redirect(location) {
        redirects.push(location);
        throw new RedirectSignal(location);
      },
    },
    "@/lib/admin-auth": {
      async requireAdminAuthenticated() {
        authChecks += 1;
        if (!authenticated) throw new Error("Unauthorized");
      },
    },
    "@/lib/form-utils": compile("lib/form-utils.ts"),
    "@/lib/par3-showdown": backend,
  });
  return { actions, mutations, revalidations, redirects, authChecks: () => authChecks };
}

function form(values = {}) {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, String(value));
  return data;
}

async function invoke(action, data, notice, anchor) {
  await assert.rejects(action(data), (error) => {
    assert.ok(error instanceof RedirectSignal, "the server action must finish through its normal redirect");
    const url = new URL(error.location, "https://example.test");
    assert.equal(url.pathname, "/clubhouse-admin/par3");
    assert.equal(url.searchParams.get("notice"), notice);
    if (anchor) assert.equal(url.hash, `#${anchor}`);
    return true;
  });
}

test("every exported admin action rejects unauthorized requests before parsing, writes or revalidation", async () => {
  const h = harness({ authenticated: false });
  const exported = Object.entries(h.actions);
  assert.equal(exported.length, 14, "all fourteen current Par 3 server actions must be covered");
  for (const [name, action] of exported) {
    assert.equal(typeof action, "function", name);
    await assert.rejects(action(form({ pool_sizes: "invalid JSON" })), /Unauthorized/, name);
  }
  assert.equal(h.authChecks(), exported.length);
  assert.deepEqual(h.mutations, []);
  assert.deepEqual(h.revalidations, []);
  assert.deepEqual(h.redirects, []);
});

test("the four-place CTP form sends four qualifiers rather than sixty-four padded entries", async () => {
  const h = harness();
  await invoke(h.actions.updatePar3CtpWinnerAction, form({
    event_id: 1, qualifier_1: 101, qualifier_2: 102, qualifier_3: 103, qualifier_4: 104,
  }), "ctp-saved", "ctp-playoff");
  assert.deepEqual(h.mutations, [{ name: "updatePar3CtpQualifiers", args: [1, [101, 102, 103, 104]] }]);
  assert.ok(h.revalidations.includes("/clubhouse-admin/par3"));
  assert.ok(h.revalidations.includes("/clubhouse-admin/par3/print"));
  assert.ok(h.revalidations.includes("/api/par3-showdown"));
  assert.ok(h.revalidations.includes("/stream/par3-showdown"));
});

test("CTP trimming preserves an unconfirmed place between selected ranks", async () => {
  const h = harness();
  await invoke(h.actions.updatePar3CtpWinnerAction, form({
    event_id: 1, qualifier_1: 101, qualifier_2: "", qualifier_3: 103, qualifier_4: "",
  }), "ctp-saved", "ctp-playoff");
  assert.deepEqual(h.mutations[0], { name: "updatePar3CtpQualifiers", args: [1, [101, null, 103]] });
});

test("clearing CTP places sends an empty selection for the backend's incomplete-setup clearing path", async () => {
  const h = harness({ handlers: {
    updatePar3CtpQualifiers(eventId, ids) {
      assert.equal(eventId, 1);
      assert.deepEqual(ids, [], "clearing must not require the normal field of eligible contestants");
    },
  } });
  await invoke(h.actions.updatePar3CtpWinnerAction, form({ event_id: 1 }), "ctp-reset", "ctp-playoff");
  assert.deepEqual(h.mutations, [{ name: "updatePar3CtpQualifiers", args: [1, []] }]);
  assert.ok(h.revalidations.length > 0);
});

test("valid format fields reach the backend as nominated numeric capacities and finals size", async () => {
  const h = harness();
  await invoke(h.actions.updatePar3TournamentFormatAction, form({
    event_id: 7, pool_sizes: " [2, 5, 8] ", finals_size: 8,
  }), "pool-format-saved", "entrants");
  assert.deepEqual(h.mutations, [{ name: "updatePar3TournamentFormat", args: [7, { poolSizes: [2, 5, 8], finalsSize: 8 }] }]);
  assert.equal(h.authChecks(), 1);
  assert.ok(h.revalidations.includes("/"));
});

test("unreadable or fractional format inputs never reach a backend mutation", async () => {
  const invalid = [
    { pool_sizes: "[2," },
    { pool_sizes: '{"poolSizes":[2,4]}' },
    { pool_sizes: '[2,"4"]' },
    { pool_sizes: "[2,4.5]" },
    { finals_size: "4.5" },
    { event_id: "1.5" },
    { event_id: "" },
    { finals_format: "invented_byes" },
  ];
  for (const fields of invalid) {
    const h = harness();
    await invoke(h.actions.updatePar3TournamentFormatAction, form({
      event_id: 1, pool_sizes: "[2,4]", finals_size: 4, ...fields,
    }), "pool-format-failed", "entrants");
    assert.deepEqual(h.mutations, [], JSON.stringify(fields));
    assert.deepEqual(h.revalidations, []);
  }
});

test("CTP bye format is passed explicitly and only accepts the supported format values", async () => {
  const h = harness();
  await invoke(h.actions.updatePar3TournamentFormatAction, form({
    event_id: 2, pool_sizes: "[4,4,4,4,4]", finals_size: 16, finals_format: "pool_winners_ctp_bye",
  }), "pool-format-saved", "entrants");
  assert.deepEqual(h.mutations, [{ name: "updatePar3TournamentFormat", args: [2, {
    poolSizes: [4, 4, 4, 4, 4], finalsSize: 16, finalsFormat: "pool_winners_ctp_bye",
  }] }]);
});

test("allocation accepts the nominated seeded/random method and blocks invalid methods or fractional events", async () => {
  for (const method of ["seeded", "random"]) {
    const h = harness();
    await invoke(h.actions.allocatePar3PoolsAction, form({ event_id: 3, method }), "pool-allocation-saved", "entrants");
    assert.deepEqual(h.mutations, [{ name: "allocatePar3Pools", args: [3, method] }]);
  }
  for (const fields of [{ method: "" }, { method: "randomish" }, { method: "delete" }, { event_id: "3.5" }]) {
    const h = harness();
    await invoke(h.actions.allocatePar3PoolsAction, form({ event_id: 3, method: "seeded", ...fields }), "pool-allocation-failed", "entrants");
    assert.deepEqual(h.mutations, []);
    assert.deepEqual(h.revalidations, []);
  }
});
