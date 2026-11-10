/**
 * ISOLATED DEVELOPMENT DATA ONLY.
 *
 * This module has no database / network imports, reads no credentials and never
 * creates Auth users. Import createCglDevelopmentFixture() in a local test or
 * export its JSON to a developer fixture file. The reserved .invalid addresses,
 * fixture IDs and source labels must never be passed to a production seed.
 */
import type {
  CglDivision,
  CglPlanId,
  CompetitionResult,
  CreditLedgerEvent,
} from "../lib/cgl-engine";

export interface FixtureMember {
  id: string;
  email: string;
  username: string;
  planId: CglPlanId;
  membership: "full" | "casual";
  division: CglDivision | null;
  handicap: number | null;
  handicapVerified: boolean;
  establishedHandicap: boolean;
  eligibleHoles: number;
  joinedAt: string;
  seasonEntryPaid: boolean;
  registrationExpiresAt: string | null;
  paymentStatus: "paid" | "overdue";
  failedPaymentWeek: number | null;
}

export interface FixtureWeek {
  id: string;
  seasonWeek: number;
  championshipWeek: number | null;
  kind: "qualification" | "championship";
  opensAt: string;
  closesAt: string;
  status: "closed" | "published" | "upcoming";
  courseId: string;
  format: "aggregate";
}

function addDays(timestamp: string, days: number): string {
  return new Date(
    new Date(timestamp).getTime() + days * 86400000,
  ).toISOString();
}

export function createCglDevelopmentFixture() {
  const seasonStart = "2027-03-01T00:00:00.000Z";
  const asOf = "2027-05-23T00:00:00.000Z";
  const fullMembers: FixtureMember[] = Array.from(
    { length: 20 },
    (_, index) => ({
      id: `fixture-member-${String(index + 1).padStart(2, "0")}`,
      email: `member-${index + 1}@cgl-fixture.invalid`,
      username: `FixtureGolfer${String(index + 1).padStart(2, "0")}`,
      planId: index < 10 ? "annual" : index < 16 ? "monthly" : "weekly",
      membership: "full",
      division: index < 10 ? "A" : "B",
      handicap:
        index === 0
          ? -2.4
          : index < 10
            ? Number((2 + index * 0.7).toFixed(1))
            : Number((10 + (index - 10) * 1.4).toFixed(1)),
      handicapVerified: true,
      establishedHandicap: index !== 3,
      eligibleHoles: index === 3 ? 54 : 108,
      joinedAt: seasonStart,
      seasonEntryPaid: true,
      registrationExpiresAt: null,
      paymentStatus: index === 19 ? "overdue" : "paid",
      failedPaymentWeek: index === 19 ? 9 : null,
    }),
  );
  const casualMembers: FixtureMember[] = Array.from(
    { length: 4 },
    (_, index) => ({
      id: `fixture-casual-${index + 1}`,
      email: `casual-${index + 1}@cgl-fixture.invalid`,
      username: `FixtureCasual${index + 1}`,
      planId: "casual_registration",
      membership: "casual",
      division: index === 3 ? null : index < 2 ? "A" : "B",
      handicap: index === 3 ? null : index < 2 ? 6 + index : 18,
      handicapVerified: index !== 3,
      establishedHandicap: index !== 3,
      eligibleHoles: index === 3 ? 36 : 108,
      joinedAt: index === 2 ? "2027-04-01T00:00:00.000Z" : seasonStart,
      seasonEntryPaid: index !== 3,
      registrationExpiresAt: "2028-03-01T00:00:00.000Z",
      paymentStatus: "paid",
      failedPaymentWeek: null,
    }),
  );
  const members = [...fullMembers, ...casualMembers];
  const weeks: FixtureWeek[] = Array.from({ length: 13 }, (_, index) => ({
    id: `fixture-week-${index + 1}`,
    seasonWeek: index + 1,
    championshipWeek: index >= 3 ? index - 2 : null,
    kind: index < 3 ? "qualification" : "championship",
    opensAt: addDays(seasonStart, index * 7),
    closesAt: addDays(seasonStart, (index + 1) * 7),
    status: index < 11 ? "closed" : index === 11 ? "published" : "upcoming",
    courseId: `fixture-course-${Math.floor(index / 2) + 1}`,
    format: "aggregate",
  }));

  const weeklyResults: (CompetitionResult & {
    id: string;
    weekId: string;
    championshipWeek: number;
    externalId: string;
    source: "isolated_fixture";
    scorecardUrl: null;
    status: "verified" | "pending";
    segmentGross: [number, number];
    segmentNet: [number, number];
  })[] = [];
  for (const week of weeks.filter((item) => item.championshipWeek != null)) {
    const championshipWeek = week.championshipWeek!;
    for (const [index, member] of members.entries()) {
      if (!member.division || !member.handicapVerified) continue;
      // Missing weeks deliberately exercise best-eight and zero scoring.
      if (
        (index === 2 && championshipWeek === 3) ||
        (index === 8 && [2, 7].includes(championshipWeek))
      )
        continue;
      if (new Date(member.joinedAt) >= new Date(week.closesAt)) continue;
      const gross = 72 + (index % 12) + ((championshipWeek + index) % 5);
      const playingHandicap = Math.round(member.handicap!);
      const holes = Array.from({ length: 18 }, (_, holeIndex) => {
        const holeGross = 4 + (holeIndex < gross - 72 ? 1 : 0);
        const strokes =
          playingHandicap >= 0
            ? Math.floor(playingHandicap / 18) +
              (holeIndex < playingHandicap % 18 ? 1 : 0)
            : -(holeIndex >= 18 + playingHandicap ? 1 : 0);
        return {
          strokeIndex: holeIndex + 1,
          gross: holeGross,
          net: holeGross - strokes,
          segment: holeIndex < 9 ? 1 : 2,
        };
      });
      const firstGross = holes
        .slice(0, 9)
        .reduce((sum, hole) => sum + hole.gross, 0);
      const firstNet = holes
        .slice(0, 9)
        .reduce((sum, hole) => sum + hole.net, 0);
      const secondGross = holes
        .slice(9)
        .reduce((sum, hole) => sum + hole.gross, 0);
      const secondNet = holes.slice(9).reduce((sum, hole) => sum + hole.net, 0);
      const verified = championshipWeek < 10;
      weeklyResults.push({
        id: `fixture-result-${championshipWeek}-${member.id}`,
        playerId: member.id,
        division: member.division,
        gross,
        net: firstNet + secondNet,
        eligible: !(
          member.failedPaymentWeek != null &&
          championshipWeek > member.failedPaymentWeek
        ),
        verified,
        membership: member.membership,
        holes,
        ctpMetres: Number(
          (0.2 + ((index + championshipWeek) % members.length) * 0.11).toFixed(
            2,
          ),
        ),
        ctpVerifiedAt: addDays(week.opensAt, 1 + index / 100),
        weekId: week.id,
        championshipWeek,
        externalId: `fixture-only:${championshipWeek}:${member.id}`,
        source: "isolated_fixture",
        scorecardUrl: null,
        status: verified ? "verified" : "pending",
        segmentGross: [firstGross, secondGross],
        segmentNet: [firstNet, secondNet],
      });
    }
  }

  const ledger: CreditLedgerEvent[] = [
    {
      id: "fixture-lot-expiring",
      key: "fixture:credits:expiring",
      memberId: fullMembers[0].id,
      type: "issue",
      amount: 30,
      occurredAt: "2025-12-01T00:00:00.000Z",
      expiresAt: "2027-06-01T00:00:00.000Z",
      sourceId: "fixture-historical-award",
    },
    {
      id: "fixture-lot-expired",
      key: "fixture:credits:expired",
      memberId: fullMembers[1].id,
      type: "issue",
      amount: 15,
      occurredAt: "2025-10-01T00:00:00.000Z",
      expiresAt: "2027-04-01T00:00:00.000Z",
      sourceId: "fixture-historical-award",
    },
    {
      id: "fixture-lot-expiring-soon",
      key: "fixture:credits:expiring-soon",
      memberId: fullMembers[2].id,
      type: "issue",
      amount: 25,
      occurredAt: "2025-12-01T00:00:00.000Z",
      expiresAt: "2027-06-01T00:00:00.000Z",
      sourceId: "fixture-historical-award",
    },
    {
      id: "fixture-lot-full-weekly",
      key: "fixture:weekly:1:net",
      memberId: fullMembers[0].id,
      type: "issue",
      amount: 20,
      occurredAt: "2027-03-29T00:00:00.000Z",
      expiresAt: "2028-09-29T00:00:00.000Z",
      sourceId: "fixture-week-4-net",
    },
    {
      id: "fixture-lot-casual-weekly",
      key: "fixture:weekly:1:gross",
      memberId: casualMembers[0].id,
      type: "issue",
      amount: 10,
      occurredAt: "2027-03-29T00:00:00.000Z",
      expiresAt: "2028-09-29T00:00:00.000Z",
      sourceId: "fixture-week-4-gross",
    },
    {
      id: "fixture-redemption-hat",
      key: "fixture:order:hat",
      memberId: fullMembers[0].id,
      type: "redeem",
      amount: -40,
      occurredAt: "2027-04-01T00:00:00.000Z",
      sourceId: "fixture-order-1",
      allocations: [
        { lotId: "fixture-lot-expiring", credits: 30 },
        { lotId: "fixture-lot-full-weekly", credits: 10 },
      ],
    },
  ];
  const catalogue = [
    {
      id: "fixture-reward-hat",
      name: "Fixture CGS hat",
      credits: 40,
      retailCents: 3000,
      costCents: 1700,
      stock: 20,
      enabled: true,
      fulfilment: "pickup_or_dispatch",
    },
    {
      id: "fixture-reward-glove",
      name: "Fixture CGS glove",
      credits: 30,
      retailCents: 2000,
      costCents: 1200,
      stock: 20,
      enabled: true,
      fulfilment: "pickup_or_dispatch",
    },
    {
      id: "fixture-reward-balls",
      name: "Fixture golf ball sleeve",
      credits: 20,
      retailCents: 1500,
      costCents: 700,
      stock: 30,
      enabled: true,
      fulfilment: "pickup_or_dispatch",
    },
    {
      id: "fixture-reward-season",
      name: "Fixture season entry redemption",
      credits: 200,
      retailCents: 10000,
      costCents: 0,
      stock: null,
      enabled: false,
      fulfilment: "fee_discount",
    },
  ];

  return {
    metadata: {
      isolated: true as const,
      environment: "development_fixture" as const,
      asOf,
      warning:
        "Synthetic fixture data. Never import into real CGS records or represent as SGT results.",
    },
    season: {
      id: "fixture-season-2027-1",
      name: "Fixture Aggregate Championship",
      startsAt: seasonStart,
      endsAt: addDays(seasonStart, 91),
      championshipStartsAt: addDays(seasonStart, 21),
      status: "test_fixture",
      format: "aggregate",
      pointsVersion: "pga-regular-500-2026-v1",
      countedWeeks: 8,
      championshipWeeks: 10,
      cGradeEnabled: false,
    },
    members,
    weeks,
    weeklyResults,
    ledger,
    catalogue,
    payments: [
      ...fullMembers.map((member) => ({
        id: `fixture-payment-${member.id}`,
        memberId: member.id,
        provider: "fixture_only",
        amountCents:
          member.planId === "annual"
            ? 24900
            : member.planId === "monthly"
              ? 2995
              : 895,
        status: "paid",
        paidAt: seasonStart,
      })),
      {
        id: "fixture-failed-payment",
        memberId: fullMembers[19].id,
        provider: "fixture_only",
        amountCents: 895,
        status: "failed",
        paidAt: null,
        failedAt: "2027-05-17T00:00:00.000Z",
        championshipWeek: 9,
      },
    ],
    cancellationRequests: [
      {
        id: "fixture-cancellation",
        memberId: fullMembers[12].id,
        requestedAt: "2027-04-15T00:00:00.000Z",
        effectiveAt: addDays(seasonStart, 91),
        status: "review_required",
        policyApproved: false,
      },
    ],
    orders: [
      {
        id: "fixture-order-1",
        memberId: fullMembers[0].id,
        catalogueId: "fixture-reward-hat",
        credits: 40,
        cashCents: 0,
        status: "collected",
        fulfilledAt: "2027-04-03T00:00:00.000Z",
        actualCostCents: 1700,
      },
    ],
    gifts: [
      {
        id: "fixture-gift-1",
        memberId: fullMembers[0].id,
        seasonId: "fixture-season-2027-1",
        status: "collected",
        actualCostCents: 1700,
      },
      {
        id: "fixture-gift-2",
        memberId: fullMembers[10].id,
        seasonId: "fixture-season-2027-1",
        status: "eligible",
        successfulPayments: 2,
      },
      {
        id: "fixture-gift-3",
        memberId: fullMembers[16].id,
        seasonId: "fixture-season-2027-1",
        status: "waiting",
        successfulPayments: 4,
      },
    ],
  };
}
