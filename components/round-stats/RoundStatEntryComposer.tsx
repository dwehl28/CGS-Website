"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { RoundStatsAdminActionState } from "@/app/clubhouse-admin/round-stats/actions";
import { updateRoundStatEntryAction } from "@/app/clubhouse-admin/round-stats/actions";
import type { RoundStatRound } from "@/lib/round-stats";

type RoundStatEntryComposerProps = {
  round: RoundStatRound;
};

const initialRoundStatsAdminActionState: RoundStatsAdminActionState = {
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
      {pending ? "Saving stats..." : "Save hole stats"}
    </button>
  );
}

function getInputValue(value: number | null) {
  return value === null ? "" : value.toString();
}

function getPlayerOptions(players: string[], currentPlayer: string | null) {
  const optionSet = new Set(players);

  if (currentPlayer) {
    optionSet.add(currentPlayer);
  }

  return [...optionSet];
}

export default function RoundStatEntryComposer({
  round,
}: RoundStatEntryComposerProps) {
  const [state, formAction] = useActionState(
    updateRoundStatEntryAction,
    initialRoundStatsAdminActionState
  );
  const [selectedTeamId, setSelectedTeamId] = useState(
    round.teams[0]?.id.toString() ?? ""
  );
  const [selectedHoleId, setSelectedHoleId] = useState(
    round.holes[0]?.id.toString() ?? ""
  );
  const selectedTeam = round.teams.find(
    (team) => team.id.toString() === selectedTeamId
  );
  const selectedHole = round.holes.find(
    (hole) => hole.id.toString() === selectedHoleId
  );
  const selectedEntry = round.entries.find(
    (entry) =>
      entry.teamId.toString() === selectedTeamId &&
      entry.holeId.toString() === selectedHoleId
  );
  const fieldKey = `${selectedTeamId}-${selectedHoleId}-${selectedEntry?.id ?? "new"}`;
  const driveOptions = getPlayerOptions(
    selectedTeam?.players ?? [],
    selectedEntry?.drivePlayer ?? null
  );
  const approachOptions = getPlayerOptions(
    selectedTeam?.players ?? [],
    selectedEntry?.approachPlayer ?? null
  );
  const puttOptions = getPlayerOptions(
    selectedTeam?.players ?? [],
    selectedEntry?.puttPlayer ?? null
  );

  return (
    <form action={formAction} className="round-stat-entry-form">
      <input type="hidden" name="round_id" value={round.id} />
      <input type="hidden" name="round_slug" value={round.slug} />

      <div className="round-stat-input-grid">
        <div>
          <label className="field-label" htmlFor="round-stat-team">
            Team
          </label>
          <select
            id="round-stat-team"
            name="team_id"
            className="field-control"
            value={selectedTeamId}
            onChange={(event) => setSelectedTeamId(event.target.value)}
            required
          >
            {round.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="round-stat-hole">
            Hole
          </label>
          <select
            id="round-stat-hole"
            name="hole_id"
            className="field-control"
            value={selectedHoleId}
            onChange={(event) => setSelectedHoleId(event.target.value)}
            required
          >
            {round.holes.map((hole) => (
              <option key={hole.id} value={hole.id}>
                {hole.holeLabel}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div key={fieldKey} className="round-stat-entry-card">
        <div className="round-stat-entry-heading">
          <div>
            <p className="round-stat-kicker">Hole input</p>
            <h3>
              {selectedTeam?.name ?? "Team"} | {selectedHole?.holeLabel ?? "Hole"}
            </h3>
            <span>
              Existing data: {selectedEntry ? "loaded for editing" : "new entry"}
            </span>
          </div>
          <strong>{selectedEntry?.scoreLabel ?? "--"}</strong>
        </div>

        <div className="round-stat-input-grid round-stat-input-grid-four">
          <div>
            <label className="field-label" htmlFor="score-to-par">
              Score to par
            </label>
            <input
              id="score-to-par"
              type="number"
              step="1"
              name="score_to_par"
              className="field-control"
              defaultValue={getInputValue(selectedEntry?.scoreToPar ?? null)}
              placeholder="-1, 0, +1"
              required
            />
          </div>

          <div>
            <label className="field-label" htmlFor="putts">
              Putts
            </label>
            <input
              id="putts"
              type="number"
              step="1"
              min="0"
              name="putts"
              className="field-control"
              defaultValue={getInputValue(selectedEntry?.putts ?? null)}
              placeholder="2"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="penalties">
              Penalties
            </label>
            <input
              id="penalties"
              type="number"
              step="1"
              min="0"
              name="penalties"
              className="field-control"
              defaultValue={selectedEntry?.penalties ?? 0}
            />
          </div>

          <div>
            <label className="field-label">Hole status</label>
            <div className="round-stat-mini-status">
              {selectedEntry ? "Editing saved hole" : "Ready for first save"}
            </div>
          </div>
        </div>

        <div className="round-stat-input-grid">
          <fieldset className="round-stat-radio-card">
            <legend>Fairway hit</legend>
            <label>
              <input
                type="radio"
                name="fairway_hit"
                value="yes"
                defaultChecked={selectedEntry?.fairwayHit === true}
              />
              Yes
            </label>
            <label>
              <input
                type="radio"
                name="fairway_hit"
                value="no"
                defaultChecked={selectedEntry?.fairwayHit === false}
              />
              No
            </label>
            <label>
              <input
                type="radio"
                name="fairway_hit"
                value=""
                defaultChecked={selectedEntry?.fairwayHit === null || !selectedEntry}
              />
              N/A
            </label>
          </fieldset>

          <fieldset className="round-stat-radio-card">
            <legend>Green in regulation</legend>
            <label>
              <input
                type="radio"
                name="green_in_regulation"
                value="yes"
                defaultChecked={selectedEntry?.greenInRegulation === true}
              />
              Yes
            </label>
            <label>
              <input
                type="radio"
                name="green_in_regulation"
                value="no"
                defaultChecked={selectedEntry?.greenInRegulation === false}
              />
              No
            </label>
            <label>
              <input
                type="radio"
                name="green_in_regulation"
                value=""
                defaultChecked={
                  selectedEntry?.greenInRegulation === null || !selectedEntry
                }
              />
              N/A
            </label>
          </fieldset>
        </div>

        <div className="round-stat-input-grid round-stat-input-grid-three">
          <div>
            <label className="field-label" htmlFor="drive-player">
              Drive used
            </label>
            <select
              id="drive-player"
              name="drive_player"
              className="field-control"
              defaultValue={selectedEntry?.drivePlayer ?? ""}
            >
              <option value="">Not captured</option>
              {driveOptions.map((player) => (
                <option key={player} value={player}>
                  {player}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="approach-player">
              Approach used
            </label>
            <select
              id="approach-player"
              name="approach_player"
              className="field-control"
              defaultValue={selectedEntry?.approachPlayer ?? ""}
            >
              <option value="">Not captured</option>
              {approachOptions.map((player) => (
                <option key={player} value={player}>
                  {player}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="putt-player">
              Putt made / key putt
            </label>
            <select
              id="putt-player"
              name="putt_player"
              className="field-control"
              defaultValue={selectedEntry?.puttPlayer ?? ""}
            >
              <option value="">Not captured</option>
              {puttOptions.map((player) => (
                <option key={player} value={player}>
                  {player}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="stat-notes">
            Notes
          </label>
          <textarea
            id="stat-notes"
            name="notes"
            className="field-control"
            rows={3}
            defaultValue={selectedEntry?.notes ?? ""}
            placeholder="Example: used aggressive line, penalty recovery, clutch putt."
          />
        </div>

        <SaveButton />
      </div>

      {state.message ? (
        <p className="round-stat-form-message">{state.message}</p>
      ) : null}
    </form>
  );
}
