"use client";

import { useEffect, useRef, useState } from "react";

import type {
  CompetitionScoreboard,
  LeaderboardMode,
} from "@/lib/scoreboards";

export type ScoreChangeSpotlightData = {
  key: string;
  entryId: number;
  playerName: string;
  photoUrl: string;
  previousScoreLabel: string;
  nextScoreLabel: string;
  changeLabel: string;
  thruLabel: string;
};

type EntryScoreSnapshot = {
  scoreValue: number | null;
  scoreLabel: string;
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

function createSnapshotMap(competition: CompetitionScoreboard) {
  return new Map<number, EntryScoreSnapshot>(
    competition.entries.map((entry) => [
      entry.id,
      {
        scoreValue: entry.scoreValue,
        scoreLabel: entry.scoreLabel,
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
              updatedAt: entry.updatedAt,
            }
          : previous
      );

      if (
        !previous ||
        !isCurrentSnapshot ||
        previous.scoreValue === null ||
        entry.scoreValue === null ||
        previous.scoreValue === entry.scoreValue
      ) {
        return;
      }

      candidates.push({
        key: `${entry.id}-${entry.updatedAt}`,
        entryId: entry.id,
        playerName: entry.playerName,
        photoUrl: entry.photoUrl,
        previousScoreLabel: previous.scoreLabel,
        nextScoreLabel: entry.scoreLabel,
        changeLabel: getChangeLabel(
          previous.scoreValue,
          entry.scoreValue,
          nextCompetition.leaderboardMode
        ),
        thruLabel: entry.thruLabel ?? "Live round",
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
      entryId: selectedChange.entryId,
      playerName: selectedChange.playerName,
      photoUrl: selectedChange.photoUrl,
      previousScoreLabel: selectedChange.previousScoreLabel,
      nextScoreLabel: selectedChange.nextScoreLabel,
      changeLabel: selectedChange.changeLabel,
      thruLabel: selectedChange.thruLabel,
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
