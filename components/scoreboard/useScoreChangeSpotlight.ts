"use client";

import { useEffect, useRef, useState } from "react";

import type {
  CompetitionScoreboard,
  LeaderboardMode,
} from "@/lib/scoreboards";

export type ScoreChangeSpotlightData = {
  key: string;
  kind: "score" | "through";
  entryId: number;
  playerName: string;
  photoUrl: string;
  previousValueLabel: string;
  nextValueLabel: string;
  changeLabel: string;
  contextLabel: string;
};

type EntryScoreSnapshot = {
  scoreValue: number | null;
  scoreLabel: string;
  thruLabel: string | null;
  updatedAt: string;
};

const SCORE_SPOTLIGHT_DISPLAY_MS = 6000;
const SCORE_SPOTLIGHT_COOLDOWN_MS = 18000;

function getUpdatedTime(value: string) {
  const updatedTime = Date.parse(value);
  return Number.isNaN(updatedTime) ? 0 : updatedTime;
}

function getChangeLabel(
  previousScore: number,
  nextScore: number,
  leaderboardMode: LeaderboardMode
) {
  const improved =
    leaderboardMode === "points"
      ? nextScore > previousScore
      : nextScore < previousScore;

  return improved ? "Score improved" : "Score updated";
}

function normalizeThroughLabel(value: string | null) {
  return value?.trim() || null;
}

function getThroughChangeLabel(previousValue: string | null, nextValue: string | null) {
  const previousHole = Number(previousValue?.match(/\d+/)?.[0]);
  const nextHole = Number(nextValue?.match(/\d+/)?.[0]);

  if (Number.isFinite(previousHole) && Number.isFinite(nextHole)) {
    return nextHole > previousHole
      ? "Round progress advanced"
      : "Hole count corrected";
  }

  return "Round progress updated";
}

function createSnapshotMap(competition: CompetitionScoreboard) {
  return new Map<number, EntryScoreSnapshot>(
    competition.entries.map((entry) => [
      entry.id,
      {
        scoreValue: entry.scoreValue,
        scoreLabel: entry.scoreLabel,
        thruLabel: normalizeThroughLabel(entry.thruLabel),
        updatedAt: entry.updatedAt,
      },
    ])
  );
}

export function useScoreChangeSpotlight(
  initialCompetition: CompetitionScoreboard
) {
  const [spotlight, setSpotlight] =
    useState<ScoreChangeSpotlightData | null>(null);
  const scoreSnapshotsRef = useRef(createSnapshotMap(initialCompetition));
  const activeRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const dismissTimerRef = useRef<number | null>(null);

  function observeCompetition(nextCompetition: CompetitionScoreboard) {
    const previousSnapshots = scoreSnapshotsRef.current;
    const nextSnapshots = new Map<number, EntryScoreSnapshot>();
    const candidates: Array<ScoreChangeSpotlightData & { updatedTime: number }> = [];

    nextCompetition.entries.forEach((entry) => {
      const previous = previousSnapshots.get(entry.id);
      const entryUpdatedTime = getUpdatedTime(entry.updatedAt);
      const previousUpdatedTime = previous ? getUpdatedTime(previous.updatedAt) : 0;
      const isCurrentSnapshot = !previous || entryUpdatedTime >= previousUpdatedTime;

      nextSnapshots.set(
        entry.id,
        isCurrentSnapshot
          ? {
              scoreValue: entry.scoreValue,
              scoreLabel: entry.scoreLabel,
              thruLabel: normalizeThroughLabel(entry.thruLabel),
              updatedAt: entry.updatedAt,
            }
          : previous
      );

      if (
        !previous ||
        !isCurrentSnapshot
      ) {
        return;
      }

      if (
        previous.scoreValue !== null &&
        entry.scoreValue !== null &&
        previous.scoreValue !== entry.scoreValue
      ) {
        candidates.push({
          key: `${entry.id}-score-${entry.updatedAt}`,
          kind: "score",
          entryId: entry.id,
          playerName: entry.playerName,
          photoUrl: entry.photoUrl,
          previousValueLabel: previous.scoreLabel,
          nextValueLabel: entry.scoreLabel,
          changeLabel: getChangeLabel(
            previous.scoreValue,
            entry.scoreValue,
            nextCompetition.leaderboardMode
          ),
          contextLabel: entry.thruLabel ?? "Live round",
          updatedTime: entryUpdatedTime,
        });
        return;
      }

      const previousThrough = normalizeThroughLabel(previous.thruLabel);
      const nextThrough = normalizeThroughLabel(entry.thruLabel);

      if (previousThrough === nextThrough) {
        return;
      }

      candidates.push({
        key: `${entry.id}-through-${entry.updatedAt}`,
        kind: "through",
        entryId: entry.id,
        playerName: entry.playerName,
        photoUrl: entry.photoUrl,
        previousValueLabel: previousThrough ?? "Start",
        nextValueLabel: nextThrough ?? "Start",
        changeLabel: getThroughChangeLabel(previousThrough, nextThrough),
        contextLabel: `Current score ${entry.scoreLabel}`,
        updatedTime: entryUpdatedTime,
      });
    });

    scoreSnapshotsRef.current = nextSnapshots;

    if (
      candidates.length === 0 ||
      activeRef.current ||
      Date.now() < cooldownUntilRef.current
    ) {
      return null;
    }

    const selectedChange = candidates.sort(
      (left, right) => right.updatedTime - left.updatedTime
    )[0];
    const nextSpotlight: ScoreChangeSpotlightData = {
      key: selectedChange.key,
      kind: selectedChange.kind,
      entryId: selectedChange.entryId,
      playerName: selectedChange.playerName,
      photoUrl: selectedChange.photoUrl,
      previousValueLabel: selectedChange.previousValueLabel,
      nextValueLabel: selectedChange.nextValueLabel,
      changeLabel: selectedChange.changeLabel,
      contextLabel: selectedChange.contextLabel,
    };

    activeRef.current = true;
    cooldownUntilRef.current = Date.now() + SCORE_SPOTLIGHT_COOLDOWN_MS;
    setSpotlight(nextSpotlight);

    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
    }

    dismissTimerRef.current = window.setTimeout(() => {
      activeRef.current = false;
      setSpotlight(null);
      dismissTimerRef.current = null;
    }, SCORE_SPOTLIGHT_DISPLAY_MS);

    return nextSpotlight;
  }

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  return {
    spotlight,
    observeCompetition,
  };
}
