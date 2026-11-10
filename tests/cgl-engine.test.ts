import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import type {
  CompetitionResult,
  CreditLedgerEvent,
  NineHoleAttempt,
  CglPlanId,
  MembershipPlan,
} from "../lib/cgl-engine";

// Node 24 strips TypeScript directly. A variable URL avoids requiring Next's
// TypeScript configuration to allow emitted .ts import specifiers.
const engineUrl = pathToFileURL(
  resolve(process.cwd(), "lib/cgl-engine.ts"),
).href;
const rules: typeof import("../lib/cgl-engine") = await import(engineUrl);
const fixtureUrl = pathToFileURL(
  resolve(process.cwd(), "scripts/cgl-development-fixture.ts"),
).href;
const {
  createCglDevelopmentFixture,
}: typeof import("../scripts/cgl-development-fixture") = await import(
  fixtureUrl
);

const plan = (id: CglPlanId): MembershipPlan =>
  rules.CGL_DEFAULT_PLANS.find((item) => item.id === id)!;
const result = (
  playerId: string,
  division: "A" | "B",
  net: number,
  extras: Partial<CompetitionResult> = {},
): CompetitionResult => ({
  playerId,
  division,
  net,
  gross: net + 5,
  eligible: true,
  verified: true,
  membership: "full",
  ...extras,
});
const attempt = (
  id: string,
  net: number,
  extras: Partial<NineHoleAttempt> = {},
): NineHoleAttempt => ({
  id,
  net,
  gross: net + 5,
  courseId: "course-a",
  holesCompleted: 9,
  eligible: true,
  verified: true,
  ...extras,
});
const issue = (
  ledger: readonly CreditLedgerEvent[],
  id: string,
  amount: number,
  occurredAt = "2027-03-01T00:00:00Z",
  memberId = "member-1",
) =>
  rules.issueCredits(ledger, {
    id,
    key: `award:${id}`,
    memberId,
    amount,
    occurredAt,
    sourceId: `competition:${id}`,
  });

test("all five charge items have the approved starting AUD prices and casual purchases never auto-renew", () => {
  assert.deepEqual(
    rules.CGL_DEFAULT_PLANS.map((item) => [item.id, item.priceCents]),
    [
      ["annual", 24900],
      ["monthly", 2995],
      ["weekly", 895],
      ["casual_registration", 2900],
      ["casual_season", 10000],
    ],
  );
  assert.equal(
    rules.nextRenewalAt(plan("casual_registration"), "2027-03-01"),
    null,
  );
  assert.equal(rules.nextRenewalAt(plan("casual_season"), "2027-03-01"), null);
});

test("calendar renewals clamp month ends without drifting the original anniversary", () => {
  assert.equal(
    rules.nextRenewalAt(plan("monthly"), "2027-01-31T11:00:00Z"),
    "2027-02-28T11:00:00.000Z",
  );
  assert.equal(
    rules.renewalAt(plan("monthly"), "2027-01-31T11:00:00Z", 2),
    "2027-03-31T11:00:00.000Z",
  );
  assert.equal(
    rules.nextRenewalAt(plan("annual"), "2028-02-29T11:00:00Z"),
    "2029-02-28T11:00:00.000Z",
  );
  assert.equal(
    rules.nextRenewalAt(plan("weekly"), "2027-03-01T10:00:00Z"),
    "2027-03-08T10:00:00.000Z",
  );
});

test("monthly and annual initial charges prorate in cents; commenced weekly and casual charges remain full", () => {
  const base = {
    joinedAt: "2027-04-16T00:00:00Z",
    periodStart: "2027-04-01T00:00:00Z",
    periodEnd: "2027-05-01T00:00:00Z",
  };
  assert.equal(
    rules.quoteInitialCharge({ ...base, plan: plan("monthly") }).amountCents,
    1498,
  );
  assert.equal(
    rules.quoteInitialCharge({ ...base, plan: plan("annual") }).amountCents,
    12450,
  );
  assert.equal(
    rules.quoteInitialCharge({ ...base, plan: plan("weekly") }).amountCents,
    895,
  );
  assert.equal(
    rules.quoteInitialCharge({ ...base, plan: plan("casual_registration") })
      .amountCents,
    2900,
  );
  assert.equal(
    rules.quoteInitialCharge({ ...base, plan: plan("casual_season") })
      .amountCents,
    10000,
  );
});

test("last-millisecond proration never accidentally becomes free and invalid billing periods fail", () => {
  assert.equal(
    rules.quoteInitialCharge({
      plan: plan("monthly"),
      joinedAt: "2027-04-30T23:59:59.999Z",
      periodStart: "2027-04-01",
      periodEnd: "2027-05-01",
    }).amountCents,
    1,
  );
  assert.throws(
    () =>
      rules.quoteInitialCharge({
        plan: plan("monthly"),
        joinedAt: "2027-05-01",
        periodStart: "2027-04-01",
        periodEnd: "2027-05-01",
      }),
    /within/,
  );
});

test("upgrades explicitly disclose overlap and apply only the configured paid credit", () => {
  const quote = rules.quoteUpgrade({
    plan: plan("annual"),
    joinedAt: "2027-04-16",
    periodStart: "2027-04-01",
    periodEnd: "2027-05-01",
    priorPaymentCreditCents: 2900,
    existingSubscriptionId: "old-sub",
  });
  assert.equal(quote.amountCents, 9550);
  assert.equal(quote.requiresExistingSubscriptionStop, true);
  assert.throws(
    () =>
      rules.quoteUpgrade({
        plan: plan("monthly"),
        joinedAt: "2027-04-01",
        periodStart: "2027-04-01",
        periodEnd: "2027-05-01",
        priorPaymentCreditCents: 2995,
      }),
    /fully funded/,
  );
});

test("unapproved season-boundary commitments are review-only with exact future-payment disclosure", () => {
  const quote = rules.cancellationQuote({
    plan: plan("weekly"),
    requestedAt: "2027-03-02T00:00:00Z",
    paidThrough: "2027-03-08",
    nextBillingAt: "2027-03-08T00:00:00Z",
    billingAnchor: "2027-03-01T00:00:00Z",
    seasonBoundaries: ["2027-03-22T00:00:00Z"],
    policy: { mode: "season_boundary", approved: false },
  });
  assert.equal(quote.status, "review_required");
  assert.equal(quote.effectiveAt, "2027-03-22T00:00:00.000Z");
  assert.deepEqual(
    quote.futurePayments.map((payment) => payment.dueAt),
    ["2027-03-08T00:00:00.000Z", "2027-03-15T00:00:00.000Z"],
  );
  assert.equal(quote.futureAmountCents, 1790);
});

test("annual cancellation ends at the paid annual term and casual registration never creates future bills", () => {
  const common = {
    requestedAt: "2027-03-02",
    paidThrough: "2028-03-01",
    nextBillingAt: "2028-03-01",
    seasonBoundaries: ["2027-06-01"],
    policy: { mode: "season_boundary" as const, approved: true },
  };
  assert.equal(
    rules.cancellationQuote({ ...common, plan: plan("annual") }).effectiveAt,
    "2028-03-01T00:00:00.000Z",
  );
  assert.equal(
    rules.cancellationQuote({ ...common, plan: plan("casual_registration") })
      .futureAmountCents,
    0,
  );
  assert.throws(
    () =>
      rules.cancellationQuote({
        ...common,
        plan: plan("weekly"),
        seasonBoundaries: [],
      }),
    /Publish/,
  );
});

test("failed recurring payment allows its current week, blocks next week, and confirmed payment restores access", () => {
  const base = {
    kind: "full" as const,
    active: true,
    now: "2027-03-08",
    paidThrough: "2027-03-02",
    failedPaymentWeek: 4,
  };
  assert.equal(
    rules.competitionEligibility({ ...base, competitionWeek: 4 }).eligible,
    true,
  );
  assert.equal(
    rules.competitionEligibility({ ...base, competitionWeek: 3 }).eligible,
    true,
  );
  assert.equal(
    rules.competitionEligibility({ ...base, competitionWeek: 5 }).eligible,
    false,
  );
  assert.equal(
    rules.competitionEligibility({
      ...base,
      competitionWeek: 5,
      paymentConfirmed: true,
      paidThrough: "2027-04-01",
    }).eligible,
    true,
  );
  assert.equal(
    rules.competitionEligibility({
      ...base,
      competitionWeek: 4,
      suspended: true,
    }).eligible,
    false,
  );
});

test("casual eligibility requires BOTH unexpired manual registration and the chosen paid season", () => {
  const base = {
    kind: "casual" as const,
    active: true,
    now: "2027-03-08",
    competitionWeek: 4,
    casualRegistrationExpiresAt: "2028-03-01",
  };
  assert.equal(
    rules.competitionEligibility({ ...base, seasonEntryPaid: false }).eligible,
    false,
  );
  assert.equal(
    rules.competitionEligibility({ ...base, seasonEntryPaid: true }).eligible,
    true,
  );
  assert.equal(
    rules.competitionEligibility({
      ...base,
      seasonEntryPaid: true,
      casualRegistrationExpiresAt: "2027-03-01",
    }).eligible,
    false,
  );
});

test("54 eligible holes do not fabricate an SGT handicap verification", () => {
  assert.equal(
    rules.handicapEligibility({
      established: false,
      eligibleHoles: 53,
      handicap: 12,
      verified: true,
    }).eligible,
    false,
  );
  assert.equal(
    rules.handicapEligibility({
      established: false,
      eligibleHoles: 54,
      handicap: null,
      verified: false,
    }).status,
    "awaiting_verification",
  );
  assert.equal(
    rules.handicapEligibility({
      established: false,
      eligibleHoles: 54,
      handicap: 12,
      verified: true,
    }).eligible,
    true,
  );
  assert.equal(
    rules.handicapEligibility({
      established: true,
      eligibleHoles: 0,
      handicap: -2.4,
      verified: true,
    }).eligible,
    true,
  );
});

test("A/B thresholds include plus handicaps; C Grade requires explicit activation", () => {
  assert.equal(rules.assignDivision(-2), "A");
  assert.equal(rules.assignDivision(9.9), "A");
  assert.equal(rules.assignDivision(10), "B");
  assert.equal(rules.assignDivision(24), "B");
  assert.equal(rules.assignDivision(19.9, { cGradeEnabled: true }), "B");
  assert.equal(rules.assignDivision(20, { cGradeEnabled: true }), "C");
});

test("division locks survive a mid-season handicap change; next season reassignment and reasoned overrides work", () => {
  assert.equal(
    rules.assignDivision(11, {
      lockedDivision: "A",
      championshipStarted: true,
    }),
    "A",
  );
  assert.equal(
    rules.assignDivision(11, {
      lockedDivision: "A",
      championshipStarted: false,
    }),
    "B",
  );
  assert.equal(
    rules.assignDivision(11, {
      lockedDivision: "A",
      championshipStarted: true,
      override: {
        division: "B",
        reason: "Verified correction",
        actorId: "admin",
      },
    }),
    "B",
  );
  assert.throws(
    () =>
      rules.assignDivision(11, {
        override: { division: "B", reason: "", actorId: "admin" },
      }),
    /reason/,
  );
});

test("administrators can configure ordered division thresholds while plus handicaps remain supported", () => {
  assert.equal(rules.assignDivision(12, { aMaximum: 12.9 }), "A");
  assert.equal(rules.assignDivision(13, { aMaximum: 12.9 }), "B");
  assert.equal(
    rules.assignDivision(24.9, {
      cGradeEnabled: true,
      aMaximum: 12.9,
      bMaximum: 24.9,
    }),
    "B",
  );
  assert.equal(
    rules.assignDivision(25, {
      cGradeEnabled: true,
      aMaximum: 12.9,
      bMaximum: 24.9,
    }),
    "C",
  );
  assert.equal(rules.assignDivision(-3, { aMaximum: -1 }), "A");
  assert.throws(
    () =>
      rules.assignDivision(12, {
        cGradeEnabled: true,
        aMaximum: 20,
        bMaximum: 10,
      }),
    /ordered/,
  );
  assert.throws(
    () => rules.assignDivision(12, { aMaximum: Number.NaN }),
    /finite/,
  );
});

test("Aggregate combines two eligible verified nines on the same course", () => {
  const scores = rules.scoreCompetition("aggregate", [
    attempt("one", 34),
    attempt("two", 35),
  ]);
  assert.deepEqual(
    [scores.status, scores.net, scores.gross],
    ["complete", 69, 79],
  );
  assert.equal(
    rules.scoreCompetition("aggregate", [
      attempt("one", 34),
      attempt("two", 35, { courseId: "other" }),
    ]).status,
    "manual_review",
  );
  assert.equal(
    rules.scoreCompetition("aggregate", [attempt("one", 34)]).status,
    "incomplete",
  );
});

test("Redemption selects best eligible nine and rejects a third attempt", () => {
  assert.equal(
    rules.scoreCompetition("redemption", [
      attempt("one", 34),
      attempt("two", 31),
    ]).net,
    31,
  );
  assert.equal(
    rules.scoreCompetition("redemption", [
      attempt("one", 34),
      attempt("two", 31, { eligible: false }),
    ]).net,
    34,
  );
  assert.equal(
    rules.scoreCompetition("redemption", [
      attempt("one", 34),
      attempt("two", 31),
      attempt("three", 30),
    ]).status,
    "manual_review",
  );
});

test("World Tour requires different courses and Elements additionally verifies different playing conditions", () => {
  assert.equal(
    rules.scoreCompetition("world_tour", [
      attempt("one", 34),
      attempt("two", 35, { courseId: "other" }),
    ]).net,
    69,
  );
  assert.equal(
    rules.scoreCompetition("world_tour", [
      attempt("one", 34),
      attempt("two", 35),
    ]).status,
    "manual_review",
  );
  assert.equal(
    rules.scoreCompetition("elements", [
      attempt("one", 34),
      attempt("two", 35, { courseId: "other" }),
    ]).status,
    "manual_review",
  );
  assert.equal(
    rules.scoreCompetition("elements", [
      attempt("one", 34, { conditionsId: "calm" }),
      attempt("two", 35, { courseId: "other", conditionsId: "wind" }),
    ]).status,
    "complete",
  );
});

test("countback starts at configured stroke index one and does not invent missing hole data", () => {
  const a = [
    { strokeIndex: 1, net: 3, gross: 4 },
    { strokeIndex: 2, net: 5, gross: 5 },
  ];
  const b = [
    { strokeIndex: 1, net: 4, gross: 5 },
    { strokeIndex: 2, net: 3, gross: 4 },
  ];
  assert.equal(rules.compareCountback(a, b).order, -1);
  assert.equal(rules.compareCountback(a, b, [2, 1]).order, 1);
  assert.equal(rules.compareCountback(undefined, b).order, null);
  assert.equal(rules.compareCountback(a, a, [1, 2]).order, 0);
});

test("PGA regular500 reference includes every official lower position through85", () => {
  const points = rules.CGL_DEFAULT_POINTS_TABLE;
  assert.equal(points.values.length, 85);
  assert.deepEqual(
    points.values.slice(0, 10),
    [500, 300, 190, 135, 110, 100, 90, 85, 80, 75],
  );
  assert.equal(points.values[24], 35.5);
  assert.equal(points.values[64], 4);
  assert.equal(points.values[84], 1.5);
  assert.match(points.sourceUrl, /pgatourhq/);
});

test("weekly finishing points are calculated within each division rather than the combined field", () => {
  const calculation = rules.calculateDivisionPoints([
    result("a1", "A", 65),
    result("b1", "B", 66),
    result("a2", "A", 67),
    result("b2", "B", 68),
  ]);
  assert.deepEqual(
    calculation.rows.map((row) => [row.playerId, row.position, row.points]),
    [
      ["a1", 1, 500],
      ["a2", 2, 300],
      ["b1", 1, 500],
      ["b2", 2, 300],
    ],
  );
  assert.equal(calculation.manualReview, false);
});

test("unresolved score ties hold points for manual review; verified countback resolves them", () => {
  const tied = [
    result("a1", "A", 65),
    result("a2", "A", 65),
    result("a3", "A", 67),
  ];
  const unresolved = rules.calculateDivisionPoints(tied);
  assert.equal(unresolved.manualReview, true);
  assert.deepEqual(
    unresolved.rows.map((row) => row.points),
    [null, null, 190],
  );
  tied[0].holes = [{ strokeIndex: 1, net: 3, gross: 4 }];
  tied[1].holes = [{ strokeIndex: 1, net: 4, gross: 5 }];
  assert.equal(rules.calculateDivisionPoints(tied).rows[0].points, 500);
});

test("excluded/unverified competitors do not earn points and edited table versions persist in the calculation", () => {
  const table = {
    ...rules.CGL_DEFAULT_POINTS_TABLE,
    version: "admin-version-2",
    values: [200],
  };
  const calculation = rules.calculateDivisionPoints(
    [
      result("valid", "A", 65),
      result("excluded", "A", 60, { eligible: false }),
      result("pending", "A", 61, { verified: false }),
    ],
    table,
  );
  assert.equal(calculation.rows.length, 1);
  assert.equal(calculation.rows[0].points, 200);
  assert.equal(calculation.rows[0].pointsVersion, "admin-version-2");
});

test("championship best8 drops the two lowest weeks; missing weeks are zero and pending ties remain explicit", () => {
  const all = rules.bestEightOfTen(
    [500, 300, 190, 135, 110, 100, 90, 85, 80, 75].map((points, index) => ({
      week: index + 1,
      points,
    })),
  );
  assert.equal(all.total, 1510);
  assert.deepEqual(
    all.discarded.map((week) => week.week),
    [9, 10],
  );
  const partial = rules.bestEightOfTen([
    { week: 1, points: 500 },
    { week: 2, points: null },
  ]);
  assert.equal(partial.total, 500);
  assert.equal(partial.roundsCounted, 1);
  assert.equal(partial.hasPending, true);
  assert.equal(partial.missingWeeks.length, 9);
  assert.throws(
    () =>
      rules.bestEightOfTen([
        { week: 1, points: 500 },
        { week: 1, points: 300 },
      ]),
    /Duplicate/,
  );
});

test("annual rankings stay pending until an administrator approves a configured formula", () => {
  assert.equal(
    rules.annualRanking([{ seasonId: "s1", points: 500 }], {
      approved: false,
      method: "sum",
    }).points,
    null,
  );
  assert.equal(
    rules.annualRanking(
      [
        { seasonId: "s1", points: 500 },
        { seasonId: "s2", points: 300 },
      ],
      { approved: true, method: "sum" },
    ).points,
    800,
  );
});

test("weekly prizes are shared across grades, one per player in editable priority, with the full/casual multiplier", () => {
  const field = [
    result("double-leader", "A", 65, { gross: 68, ctpMetres: 0.2 }),
    result("casual", "B", 67, {
      gross: 69,
      membership: "casual",
      ctpMetres: 0.4,
    }),
    result("third", "B", 68, { gross: 70, ctpMetres: 0.6 }),
  ];
  const normal = rules.selectWeeklyAwards(field, {
    weekId: "w1",
    verified: true,
    published: true,
  });
  assert.deepEqual(
    normal.awards.map((award) => [
      award.category,
      award.playerId,
      award.credits,
    ]),
    [
      ["net", "double-leader", 20],
      ["gross", "casual", 10],
      ["ctp", "third", 10],
    ],
  );
  assert.equal(new Set(normal.awards.map((award) => award.playerId)).size, 3);
  const reversed = rules.selectWeeklyAwards(field, {
    weekId: "w1",
    verified: true,
    published: true,
    priority: ["ctp", "net", "gross"],
  });
  assert.deepEqual(
    reversed.awards.map((award) => [award.category, award.playerId]),
    [
      ["ctp", "double-leader"],
      ["net", "casual"],
      ["gross", "third"],
    ],
  );
});

test("unpublished/unverified results never issue awards", () => {
  assert.equal(
    rules.selectWeeklyAwards([result("a", "A", 65)], {
      weekId: "w1",
      verified: true,
      published: false,
    }).awards.length,
    0,
  );
  assert.equal(
    rules.selectWeeklyAwards([result("a", "A", 65)], {
      weekId: "w1",
      verified: false,
      published: true,
    }).awards.length,
    0,
  );
});

test("CTP equal distances use earliest verified qualifying timestamp; missing timestamps trigger review", () => {
  const field = [
    result("later", "A", 70, {
      ctpMetres: 0.2,
      ctpVerifiedAt: "2027-04-01T10:00:00Z",
    }),
    result("earlier", "B", 71, {
      ctpMetres: 0.2,
      ctpVerifiedAt: "2027-04-01T09:00:00Z",
    }),
  ];
  const config = {
    weekId: "w1",
    verified: true,
    published: true,
    priority: ["ctp", "net", "gross"] as const,
  };
  assert.equal(
    rules.selectWeeklyAwards(field, config).awards[0].playerId,
    "earlier",
  );
  field[0].ctpVerifiedAt = null;
  assert.equal(rules.selectWeeklyAwards(field, config).manualReview, true);
});

test("credit issues are immutable, idempotent, and expire18 calendar months after individual issue dates", () => {
  const first = issue([], "a", 20, "2027-08-31T00:00:00Z");
  assert.equal(first.event?.expiresAt, "2029-02-28T00:00:00.000Z");
  const duplicate = issue(first.ledger, "a", 20, "2027-08-31T00:00:00Z");
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.ledger.length, 1);
  assert.equal(
    rules.creditLots(first.ledger, "member-1", "2029-02-28T00:00:00Z")
      .available,
    0,
  );
  assert.equal(
    rules.creditLots(first.ledger, "other-member", "2027-09-01").available,
    0,
  );
  assert.throws(
    () => issue(first.ledger, "a", 21, "2027-08-31T00:00:00Z"),
    /different credit command/,
  );
});

test("redemption spends earliest-expiring credits first, records allocations and cannot go negative", () => {
  const older = issue([], "older", 20, "2027-01-01");
  const both = issue(older.ledger, "newer", 30, "2027-02-01");
  const command = {
    id: "r1",
    key: "order:1",
    memberId: "member-1",
    amount: 25,
    occurredAt: "2027-03-01",
    sourceId: "reward-order-1",
  };
  const spent = rules.redeemCredits(both.ledger, command);
  assert.deepEqual(spent.event?.allocations, [
    { lotId: "older", credits: 20 },
    { lotId: "newer", credits: 5 },
  ]);
  assert.equal(
    rules.creditLots(spent.ledger, "member-1", "2027-03-01").available,
    25,
  );
  assert.equal(
    rules.creditLots(both.ledger, "member-1", "2027-03-01").available,
    50,
  );
  assert.equal(rules.redeemCredits(spent.ledger, command).duplicate, true);
  assert.throws(
    () =>
      rules.redeemCredits(spent.ledger, {
        ...command,
        id: "r2",
        key: "order:2",
        amount: 26,
      }),
    /Insufficient/,
  );
});

test("scheduled expiry affects only expired remaining lots and cannot duplicate the expiry debit", () => {
  const old = issue([], "old", 20, "2027-01-01");
  const both = issue(old.ledger, "new", 30, "2028-06-01");
  const input = {
    id: "expiry-1",
    key: "expiry:2028-07-01",
    memberId: "member-1",
    occurredAt: "2028-07-01",
    sourceId: "scheduled-expiry",
  };
  const expired = rules.expireCredits(both.ledger, input);
  assert.equal(expired.event?.amount, -20);
  assert.equal(
    rules.creditLots(expired.ledger, "member-1", "2028-07-01").available,
    30,
  );
  assert.equal(rules.expireCredits(expired.ledger, input).duplicate, true);
});

test("malformed ledger debits and cross-account lot spending are rejected", () => {
  const first = issue([], "a", 20);
  const invalid: CreditLedgerEvent = {
    id: "bad",
    key: "bad",
    memberId: "member-1",
    type: "redeem",
    amount: -21,
    occurredAt: "2027-04-01",
    sourceId: "bad-order",
    allocations: [{ lotId: "a", credits: 21 }],
  };
  assert.throws(
    () =>
      rules.creditLots([...first.ledger, invalid], "member-1", "2027-04-01"),
    /negative/,
  );
  assert.throws(
    () =>
      rules.creditLots(
        [
          ...first.ledger,
          {
            ...invalid,
            amount: -1,
            memberId: "other",
            allocations: [{ lotId: "a", credits: 1 }],
          },
        ],
        "other",
        "2027-04-01",
      ),
    /negative/,
  );
});

test("credit reversals require an administrator and reason, retain history and never make balances negative", () => {
  const first = issue([], "a", 20);
  const input = {
    id: "reverse",
    key: "reverse:a",
    memberId: "member-1",
    amount: 10,
    occurredAt: "2027-04-01",
    sourceId: "review:a",
  };
  assert.throws(
    () => rules.adjustCreditsDown(first.ledger, input),
    /Administrator/,
  );
  const adjusted = rules.adjustCreditsDown(first.ledger, {
    ...input,
    actorId: "admin",
    reason: "Authorised correction",
  });
  assert.equal(
    rules.creditLots(adjusted.ledger, "member-1", "2027-04-01").available,
    10,
  );
  assert.equal(adjusted.ledger[0].amount, 20);
});

test("credit-funded season fees can cover100% when enabled, without an arbitrary25% cap", () => {
  const quote = rules.quoteFeeRedemption({
    enabled: true,
    paymentType: "season",
    priceCents: 10000,
    requestedCredits: 200,
    availableCredits: 200,
    allowFullRedemption: true,
  });
  assert.deepEqual(quote, {
    credits: 200,
    discountCents: 10000,
    cashDueCents: 0,
    allowed: true,
  });
  assert.equal(
    rules.quoteFeeRedemption({
      enabled: true,
      paymentType: "membership",
      priceCents: 10000,
      requestedCredits: 200,
      availableCredits: 200,
      recurring: true,
    }).allowed,
    false,
  );
  assert.equal(
    rules.quoteFeeRedemption({
      enabled: true,
      paymentType: "membership",
      priceCents: 10000,
      requestedCredits: 100,
      availableCredits: 200,
      recurring: true,
    }).cashDueCents,
    5000,
  );
});

test("redemption respects per-item enablement, configured limits and available balance", () => {
  const input = {
    enabled: true,
    paymentType: "merchandise" as const,
    priceCents: 2000,
    requestedCredits: 40,
    availableCredits: 40,
  };
  assert.equal(
    rules.quoteFeeRedemption({ ...input, enabled: false }).allowed,
    false,
  );
  assert.equal(
    rules.quoteFeeRedemption({ ...input, maximumCredits: 20 }).allowed,
    false,
  );
  assert.equal(
    rules.quoteFeeRedemption({ ...input, availableCredits: 30 }).allowed,
    false,
  );
});

test("seasonal gifts release in Week5 with annual1/monthly2/weekly5 successful payments and never to casuals", () => {
  const input = {
    active: true,
    seasonWeek: 5,
    successfulPayments: 1,
    alreadyAllocated: false,
    seasonConditionsMet: true,
  };
  assert.equal(
    rules.giftEligibility({ ...input, planId: "annual" }).eligible,
    true,
  );
  assert.equal(
    rules.giftEligibility({ ...input, seasonWeek: 4, planId: "annual" })
      .eligible,
    false,
  );
  assert.equal(
    rules.giftEligibility({ ...input, planId: "monthly" }).eligible,
    false,
  );
  assert.equal(
    rules.giftEligibility({
      ...input,
      planId: "monthly",
      successfulPayments: 2,
    }).eligible,
    true,
  );
  assert.equal(
    rules.giftEligibility({ ...input, planId: "weekly", successfulPayments: 4 })
      .eligible,
    false,
  );
  assert.equal(
    rules.giftEligibility({ ...input, planId: "weekly", successfulPayments: 5 })
      .eligible,
    true,
  );
  assert.equal(
    rules.giftEligibility({
      ...input,
      planId: "casual_season",
      successfulPayments: 10,
    }).eligible,
    false,
  );
});

test("mid-season gifts require a configured policy and duplicate allocations are stopped", () => {
  const input = {
    planId: "annual" as const,
    active: true,
    seasonWeek: 5,
    successfulPayments: 1,
    alreadyAllocated: false,
    seasonConditionsMet: true,
    joinedMidSeason: true,
  };
  assert.equal(rules.giftEligibility(input).status, "manual_review");
  assert.equal(
    rules.giftEligibility({ ...input, midSeasonPolicy: "same_rules" }).eligible,
    true,
  );
  assert.equal(
    rules.giftEligibility({ ...input, alreadyAllocated: true }).status,
    "already_allocated",
  );
});

test("SGT reconciliation deduplicates imports and never silently overwrites verified results", () => {
  const incoming = { externalId: "sgt:1", fingerprint: "version-a" };
  assert.equal(rules.reconcileImportedResult(null, incoming).action, "insert");
  assert.equal(
    rules.reconcileImportedResult({ ...incoming, verified: true }, incoming)
      .action,
    "unchanged",
  );
  assert.equal(
    rules.reconcileImportedResult(
      { ...incoming, verified: true },
      { ...incoming, fingerprint: "version-b" },
    ).action,
    "manual_review",
  );
  assert.equal(
    rules.reconcileImportedResult(
      { ...incoming, verified: false },
      { ...incoming, fingerprint: "version-b" },
    ).action,
    "update_unverified",
  );
});

test("results administrators cannot change billing, credits, settings or roles; members cannot administer", () => {
  assert.equal(rules.canCgl("public", "view_public"), true);
  assert.equal(rules.canCgl("public", "view_own"), false);
  assert.equal(rules.canCgl("results_admin", "manage_results"), true);
  assert.equal(rules.canCgl("results_admin", "manage_billing"), false);
  assert.equal(rules.canCgl("results_admin", "manage_rewards"), false);
  assert.equal(rules.canCgl("member", "manage_results"), false);
  assert.equal(rules.canCgl("league_admin", "manage_roles"), false);
  assert.equal(rules.canCgl("super_admin", "manage_roles"), true);
  assert.equal(rules.canCgl("untrusted-role" as "member", "view_own"), false);
});

test("financial scenarios distinguish forecast exposure/costs from income and use editable plan prices", () => {
  const common = {
    annualMembers: 10,
    monthlyMembers: 6,
    weeklyMembers: 4,
    casualRegistrations: 0,
    casualSeasonEntries: 0,
    merchandiseCostCents: 136000,
    feeBasisPoints: 0,
    fixedFeeCents: 0,
  };
  const scenario = rules.financialScenario(common);
  assert.equal(scenario.classification, "forecast");
  assert.equal(scenario.forecastRevenueCents, 650800);
  assert.equal(scenario.budgetedCostsCents, 596000);
  assert.equal(scenario.forecastSurplusCents, 54800);
  assert.equal(
    rules.financialScenario({ ...common, prices: { annual: 25000 } })
      .forecastRevenueCents,
    651800,
  );
});

test("development fixtures isolate20 full members and4 casuals from real accounts and create a complete13-week season", () => {
  const fixture = createCglDevelopmentFixture();
  assert.equal(fixture.metadata.isolated, true);
  assert.equal(
    fixture.members.filter((member) => member.membership === "full").length,
    20,
  );
  assert.equal(
    fixture.members.filter((member) => member.planId === "annual").length,
    10,
  );
  assert.equal(
    fixture.members.filter((member) => member.planId === "monthly").length,
    6,
  );
  assert.equal(
    fixture.members.filter((member) => member.planId === "weekly").length,
    4,
  );
  assert.equal(
    fixture.members.filter((member) => member.membership === "casual").length,
    4,
  );
  assert.equal(fixture.weeks.length, 13);
  assert.equal(
    fixture.weeks.filter((week) => week.kind === "qualification").length,
    3,
  );
  assert.equal(
    fixture.weeks.filter((week) => week.kind === "championship").length,
    10,
  );
  assert.equal(
    new Date(fixture.season.endsAt).getTime() -
      new Date(fixture.season.startsAt).getTime(),
    91 * 86400000,
  );
  assert.ok(
    fixture.members.every(
      (member) =>
        member.id.startsWith("fixture-") && member.email.endsWith(".invalid"),
    ),
  );
  assert.ok(
    fixture.weeklyResults.every(
      (item) =>
        item.source === "isolated_fixture" && item.scorecardUrl === null,
    ),
  );
});

test("fixture scorecards reconcile combined and segment totals; both grades calculate independently", () => {
  const fixture = createCglDevelopmentFixture();
  for (const item of fixture.weeklyResults) {
    assert.equal(
      item.holes!.reduce((sum, hole) => sum + hole.gross, 0),
      item.gross,
    );
    assert.equal(
      item.holes!.reduce((sum, hole) => sum + hole.net, 0),
      item.net,
    );
    assert.equal(
      item.segmentGross.reduce((a, b) => a + b),
      item.gross,
    );
    assert.equal(
      item.segmentNet.reduce((a, b) => a + b),
      item.net,
    );
  }
  const points = rules.calculateDivisionPoints(
    fixture.weeklyResults.filter((item) => item.championshipWeek === 1),
  );
  assert.ok(
    points.rows.some(
      (row) => row.division === "A" && row.position === 1 && row.points === 500,
    ),
  );
  assert.ok(
    points.rows.some(
      (row) => row.division === "B" && row.position === 1 && row.points === 500,
    ),
  );
});

test("fixture ledger retains member/casual earnings, spent merchandise, pending expiry and expiring credits", () => {
  const fixture = createCglDevelopmentFixture();
  assert.equal(
    rules.creditLots(
      fixture.ledger,
      fixture.members[0].id,
      fixture.metadata.asOf,
    ).available,
    10,
  );
  assert.equal(
    rules.creditLots(
      fixture.ledger,
      fixture.members[1].id,
      fixture.metadata.asOf,
    ).expiredUnprocessed,
    15,
  );
  assert.equal(
    rules.creditLots(
      fixture.ledger,
      fixture.members[2].id,
      fixture.metadata.asOf,
    ).available,
    25,
  );
  assert.equal(
    rules.creditLots(
      fixture.ledger,
      fixture.members[20].id,
      fixture.metadata.asOf,
    ).available,
    10,
  );
  assert.equal(fixture.orders[0].actualCostCents, 1700);
  assert.equal(
    fixture.payments.filter((payment) => payment.status === "failed").length,
    1,
  );
  assert.equal(fixture.cancellationRequests[0].status, "review_required");
});
