const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../lib/par3-showdown-types.ts");
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const rules = loaded.exports;

function event(poolSizes = [4, 4, 4, 4, 4, 4], finalsSize = 16, finalsFormat = "standard") {
  return { ...rules.validatePar3Format({ poolSizes, finalsSize, finalsFormat }), id: 1 };
}

function snapshot(poolSizes = [4, 4, 4, 4, 4, 4], finalsSize = 16, assignedSizes = poolSizes, finalsFormat = "standard") {
  let id = 0;
  const players = assignedSizes.flatMap((size, poolIndex) => Array.from({ length: size }, (_, index) => ({
    id: ++id, eventId: 1, displayOrder: index + 1, name: `Player ${id}`,
    poolNumber: poolIndex + 1, teeCategory: "championship", poolRankOverride: null,
    ctpRank: null, ctpDistanceCm: null, isWithdrawn: false, createdAt: "", updatedAt: "",
  })));
  return { event: event(poolSizes, finalsSize, finalsFormat), players, poolMatches: [], source: "database", warningMessage: null };
}

function completedPool(size) {
  const source = snapshot([size], 2);
  source.poolMatches = rules.buildPar3RoundRobinPairs(size).map((pair) => ({
    id: pair.matchNumber, eventId: 1, poolNumber: 1, matchNumber: pair.matchNumber,
    player1Id: source.players[pair.firstIndex].id, player2Id: source.players[pair.secondIndex].id,
    winnerId: source.players[pair.firstIndex].id, status: "complete", bayNumber: 1,
    createdAt: "", updatedAt: "",
  }));
  return rules.buildPar3Pools(source)[0];
}

test("legacy four-player fixture order and five/six-pool seeded finals are preserved", () => {
  assert.deepEqual(rules.buildPar3RoundRobinPairs(4).map(({ firstIndex, secondIndex }) => [firstIndex, secondIndex]),
    [[0, 3], [1, 2], [0, 2], [3, 1], [0, 1], [2, 3]]);
  assert.equal(rules.getPar3FinalsSize({}), 16);
  assert.deepEqual(rules.getPar3PoolSizes({ poolCount: 5, poolSize: 4 }), [4, 4, 4, 4, 4]);
  assert.deepEqual(rules.getPar3RoundOf16Template(5), rules.PAR3_ROUND_OF_16_TEMPLATE);
  assert.deepEqual(rules.getPar3RoundOf16Template(6), rules.PAR3_SIX_POOL_ROUND_OF_16_TEMPLATE);
  assert.equal(rules.getPar3AutomaticQualifyingPlaces(5), 3);
  assert.equal(rules.getPar3CtpQualifierCount(6), 4);
});

test("format limits reject unsafe capacities and invalid or oversized finals", () => {
  for (const input of [
    { poolSizes: [], finalsSize: 2 }, { poolSizes: Array(17).fill(2), finalsSize: 16 },
    { poolSizes: [1, 3], finalsSize: 4 }, { poolSizes: [9], finalsSize: 8 },
    { poolSizes: [3.5, 4], finalsSize: 4 }, { poolSizes: Array(9).fill(8), finalsSize: 64 },
    { poolSizes: [4, 4], finalsSize: 3 }, { poolSizes: [4, 4], finalsSize: 16 },
    { poolSizes: [4, 4], finalsSize: 0 }, { poolSizes: [4, 4], finalsSize: 4.5 },
  ]) assert.throws(() => rules.validatePar3Format(input));
  const input = { poolSizes: [2, 5, 8], finalsSize: 8 };
  const normalized = rules.validatePar3TournamentFormat(input);
  assert.deepEqual(normalized, { poolSizes: [2, 5, 8], poolCount: 3, poolSize: 8, maxPlayers: 15, finalsSize: 8, finalsFormat: "standard" });
  input.poolSizes[0] = 7;
  assert.equal(normalized.poolSizes[0], 2, "normalized format must not retain mutable caller arrays");
});

test("every pool size has every unique pair once, no per-round conflicts and no fake bye matches", () => {
  for (let size = 2; size <= 8; size += 1) {
    const pairs = rules.getPar3PoolFixturePairs(size);
    assert.equal(pairs.length, size * (size - 1) / 2, `match count for ${size}`);
    const unique = new Set();
    for (const pair of pairs) {
      assert.ok(pair.firstIndex >= 0 && pair.firstIndex < size);
      assert.ok(pair.secondIndex >= 0 && pair.secondIndex < size);
      assert.notEqual(pair.firstIndex, pair.secondIndex);
      unique.add([pair.firstIndex, pair.secondIndex].sort().join(":"));
      assert.equal(rules.getPoolMatchRound(pair.matchNumber, size), pair.round);
      assert.equal(rules.getPoolStage(pair.matchNumber, size).label, `Round ${pair.round}`);
    }
    assert.equal(unique.size, pairs.length);
    const rounds = size % 2 === 0 ? size - 1 : size;
    for (let round = 1; round <= rounds; round += 1) {
      const indexes = pairs.filter((pair) => pair.round === round).flatMap((pair) => [pair.firstIndex, pair.secondIndex]);
      assert.equal(indexes.length, Math.floor(size / 2) * 2);
      assert.equal(new Set(indexes).size, indexes.length, `a player cannot play twice in round ${round}`);
    }
  }
  for (const size of [0, 1, 9, 3.5]) assert.throws(() => rules.buildPar3RoundRobinPairs(size));
});

test("pool courses cycle after round three with accurate extended round labels", () => {
  const stages = rules.getPar3PoolStages(8);
  assert.equal(stages.length, 7);
  assert.equal(stages[3].label, "Round 4");
  assert.equal(stages[3].course, rules.PAR3_POOL_STAGES[0].course);
  assert.equal(rules.getPar3PoolStages(7).length, 7);
  assert.equal(rules.getPar3PoolStages(1).length, 0);
});

test("qualification adapts to equal, uneven and partially filled pools", () => {
  assert.deepEqual(rules.getPar3QualificationPlan(event([4, 4, 4], 8)), {
    automaticPlaces: 2, ctpPoolPosition: 3, ctpQualifierCount: 2,
    ctpAllRemaining: false, ctpContestantCount: 3, finalsSize: 8, errors: [],
    finalsFormat: "standard", ctpPurpose: "qualification", byeCount: 0, requiredPlayerCount: 8,
    allPlayersAdvance: false, openingMatchCount: 4,
  });
  const uneven = snapshot([2, 8], 8);
  const plan = rules.getPar3QualificationPlan(uneven);
  assert.equal(plan.automaticPlaces, 2);
  assert.equal(plan.ctpQualifierCount, 4);
  assert.equal(plan.ctpAllRemaining, true);
  assert.equal(plan.ctpContestantCount, 6);
  assert.equal(rules.getPar3CtpContestants(uneven).length, 6);
  const partiallyFilled = snapshot([5, 5, 5], 8, [2, 3, 4]);
  assert.equal(rules.getPar3QualificationPlan(partiallyFilled).automaticPlaces, 2);
  assert.equal(rules.getPar3QualificationPlan(partiallyFilled).ctpQualifierCount, 2);
  assert.equal(rules.getPar3CtpContestants(partiallyFilled).length, 2);
  assert.equal(rules.getPar3CtpContestants(snapshot([4, 4], 8)).length, 0);
});

test("finals reject empty pools, over-capacity pools, unassigned players and insufficient attendance", () => {
  for (const source of [snapshot([4, 4], 8, [4, 0]), snapshot([4, 4], 8, [5, 4]), snapshot([4, 4], 8, [3, 4])]) {
    assert.ok(rules.getPar3QualificationPlan(source).errors.length > 0);
    assert.deepEqual(rules.getPar3FinalsTemplate(source), []);
  }
  const unassigned = snapshot([4, 4], 4);
  unassigned.players[0].poolNumber = null;
  assert.match(rules.getPar3QualificationPlan(unassigned).errors.join(" "), /Assign every active player/);
  const mismatched = event([4, 4], 4);
  mismatched.poolCount = 3;
  assert.match(rules.getPar3QualificationPlan(mismatched).errors.join(" "), /pool count/);
});

test("general finals templates cover every qualifying slot exactly once across supported formats", () => {
  const formats = [];
  for (let poolCount = 1; poolCount <= 16; poolCount += 1) {
    for (let poolSize = 2; poolSize <= 8 && poolCount * poolSize <= 64; poolSize += 1) {
      formats.push(Array(poolCount).fill(poolSize));
    }
  }
  formats.push([2, 8], [2, 3, 8], [2, 8, 8, 8, 8], [3, 4, 5, 6, 7, 8], Array(16).fill(4));
  for (const poolSizes of formats) {
    for (const finalsSize of [2, 4, 8, 16, 32, 64].filter((size) => size <= poolSizes.reduce((sum, size) => sum + size, 0))) {
      const source = event(poolSizes, finalsSize);
      const plan = rules.getPar3QualificationPlan(source);
      const template = rules.getPar3FinalsTemplate(source);
      assert.equal(template.length, finalsSize / 2, JSON.stringify(source));
      const slots = template.flatMap((pairing) => [pairing.first, pairing.second]);
      assert.equal(new Set(slots.map((slot) => slot.key)).size, finalsSize);
      assert.equal(slots.filter((slot) => slot.isCtp).length, plan.ctpQualifierCount);
      assert.equal(slots.filter((slot) => slot.position === 1).length, plan.automaticPlaces > 0 ? poolSizes.length : 0);
      for (const bracketSlot of slots.filter((slot) => !slot.isCtp)) {
        assert.ok(bracketSlot.position <= poolSizes[bracketSlot.poolNumber - 1]);
        assert.ok(bracketSlot.position <= plan.automaticPlaces);
      }
      if (poolSizes.length > 1 && poolSizes.every((size) => size === poolSizes[0])) {
        assert.ok(template.every((pairing) => !pairing.first.poolNumber || !pairing.second.poolNumber
          || pairing.first.poolNumber !== pairing.second.poolNumber), `avoidable same-pool opener for ${poolSizes} / ${finalsSize}`);
      }
    }
  }
});

test("pool completion requires every unique valid result or a complete unique manual ranking", () => {
  for (let size = 2; size <= 8; size += 1) assert.equal(rules.isPar3PoolComplete(completedPool(size)), true);
  const base = completedPool(4);
  const clone = () => structuredClone(base);
  const missing = clone(); missing.matches.pop();
  const duplicate = clone(); duplicate.matches[1] = { ...duplicate.matches[0], id: 99 };
  const fakeWinner = clone(); fakeWinner.matches[0].winnerId = 999;
  const pending = clone(); pending.matches[0].status = "live";
  const foreignPlayer = clone(); foreignPlayer.matches[0].player2Id = 999;
  for (const pool of [missing, duplicate, fakeWinner, pending, foreignPlayer]) assert.equal(rules.isPar3PoolComplete(pool), false);
  const partialWithResults = clone(); partialWithResults.players[0].poolRankOverride = 4;
  assert.equal(rules.isPar3PoolComplete(partialWithResults), false);
  assert.equal(rules.buildPoolStandings(partialWithResults.players, partialWithResults.matches)[0].player.id, base.standings[0].player.id,
    "an incomplete manual override must not change result-based standings");
  const duplicateWithResults = clone(); duplicateWithResults.players.forEach((player) => { player.poolRankOverride = 1; });
  assert.equal(rules.isPar3PoolComplete(duplicateWithResults), false);
  assert.ok(rules.buildPoolStandings(duplicateWithResults.players, duplicateWithResults.matches).every((standing) => standing.tieBreakLabel !== "Admin seed"));
  const partialManual = clone(); partialManual.matches = []; partialManual.players[0].poolRankOverride = 1;
  assert.equal(rules.isPar3PoolComplete(partialManual), false);
  partialManual.players.forEach((player, index) => { player.poolRankOverride = index + 1; });
  assert.equal(rules.isPar3PoolComplete(partialManual), true);
  partialManual.players[3].poolRankOverride = 1;
  assert.equal(rules.isPar3PoolComplete(partialManual), false);
  assert.equal(rules.isPar3PoolComplete({ ...base, capacity: 3 }), false);
});

test("general draws use verified CTP qualifiers' pools to avoid opening rematches when possible", () => {
  const source = snapshot([4, 4, 4], 8);
  source.players.forEach((player) => { player.poolRankOverride = player.displayOrder; });
  const contestants = rules.getPar3CtpContestants(source).map((standing) => standing.player);
  contestants[0].ctpRank = 2;
  contestants[1].ctpRank = 1;
  const template = rules.getPar3FinalsTemplate(source);
  for (const pairing of template) {
    const first = rules.resolvePar3BracketSlot(source, pairing.first);
    const second = rules.resolvePar3BracketSlot(source, pairing.second);
    assert.ok(first && second);
    assert.notEqual(first.poolNumber, second.poolNumber);
  }
  const legacy = snapshot();
  legacy.players.forEach((player) => { player.poolRankOverride = player.displayOrder; });
  rules.getPar3CtpContestants(legacy).slice(0, 4).forEach((standing, index) => { standing.player.ctpRank = index + 1; });
  assert.deepEqual(rules.getPar3FinalsTemplate(legacy), rules.PAR3_SIX_POOL_ROUND_OF_16_TEMPLATE);
});

test("CTP qualification excludes automatic qualifiers, withdrawn players and conflicting ranks", () => {
  const source = snapshot([4, 4, 4], 8);
  source.players.forEach((player) => { player.poolRankOverride = player.displayOrder; });
  let contestants = rules.getPar3CtpContestants(source).map((standing) => standing.player);
  assert.deepEqual(contestants.map((player) => player.poolRankOverride), [3, 3, 3]);
  contestants[0].ctpRank = 1;
  contestants[1].ctpRank = 2;
  source.players[0].ctpRank = 1;
  assert.deepEqual(rules.getPar3CtpQualifiers(source).map((player) => player.id), [contestants[0].id, contestants[1].id]);
  contestants[2].ctpRank = 1;
  assert.deepEqual(rules.getPar3CtpQualifiers(source).map((player) => player.id), [contestants[1].id]);
  assert.equal(rules.getPar3CtpWinner(source), null);
  contestants[2].ctpRank = 3;
  contestants[1].ctpRank = 0;
  assert.deepEqual(rules.getPar3CtpQualifiers(source).map((player) => player.id), [contestants[0].id]);
  contestants[0].isWithdrawn = true;
  contestants = rules.getPar3CtpContestants(source).map((standing) => standing.player);
  assert.ok(contestants.every((player) => !player.isWithdrawn));
});

test("simulator queues order mixed-size pools by their actual round then pool", () => {
  const source = snapshot([3, 5], 4);
  let id = 0;
  source.poolMatches = [3, 5].flatMap((size, poolIndex) => rules.buildPar3RoundRobinPairs(size).map((pair) => ({
    id: ++id, poolNumber: poolIndex + 1, matchNumber: pair.matchNumber, status: "scheduled", bayNumber: 1,
  })));
  const queued = rules.getPar3SimulatorQueues(source, 1)[0].queued;
  assert.deepEqual(queued.slice(0, 3).map((match) => [match.poolNumber, match.matchNumber]), [[1, 1], [2, 1], [2, 2]]);
  assert.deepEqual(queued.slice(3, 6).map((match) => [match.poolNumber, match.matchNumber]), [[1, 2], [2, 3], [2, 4]]);
});

test("finals round labels and courses match two through sixty-four player draws", () => {
  for (const size of [2, 4, 8, 16, 32, 64]) {
    const stages = rules.getPar3FinalsStages(size);
    assert.equal(stages.length, Math.log2(size));
    assert.equal(stages.at(-1).label, "Grand Final");
    assert.equal(stages.at(-1).course, "The National Golf Club (Old Course)");
    const data = {
      group: [{ id: 1, number: 1 }], match: [],
      round: stages.map((_, index) => ({ id: index + 1, group_id: 1, number: index + 1 })),
    };
    assert.deepEqual(rules.getPar3KnockoutRounds(data).map((round) => round.label), stages.map((stage) => stage.label));
  }
  assert.equal(rules.getPar3FinalsStages(64)[0].label, "Round of 64");
  assert.equal(rules.getPar3FinalsStages(4)[0].label, "Semi Finals");
});

test("the pool-winners CTP mode accepts fifteen players in sixteen slots without changing standard qualification", () => {
  const input = { poolSizes: [3, 3, 3, 3, 3], finalsSize: 16, finalsFormat: "pool_winners_ctp_bye" };
  const normalized = rules.validatePar3Format(input);
  assert.equal(normalized.maxPlayers, 15);
  assert.equal(normalized.finalsFormat, "pool_winners_ctp_bye");
  assert.throws(() => rules.validatePar3Format({ ...input, finalsFormat: "standard" }));
  assert.throws(() => rules.validatePar3Format({ ...input, finalsFormat: "invented" }));
  assert.throws(() => rules.validatePar3Format({ poolSizes: [2], finalsSize: 2, finalsFormat: input.finalsFormat }));
  assert.throws(() => rules.validatePar3Format({ poolSizes: [2, 2, 2, 2], finalsSize: 8, finalsFormat: input.finalsFormat }), /two players in every pool/);
  assert.equal(rules.getPar3FinalsFormat({}), "standard");
  const source = snapshot(input.poolSizes, 16, input.poolSizes, input.finalsFormat);
  const plan = rules.getPar3QualificationPlan(source);
  assert.deepEqual(plan, {
    automaticPlaces: 0, ctpPoolPosition: 1, ctpQualifierCount: 1,
    ctpAllRemaining: false, ctpContestantCount: 5, finalsSize: 16, finalsFormat: input.finalsFormat,
    ctpPurpose: "bye", byeCount: 1, requiredPlayerCount: 15,
    allPlayersAdvance: true, openingMatchCount: 7, errors: [],
  });
});

test("all five pool winners contest the bye and lower pool positions cannot receive it", () => {
  const source = snapshot([3, 3, 3, 3, 3], 16, undefined, "pool_winners_ctp_bye");
  source.players.forEach((player) => { player.poolRankOverride = player.displayOrder; });
  const contestants = rules.getPar3CtpContestants(source);
  assert.equal(contestants.length, 5);
  assert.deepEqual(contestants.map((standing) => standing.position), [1, 1, 1, 1, 1]);
  source.players[1].ctpRank = 1;
  assert.deepEqual(rules.getPar3CtpQualifiers(source), []);
  source.players[1].ctpRank = null;
  contestants[3].player.ctpRank = 1;
  assert.equal(rules.getPar3CtpWinner(source).id, contestants[3].player.id);
  contestants[2].player.ctpRank = 1;
  assert.deepEqual(rules.getPar3CtpQualifiers(source), [], "duplicate CTP first places cannot award a bye");
});

test("each possible CTP winner receives the only true bye while all other fourteen players play once", () => {
  for (let winningPool = 1; winningPool <= 5; winningPool += 1) {
    const source = snapshot([3, 3, 3, 3, 3], 16, undefined, "pool_winners_ctp_bye");
    source.players.forEach((player) => { player.poolRankOverride = player.displayOrder; });
    const winner = source.players.find((player) => player.poolNumber === winningPool && player.poolRankOverride === 1);
    winner.ctpRank = 1;
    const template = rules.getPar3FinalsTemplate(source);
    const slots = template.flatMap((pairing) => [pairing.first, pairing.second]);
    assert.equal(template.length, 8);
    assert.equal(slots.filter((slot) => slot.isBye).length, 1);
    assert.equal(template[0].second.isBye, true);
    assert.equal(rules.resolvePar3BracketSlot(source, template[0].first).id, winner.id);
    const resolved = slots.map((slot) => rules.resolvePar3BracketSlot(source, slot));
    assert.equal(resolved.filter((player) => player === null).length, 1);
    assert.deepEqual(resolved.filter(Boolean).map((player) => player.id).sort((a, b) => a - b), source.players.map((player) => player.id));
    const openers = template.filter((pairing) => !pairing.first.isBye && !pairing.second.isBye);
    assert.equal(openers.length, 7);
    const playing = openers.flatMap((pairing) => [
      rules.resolvePar3BracketSlot(source, pairing.first), rules.resolvePar3BracketSlot(source, pairing.second),
    ]);
    assert.equal(new Set(playing.map((player) => player.id)).size, 14);
    assert.ok(!playing.some((player) => player.id === winner.id));
    assert.ok(openers.every((pairing) => rules.resolvePar3BracketSlot(source, pairing.first).poolNumber
      !== rules.resolvePar3BracketSlot(source, pairing.second).poolNumber), "opening pool rematches should be avoided");
  }
});

test("bye mode requires exactly one fewer actual player than the nominated bracket size", () => {
  for (const assigned of [[2, 3, 3, 3, 3], [4, 3, 3, 3, 3]]) {
    const source = snapshot([4, 4, 4, 4, 4], 16, assigned, "pool_winners_ctp_bye");
    assert.match(rules.getPar3QualificationPlan(source).errors.join(" "), /exactly 15 active players/);
    assert.deepEqual(rules.getPar3FinalsTemplate(source), []);
  }
  const source = snapshot([4, 4, 4, 4, 4], 16, [2, 2, 3, 4, 4], "pool_winners_ctp_bye");
  source.players.forEach((player) => { player.poolRankOverride = player.displayOrder; });
  source.players.find((player) => player.poolNumber === 3 && player.poolRankOverride === 1).ctpRank = 1;
  assert.deepEqual(rules.getPar3QualificationPlan(source).errors, []);
  const slots = rules.getPar3FinalsTemplate(source).flatMap((pairing) => [pairing.first, pairing.second]);
  const resolved = slots.map((slot) => rules.resolvePar3BracketSlot(source, slot));
  assert.equal(resolved.filter(Boolean).length, 15);
  assert.equal(new Set(resolved.filter(Boolean).map((player) => player.id)).size, 15);
});

test("unconfirmed bye previews reserve one real bye and distinct placeholders without inventing a CTP winner", () => {
  const format = event([4, 4, 4, 4, 4], 16, "pool_winners_ctp_bye");
  const template = rules.getPar3FinalsTemplate(format);
  const slots = template.flatMap((pairing) => [pairing.first, pairing.second]);
  assert.equal(slots.length, 16);
  assert.equal(new Set(slots.map((slot) => slot.key)).size, 16);
  assert.equal(slots.filter((slot) => slot.isBye).length, 1);
  assert.equal(slots.filter((slot) => slot.isCtp).length, 1);
  assert.equal(slots.filter((slot) => slot.remainingPoolWinnerIndex).length, 4);
  assert.ok(slots.filter((slot) => slot.poolNumber).every((slot) => slot.position === 2 || slot.position === 3));
  const source = snapshot([3, 3, 3, 3, 3], 16, undefined, "pool_winners_ctp_bye");
  assert.equal(rules.resolvePar3BracketSlot(source, template[0].first), null);
  assert.equal(rules.resolvePar3BracketSlot(source, template[0].second), null);
  assert.equal(template[0].first.isBye, undefined, "an unconfirmed winner is a placeholder rather than a second bye");
});

test("the one-bye format generalizes to seven, thirty-one and sixty-three entrants", () => {
  for (const [sizes, bracketSize] of [[[3], 4], [[3, 4], 8], [[7, 8, 8, 8], 32], [[7, 8, 8, 8, 8, 8, 8, 8], 64]]) {
    const source = snapshot(sizes, bracketSize, undefined, "pool_winners_ctp_bye");
    source.players.forEach((player) => { player.poolRankOverride = player.displayOrder; });
    source.players[0].ctpRank = 1;
    const plan = rules.getPar3QualificationPlan(source);
    assert.deepEqual(plan.errors, []);
    assert.equal(plan.requiredPlayerCount, bracketSize - 1);
    assert.equal(plan.openingMatchCount, bracketSize / 2 - 1);
    const template = rules.getPar3FinalsTemplate(source);
    assert.equal(template.length, bracketSize / 2);
    const resolved = template.flatMap((pairing) => [pairing.first, pairing.second]).map((slot) => rules.resolvePar3BracketSlot(source, slot));
    assert.equal(resolved.filter((player) => player === null).length, 1);
    assert.equal(new Set(resolved.filter(Boolean).map((player) => player.id)).size, bracketSize - 1);
  }
});

test("genuine knockout byes are distinguished from unresolved future opponents", () => {
  assert.equal(rules.isPar3KnockoutBye({ opponent1: { id: 0 }, opponent2: null }), true);
  assert.equal(rules.isPar3KnockoutBye({ opponent1: null, opponent2: { id: 2 } }), true);
  assert.equal(rules.isPar3KnockoutBye({ opponent1: { id: 0 }, opponent2: { id: null } }), false);
  assert.equal(rules.isPar3KnockoutBye({ opponent1: { id: null }, opponent2: null }), false);
  assert.equal(rules.isPar3KnockoutBye({ opponent1: null, opponent2: null }), false);
});

test("the championship course poster maps all eight stages to their nominated holes", () => {
  const stages = [
    ...rules.getPar3PoolStages(3),
    rules.getPar3CtpStage(),
    ...rules.getPar3FinalsStages(event([3, 3, 3, 3, 3], 16, "pool_winners_ctp_bye")),
  ];
  assert.deepEqual(stages.map((stage) => [stage.stageNumber, stage.course, stage.holes]), [
    [1, "Gailes Golf Course", [3, 6, 12]],
    [2, "Royal Canberra Golf Club", [8, 13, 17]],
    [3, "Royal Hobart Golf Club", [8, 11, 15]],
    [4, "Augusta National Golf Club", [12]],
    [5, "Royal Adelaide Golf Club", [7, 12, 16]],
    [6, "New South Wales Golf Club", [2, 6, 17]],
    [7, "The Australian Golf Club", [2, 4, 11]],
    [8, "The National Golf Club (Old Course)", [4, 7, 13]],
  ]);
  assert.deepEqual(stages.map((stage) => stage.label), [
    "Round 1", "Round 2", "Round 3", "CTP contest", "Opening round", "Quarter Finals", "Semi Finals", "Grand Final",
  ]);
});

test("bye knockout labels use opening round while standard and omitted event callers retain legacy round names", () => {
  const data = {
    group: [{ id: 1, number: 1 }], match: [],
    round: Array.from({ length: 4 }, (_, index) => ({ id: index + 1, group_id: 1, number: index + 1 })),
  };
  const byeEvent = event([3, 3, 3, 3, 3], 16, "pool_winners_ctp_bye");
  assert.equal(rules.getPar3FinalsStages(byeEvent)[0].label, "Opening round");
  assert.equal(rules.getPar3KnockoutRounds(data, byeEvent)[0].label, "Opening round");
  assert.equal(rules.getPar3KnockoutRounds(data)[0].label, "Round of 16");
  assert.equal(rules.getPar3KnockoutRounds(data, event([4, 4, 4, 4, 4], 16))[0].label, "Round of 16");
  assert.equal(rules.getPar3FinalsStages(16)[0].label, "Round of 16");
  assert.deepEqual(rules.getPar3KnockoutRounds(data, byeEvent).slice(1).map((round) => round.label), ["Quarter Finals", "Semi Finals", "Grand Final"]);
});

test("other bracket sizes retain their computed rounds without inventing extra poster stage numbers", () => {
  for (const size of [2, 4, 8, 32, 64]) {
    const stages = rules.getPar3FinalsStages(size);
    assert.equal(stages.length, Math.log2(size));
    assert.ok(stages.every((stage) => stage.stageNumber === undefined));
    assert.deepEqual(stages.at(-1).holes, [4, 7, 13]);
  }
  const large = rules.getPar3FinalsStages(64);
  assert.deepEqual(large.slice(0, 3).map((stage) => stage.label), ["Round of 64", "Round of 32", "Round of 16"]);
  assert.ok(large.slice(0, 3).every((stage) => stage.course === "Royal Adelaide Golf Club"));
  assert.deepEqual(large[0].holes, [7, 12, 16], "extra opening rounds may reuse the supplied opening course and holes");
  const extendedPools = rules.getPar3PoolStages(8);
  assert.ok(extendedPools.slice(3).every((stage) => stage.stageNumber === undefined));
});

test("returned course-hole arrays can be used independently without altering the poster configuration", () => {
  const ctp = rules.getPar3CtpStage();
  const pools = rules.getPar3PoolStages(3);
  const finals = rules.getPar3FinalsStages(16);
  ctp.holes[0] = 1;
  pools[0].holes[0] = 1;
  finals[0].holes[0] = 1;
  assert.deepEqual(rules.getPar3CtpStage().holes, [12]);
  assert.deepEqual(rules.getPar3PoolStages(3)[0].holes, [3, 6, 12]);
  assert.deepEqual(rules.getPar3FinalsStages(16)[0].holes, [7, 12, 16]);
});
