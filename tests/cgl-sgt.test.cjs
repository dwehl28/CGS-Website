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
