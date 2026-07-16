"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import type { ScoreboardAdminActionState } from "@/app/clubhouse-admin/scoreboard/actions";
import { createCompetitionScoreEntryAction } from "@/app/clubhouse-admin/scoreboard/actions";
import { getScoreNoun, type LeaderboardMode } from "@/lib/scoreboards";

type ScoreEntryComposerProps = {
  competitionId: number;
  competitionSlug: string;
  leaderboardMode: LeaderboardMode;
};

const initialScoreboardAdminActionState: ScoreboardAdminActionState = {
  message: "",
};

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full border-0 disabled:opacity-70"
    >
      {pending ? "Saving..." : "Add player row"}
    </button>
  );
}

export default function ScoreEntryComposer({
  competitionId,
  competitionSlug,
  leaderboardMode,
}: ScoreEntryComposerProps) {
  const [state, formAction] = useActionState(
    createCompetitionScoreEntryAction,
    initialScoreboardAdminActionState
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message === "Score row saved and pushed into the live board.") {
      formRef.current?.reset();
    }
  }, [state.message]);

  return (
    <form ref={formRef} action={formAction} className="mt-5 space-y-4">
      <input type="hidden" name="competition_id" value={competitionId} />
      <input type="hidden" name="competition_slug" value={competitionSlug} />
      <input type="hidden" name="leaderboard_mode" value={leaderboardMode} />

      <div className="grid gap-4 md:grid-cols-[0.56fr_0.2fr_0.24fr]">
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-zinc-500">
            Team / player
          </label>
          <input
            type="text"
            name="player_name"
            className="field-control"
            placeholder="Team name"
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-zinc-500">
            {getScoreNoun(leaderboardMode)}
          </label>
          <input
            type="number"
            step="0.1"
            name="score_value"
            className="field-control"
            placeholder={leaderboardMode === "points" ? "32" : "-2"}
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-zinc-500">
            Through
          </label>
          <input
            type="text"
            name="thru_label"
            className="field-control"
            placeholder="16 holes"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-black/18 px-4 py-4 text-sm text-zinc-300">
          <input
            type="checkbox"
            name="is_cgs_member"
            className="h-4 w-4 accent-[var(--gold)]"
          />
          Show the CGS logo next to this player.
        </label>

        <div className="rounded-[1rem] border border-white/8 bg-black/12 px-4 py-4 text-sm leading-7 text-zinc-400">
          Positions are automatic now. If you want to show a handicap, include it in
          the player name you type here.
        </div>
      </div>

      <SaveButton />

      {state.message ? (
        <p className="text-center text-sm leading-7 text-zinc-400">{state.message}</p>
      ) : null}
    </form>
  );
}
