const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
function compile(file, overrides = {}) {
  const filename = path.resolve(__dirname, "..", file);
  const loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded.require = (name) => overrides[name] ?? module.require(name);
  loaded._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    filename,
  );
  return loaded.exports;
}
const engine = compile("lib/cgl-engine.ts");
const fixture = compile("scripts/cgl-development-fixture.ts");
const { createCglPreviewSnapshot } = compile(
  "scripts/cgl-preview-snapshot.ts",
  { "./cgl-development-fixture": fixture, "../lib/cgl-engine": engine },
);
test("2027 presentation uses an isolated fictional field without account or contact records", () => {
  const data = createCglPreviewSnapshot();
  assert.equal(data.preview, true);
  assert.equal(data.players.length, 24);
  assert.equal(data.weeks.length, 13);
  assert.ok(data.results.length > 100);
  assert.equal(JSON.stringify(data).includes("@"), false);
  assert.equal(JSON.stringify(data).includes("LachlanMacka"), false);
  assert.ok(
    data.results.every(
      (result) =>
        result.scorecard_url === null &&
        result.sgt_username.startsWith("Fixture"),
    ),
  );
});
test("preview standings use division-specific best-eight calculations and preserve unresolved ties", () => {
  const data = createCglPreviewSnapshot();
  for (const standing of data.standings) {
    assert.equal(
      standing.total_points,
      standing.counted.reduce((sum, item) => sum + item.points, 0),
    );
    assert.ok(standing.rounds_counted <= 8);
    assert.equal(standing.counted.length + standing.discarded.length, 10);
    assert.equal(
      standing.position,
      1 +
        data.standings.filter(
          (other) =>
            other.division === standing.division &&
            other.total_points > standing.total_points,
        ).length,
    );
  }
  assert.ok(data.results.some((result) => result.points === null));
  assert.ok(
    data.annual.every(
      (result) =>
        result.status === "pending_approval" && result.points === null,
    ),
  );
});
