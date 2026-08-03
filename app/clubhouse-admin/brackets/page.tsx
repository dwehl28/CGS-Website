import type { Metadata } from "next";
import Link from "next/link";

import {
  createDoubleEliminationBracketAction,
  recordDoubleEliminationWinnerAction,
  resetDoubleEliminationMatchAction,
  updateDoubleEliminationBracketAction,
} from "@/app/clubhouse-admin/brackets/actions";
import { logoutAdminAction } from "@/app/clubhouse-admin/actions";
import AdminShell, { AdminAccessState } from "@/components/admin/AdminShell";
import ClubhouseAdminLogin from "@/components/ClubhouseAdminLogin";
import {
  hasAdminSecretConfigured,
  isAdminAuthenticated,
} from "@/lib/admin-auth";
import { getAdminDoubleEliminationBrackets } from "@/lib/double-elimination";
import {
  BRACKET_MATCH_COMPLETED,
  getBracketChampion,
  getBracketSections,
  getMatchWinnerId,
  getParticipantName,
  isActionableMatch,
  type BracketSectionKey,
  type DoubleEliminationBracket,
  type DoubleEliminationMatch,
} from "@/lib/double-elimination-types";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Double-Elimination Bracket Admin",
    description:
      "Private CGS controller for double-elimination competitions and live stream brackets.",
    path: "/clubhouse-admin/brackets",
  }),
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

type BracketAdminPageProps = {
  searchParams: Promise<{ notice?: string }>;
};

const noticeMessages: Record<string, string> = {
  "check-names": "Enter between 2 and 16 unique player names, one per line.",
  "create-failed":
    "The bracket could not be created. Check that its stream URL name is unique.",
  "update-failed": "The bracket settings could not be saved.",
  "result-failed": "That match result could not be recorded.",
  "reset-failed":
    "That result cannot be reset after a later match has already been completed.",
};

function getSectionTone(section: BracketSectionKey) {
  if (section === "upper") {
    return "Upper";
  }

  if (section === "lower") {
    return "Lower";
  }

  return "Finals";
}

function ResultControl({
  bracket,
  match,
  section,
  roundLabel,
}: {
  bracket: DoubleEliminationBracket;
  match: DoubleEliminationMatch;
  section: BracketSectionKey;
  roundLabel: string;
}) {
  const firstName = getParticipantName(
    bracket.bracketData,
    match.opponent1?.id
  );
  const secondName = getParticipantName(
    bracket.bracketData,
    match.opponent2?.id
  );

  return (
    <div className="border-t border-white/10 py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase text-cyan-200">
          {getSectionTone(section)} · {roundLabel} · Match {match.number}
        </p>
        <span className="text-xs text-zinc-500">Tap the winner</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {[firstName, secondName].map((name, index) => (
          <form action={recordDoubleEliminationWinnerAction} key={name}>
            <input type="hidden" name="bracket_id" value={bracket.id} />
            <input type="hidden" name="match_id" value={String(match.id)} />
            <input type="hidden" name="winner_side" value={index + 1} />
            <input type="hidden" name="slug" value={bracket.slug} />
            <button
              type="submit"
              className="min-h-14 w-full border border-white/15 bg-white/7 px-4 py-3 text-left text-base font-bold text-white transition hover:border-cyan-300 hover:bg-cyan-300/12"
            >
              {name}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}

function CompletedResult({
  bracket,
  match,
  roundLabel,
}: {
  bracket: DoubleEliminationBracket;
  match: DoubleEliminationMatch;
  roundLabel: string;
}) {
  const winnerId = getMatchWinnerId(match);
  const winnerName = getParticipantName(bracket.bracketData, winnerId);

  return (
    <div className="flex flex-col gap-3 border-t border-white/10 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase text-zinc-500">
          {roundLabel} · Match {match.number}
        </p>
        <p className="mt-1 font-semibold text-white">{winnerName} won</p>
      </div>
      <form action={resetDoubleEliminationMatchAction}>
        <input type="hidden" name="bracket_id" value={bracket.id} />
        <input type="hidden" name="match_id" value={String(match.id)} />
        <input type="hidden" name="slug" value={bracket.slug} />
        <button type="submit" className="btn-secondary">
          Undo result
        </button>
      </form>
    </div>
  );
}

function BracketController({ bracket }: { bracket: DoubleEliminationBracket }) {
  const sections = getBracketSections(bracket.bracketData);
  const matchContext = sections.flatMap((section) =>
    section.rounds.flatMap((round) =>
      round.matches.map((match) => ({
        match,
        section: section.key,
        roundLabel: round.label,
      }))
    )
  );
  const actionableMatches = matchContext.filter(({ match }) =>
    isActionableMatch(match)
  );
  const completedMatches = matchContext.filter(
    ({ match }) =>
      match.status === BRACKET_MATCH_COMPLETED &&
      match.opponent1?.id !== null &&
      match.opponent1?.id !== undefined &&
      match.opponent2?.id !== null &&
      match.opponent2?.id !== undefined &&
      getMatchWinnerId(match) !== null
  );
  const champion = getBracketChampion(bracket.bracketData);

  return (
    <article
      id={`bracket-${bracket.id}`}
      className="panel overflow-hidden rounded-[1.6rem]"
    >
      <div className="border-b border-white/10 px-5 py-5 md:px-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">{bracket.isLive ? "Live" : "Ready"}</span>
              <span className="text-sm text-zinc-400">
                {bracket.participantCount} players
              </span>
            </div>
            <h2 className="mt-3 text-2xl md:text-3xl">{bracket.title}</h2>
            <p className="mt-2 text-sm text-zinc-400">
              {champion ? `Champion: ${champion}` : bracket.statusLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/stream/brackets/${bracket.slug}`}
              target="_blank"
              className="btn-primary"
            >
              Open stream asset
            </Link>
            <Link
              href={`/api/brackets/${bracket.slug}`}
              target="_blank"
              className="btn-secondary"
            >
              Live data
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
        <section className="px-5 py-6 md:px-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Match control</p>
              <h3 className="mt-3 text-xl">Ready now</h3>
            </div>
            <span className="text-sm text-zinc-400">
              {actionableMatches.length} match
              {actionableMatches.length === 1 ? "" : "es"}
            </span>
          </div>

          <div className="mt-5">
            {actionableMatches.length > 0 ? (
              actionableMatches.map(({ match, section, roundLabel }) => (
                <ResultControl
                  key={String(match.id)}
                  bracket={bracket}
                  match={match}
                  section={section}
                  roundLabel={roundLabel}
                />
              ))
            ) : (
              <div className="border border-dashed border-white/15 px-4 py-6 text-sm text-zinc-400">
                {champion
                  ? "Competition complete. The champion is shown on the stream asset."
                  : "No match is ready yet. Check the completed results below if progression looks incorrect."}
              </div>
            )}
          </div>

          {completedMatches.length > 0 ? (
            <details className="simple-details mt-6 border-t border-white/10 pt-5">
              <summary>Completed matches ({completedMatches.length})</summary>
              <div className="mt-4">
                {completedMatches
                  .slice()
                  .reverse()
                  .map(({ match, roundLabel }) => (
                    <CompletedResult
                      key={String(match.id)}
                      bracket={bracket}
                      match={match}
                      roundLabel={roundLabel}
                    />
                  ))}
              </div>
            </details>
          ) : null}
        </section>

        <details className="simple-details border-t border-white/10 px-5 py-6 md:px-7 xl:border-l xl:border-t-0">
          <summary>Stream settings</summary>
          <form action={updateDoubleEliminationBracketAction} className="mt-5 grid gap-4">
            <input type="hidden" name="id" value={bracket.id} />
            <input type="hidden" name="original_slug" value={bracket.slug} />
            <div>
              <label className="field-label" htmlFor={`bracket-title-${bracket.id}`}>
                Competition name
              </label>
              <input
                id={`bracket-title-${bracket.id}`}
                name="title"
                className="field-control"
                defaultValue={bracket.title}
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor={`bracket-subtitle-${bracket.id}`}>
                Stream subtitle
              </label>
              <input
                id={`bracket-subtitle-${bracket.id}`}
                name="subtitle"
                className="field-control"
                defaultValue={bracket.subtitle}
              />
            </div>
            <div>
              <label className="field-label" htmlFor={`bracket-status-${bracket.id}`}>
                Status text
              </label>
              <input
                id={`bracket-status-${bracket.id}`}
                name="status_label"
                className="field-control"
                defaultValue={bracket.statusLabel}
              />
            </div>
            <div>
              <label className="field-label" htmlFor={`bracket-slug-${bracket.id}`}>
                Stream URL name
              </label>
              <input
                id={`bracket-slug-${bracket.id}`}
                name="slug"
                className="field-control"
                defaultValue={bracket.slug}
                required
              />
            </div>
            <label className="flex items-center gap-3 text-sm text-zinc-200">
              <input
                type="checkbox"
                name="is_published"
                defaultChecked={bracket.isPublished}
              />
              Stream link is available
            </label>
            <label className="flex items-center gap-3 text-sm text-zinc-200">
              <input type="checkbox" name="is_live" defaultChecked={bracket.isLive} />
              Show LIVE on the graphic
            </label>
            <button type="submit" className="btn-primary">
              Save settings
            </button>
          </form>
        </details>
      </div>
    </article>
  );
}

export default async function BracketAdminPage({
  searchParams,
}: BracketAdminPageProps) {
  const hasSecretConfigured = hasAdminSecretConfigured();
  const isAuthenticated = hasSecretConfigured
    ? await isAdminAuthenticated()
    : false;

  if (!hasSecretConfigured) {
    return (
      <AdminAccessState
        eyebrow="Admin setup needed"
        title="Bracket admin is not ready yet"
        description="Configure the CGS admin session before using this internal route."
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <AdminAccessState
        eyebrow="Private route"
        title="Double-elimination admin"
        description="Sign in to create the Par 3 bracket, record winners, and control the live stream graphic."
      >
        <ClubhouseAdminLogin />
      </AdminAccessState>
    );
  }

  const { notice } = await searchParams;
  let brackets: DoubleEliminationBracket[] = [];
  let loadingError = "";

  try {
    brackets = await getAdminDoubleEliminationBrackets();
  } catch (error) {
    console.error("Load double-elimination brackets error:", error);
    loadingError =
      "Bracket storage is not available yet. Apply the latest database migration and reload.";
  }

  return (
    <AdminShell
      eyebrow="Competition tools"
      title="Double-elimination brackets"
      description="Paste the player names once. During the event, choose the winner of each ready match and the bracket will progress automatically on the stream."
      actions={
        <>
          <Link href="/clubhouse-admin" className="btn-secondary">
            Dashboard
          </Link>
          <form action={logoutAdminAction}>
            <button type="submit" className="btn-secondary">
              Sign out
            </button>
          </form>
        </>
      }
    >
      {notice && noticeMessages[notice] ? (
        <div className="mb-6 border border-amber-300/30 bg-amber-300/10 px-5 py-4 text-sm text-amber-50">
          {noticeMessages[notice]}
        </div>
      ) : null}

      {loadingError ? (
        <div className="mb-6 border border-red-300/30 bg-red-300/10 px-5 py-4 text-sm text-red-50">
          {loadingError}
        </div>
      ) : null}

      <details
        className="simple-details panel rounded-[1.6rem] p-5 md:p-7"
        open={brackets.length === 0}
      >
        <summary>Create a bracket</summary>
        <form action={createDoubleEliminationBracketAction} className="mt-6 grid gap-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="new-bracket-title">
                Competition name
              </label>
              <input
                id="new-bracket-title"
                name="title"
                className="field-control"
                defaultValue="CGS Par 3 Knockout"
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="new-bracket-slug">
                Stream URL name
              </label>
              <input
                id="new-bracket-slug"
                name="slug"
                className="field-control"
                defaultValue="par-3-knockout"
              />
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="new-bracket-subtitle">
                Stream subtitle
              </label>
              <input
                id="new-bracket-subtitle"
                name="subtitle"
                className="field-control"
                defaultValue="Par 3 Double Elimination"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="new-bracket-status">
                Status text
              </label>
              <input
                id="new-bracket-status"
                name="status_label"
                className="field-control"
                defaultValue="Bracket setup"
              />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="new-bracket-names">
              Player names · one per line
            </label>
            <textarea
              id="new-bracket-names"
              name="participant_names"
              className="field-control"
              rows={10}
              placeholder={"Player one\nPlayer two\nPlayer three\nPlayer four"}
              required
            />
            <p className="mt-2 text-sm text-zinc-400">
              2 to 16 players. The order entered is the seed order; uneven fields receive automatic BYEs.
            </p>
          </div>
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-3 text-sm text-zinc-200">
              <input type="checkbox" name="is_published" defaultChecked />
              Create the stream link now
            </label>
            <label className="flex items-center gap-3 text-sm text-zinc-200">
              <input type="checkbox" name="is_live" />
              Show LIVE immediately
            </label>
          </div>
          <button type="submit" className="btn-primary justify-self-start">
            Create bracket
          </button>
        </form>
      </details>

      <div className="mt-7 grid gap-6">
        {brackets.map((bracket) => (
          <BracketController key={bracket.id} bracket={bracket} />
        ))}
      </div>
    </AdminShell>
  );
}
