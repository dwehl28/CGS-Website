import type { Database } from "brackets-manager";

export type DoubleEliminationData = Database;
export type DoubleEliminationMatch = Database["match"][number];

export type DoubleEliminationBracket = {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  participantCount: number;
  isPublished: boolean;
  isLive: boolean;
  bracketData: DoubleEliminationData;
  updatedAt: string;
  createdAt: string;
};

export type BracketSectionKey = "upper" | "lower" | "final";

export type BracketRoundView = {
  id: number | string;
  number: number;
  label: string;
  matches: DoubleEliminationMatch[];
};

export type BracketSectionView = {
  key: BracketSectionKey;
  label: string;
  rounds: BracketRoundView[];
};

export const BRACKET_MATCH_READY = 2;
export const BRACKET_MATCH_RUNNING = 3;
export const BRACKET_MATCH_COMPLETED = 4;

function sameId(left: number | string | null, right: number | string | null) {
  return String(left) === String(right);
}

export function getParticipantName(
  data: DoubleEliminationData,
  participantId: number | string | null | undefined
) {
  if (participantId === null || participantId === undefined) {
    return "TBD";
  }

  return (
    data.participant.find((participant) =>
      sameId(participant.id, participantId)
    )?.name || "TBD"
  );
}

export function getMatchWinnerId(match: DoubleEliminationMatch) {
  if (match.opponent1?.result === "win") {
    return match.opponent1.id;
  }

  if (match.opponent2?.result === "win") {
    return match.opponent2.id;
  }

  return null;
}

function getRoundLabel(
  section: BracketSectionKey,
  roundNumber: number,
  roundCount: number
) {
  if (section === "final") {
    return roundNumber === 1 ? "Grand Final" : "Reset Final";
  }

  if (roundNumber === roundCount) {
    return section === "upper" ? "Upper Final" : "Lower Final";
  }

  return `${section === "upper" ? "Upper" : "Lower"} R${roundNumber}`;
}

export function getBracketSections(
  data: DoubleEliminationData
): BracketSectionView[] {
  const sectionDefinitions: Array<{
    key: BracketSectionKey;
    label: string;
    groupNumber: number;
  }> = [
    { key: "upper", label: "Upper bracket", groupNumber: 1 },
    { key: "lower", label: "Lower bracket", groupNumber: 2 },
    { key: "final", label: "Finals", groupNumber: 3 },
  ];

  return sectionDefinitions.map((definition) => {
    const group = data.group.find(
      (candidate) => candidate.number === definition.groupNumber
    );
    const rounds = group
      ? data.round
          .filter((round) => sameId(round.group_id, group.id))
          .sort((left, right) => left.number - right.number)
      : [];

    return {
      key: definition.key,
      label: definition.label,
      rounds: rounds.map((round) => ({
        id: round.id,
        number: round.number,
        label: getRoundLabel(definition.key, round.number, rounds.length),
        matches: data.match
          .filter((match) => sameId(match.round_id, round.id))
          .sort((left, right) => left.number - right.number),
      })),
    };
  });
}

export function getBracketChampion(data: DoubleEliminationData) {
  const finalSection = getBracketSections(data).find(
    (section) => section.key === "final"
  );
  const finalMatches =
    finalSection?.rounds.flatMap((round) => round.matches).reverse() ?? [];
  const completedFinal = finalMatches.find(
    (match) =>
      match.status === BRACKET_MATCH_COMPLETED && getMatchWinnerId(match) !== null
  );
  const winnerId = completedFinal ? getMatchWinnerId(completedFinal) : null;

  return winnerId === null ? null : getParticipantName(data, winnerId);
}

export function isActionableMatch(match: DoubleEliminationMatch) {
  return (
    (match.status === BRACKET_MATCH_READY ||
      match.status === BRACKET_MATCH_RUNNING) &&
    match.opponent1?.id !== null &&
    match.opponent1?.id !== undefined &&
    match.opponent2?.id !== null &&
    match.opponent2?.id !== undefined
  );
}
