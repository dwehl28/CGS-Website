export const SCORECARD_DRAFT_STORAGE_KEY = "cgs-scorecard-studio-draft-v1";

export type ScorecardDraftSnapshot = {
  teamName: string;
  courseName: string;
  handicap: string;
  grossScore: string;
  netScore: string;
  roundDate: string;
  roundLabel: string;
  distanceUnit: "m" | "yd";
  holes: Array<{
    distance: string;
    par: string;
    score: string;
  }>;
};

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
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
