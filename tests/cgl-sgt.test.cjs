const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

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
        esModuleInterop: true,
      },
    }).outputText,
    sourcePath,
  );
  return loaded.exports;
}

const sgt = compileModule("lib/cgl-sgt.ts", {
  "server-only": {},
  "@/lib/supabase-admin": {
    getSupabaseAdmin: () => {
      throw new Error("Database access is not expected in this unit test");
    },
  },
});

const live = compileModule("lib/cgl-sgt-live.ts");

test("public SGT snapshots remove credentials, contact details and provider IDs recursively", () => {
  const safe = sgt.sanitizeSgtPublic({
    name: "Fixture Golfer",
    gross: 72,
    net: 68,
    email: "private@example.invalid",
    apiKey: "PRIVATE-KEY",
    user_id: "PRIVATE-USER-ID",
    nested: {
      playerId: 12345,
      team_id: 88,
      driving_distance: 286,
      holes: [{ scorecard_id: 777, hole: 1, score: 4 }],
    },
  });
  const json = JSON.stringify(safe);
  assert.equal(json.includes("private@example.invalid"), false);
  assert.equal(json.includes("PRIVATE-KEY"), false);
  assert.equal(json.includes("PRIVATE-USER-ID"), false);
  assert.equal(json.includes("12345"), false);
  assert.equal(json.includes("777"), false);
  assert.equal(json.includes("Fixture Golfer"), true);
  assert.equal(json.includes("driving_distance"), true);
  assert.equal(json.includes('"score":4'), true);
});

test("the SGT migration keeps provider data private and the rotating key in Vault", () => {
  const migration = fs.readFileSync(
    path.resolve(
      __dirname,
      "..",
      "supabase/migrations/20261112115633_cgl_sgt_club_api_sync.sql",
    ),
    "utf8",
  );
  for (const table of [
    "cgl_sgt_connections",
    "cgl_sgt_tours",
    "cgl_sgt_tournaments",
    "cgl_sgt_sync_runs",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`));
  }
  assert.match(migration, /vault\.create_secret/);
  assert.match(migration, /vault\.update_secret/);
  assert.match(migration, /vault\.decrypted_secrets/);
  assert.match(migration, /p_reason text/);
  assert.match(migration, /cgl-sgt-sync-every-30-minutes/);
  assert.equal(/password/i.test(migration), false);
});

test("the scheduled sync endpoint fails closed around a dedicated long secret", () => {
  const route = fs.readFileSync(
    path.resolve(__dirname, "..", "app/api/cgl/sgt/sync/route.ts"),
    "utf8",
  );
  assert.match(route, /CGL_SGT_SYNC_SECRET/);
  assert.match(route, /expected\.length >= 32/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /status: 403/);
  assert.match(route, /Cache-Control": "no-store/);
});

test("the SGT admin form reads credentials directly from its inputs", () => {
  const component = fs.readFileSync(
    path.resolve(
      __dirname,
      "..",
      "components/cgl/CglAdminCentre.tsx",
    ),
    "utf8",
  );
  assert.match(component, /ref=\{sgtUsernameRef\}/);
  assert.match(component, /ref=\{sgtPasswordRef\}/);
  assert.match(component, /username: sgtUsernameRef\.current\?\.value/);
  assert.match(component, /password: sgtPasswordRef\.current\?\.value/);
});

test("the public live parser reads SGT flat gross, nett, par and stroke-index fields", () => {
  const card = {
    user_name: "Fixture Golfer",
    total_gross: 47,
    total_net: 41,
  };
  for (let hole = 1; hole <= 12; hole += 1) {
    card[`h${hole}_Par`] = hole % 3 === 0 ? 5 : 4;
    card[`h${hole}_index`] = hole;
    card[`hole${hole}_gross`] = hole === 1 ? 3 : 4;
    card[`hole${hole}_net`] = hole === 1 ? 2 : 4;
  }
  card.h13_Par = 4;
  card.hole13_gross = 0;
  card.hole13_net = 0;
  const holes = live.sgtScorecardHoles(card);
  assert.equal(holes.length, 12);
  assert.deepEqual(holes[0], {
    hole: 1,
    par: 4,
    gross: 3,
    net: 2,
    strokeIndex: 1,
  });
  assert.equal(live.sgtScore(card, "gross"), 47);
  assert.equal(live.sgtScore(card, "net"), 41);
});

test("the live leaderboard aggregates rounds and reports current progress", () => {
  const finished = {
    user_name: "Alice",
    round: 1,
    activeHole: 3,
    total_net: 35,
    toPar_net: -1,
    h1_Par: 4,
    h2_Par: 4,
    h3_Par: 4,
    hole1_net: 3,
    hole2_net: 4,
    hole3_net: 4,
  };
  const playing = {
    user_name: "Alice",
    round: 2,
    activeHole: 3,
    total_net: 20,
    toPar_net: -2,
    h1_Par: 4,
    h2_Par: 4,
    h3_Par: 4,
    hole1_net: 3,
    hole2_net: 3,
  };
  const other = {
    user_name: "Bob",
    round: 1,
    activeHole: 3,
    total_net: 38,
    toPar_net: 2,
    h1_Par: 4,
    h2_Par: 4,
    h3_Par: 4,
    hole1_net: 4,
    hole2_net: 5,
    hole3_net: 5,
  };
  const leaderboard = live.buildSgtTournamentLeaderboard(
    [finished, playing, other],
    "net",
  );
  assert.equal(leaderboard[0].name, "Alice");
  assert.equal(leaderboard[0].total, 55);
  assert.equal(leaderboard[0].toPar, -3);
  assert.equal(leaderboard[0].status, "live");
  assert.equal(leaderboard[0].currentRound, 2);
  assert.equal(leaderboard[0].thru, "2");
  assert.equal(leaderboard[1].status, "finished");
});

test("the live statistics parser maps real SGT category fields", () => {
  const categories = live.buildSgtStatCategories({
    drivingAccuracy: [
      { user_name: "Alice", fir_percent: 75 },
      { user_name: "Bob", fir_percent: 62.5 },
    ],
    drivingDistance: [
      { user_name: "Bob", longest_drive: 286 },
      { user_name: "Alice", longest_drive: 272 },
    ],
  });
  const fairways = categories.find((category) => category.key === "drivingAccuracy");
  const distance = categories.find((category) => category.key === "drivingDistance");
  assert.equal(fairways.entries[0].name, "Alice");
  assert.equal(live.formatSgtStatValue(fairways.entries[0].value, fairways), "75.0%");
  assert.equal(distance.entries[0].name, "Bob");
  assert.equal(distance.entries[0].value, 286);
});

test("the focused public live refresh is throttled and service-role only", () => {
  const migration = fs.readFileSync(
    path.resolve(
      __dirname,
      "..",
      "supabase/migrations/20261120130555_cgl_sgt_live_pulse.sql",
    ),
    "utf8",
  );
  assert.match(migration, /live_sync_interval_seconds integer not null default 45/);
  assert.match(migration, /between 30 and 300/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /revoke all on function public\.cgl_sgt_claim_live_sync\(text,uuid\)/);
  assert.match(migration, /grant execute on function public\.cgl_sgt_claim_live_sync\(text,uuid\)\s+to service_role/);
});

test("the customer live pulse is same-origin protected and keeps cached results", () => {
  const route = fs.readFileSync(
    path.resolve(__dirname, "..", "app/api/cgl/sgt/live/route.ts"),
    "utf8",
  );
  const component = fs.readFileSync(
    path.resolve(__dirname, "..", "components/cgl/CglSgtLive.tsx"),
    "utf8",
  );
  assert.match(route, /verifyCglOrigin\(request\)/);
  assert.match(route, /status: 403/);
  assert.match(route, /getCglSgtPublicSnapshot/);
  assert.match(route, /Last confirmed data is still available/);
  assert.match(component, /15_000/);
  assert.match(component, /tick % 3 === 0/);
  assert.match(component, /If-None-Match/);
});
