export type SgtRow = Record<string, unknown>;
export type SgtScoreMode = "gross" | "net";

export type SgtHole = {
  hole: number;
  par: number | null;
  gross: number | null;
  net: number | null;
  strokeIndex: number | null;
};

export type SgtLeaderboardEntry = {
  name: string;
  position: number;
  tied: boolean;
  total: number | null;
  toPar: number | null;
  holesPlayed: number;
  holeCount: number;
  roundsCompleted: number;
  currentRound: number;
  status: "waiting" | "live" | "finished";
  thru: string;
  cards: SgtRow[];
};

export type SgtStatEntry = {
  name: string;
  value: number;
  average: number | null;
};

export type SgtStatCategory = {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
  unit: string;
  precision: number;
  signed: boolean;
  entries: SgtStatEntry[];
};

type StatDefinition = Omit<SgtStatCategory, "key" | "entries"> & {
  valueKeys: string[];
  lowerIsBetter?: boolean;
};

const IDENTITY_KEYS = new Set([
  "user_name",
  "username",
  "player_name",
  "playername",
  "display_name",
  "name",
  "team_name",
  "teamname",
  "numrounds",
  "rounds",
  "touraverage",
]);

const STAT_DEFINITIONS: Record<string, StatDefinition> = {
  drivingDistance: {
    label: "Longest drive",
    shortLabel: "Drive",
    description: "Longest recorded drive in SGT.",
    valueKeys: ["longest_drive", "long_drive", "drivingDistance", "distance"],
    unit: "yd",
    precision: 0,
    signed: false,
  },
  drivingAccuracy: {
    label: "Fairways hit",
    shortLabel: "FIR",
    description: "Percentage of eligible fairways hit.",
    valueKeys: ["fir_percent", "fairwayspcthit", "drivingAccuracy", "percentage"],
    unit: "%",
    precision: 1,
    signed: false,
  },
  greenAccuracy: {
    label: "Greens in regulation",
    shortLabel: "GIR",
    description: "Percentage of greens reached in regulation.",
    valueKeys: ["gir_percent", "GIR", "greenAccuracy", "percentage"],
    unit: "%",
    precision: 1,
    signed: false,
  },
  girAccuracy: {
    label: "Greens in regulation",
    shortLabel: "GIR",
    description: "Percentage of greens reached in regulation.",
    valueKeys: ["GIR", "gir_percent", "girAccuracy", "percentage"],
    unit: "%",
    precision: 1,
    signed: false,
  },
  girProx: {
    label: "GIR proximity",
    shortLabel: "GIR prox",
    description: "Average proximity after a green-in-regulation approach.",
    valueKeys: ["girProx", "gir_prox", "proximity"],
    unit: "ft",
    precision: 1,
    signed: false,
    lowerIsBetter: true,
  },
  closestToPin: {
    label: "Closest to pin",
    shortLabel: "CTP",
    description: "Closest recorded approach to the pin.",
    valueKeys: ["closest_to_pin", "closestToPin", "proximity", "distance"],
    unit: "ft",
    precision: 1,
    signed: false,
    lowerIsBetter: true,
  },
  scoringAverage: {
    label: "Scoring average",
    shortLabel: "Scoring",
    description: "Average gross score recorded in SGT.",
    valueKeys: ["scoring_average", "scoringAverage", "average"],
    unit: "",
    precision: 1,
    signed: false,
    lowerIsBetter: true,
  },
  puttsPerRound: {
    label: "Putts per round",
    shortLabel: "Putts / rnd",
    description: "Average putts per completed round.",
    valueKeys: ["putts_per_round", "puttsPerRound", "average"],
    unit: "",
    precision: 1,
    signed: false,
    lowerIsBetter: true,
  },
  puttsPerGIR: {
    label: "Putts per GIR",
    shortLabel: "Putts / GIR",
    description: "Average putts after reaching a green in regulation.",
    valueKeys: ["putts_per_gir", "puttsPerGIR", "average"],
    unit: "",
    precision: 2,
    signed: false,
    lowerIsBetter: true,
  },
  feetPuttsMade: {
    label: "Putts made distance",
    shortLabel: "Putting",
    description: "Average total distance of putts made per round.",
    valueKeys: ["putts_feet_per_round", "feetPuttsMade", "distance"],
    unit: "ft",
    precision: 1,
    signed: false,
  },
  sandSave: {
    label: "Sand saves",
    shortLabel: "Sand save",
    description: "Percentage of bunker attempts saved.",
    valueKeys: ["sand_save_percent", "sandSave", "percentage"],
    unit: "%",
    precision: 1,
    signed: false,
  },
  scramble: {
    label: "Scrambling",
    shortLabel: "Scramble",
    description: "Percentage of missed greens converted into par or better.",
    valueKeys: ["scramble_percent", "scramble", "percentage"],
    unit: "%",
    precision: 1,
    signed: false,
  },
  scrambling: {
    label: "Scrambling",
    shortLabel: "Scramble",
    description: "Percentage of missed greens converted into par or better.",
    valueKeys: ["scrambling", "scramble_percent", "percentage"],
    unit: "%",
    precision: 1,
    signed: false,
  },
  birdies: countStat("Birdies", "Birdies", "Total birdies recorded."),
  eagles: countStat("Eagles", "Eagles", "Total eagles recorded."),
  aces: countStat("Aces", "Aces", "Total holes-in-one recorded."),
  bogeys: countStat("Bogeys", "Bogeys", "Total bogeys recorded.", true),
  doublebogeys: countStat(
    "Double bogeys",
    "Doubles",
    "Total double bogeys recorded.",
    true,
  ),
  onePutts: countStat("One putts", "One putts", "Total one-putt holes recorded."),
  threePutts: countStat(
    "Three putts",
    "Three putts",
    "Total three-putt holes recorded.",
    true,
  ),
  sgTee: strokesGainedStat("Strokes gained: tee", "SG tee"),
  strokesGainedTee: strokesGainedStat("Strokes gained: tee", "SG tee"),
  sgApproach: strokesGainedStat("Strokes gained: approach", "SG approach"),
  strokesGainedApproach: strokesGainedStat(
    "Strokes gained: approach",
    "SG approach",
  ),
  sgATG: strokesGainedStat("Strokes gained: around green", "SG ARG"),
  strokesGainedATG: strokesGainedStat(
    "Strokes gained: around green",
    "SG ARG",
  ),
  sgGreen: strokesGainedStat("Strokes gained: putting", "SG putting"),
  strokesGainedGreen: strokesGainedStat(
    "Strokes gained: putting",
    "SG putting",
  ),
  sgTeeToGreen: strokesGainedStat(
    "Strokes gained: tee to green",
    "SG T2G",
  ),
  strokesGainedTee2Green: strokesGainedStat(
    "Strokes gained: tee to green",
    "SG T2G",
  ),
  sgTotal: strokesGainedStat("Strokes gained: total", "SG total"),
  strokesGainedTotal: strokesGainedStat(
    "Strokes gained: total",
    "SG total",
  ),
};

for (const range of [
  "10to30",
  "30to50",
  "50to100",
  "100to125",
  "125to150",
  "150to175",
  "175to200",
  "200to225",
]) {
  STAT_DEFINITIONS[`prox${range}`] = {
    label: `Proximity ${range.replace("to", "–")} yd`,
    shortLabel: `${range.replace("to", "–")} yd`,
    description: "Average approach proximity for this distance band.",
    valueKeys: ["prox", `prox${range}`, "proximity"],
    unit: "ft",
    precision: 1,
    signed: false,
    lowerIsBetter: true,
  };
}

for (const distance of [1, 2, 3, 4, 5]) {
  STAT_DEFINITIONS[`puttMakePct${distance}`] = {
    label: `${distance} ft putt make rate`,
    shortLabel: `${distance} ft putts`,
    description: `Percentage of ${distance}-foot putts made.`,
    valueKeys: [
      `putt_make_pct_${distance}`,
      `puttMakePct${distance}`,
      "percentage",
    ],
    unit: "%",
    precision: 1,
    signed: false,
  };
}

function countStat(
  label: string,
  shortLabel: string,
  description: string,
  lowerIsBetter = false,
): StatDefinition {
  return {
    label,
    shortLabel,
    description,
    valueKeys: [label.toLowerCase().replaceAll(" ", "")],
    unit: "",
    precision: 0,
    signed: false,
    lowerIsBetter,
  };
}

function strokesGainedStat(label: string, shortLabel: string): StatDefinition {
  return {
    label,
    shortLabel,
    description: "SGT strokes gained performance against the comparison field.",
    valueKeys: [
      label.includes("approach")
        ? "sgApproach"
        : label.includes("around")
          ? "sgATG"
          : label.includes("putting")
            ? "sgGreen"
            : label.includes("tee to green")
              ? "sgTeeToGreen"
              : label.includes("total")
                ? "sgTotal"
                : "sgTee",
      "value",
    ],
    unit: "",
    precision: 2,
    signed: true,
  };
}

export function sgtRows(value: unknown): SgtRow[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is SgtRow =>
          !!item && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

export function sgtRow(value: unknown): SgtRow {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as SgtRow)
    : {};
}

export function sgtFirst(
  record: SgtRow,
  keys: string[],
  fallback: unknown = null,
) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

export function sgtNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sgtHoleScore(value: unknown) {
  const score = sgtNumber(value);
  return score !== null && score > 0 ? score : null;
}

export function sgtPlayerName(record: SgtRow) {
  const value = sgtFirst(record, [
    "user_name",
    "username",
    "player_name",
    "playerName",
    "display_name",
    "team_name",
    "teamName",
    "name",
    "TeamPlayer1",
  ]);
  return typeof value === "string" && value.trim() ? value.trim() : "Player";
}

export function sgtScore(record: SgtRow, mode: SgtScoreMode) {
  return sgtNumber(
    sgtFirst(
      record,
      mode === "net"
        ? ["total_net", "net", "net_score", "netscore", "netTotal", "points"]
        : ["total_gross", "gross", "gross_score", "grossscore", "grossTotal", "score"],
    ),
  );
}

export function sgtToPar(record: SgtRow, mode: SgtScoreMode) {
  return sgtNumber(
    sgtFirst(
      record,
      mode === "net"
        ? ["toPar_net", "to_par_net", "net_to_par"]
        : ["toPar_gross", "to_par_gross", "gross_to_par"],
    ),
  );
}

export function sgtExtractRows(value: unknown, keys: string[] = []) {
  const direct = sgtRows(value);
  if (direct.length) return direct;
  const object = sgtRow(value);
  for (const key of keys) {
    const nested = sgtRows(object[key]);
    if (nested.length) return nested;
  }
  return [];
}

export function sgtScorecardHoles(card: SgtRow): SgtHole[] {
  const nested = sgtRow(card.scorecard);
  const direct = sgtExtractRows(
    card.holes ?? card.scores ?? nested.holes ?? nested.scores,
    ["holes", "scores"],
  );
  if (direct.length) {
    const holes = direct.slice(0, 18).map((hole, index) => ({
      hole: sgtNumber(sgtFirst(hole, ["hole", "hole_number", "number"])) ?? index + 1,
      par: sgtNumber(sgtFirst(hole, ["par", "hole_par"])),
      gross: sgtHoleScore(sgtFirst(hole, ["gross", "score", "strokes"])),
      net: sgtHoleScore(sgtFirst(hole, ["net", "net_score", "netscore"])),
      strokeIndex: sgtNumber(sgtFirst(hole, ["stroke_index", "index", "si"])),
    }));
    const finalHole = holes.findLastIndex(
      (hole) => hole.gross !== null || hole.net !== null,
    );
    return finalHole < 0 ? [] : holes.slice(0, finalHole + 1);
  }

  const holes = Array.from({ length: 18 }, (_, index): SgtHole => {
    const hole = index + 1;
    return {
      hole,
      par: sgtNumber(
        sgtFirst(card, [
          `h${hole}_Par`,
          `h${hole}_par`,
          `par${hole}`,
          `par_${hole}`,
          `hole${hole}_par`,
        ]),
      ),
      gross: sgtHoleScore(
        sgtFirst(card, [
          `hole${hole}_gross`,
          `hole${hole}_Gross`,
          `h${hole}`,
          `hole${hole}`,
          `gross${hole}`,
          `gross_${hole}`,
        ]),
      ),
      net: sgtHoleScore(
        sgtFirst(card, [
          `hole${hole}_net`,
          `hole${hole}_Net`,
          `net${hole}`,
          `net_${hole}`,
        ]),
      ),
      strokeIndex: sgtNumber(
        sgtFirst(card, [
          `h${hole}_index`,
          `hole${hole}_index`,
          `index${hole}`,
        ]),
      ),
    };
  });
  const finalHole = holes.findLastIndex(
    (hole) => hole.gross !== null || hole.net !== null,
  );
  return finalHole < 0 ? [] : holes.slice(0, finalHole + 1);
}

export function buildSgtTournamentLeaderboard(
  cards: SgtRow[],
  mode: SgtScoreMode,
  stableford = false,
): SgtLeaderboardEntry[] {
  const grouped = new Map<string, SgtRow[]>();
  for (const card of cards) {
    const name = sgtPlayerName(card);
    grouped.set(name, [...(grouped.get(name) ?? []), card]);
  }

  const entries = [...grouped.entries()].map(([name, playerCards]) => {
    const ordered = playerCards.toSorted(
      (a, b) =>
        (sgtNumber(sgtFirst(a, ["round", "round_number"])) ?? 1) -
        (sgtNumber(sgtFirst(b, ["round", "round_number"])) ?? 1),
    );
    let total = 0;
    let hasTotal = false;
    let toPar = 0;
    let hasToPar = false;
    let holesPlayed = 0;
    let holeCount = 0;
    let roundsCompleted = 0;
    let liveCard: SgtRow | null = null;

    for (const card of ordered) {
      const holes = sgtScorecardHoles(card);
      const activeHole =
        sgtNumber(sgtFirst(card, ["activeHole", "active_hole", "through", "thru"])) ??
        0;
      const cardHoleCount = Math.max(holes.length, activeHole, 1);
      const scoredHoles = holes.filter(
        (hole) => (mode === "net" ? hole.net : hole.gross) !== null,
      ).length;
      const played = activeHole > 0
        ? Math.min(
            Math.max(activeHole - 1, scoredHoles, 0),
            cardHoleCount,
          )
        : scoredHoles;
      holesPlayed += played;
      holeCount += cardHoleCount;
      if (activeHole > cardHoleCount || (cardHoleCount > 0 && played >= cardHoleCount))
        roundsCompleted += 1;
      else if (played > 0) liveCard = card;

      const cardTotal = sgtScore(card, mode);
      if (cardTotal !== null) {
        total += cardTotal;
        hasTotal = true;
      }
      const cardToPar = sgtToPar(card, mode);
      if (cardToPar !== null) {
        toPar += cardToPar;
        hasToPar = true;
      }
    }

    const current = liveCard ?? ordered.at(-1) ?? {};
    const currentRound =
      sgtNumber(sgtFirst(current, ["round", "round_number"])) ?? ordered.length;
    const currentHoles = sgtScorecardHoles(current);
    const activeHole =
      sgtNumber(sgtFirst(current, ["activeHole", "active_hole", "through", "thru"])) ??
      0;
    const currentHoleCount = Math.max(currentHoles.length, activeHole, 1);
    const scoredCurrentHoles = currentHoles.filter(
      (hole) => (mode === "net" ? hole.net : hole.gross) !== null,
    ).length;
    const currentPlayed = activeHole > 0
      ? Math.min(
          Math.max(activeHole - 1, scoredCurrentHoles, 0),
          currentHoleCount,
        )
      : scoredCurrentHoles;
    const status: SgtLeaderboardEntry["status"] = liveCard
      ? "live"
      : ordered.length > 0 && roundsCompleted === ordered.length
        ? "finished"
        : currentPlayed > 0
          ? "live"
          : "waiting";
    const thru = status === "finished"
      ? "F"
      : status === "waiting"
        ? "—"
        : `${currentPlayed}`;

    return {
      name,
      position: 0,
      tied: false,
      total: hasTotal ? total : null,
      toPar: hasToPar ? toPar : null,
      holesPlayed,
      holeCount,
      roundsCompleted,
      currentRound,
      status,
      thru,
      cards: ordered,
    };
  });

  entries.sort((a, b) => {
    const primaryA = stableford ? a.total : a.toPar ?? a.total;
    const primaryB = stableford ? b.total : b.toPar ?? b.total;
    if (primaryA === null) return 1;
    if (primaryB === null) return -1;
    return (
      (stableford ? primaryB - primaryA : primaryA - primaryB) ||
      b.holesPlayed - a.holesPlayed ||
      a.name.localeCompare(b.name)
    );
  });

  for (const [index, entry] of entries.entries()) {
    const value = stableford ? entry.total : entry.toPar ?? entry.total;
    const previous = entries[index - 1];
    const previousValue = previous
      ? stableford
        ? previous.total
        : previous.toPar ?? previous.total
      : null;
    entry.position = index > 0 && value !== null && value === previousValue
      ? previous.position
      : index + 1;
  }
  const positionCounts = new Map<number, number>();
  for (const entry of entries)
    positionCounts.set(entry.position, (positionCounts.get(entry.position) ?? 0) + 1);
  for (const entry of entries) entry.tied = (positionCounts.get(entry.position) ?? 0) > 1;
  return entries;
}

export function buildSgtStatCategories(value: unknown): SgtStatCategory[] {
  const source = sgtRow(value);
  const categories: SgtStatCategory[] = [];
  for (const [key, rawRows] of Object.entries(source)) {
    const rows = sgtExtractRows(rawRows, ["stats", "results", "leaders", "rows"]);
    if (!rows.length) continue;
    const definition = STAT_DEFINITIONS[key] ?? fallbackStatDefinition(key, rows);
    const valueKey = [key, ...definition.valueKeys].find((candidate) =>
      rows.some((entry) => sgtNumber(entry[candidate]) !== null),
    );
    if (!valueKey) continue;
    const entries = rows
      .map((entry): SgtStatEntry | null => {
        const statValue = sgtNumber(entry[valueKey]);
        if (statValue === null) return null;
        return {
          name: sgtPlayerName(entry),
          value: statValue,
          average: sgtNumber(
            sgtFirst(entry, ["tourAverage", "tour_average", "field_average"]),
          ),
        };
      })
      .filter((entry): entry is SgtStatEntry => entry !== null)
      .toSorted((a, b) =>
        definition.lowerIsBetter ? a.value - b.value : b.value - a.value,
      );
    if (!entries.length) continue;
    categories.push({
      key,
      label: definition.label,
      shortLabel: definition.shortLabel,
      description: definition.description,
      unit: definition.unit,
      precision: definition.precision,
      signed: definition.signed,
      entries,
    });
  }
  return categories.toSorted((a, b) => a.label.localeCompare(b.label));
}

function fallbackStatDefinition(key: string, rows: SgtRow[]): StatDefinition {
  const valueKeys = [...new Set(rows.flatMap((entry) => Object.keys(entry)))].filter(
    (candidate) =>
      !IDENTITY_KEYS.has(candidate.toLowerCase()) &&
      rows.some((entry) => sgtNumber(entry[candidate]) !== null),
  );
  const label = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const percent = /accuracy|percent|pct|save|scrambl/i.test(key);
  const proximity = /prox|closest/i.test(key);
  const strokesGained = /^(sg|strokesGained)/i.test(key);
  return {
    label,
    shortLabel: label,
    description: "Official statistic supplied by SGT.",
    valueKeys,
    unit: percent ? "%" : proximity ? "ft" : "",
    precision: strokesGained ? 2 : 1,
    signed: strokesGained,
    lowerIsBetter: proximity,
  };
}

export function formatSgtToPar(value: number | null) {
  if (value === null) return "—";
  if (value === 0) return "E";
  return value > 0 ? `+${value}` : String(value);
}

export function formatSgtStatValue(
  value: number,
  category: Pick<SgtStatCategory, "precision" | "signed" | "unit">,
) {
  const formatted = value.toLocaleString("en-AU", {
    minimumFractionDigits: category.precision,
    maximumFractionDigits: category.precision,
    signDisplay: category.signed ? "exceptZero" : "auto",
  });
  return `${formatted}${category.unit}`;
}
