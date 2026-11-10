const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const cache = new Map();
function load(relative, overrides = {}) {
  const filename = path.resolve(__dirname, "..", relative);
  if (cache.has(filename)) return cache.get(filename);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded.require = (name) => {
    if (name in overrides) return overrides[name];
    if (name === "next/image") return { __esModule: true, default: ({ src, alt }) => React.createElement("img", { src, alt }) };
    if (name === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
    if (name === "@/lib/supabase-browser") return { getSupabaseBrowserClient: () => null };
    if (name === "./par3-showdown-types" || name === "@/lib/par3-showdown-types") return load("lib/par3-showdown-types.ts");
    if (name === "@/lib/par3-display") return load("lib/par3-display.ts");
    if (name === "@/components/par3/Par3MatchScorecard") return load("components/par3/Par3MatchScorecard.tsx");
    return require(name);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  cache.set(filename, loaded.exports);
  return loaded.exports;
}

const rules = load("lib/par3-showdown-types.ts");
const display = load("lib/par3-display.ts");
function snapshot(sizes, finalsSize, finalsFormat = "standard") {
  let id = 0;
  const players = sizes.flatMap((size, poolIndex) => Array.from({ length: size }, (_, index) => ({
    id: ++id, eventId: 1, displayOrder: index + 1, name: `Display Player ${id}`,
    poolNumber: poolIndex + 1, teeCategory: "championship", poolRankOverride: null,
    ctpRank: null, ctpDistanceCm: null, isWithdrawn: false, phone: "TEST-PRIVATE",
    createdAt: "", updatedAt: "",
  })));
  const event = { ...rules.validatePar3Format({ poolSizes: sizes, finalsSize, finalsFormat }), id: 1, knockoutData: null, currentPhase: "pools", statusLabel: "Testing", publicMessage: "", isLive: false };
  const poolMatches = sizes.flatMap((size, poolIndex) => {
    const own = players.filter((player) => player.poolNumber === poolIndex + 1);
    return rules.buildPar3RoundRobinPairs(size).map((pair) => ({
      id: ++id, eventId: 1, poolNumber: poolIndex + 1, matchNumber: pair.matchNumber,
      player1Id: own[pair.firstIndex].id, player2Id: own[pair.secondIndex].id,
      winnerId: null, status: "scheduled", bayNumber: null, createdAt: "", updatedAt: "",
    }));
  });
  return { event, players, poolMatches, source: "database", warningMessage: null };
}

test("mixed pool display rounds follow their own schedules and preview uses nominated capacities", () => {
  const mixed = snapshot([3, 5, 8], 8);
  for (const poolNumber of [1, 2, 3]) {
    const matches = mixed.poolMatches.filter((match) => match.poolNumber === poolNumber);
    const rounds = matches.map((match) => display.getPar3DisplayMatchRound(mixed, match));
    assert.equal(Math.max(...rounds), [3, 5, 7][poolNumber - 1]);
  }
  assert.equal(display.getPar3DisplayPoolStages(mixed).length, 7);
  const empty = { ...snapshot(Array(16).fill(4), 64), players: [], poolMatches: [] };
  assert.equal(display.getPar3DisplayQualification(empty).automaticPlaces, 4);
  assert.equal(display.getPar3DisplayFinalsTemplate(empty).length, 32);
});

test("large tournament stream views render paged tables and finals without private contact details", () => {
  const Stream = load("components/par3/Par3StreamAsset.tsx").default;
  const large = snapshot(Array(16).fill(4), 64);
  for (const view of ["pools", "fixtures", "bracket", "finals", "portrait", "road", "banner"]) {
    const html = renderToStaticMarkup(React.createElement(Stream, { initialSnapshot: large, view }));
    assert.ok(html.length > 1000, view);
    assert.ok(!html.includes("TEST-PRIVATE"), `Contact details must not appear in ${view}`);
    if (view === "pools") {
      assert.ok(html.includes("page 1 of 3"));
      assert.ok(html.includes("--par3-pool-columns:6"));
      assert.ok(!html.includes("Display Player 25"));
    }
    if (view === "bracket") assert.ok(html.includes("Round of 64"));
    if (view === "fixtures") assert.ok(html.includes("1 of 6"));
  }
});

test("mixed pool print packs retain later rounds and split long pool sheets", async () => {
  const mixed = snapshot([3, 5, 8], 8);
  const Print = load("app/clubhouse-admin/par3/print/page.tsx", {
    "@/lib/admin-auth": { isAdminAuthenticated: async () => true },
    "@/lib/par3-showdown": { getAdminPar3Snapshot: async () => mixed },
    "@/components/par3/Par3PrintButton": { __esModule: true, default: () => null },
  }).default;
  const html = renderToStaticMarkup(await Print({ searchParams: Promise.resolve({ sheet: "pack" }) }));
  assert.ok(html.includes("Round 7"));
  assert.ok(html.includes("Quarter Finals"));
  assert.ok(!html.includes("Round of 16"));
  assert.ok(html.includes("Pool C / sheet 3"));
  assert.ok(html.includes("TEST-PRIVATE"), "The authenticated organiser print pack retains its private player contact sheet");
});

function byeSnapshot(withBracket = false) {
  const source = snapshot([3, 3, 3, 3, 3], 16, "pool_winners_ctp_bye");
  source.event.currentPhase = "knockout";
  for (const player of source.players) player.poolRankOverride = player.displayOrder;
  source.players[0].ctpRank = 1;
  source.players[0].ctpDistanceCm = 25;
  if (withBracket) {
    const rounds = Array.from({ length: 4 }, (_, index) => ({ id: index + 1, group_id: 1, number: index + 1 }));
    const matches = rounds.flatMap((round, roundIndex) => Array.from({ length: 8 / 2 ** roundIndex }, (_, index) => ({
      id: `match-${round.number}-${index}`, number: index + 1, round_id: round.id,
      status: roundIndex === 0 && index === 0 ? rules.PAR3_MATCH_COMPLETED : rules.PAR3_MATCH_READY,
      opponent1: roundIndex === 0 ? { id: index === 0 ? 1 : index * 2, ...(index === 0 ? { result: "win" } : {}) } : { id: null },
      opponent2: roundIndex === 0 && index === 0 ? null : roundIndex === 0 ? { id: index * 2 + 1 } : { id: null },
    })));
    source.event.knockoutData = {
      stage: [], group: [{ id: 1, number: 1 }], round: rounds, match: matches, match_game: [],
      participant: source.players.map((player) => ({ id: player.id, name: player.name })),
    };
  }
  return source;
}

test("pool-winner CTP preview advances fifteen players and shows one bye plus seven matches", async () => {
  const source = byeSnapshot();
  const description = display.getPar3QualificationDescription(source);
  assert.ok(description.includes("All 15 players advance"));
  assert.ok(description.includes("7 opening matches"));
  assert.ok(description.includes("bye to the Quarter Finals"));
  const Stream = load("components/par3/Par3StreamAsset.tsx").default;
  const bracket = renderToStaticMarkup(React.createElement(Stream, { initialSnapshot: source, view: "bracket" }));
  assert.equal((bracket.match(/is-bye/g) ?? []).length, 1);
  assert.ok(bracket.includes("Bye · advances to Quarter Finals"));
  const results = renderToStaticMarkup(React.createElement(Stream, { initialSnapshot: source, view: "results" }));
  assert.ok(results.includes("15 finalists"));
  const PrintPath = "app/clubhouse-admin/par3/print/page.tsx";
  cache.delete(path.resolve(__dirname, "..", PrintPath));
  const Print = load(PrintPath, {
    "@/lib/admin-auth": { isAdminAuthenticated: async () => true },
    "@/lib/par3-showdown": { getAdminPar3Snapshot: async () => source },
    "@/components/par3/Par3PrintButton": { __esModule: true, default: () => null },
  }).default;
  const printed = renderToStaticMarkup(await Print({ searchParams: Promise.resolve({ sheet: "round-of-16" }) }));
  assert.equal((printed.match(/Winner ____________________/g) ?? []).length, 7);
  assert.ok(printed.includes("15 players advance; 7 opening matches and one bye"));
  assert.ok(printed.includes("Opening round"));
  assert.ok(!/round of 16/i.test(printed));
});

test("generated bye advances a real player without inventing a played win or a TBD opponent", () => {
  const source = byeSnapshot(true);
  assert.equal(display.getPar3DisplayByePlayer(source, 1, source.event.knockoutData.match[0]), "Display Player 1");
  assert.equal(display.getPar3DisplayByePlayer(source, 2, { opponent1: { id: 1 }, opponent2: { id: null } }), null);
  const Stream = load("components/par3/Par3StreamAsset.tsx").default;
  const finals = renderToStaticMarkup(React.createElement(Stream, { initialSnapshot: source, view: "finals" }));
  assert.ok(finals.includes("CTP bye"));
  assert.ok(finals.includes("Automatic advance"));
  assert.ok(finals.includes("Bye · advances to Quarter Finals"));
  assert.ok(!finals.includes("def."), "An automatically completed bye must not enter played results");
  const Public = load("components/par3/Par3LiveTournament.tsx").default;
  const publicHtml = renderToStaticMarkup(React.createElement(Public, { initialSnapshot: source }));
  assert.equal((publicHtml.match(/is-bye/g) ?? []).length, 1);
  assert.ok(publicHtml.includes("Bye · advances to Quarter Finals"));
  assert.ok(!publicHtml.includes("TEST-PRIVATE"));
  assert.ok(publicHtml.includes("Opening round"));
  assert.ok(!publicHtml.includes("Round of 16"));
  assert.ok(publicHtml.includes("Royal Adelaide Golf Club"));
  assert.ok(publicHtml.includes("Holes 7 · 12 · 16"));
  assert.ok(publicHtml.includes("Augusta National Golf Club"));
  assert.ok(publicHtml.includes("Hole 12"));
});

test("fifteen-player homepage explains the draw and renders all poster courses and holes", async () => {
  const source = byeSnapshot();
  const Home = load("app/page.tsx", {
    "@/components/par3/Par3Countdown": { __esModule: true, default: () => null },
    "@/components/par3/Par3LiveTournament": { __esModule: true, default: () => null },
    "@/components/par3/Par3RegistrationForm": { __esModule: true, default: () => null },
    "@/lib/par3-showdown": { getPublicPar3Snapshot: async () => source },
    "@/lib/seo": { absoluteUrl: (pathname) => `https://example.test${pathname}` },
  }).default;
  const html = renderToStaticMarkup(await Home());
  assert.ok(html.includes("Tournament format at a glance"));
  assert.ok(html.includes("5 × 3"));
  assert.ok(html.includes("2 matches per player"));
  assert.ok(html.includes("one player resting in each round"));
  assert.ok(html.includes("7 head-to-head matches"));
  assert.ok(!html.includes("Stage 01"));
  assert.ok(!html.includes("Round of 16"));
  for (let round = 1; round <= 8; round += 1) assert.ok(html.includes(`<b>R${round}</b>`));
  for (const stage of display.getPar3DisplayCourseStages(source)) {
    assert.ok(html.includes(stage.course), stage.course);
    assert.ok(html.includes(display.getPar3StageHoleLabel(stage)), `${stage.label} holes`);
  }
  assert.ok(html.includes(display.PAR3_COURSE_POSTER_URL));
  assert.ok(!html.includes("championship-ii-poster.webp"), "the previous promotional poster contains a baked-in 24-player field and must not be shown for this draw");
  assert.ok(html.includes('download="CGS-Par3-Course-Draw.png"'));
});

test("CTP pool leaders stay labelled provisional before pool play is confirmed", () => {
  const source = snapshot([3, 3, 3, 3, 3], 16, "pool_winners_ctp_bye");
  source.event.currentPhase = "knockout";
  const Public = load("components/par3/Par3LiveTournament.tsx").default;
  const html = renderToStaticMarkup(React.createElement(Public, { initialSnapshot: source }));
  assert.ok(html.includes("Provisional pool positions"));
  assert.equal((html.match(/\(provisional\)/g) ?? []).length, 5);
});

test("player handout is one spacious blank match card with no roster contact data", async () => {
  const printPath = "app/clubhouse-admin/par3/print/page.tsx";
  cache.delete(path.resolve(__dirname, "..", printPath));
  const Print = load(printPath, {
    "@/lib/admin-auth": { isAdminAuthenticated: async () => true },
    "@/lib/par3-showdown": { getAdminPar3Snapshot: async () => byeSnapshot() },
    "@/components/par3/Par3PrintButton": { __esModule: true, default: () => null },
  }).default;
  const html = renderToStaticMarkup(await Print({ searchParams: Promise.resolve({ sheet: "scorecards" }) }));
  assert.equal((html.match(/aria-label="Blank player match scorecard/g) ?? []).length, 1);
  assert.ok(html.includes("Player A") && html.includes("Player B") && html.includes("Winner &amp; Score"));
  assert.equal((html.match(/class="par3-match-scorecard__simple-field"/g) ?? []).length, 3);
  assert.ok(!html.includes("signature") && !html.includes("Hole ___"));
  assert.ok(html.includes('/par3/par3-match-scorecard.pdf'));
  assert.ok(!html.includes("TEST-PRIVATE") && !html.includes("Display Player"));
});

test("long simulator queues retain every fixture on continued sheets", async () => {
  const source = snapshot([8, 8], 8);
  source.poolMatches.forEach(match => { match.bayNumber = 1; });
  const printPath = "app/clubhouse-admin/par3/print/page.tsx";
  cache.delete(path.resolve(__dirname, "..", printPath));
  const Print = load(printPath, {
    "@/lib/admin-auth": { isAdminAuthenticated: async () => true },
    "@/lib/par3-showdown": { getAdminPar3Snapshot: async () => source },
    "@/components/par3/Par3PrintButton": { __esModule: true, default: () => null },
  }).default;
  const html = renderToStaticMarkup(await Print({ searchParams: Promise.resolve({ sheet: "simulators" }) }));
  for (const match of source.poolMatches) {
    const label = `Pool ${String.fromCharCode(64 + match.poolNumber)} · Match ${match.matchNumber}`;
    assert.equal(html.split(`${label}</span>`).length - 1, 1, label);
  }
  assert.ok(html.includes("continued") && html.includes("Queue sheet 14 of 14"));
});
