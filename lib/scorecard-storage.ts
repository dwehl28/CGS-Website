export const SCORECARD_DRAFT_STORAGE_KEY = "cgs-scorecard-studio-draft-v1";

export type ScorecardHoleSnapshot = {
  distance: string;
  par: string;
  score: string;
};

export type ScorecardHandicapAllocation = {
  playingHandicap: number | null;
  strokes: Array<number | null>;
  netScores: Array<number | null>;
};

export type ScorecardDraftSnapshot = {
  teamName: string;
  courseName: string;
  handicap: string;
  grossScore: string;
  netScore: string;
  roundDate: string;
  roundLabel: string;
  distanceUnit: "m" | "yd";
  holes: ScorecardHoleSnapshot[];
};

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function getScorecardHandicapAllocation(
  holes: ScorecardHoleSnapshot[],
  handicapValue: string
): ScorecardHandicapAllocation {
  const handicap = toNumber(handicapValue);
  const activeHoles = holes
    .map((hole, index) => ({ hole, index }))
    .filter(({ hole }) =>
      Boolean(hole.distance.trim() || hole.par.trim() || hole.score.trim())
    );
  const playingHandicap =
    handicap === null || activeHoles.length === 0
      ? null
      : Math.max(0, Math.round((handicap * activeHoles.length) / 18));

  if (playingHandicap === null) {
    return {
      playingHandicap: null,
      strokes: holes.map(() => null),
      netScores: holes.map(() => null),
    };
  }

  const difficultyOrder = activeHoles
    .map(({ hole, index }) => ({
      index,
      par: toNumber(hole.par) ?? 0,
      distance: toNumber(hole.distance) ?? 0,
    }))
    .sort((left, right) => {
      if (right.par !== left.par) {
        return right.par - left.par;
      }

      if (right.distance !== left.distance) {
        return right.distance - left.distance;
      }

      return left.index - right.index;
    });

  const baseStrokes = Math.floor(playingHandicap / activeHoles.length);
  const extraStrokes = playingHandicap % activeHoles.length;
  const strokes: Array<number | null> = holes.map(() => null);

  activeHoles.forEach(({ index }) => {
    strokes[index] = baseStrokes;
  });

  difficultyOrder.slice(0, extraStrokes).forEach(({ index }) => {
    strokes[index] = (strokes[index] ?? 0) + 1;
  });

  return {
    playingHandicap,
    strokes,
    netScores: holes.map((hole, index) => {
      const grossScore = toNumber(hole.score);
      const receivedStrokes = strokes[index];
      return grossScore === null || receivedStrokes === null
        ? null
        : grossScore - receivedStrokes;
    }),
  };
}

export function parseScorecardDraftSnapshot(
  rawValue: string
): ScorecardDraftSnapshot | null {
  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>;

    if (!Array.isArray(parsed.holes) || parsed.holes.length !== 18) {
      return null;
    }

    return {
      teamName: readString(parsed.teamName),
      courseName: readString(parsed.courseName),
      handicap: readString(parsed.handicap),
      grossScore: readString(parsed.grossScore),
      netScore: readString(parsed.netScore),
      roundDate: readString(parsed.roundDate),
      roundLabel: readString(parsed.roundLabel),
      distanceUnit: parsed.distanceUnit === "yd" ? "yd" : "m",
      holes: parsed.holes.map((hole) => {
        const candidate =
          typeof hole === "object" && hole !== null
            ? (hole as Record<string, unknown>)
            : {};

        return {
          distance: readString(candidate.distance),
          par: readString(candidate.par),
          score: readString(candidate.score),
        };
      }),
    };
  } catch {
    return null;
  }
}
