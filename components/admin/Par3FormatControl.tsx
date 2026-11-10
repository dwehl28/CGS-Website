"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  getPar3QualificationPlan,
  getPoolLabel,
  validatePar3Format,
  type Par3FinalsFormat,
} from "@/lib/par3-showdown-types";

type Props = {
  eventId: number;
  initialPoolSizes: number[];
  initialFinalsSize: number;
  initialFinalsFormat?: Par3FinalsFormat;
  assignedCounts: number[];
  activePlayerCount: number;
  locked: boolean;
  lockReason: string;
  finalsFormatLocked?: boolean;
  allocationLocked: boolean;
  previewOnly?: boolean;
  saveAction?: (data: FormData) => Promise<void>;
  allocateAction?: (data: FormData) => Promise<void>;
};

function Submit({ disabled, children }: { disabled: boolean; children: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled || pending}>
      {pending ? "Saving…" : children}
    </button>
  );
}

export default function Par3FormatControl(props: Props) {
  const savedFormatKey = JSON.stringify([
    props.eventId,
    props.initialPoolSizes,
    props.initialFinalsSize,
    props.initialFinalsFormat ?? "standard",
  ]);
  return <Par3FormatEditor key={savedFormatKey} {...props} />;
}

function Par3FormatEditor({
  eventId,
  initialPoolSizes,
  initialFinalsSize,
  initialFinalsFormat = "standard",
  assignedCounts,
  activePlayerCount,
  locked,
  lockReason,
  finalsFormatLocked = locked,
  allocationLocked,
  previewOnly = false,
  saveAction,
  allocateAction,
}: Props) {
  const [poolSizes, setPoolSizes] = useState(initialPoolSizes);
  const [defaultSize, setDefaultSize] = useState(initialPoolSizes[0] ?? 4);
  const [finalsSize, setFinalsSize] = useState(initialFinalsSize);
  const [finalsFormat, setFinalsFormat] = useState(initialFinalsFormat);
  const ctpBye = finalsFormat === "pool_winners_ctp_bye";
  let formatError = "";
  try {
    validatePar3Format({ poolSizes, finalsSize, finalsFormat });
  } catch (error) {
    formatError = error instanceof Error ? error.message : "Check the format.";
  }
  const capacity = poolSizes.reduce((total, size) => total + size, 0);
  const uniformPoolSize = poolSizes.every((size) => size === poolSizes[0]) ? String(poolSizes[0]) : "mixed";
  const matches = poolSizes.reduce((total, size) => total + (size * (size - 1)) / 2, 0);
  const plan = formatError
    ? null
    : getPar3QualificationPlan({
        poolCount: poolSizes.length,
        poolSize: Math.max(...poolSizes),
        poolSizes,
        finalsSize,
        finalsFormat,
      });
  const assignmentErrors = assignedCounts.flatMap((count, index) => {
    if (count > 0 && index >= poolSizes.length) {
      return [`Move the ${count} assigned player${count === 1 ? "" : "s"} out of ${getPoolLabel(index + 1)} before removing it.`];
    }
    return count > (poolSizes[index] ?? 0)
      ? [`${getPoolLabel(index + 1)} already has ${count} players. Move players before reducing its capacity.`]
      : [];
  });
  const errors = [
    ...(formatError ? [formatError] : []),
    ...assignmentErrors,
    ...(capacity < activePlayerCount ? [`There are ${activePlayerCount} active entrants; capacity cannot be lower than that.`] : []),
    ...(plan?.errors ?? []),
    ...(!previewOnly && ctpBye && activePlayerCount !== finalsSize - 1
      ? [`This CTP bye format needs exactly ${finalsSize - 1} active entrants for a ${finalsSize}-slot bracket. There are currently ${activePlayerCount}.`]
      : []),
  ];
  const structureChanged =
    finalsSize !== initialFinalsSize ||
    poolSizes.length !== initialPoolSizes.length ||
    poolSizes.some((size, index) => size !== initialPoolSizes[index]);
  const unsaved =
    structureChanged || finalsFormat !== initialFinalsFormat;
  const saveLocked = (locked && structureChanged) || (finalsFormatLocked && finalsFormat !== initialFinalsFormat);

  return (
    <div className="panel mt-6 p-6">
      <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Tournament format</p>
      <h3 className="mt-2 text-xl">Set the field. Preview the draw.</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
        Choose 1–16 pools, with 2–8 places in each and up to 64 players overall.
        Pools can have different capacities. Each player plays everyone else in
        their pool once; odd-sized pools include a bye each round.
      </p>
      {previewOnly ? <p className="mt-4 border p-3 text-sm" style={{ color: "#704b00", background: "#fff8dc", borderColor: "#caaa57" }}>Calculator preview — changes are not saved and no players or results are loaded.</p> : null}
      <form action={previewOnly ? undefined : saveAction} className="mt-5 space-y-5">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="pool_sizes" value={JSON.stringify(poolSizes)} />
        <input type="hidden" name="finals_size" value={finalsSize} />
        <input type="hidden" name="finals_format" value={finalsFormat} />
        {!previewOnly ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border p-4" role="status"
            style={{ color: unsaved ? "#704b00" : "#0b6675", background: unsaved ? "#fff8dc" : "#effafb", borderColor: unsaved ? "#caaa57" : "#b5d9de" }}>
            <p className="text-sm leading-6">
              <strong>{unsaved ? `Unsaved preview: ${poolSizes.length} pools.` : `Saved format: ${initialPoolSizes.length} pools.`}</strong>{" "}
              {unsaved
                ? `The live tournament still has ${initialPoolSizes.length} pools. Save to update player menus, pool tables and the finals format.`
                : "The player menus, pool tables and finals use this saved format."}
            </p>
            {unsaved ? <Submit disabled={saveLocked || errors.length > 0}>Save and update tournament</Submit> : null}
          </div>
        ) : null}
        <fieldset disabled={locked} className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="field-label" htmlFor="par3-pool-count">Number of pools</label>
            <select id="par3-pool-count" className="field-control" value={poolSizes.length}
              onChange={(event) => {
                const count = Number(event.target.value);
                setPoolSizes((current) => Array.from({ length: count }, (_, index) => current[index] ?? defaultSize));
              }}>
              {Array.from({ length: 16 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="par3-default-size">Places per pool</label>
            <select id="par3-default-size" className="field-control" value={uniformPoolSize} aria-describedby="par3-default-size-help"
              onChange={(event) => {
                const size = Number(event.target.value);
                setDefaultSize(size);
                setPoolSizes((current) => current.map(() => size));
              }}>
              {uniformPoolSize === "mixed" ? <option value="mixed" disabled>Mixed sizes</option> : null}
              {[2, 3, 4, 5, 6, 7, 8].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <p id="par3-default-size-help" className="mt-2 text-xs text-zinc-400">Sets every pool. Adjust individual pools below if needed.</p>
          </div>
          <div>
            <label className="field-label" htmlFor="par3-finals-size">Finals bracket size</label>
            <select id="par3-finals-size" className="field-control" value={finalsSize} onChange={(event) => setFinalsSize(Number(event.target.value))}>
              {[2, 4, 8, 16, 32, 64].map((size) => <option key={size} value={size}>{size} slots</option>)}
            </select>
          </div>
        </fieldset>
        <fieldset disabled={finalsFormatLocked} className="border border-cyan-300/20 bg-cyan-300/5 p-4">
          <label className="field-label" htmlFor="par3-finals-format">Finals qualification and CTP</label>
          <select id="par3-finals-format" className="field-control" value={finalsFormat}
            onChange={(event) => setFinalsFormat(event.target.value as Par3FinalsFormat)}>
            <option value="standard">Standard — pool qualifiers and CTP places</option>
            <option value="pool_winners_ctp_bye">Pool winners CTP for a bye — all entrants advance</option>
          </select>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            {ctpBye
              ? `All ${poolSizes.length} pool winners contest CTP. Its winner skips the opening round; the other ${finalsSize - 2} entrants play ${(finalsSize - 2) / 2} matches. This needs exactly ${finalsSize - 1} entrants.`
              : "Leading pool places qualify automatically. CTP fills any remaining finals places."}
          </p>
          {ctpBye && finalsSize === 16 ? <p className="mt-2 font-semibold" style={{ color: "#0b6675" }}>15 players → CTP winner into the quarter-finals + seven opening matches.</p> : null}
          {finalsFormatLocked ? <p className="mt-2 text-xs text-zinc-400">Clear the confirmed CTP selection before changing this setting. Generated finals lock the setting.</p> : null}
        </fieldset>
        <fieldset disabled={locked}>
          <legend className="field-label mb-3">Individual pool capacities</legend>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {poolSizes.map((size, index) => (
              <div key={index} className="border border-white/10 bg-white/5 p-3">
                <label className="field-label" htmlFor={`par3-capacity-${index}`}>{getPoolLabel(index + 1)}</label>
                <select id={`par3-capacity-${index}`} className="field-control" value={size}
                  onChange={(event) => setPoolSizes((current) => current.map((value, poolIndex) => poolIndex === index ? Number(event.target.value) : value))}>
                  {[2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count} places</option>)}
                </select>
                <p className="mt-2 text-xs text-zinc-400">{assignedCounts[index] ?? 0} currently assigned</p>
              </div>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm sm:grid-cols-3" aria-live="polite">
          <p><strong className="text-white">{capacity} places</strong><br /><span className="text-zinc-400">{activePlayerCount} active entrants</span></p>
          <p><strong className="text-white">{matches} pool matches at capacity</strong><br /><span className="text-zinc-400">Draw uses actual assigned players</span></p>
          <p><strong className="text-white">{ctpBye ? `${finalsSize - 1} finalists + 1 bye` : `${finalsSize} finalists`}</strong><br /><span className="text-zinc-400">{ctpBye ? `${poolSizes.length} pool winners in CTP / 1 opening-round bye` : plan ? `${plan.automaticPlaces} automatic places per pool + ${plan.ctpQualifierCount} CTP places` : "Check the format below"}</span></p>
        </div>
        {errors.length ? (
          <ul className="list-inside list-disc border p-4 text-sm" style={{ color: "#704b00", background: "#fff8dc", borderColor: "#caaa57" }} role="status">
            {[...new Set(errors)].map((error) => <li key={error}>{error}</li>)}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-sm text-zinc-400">
            {locked ? `${lockReason}${!finalsFormatLocked ? " You can still change the CTP format while keeping the same pools and bracket size." : ""}` : "Saving updates every pool selector, pool table and finals preview. Player assignments stay in place; allocate entrants and sync fixtures separately. Recorded and live matches are protected."}
          </p>
          <Submit disabled={previewOnly || saveLocked || errors.length > 0 || !unsaved}>Save tournament format</Submit>
        </div>
      </form>
      <form action={previewOnly ? undefined : allocateAction} className="mt-6 flex flex-wrap items-end gap-4 border-t border-white/10 pt-5">
        <input type="hidden" name="event_id" value={eventId} />
        <div className="min-w-0 flex-1">
          <label className="field-label" htmlFor="par3-allocation-method">Allocate active entrants to the saved pools</label>
          <select id="par3-allocation-method" name="method" className="field-control" disabled={allocationLocked || unsaved}>
            <option value="seeded">Seeded draw — spread entrant order across pools</option>
            <option value="random">Random draw — shuffle all active entrants</option>
          </select>
          <p className="mt-2 text-xs text-zinc-400">
            {unsaved ? "Save the format before allocating players." : allocationLocked ? "Automatic allocation is locked once a match is live, a result is recorded or finals exist." : "Replaces current pool assignments and unplayed fixtures. You can also assign entrants individually below."}
          </p>
        </div>
        <Submit disabled={previewOnly || allocationLocked || unsaved || activePlayerCount < initialPoolSizes.length * 2}>Allocate players</Submit>
      </form>
    </div>
  );
}
