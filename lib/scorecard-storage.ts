export const SCORECARD_DRAFT_STORAGE_KEY = "cgs-scorecard-studio-draft-v1";

export type ScorecardHoleSnapshot = {
  distance: string;
  par: string;
  score: string;
};

export type ScorecardHandicapMode = "standard" | "ambrose" | "playing";
export type ScorecardAmbroseTeamSize = "2" | "3" | "4" | "custom";

export type ScorecardHandicapOptions = {
  mode?: ScorecardHandicapMode;
  allowancePercent?: string | number;
};

export type ScorecardHandicapAllocation = {
  playingHandicap: number | null;
  allocatedStrokes: number | null;
  strokes: Array<number | null>;
  netScores: Array<number | null>;
};

export type ScorecardDraftSnapshot = {
  teamName: string;
  courseName: string;
  handicap: string;
  handicapMode: ScorecardHandicapMode;
  handicapAllowance: string;
  ambroseTeamSize: ScorecardAmbroseTeamSize;
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

function roundToTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function readHandicapMode(value: unknown): ScorecardHandicapMode {
  return value === "ambrose" || value === "playing" ? value : "standard";
}

function readAmbroseTeamSize(value: unknown): ScorecardAmbroseTeamSize {
  return value === "2" || value === "3" || value === "custom" ? value : "4";
}

export function getScorecardHandicapAllocation(
  holes: ScorecardHoleSnapshot[],
  handicapValue: string,
  options: ScorecardHandicapOptions = {}
): ScorecardHandicapAllocation {
  const handicap = toNumber(handicapValue);
  const activeHoles = holes
    .map((hole, index) => ({ hole, index }))
    .filter(({ hole }) => Boolean(hole.score.trim()));
  const mode = options.mode ?? "standard";
  const allowancePercent =
    typeof options.allowancePercent === "number"
      ? options.allowancePercent
      : toNumber(options.allowancePercent ?? "");
  let playingHandicap: number | null = null;

  if (handicap !== null && activeHoles.length > 0) {
    if (mode === "playing") {
      playingHandicap = Math.max(0, roundToTwo(handicap));
    } else if (mode === "ambrose") {
      playingHandicap = Math.max(
        0,
        roundToTwo(
          handicap *
            Math.max(0, allowancePercent ?? 0) /
            100 *
            activeHoles.length /
            18
        )
      );
    } else {
      playingHandicap = Math.max(
        0,
        Math.round((handicap * activeHoles.length) / 18)
      );
    }
  }

  if (playingHandicap === null) {
    return {
      playingHandicap: null,
      allocatedStrokes: null,
      strokes: holes.map(() => null),
      netScores: holes.map(() => null),
    };
  }

  const allocatedStrokes = Math.max(0, Math.round(playingHandicap));

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

  const baseStrokes = Math.floor(allocatedStrokes / activeHoles.length);
  const extraStrokes = allocatedStrokes % activeHoles.length;
  const strokes: Array<number | null> = holes.map(() => null);

  activeHoles.forEach(({ index }) => {
    strokes[index] = baseStrokes;
  });

  difficultyOrder.slice(0, extraStrokes).forEach(({ index }) => {
    strokes[index] = (strokes[index] ?? 0) + 1;
  });

  return {
    playingHandicap,
    allocatedStrokes,
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
      handicapMode: readHandicapMode(parsed.handicapMode),
      handicapAllowance: readString(parsed.handicapAllowance) || "12.5",
      ambroseTeamSize: readAmbroseTeamSize(parsed.ambroseTeamSize),
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
