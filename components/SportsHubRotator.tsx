"use client";

import { useEffect, useState } from "react";

import type { LeagueSnapshot, LeagueStandingRow } from "@/lib/live-sports";

type SportsHubRotatorProps = {
  snapshots: LeagueSnapshot[];
  updatedAtLabel: string;
  sourceLabel: string;
};

const views = [
  {
    key: "fixtures",
    label: "Fixtures",
    heading: "Upcoming fixtures",
    description: "What is coming up next across the leagues CGS follows.",
  },
  {
    key: "results",
    label: "Results",
    heading: "Latest results",
    description: "The most recent completed event from each competition.",
  },
  {
    key: "ladder",
    label: "Ladder",
    heading: "Live ladder",
    description: "CGS-calculated standings where the league format supports it.",
  },
] as const;

type ViewKey = (typeof views)[number]["key"];

function renderFixture(snapshot: LeagueSnapshot) {
  if (!snapshot.nextEvent) {
    return (
      <p className="mt-3 text-sm text-zinc-500">
        Live fixture data is unavailable right now. Refresh again shortly.
      </p>
    );
  }

  return (
    <>
      <h3 className="mt-2 text-xl font-semibold">{snapshot.nextEvent.title}</h3>
      <p className="mt-2 text-sm text-zinc-400">{snapshot.nextEvent.subtitle}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-sm text-zinc-200">
        <span className="rounded-full border border-white/8 bg-white/6 px-3 py-1">
          {snapshot.nextEvent.when}
        </span>
        <span className="rounded-full border border-white/8 bg-white/6 px-3 py-1">
          {snapshot.nextEvent.venue}
        </span>
        <span className="rounded-full border border-white/8 bg-white/6 px-3 py-1">
          {snapshot.nextEvent.status}
        </span>
      </div>
    </>
  );
}

function renderResult(snapshot: LeagueSnapshot) {
  if (!snapshot.lastEvent) {
    return (
      <p className="mt-3 text-sm text-zinc-500">
        No recent result is available from the feed right now.
      </p>
    );
  }

  return (
    <>
      <h3 className="mt-2 text-xl font-semibold">{snapshot.lastEvent.title}</h3>
      <p className="mt-2 text-sm text-zinc-400">{snapshot.lastEvent.subtitle}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-sm text-zinc-200">
        <span className="rounded-full border border-white/8 bg-white/6 px-3 py-1">
          {snapshot.lastEvent.when}
        </span>
        <span className="rounded-full border border-white/8 bg-white/6 px-3 py-1">
          {snapshot.lastEvent.venue}
        </span>
        <span className="rounded-full border border-white/8 bg-white/6 px-3 py-1">
          {snapshot.lastEvent.status}
        </span>
        {snapshot.lastEvent.score ? (
          <span className="rounded-full border border-[rgba(92,210,255,0.2)] bg-[rgba(92,210,255,0.12)] px-3 py-1 font-semibold text-[var(--accent)]">
            Score: {snapshot.lastEvent.score}
          </span>
        ) : null}
      </div>
    </>
  );
}

function formatDifferential(value: number | null) {
  if (value === null) {
    return "--";
  }

  if (value === 0) {
    return "0";
  }

  return `${value > 0 ? "+" : ""}${value}`;
}

function renderTeamCell(row: LeagueStandingRow) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {row.badge ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.badge}
          alt=""
          className="h-6 w-6 rounded-full bg-white/90 object-contain p-0.5"
        />
      ) : (
        <span className="h-6 w-6 rounded-full border border-white/8 bg-white/6" />
      )}
      <span className="truncate text-white">{row.teamDisplayName}</span>
    </div>
  );
}

function renderLadderTable(snapshot: LeagueSnapshot) {
  const isAfl = snapshot.standingsVariant === "afl";

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
        <span className="rounded-full border border-[rgba(92,210,255,0.2)] bg-[rgba(92,210,255,0.1)] px-3 py-1 text-[var(--accent)]">
          CGS calculated
        </span>
        {snapshot.standingsSummary ? <span>{snapshot.standingsSummary}</span> : null}
      </div>

      <div className="mt-4 overflow-hidden rounded-[1.35rem] border border-white/8 bg-black/18">
        <div className="max-h-[24rem] overflow-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-[rgba(5,10,18,0.94)] text-[11px] uppercase tracking-[0.18em] text-zinc-500 backdrop-blur">
              <tr>
                <th className="px-3 py-3">#</th>
                <th className="px-3 py-3">Team</th>
                <th className="px-3 py-3">P</th>
                <th className="px-3 py-3">W</th>
                <th className="px-3 py-3">L</th>
                <th className="px-3 py-3">D</th>
                {!isAfl ? <th className="px-3 py-3">B</th> : null}
                <th className="px-3 py-3">{isAfl ? "%" : "+/-"}</th>
                <th className="px-3 py-3">Pts</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.standingsRows.map((row) => (
                <tr
                  key={row.teamId}
                  className={`border-t border-white/8 ${
                    row.position <= 8 ? "bg-[rgba(92,210,255,0.05)]" : "bg-transparent"
                  }`}
                >
                  <td className="px-3 py-3 font-semibold text-white">{row.position}</td>
                  <td className="px-3 py-3">{renderTeamCell(row)}</td>
                  <td className="px-3 py-3 text-zinc-300">{row.played}</td>
                  <td className="px-3 py-3 text-zinc-300">{row.wins}</td>
                  <td className="px-3 py-3 text-zinc-300">{row.losses}</td>
                  <td className="px-3 py-3 text-zinc-300">{row.draws}</td>
                  {!isAfl ? <td className="px-3 py-3 text-zinc-300">{row.byes}</td> : null}
                  <td className="px-3 py-3 text-zinc-300">
                    {isAfl ? (row.percentage?.toFixed(1) ?? "--") : formatDifferential(row.differential)}
                  </td>
                  <td className="px-3 py-3 font-semibold text-[var(--tan)]">
                    {row.ladderPoints}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function renderLadder(snapshot: LeagueSnapshot) {
  if (snapshot.standingsRows.length > 0) {
    return renderLadderTable(snapshot);
  }

  return (
    <div className="mt-3 rounded-2xl border border-dashed border-white/12 bg-black/18 p-4">
      <p className="text-sm leading-7 text-zinc-400">{snapshot.standingsMessage}</p>
    </div>
  );
}

export default function SportsHubRotator({
  snapshots,
  updatedAtLabel,
  sourceLabel,
}: SportsHubRotatorProps) {
  const [activeView, setActiveView] = useState<ViewKey>("fixtures");
  const [isAutoRotateEnabled, setIsAutoRotateEnabled] = useState(true);

  useEffect(() => {
    if (!isAutoRotateEnabled) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveView((current) => {
        const currentIndex = views.findIndex((view) => view.key === current);
        const nextIndex = (currentIndex + 1) % views.length;
        return views[nextIndex].key;
      });
    }, 7000);

    return () => window.clearInterval(timer);
  }, [isAutoRotateEnabled]);

  const currentView = views.find((view) => view.key === activeView) ?? views[0];

  return (
    <div className="panel rounded-[2rem] p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            Rotating feed
          </p>
          <h2 className="mt-2 text-3xl">{currentView.heading}</h2>
          <p className="mt-2 max-w-2xl text-zinc-400">{currentView.description}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <span className="chip text-zinc-100">Updated {updatedAtLabel}</span>
            <span className="chip text-zinc-100">Source: {sourceLabel}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {views.map((view) => (
            <button
              key={view.key}
              type="button"
              onClick={() => setActiveView(view.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                view.key === activeView
                  ? "bg-[var(--gold)] text-slate-950"
                  : "border border-white/12 bg-white/6 text-white"
              }`}
            >
              {view.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIsAutoRotateEnabled((current) => !current)}
            className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-semibold text-white"
            aria-pressed={isAutoRotateEnabled}
          >
            {isAutoRotateEnabled ? "Pause rotation" : "Resume rotation"}
          </button>
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        {views.map((view) => (
          <span
            key={view.key}
            className={`signal-line h-1 rounded-full ${
              view.key === activeView
                ? "w-[4.5rem] bg-[var(--gold)]"
                : "w-8 bg-white/10"
            }`}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {snapshots.map((snapshot, index) => (
          <div
            key={snapshot.key}
            className="interactive-card rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(8,12,27,0.88),rgba(5,8,20,0.7))] p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                  {snapshot.label}
                </p>
                <h3 className="mt-2 text-2xl">{snapshot.title}</h3>
              </div>
              <span className="rounded-full border border-white/8 bg-white/6 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-400">
                0{index + 1}
              </span>
            </div>

            <p className="mt-3 text-sm leading-7 text-zinc-400">
              {snapshot.description}
            </p>

            {activeView === "fixtures" && renderFixture(snapshot)}
            {activeView === "results" && renderResult(snapshot)}
            {activeView === "ladder" && renderLadder(snapshot)}
          </div>
        ))}
      </div>
    </div>
  );
}
