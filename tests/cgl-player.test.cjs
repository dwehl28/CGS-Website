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
  loaded.require = (name) =>
    Object.hasOwn(overrides, name) ? overrides[name] : module.require(name);
  loaded._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    filename,
  );
  return loaded.exports;
}

function emptySnapshot() {
  return {
    status: "ready",
    results: [],
    standings: [],
    annual: [],
    prizes: [],
    seasons: [],
    weeks: [],
  };
}
function routeHarness({
  roster = { status: "available", players: [] },
  snapshot = emptySnapshot(),
  snapshotError = false,
  sample = null,
} = {}) {
  const fakeView = (name) =>
    function View() {
      return React.createElement("div", null, name);
    };
  const views = {
    league: fakeView("2027 profile"),
    trial: fakeView("Trial profile"),
    sample: fakeView("Earlier sample profile"),
    unavailable: fakeView("Unavailable"),
  };
  const route = compile("app/cgl/players/[username]/page.tsx", {
    "next/navigation": {
      notFound() {
        const error = new Error("NEXT_NOT_FOUND");
        error.code = "NEXT_NOT_FOUND";
        throw error;
      },
    },
    "next/server": { connection: async () => {} },
    react: { ...React, cache: (fn) => fn },
    "@/components/cgl/Cgl2027Player": { default: views.league },
    "@/components/cgl/CglPlayerProfile": { default: views.sample },
    "@/components/cgl/CglRegisteredPlayer": {
      default: views.trial,
      CglRegisteredPlayerUnavailable: views.unavailable,
    },
    "@/lib/cgl-demo": { getCglPlayer: () => sample },
    "@/lib/cgl-roster": { getCglTrialRoster: async () => roster },
    "@/lib/cgl-platform": {
      getCglPublicSnapshot: async () => {
        if (snapshotError) throw new Error("CGL setup required");
        return snapshot;
      },
    },
  });
  return { route, views };
}
const params = (username) => ({ params: Promise.resolve({ username }) });

test("2027 leaderboard player links resolve case-insensitively using public history and include only that player's records", async () => {
  const snapshot = {
    ...emptySnapshot(),
    results: [
      { id: "own", sgt_username: "FixtureGolfer", week_id: "week-1", net: 70 },
      { id: "other", sgt_username: "OtherGolfer", week_id: "week-1", net: 69 },
    ],
    standings: [
      { sgt_username: "FixtureGolfer", total_points: 500 },
      { sgt_username: "OtherGolfer", total_points: 300 },
    ],
    annual: [
      {
        sgt_username: "FixtureGolfer",
        status: "pending_approval",
        points: null,
      },
    ],
  };
  const { route, views } = routeHarness({ snapshot });
  const result = await route.default(params("fixturegolfer"));
  assert.equal(result.type, views.league);
  assert.equal(result.props.profile.username, "FixtureGolfer");
  assert.equal(result.props.profile.results.length, 1);
  assert.equal(result.props.profile.standings.length, 1);
  assert.equal(
    JSON.stringify(result.props.profile).includes("OtherGolfer"),
    false,
  );
  const metadata = await route.generateMetadata(params("fixturegolfer"));
  assert.equal(metadata.title, "FixtureGolfer · CGL Player Stats");
});

test("a public known 2027 member without published results receives an honest empty profile", async () => {
  const { route, views } = routeHarness({
    snapshot: {
      ...emptySnapshot(),
      annual: [
        {
          sgt_username: "FixtureGolfer",
          status: "pending_approval",
          points: null,
        },
      ],
    },
  });
  const result = await route.default(params("FixtureGolfer"));
  assert.equal(result.type, views.league);
  assert.deepEqual(result.props.profile.results, []);
});

test("existing trial scorecard profiles survive an unapplied new CGL migration", async () => {
  const trial = {
    username: "FixtureTrial",
    profileUrl: "https://simulatorgolftour.com/profile/FixtureTrial",
    scorecardUrl: "https://simulatorgolftour.com/scorecard/123/456",
  };
  const { route, views } = routeHarness({
    roster: { status: "available", players: [trial] },
    snapshotError: true,
  });
  const result = await route.default(params("FixtureTrial"));
  assert.equal(result.props.children[0].type, views.trial);
  assert.deepEqual(result.props.children[0].props.player, trial);
  assert.equal(result.props.children[1], null);
});

test("trial players retain their linked scorecard and gain an independent 2027 history after publication", async () => {
  const trial = {
    username: "FixtureTrial",
    profileUrl: "https://simulatorgolftour.com/profile/FixtureTrial",
    scorecardUrl: "https://simulatorgolftour.com/scorecard/123/456",
  };
  const { route, views } = routeHarness({
    roster: { status: "available", players: [trial] },
    snapshot: {
      ...emptySnapshot(),
      results: [{ sgt_username: "FixtureTrial", id: "2027-result", net: 70 }],
    },
  });
  const result = await route.default(params("FixtureTrial"));
  assert.equal(result.props.children[0].type, views.trial);
  assert.equal(
    result.props.children[0].props.player.scorecardUrl,
    trial.scorecardUrl,
  );
  assert.equal(result.props.children[1].type, views.league);
  assert.equal(result.props.children[1].props.embedded, true);
});

test("2027 public profiles remain available when the legacy trial roster is temporarily unavailable", async () => {
  const { route, views } = routeHarness({
    roster: { status: "unavailable", players: [] },
    snapshot: {
      ...emptySnapshot(),
      results: [{ sgt_username: "FixtureGolfer", id: "result", net: 70 }],
    },
  });
  assert.equal(
    (await route.default(params("FixtureGolfer"))).type,
    views.league,
  );
});

test("earlier fictional design players stay in their clearly labelled legacy preview", async () => {
  const { route, views } = routeHarness({
    sample: { username: "EarlierSample" },
    snapshotError: true,
  });
  const result = await route.default(params("EarlierSample"));
  assert.equal(result.type, views.sample);
  assert.equal(result.props.username, "EarlierSample");
});

test("unknown public handles return not-found only when both sources are available", async () => {
  const { route } = routeHarness();
  await assert.rejects(route.default(params("UnknownFixture")), {
    code: "NEXT_NOT_FOUND",
  });
  const unavailable = routeHarness({ snapshotError: true });
  assert.equal(
    (await unavailable.route.default(params("UnknownFixture"))).type,
    unavailable.views.unavailable,
  );
});

function viewHarness() {
  const helpers = compile("components/cgl/cgl-ui.ts");
  return compile("components/cgl/Cgl2027Player.tsx", {
    "next/link": {
      default: ({ children, ...props }) =>
        React.createElement("a", props, children),
    },
    "./cgl-ui": helpers,
    "./Cgl2027.module.css": {
      default: new Proxy({}, { get: (_, key) => String(key) }),
    },
    "./CglPublicExperience": {
      CglEmpty: ({ title, children }) =>
        React.createElement(
          "div",
          null,
          React.createElement("h3", null, title),
          children,
        ),
      CglPerformanceHighlights: () =>
        React.createElement("div", null, "Verified performance statistics"),
    },
  }).default;
}

test("the public 2027 profile renders published score/points history and best-eight details without private fields", () => {
  const View = viewHarness();
  const profile = {
    username: "FixtureGolfer",
    seasons: [
      {
        id: "season",
        year: 2027,
        season_number: 1,
        status: "active",
        name: "Fixture season",
      },
    ],
    weeks: [{ id: "week", name: "Fixture weekly event" }],
    results: [
      {
        id: "result",
        week_id: "week",
        season_id: "season",
        gross: 75,
        net: 68,
        points: 500,
        position: 1,
        scorecard_url: "https://simulatorgolftour.com/scorecard/123/456",
      },
    ],
    standings: [
      {
        season_id: "season",
        division: "A",
        handicap: 7,
        total_points: 500,
        position: 1,
        rounds_counted: 1,
        counted: [{ week: 1, points: 500 }],
        discarded: [{ week: 10, points: 0 }],
        missing_weeks: [10],
      },
    ],
    annual: { status: "pending_approval", points: null },
    prizes: [],
    private_notes: "PRIVATE-ADMIN-NOTE",
    email: "private@example.invalid",
    credit_balance: 999,
  };
  const html = renderToStaticMarkup(React.createElement(View, { profile }));
  for (const expected of [
    "FixtureGolfer",
    "Fixture weekly event",
    "Your best eight",
    "Missing · zero points",
    "View scorecard",
    "awaiting CGS approval",
  ])
    assert.ok(html.includes(expected), `Missing ${expected}`);
  for (const forbidden of [
    "PRIVATE-ADMIN-NOTE",
    "private@example.invalid",
    "999",
    "<iframe",
  ])
    assert.equal(html.includes(forbidden), false);
});

test("the public profile never offers an unverified external scorecard host as an embedded card", () => {
  const View = viewHarness();
  const profile = {
    username: "FixtureGolfer",
    seasons: [],
    weeks: [],
    standings: [],
    annual: null,
    prizes: [],
    results: [
      {
        id: "result",
        net: 70,
        gross: 75,
        scorecard_url: "https://simulatorgolftour.com.evil.invalid/card",
      },
    ],
  };
  const html = renderToStaticMarkup(React.createElement(View, { profile }));
  assert.equal(html.includes("View scorecard"), false);
  assert.equal(html.includes("evil.invalid"), false);
  assert.ok(html.includes("Not linked"));
});
