import type { Metadata } from "next";
import Link from "next/link";

import ClubhouseAdminLogin from "@/components/ClubhouseAdminLogin";
import AdminMetricCard from "@/components/admin/AdminMetricCard";
import AdminShell, {
  AdminAccessState,
} from "@/components/admin/AdminShell";
import ScoreEntryComposer from "@/components/scoreboard/ScoreEntryComposer";
import ScoreboardCompetitionComposer from "@/components/scoreboard/ScoreboardCompetitionComposer";
import { logoutAdminAction } from "@/app/clubhouse-admin/actions";
import {
  deleteCompetitionScoreEntryAction,
  updateCompetitionScoreEntryAction,
  updateCompetitionScoreboardAction,
} from "@/app/clubhouse-admin/scoreboard/actions";
import {
  hasAdminSecretConfigured,
  isAdminAuthenticated,
} from "@/lib/admin-auth";
import { buildMetadata } from "@/lib/seo";
import { getAdminCompetitionScoreboards } from "@/lib/scoreboards";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Live Scoreboard Admin",
    description:
      "Private CGS admin area for creating competitions and updating live scoreboards.",
    path: "/clubhouse-admin/scoreboard",
  }),
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

function formatDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const year = parsedDate.getFullYear();
  const month = `${parsedDate.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsedDate.getDate()}`.padStart(2, "0");
  const hours = `${parsedDate.getHours()}`.padStart(2, "0");
  const minutes = `${parsedDate.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default async function ScoreboardAdminPage() {
  const hasSecretConfigured = hasAdminSecretConfigured();
  const isAuthenticated = hasSecretConfigured
    ? await isAdminAuthenticated()
    : false;

  if (!hasSecretConfigured) {
    return (
      <AdminAccessState
        eyebrow="Admin setup needed"
        title="Live scoreboard admin is not ready yet"
        description="Add CGS_ADMIN_SECRET to the local and hosted environment so this internal route can be used safely."
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <AdminAccessState
        eyebrow="Private route"
        title="Live scoreboard admin"
        description="This hidden page is for setting up competitions, adding score rows, and pushing live standings to the public scoreboard."
      >
        <ClubhouseAdminLogin />
      </AdminAccessState>
    );
  }

  const feed = await getAdminCompetitionScoreboards();
  const liveBoards = feed.competitions.filter((competition) => competition.isLive).length;
  const publishedBoards = feed.competitions.filter(
    (competition) => competition.isPublished
  ).length;
  const hiddenBoards = feed.competitions.length - publishedBoards;
  const totalRows = feed.competitions.reduce(
    (total, competition) => total + competition.entries.length,
    0
  );

  return (
    <AdminShell
      eyebrow="Internal tools"
      title="Live scoreboard admin"
      description="Create each competition board, control when it becomes public, and update live scoring without touching the codebase. Positions are calculated automatically from the score values."
      actions={
        <>
          <Link href="/clubhouse-admin" className="btn-secondary">
            Dashboard
          </Link>
          <Link href="/clubhouse-admin/inbox" className="btn-secondary">
            Inbox
          </Link>
          <Link href="/scoreboard" className="btn-secondary">
            Public scoreboard
          </Link>
          <form action={logoutAdminAction}>
            <button type="submit" className="btn-secondary">
              Sign out
            </button>
          </form>
        </>
      }
    >
      {feed.warningMessage ? (
        <div className="rounded-[1.35rem] border border-[var(--tan)]/30 bg-[rgba(202,147,103,0.12)] px-5 py-4 text-sm leading-7 text-zinc-200">
          {feed.warningMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Boards loaded"
          value={feed.competitions.length}
          detail="All scoreboards currently available to the admin control room."
        />
        <AdminMetricCard
          label="Live boards"
          value={liveBoards}
          detail="Boards currently marked live for active competition coverage."
        />
        <AdminMetricCard
          label="Published"
          value={publishedBoards}
          detail="Scoreboard pages visible to the public scoreboard directory."
        />
        <AdminMetricCard
          label="Score rows"
          value={totalRows}
          detail="Total player rows being tracked across every competition board."
        />
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="panel rounded-[2rem] p-8">
          <h2 className="text-3xl">Create a competition board</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-400">
            Build the board first, then drop score rows into it. You can keep a
            board hidden until you are ready for it to appear publicly.
          </p>

          <ScoreboardCompetitionComposer />
        </div>

        <div className="panel rounded-[2rem] p-8">
          <h2 className="text-3xl">Operations snapshot</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-400">
            This is the quick pulse check for competition day management.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="subtle-grid-card rounded-[1.35rem] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Feed source
              </p>
              <p className="mt-2 text-lg text-white">
                {feed.source === "database" ? "Supabase live tables" : "Fallback only"}
              </p>
            </div>

            <div className="subtle-grid-card rounded-[1.35rem] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Hidden boards
              </p>
              <p className="mt-2 text-lg text-white">{hiddenBoards}</p>
            </div>
          </div>

          <div className="mt-6 rounded-[1.35rem] border border-white/8 bg-black/16 p-5 text-sm leading-7 text-zinc-300">
            <p>
              Public board order is automatic from the score, so you only need to
              update player rows and live status.
            </p>
            <p className="mt-3">
              If you want a handicap shown, keep including it in the player name.
              The score value itself is what drives ranking.
            </p>
            <p className="mt-3">
              Tick the CGS member option on a player row and the public board will
              show the club marker next to that name.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/scoreboard" className="btn-secondary">
              Open public scoreboard
            </Link>
            <Link href="/clubhouse-admin" className="btn-secondary">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-12 space-y-8">
        {feed.competitions.length > 0 ? (
          feed.competitions.map((competition) => (
            <div key={competition.id} className="panel rounded-[2rem] p-6 md:p-8">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="chip text-zinc-100">{competition.statusLabel}</span>
                    <span className="chip text-zinc-100">
                      {competition.isPublished ? "Published" : "Hidden"}
                    </span>
                    <span className="chip text-zinc-100">
                      {competition.isLive ? "Live now" : "Not live"}
                    </span>
                  </div>
                  <h2 className="mt-5 text-4xl">{competition.title}</h2>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300">
                    {competition.summary}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link href={`/scoreboard/${competition.slug}`} className="btn-secondary">
                    Open public board
                  </Link>
                </div>
              </div>

              <form
                action={updateCompetitionScoreboardAction}
                className="mt-8 grid gap-5 rounded-[1.6rem] border border-white/8 bg-black/18 p-5"
              >
                <input type="hidden" name="id" value={competition.id} />

                <div className="grid gap-5 xl:grid-cols-2">
                  <div>
                    <label className="field-label" htmlFor={`title-${competition.id}`}>
                      Title
                    </label>
                    <input
                      id={`title-${competition.id}`}
                      type="text"
                      name="title"
                      className="field-control"
                      defaultValue={competition.title}
                      required
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor={`slug-${competition.id}`}>
                      Slug
                    </label>
                    <input
                      id={`slug-${competition.id}`}
                      type="text"
                      name="slug"
                      className="field-control"
                      defaultValue={competition.slug}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="field-label" htmlFor={`summary-${competition.id}`}>
                    Summary
                  </label>
                  <textarea
                    id={`summary-${competition.id}`}
                    name="summary"
                    rows={3}
                    className="field-control"
                    defaultValue={competition.summary}
                    required
                  />
                </div>

                <div className="grid gap-5 lg:grid-cols-3">
                  <div>
                    <label className="field-label" htmlFor={`status-${competition.id}`}>
                      Status label
                    </label>
                    <input
                      id={`status-${competition.id}`}
                      type="text"
                      name="status_label"
                      className="field-control"
                      defaultValue={competition.statusLabel}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor={`round-${competition.id}`}>
                      Round label
                    </label>
                    <input
                      id={`round-${competition.id}`}
                      type="text"
                      name="round_label"
                      className="field-control"
                      defaultValue={competition.roundLabel ?? ""}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor={`format-${competition.id}`}>
                      Format
                    </label>
                    <input
                      id={`format-${competition.id}`}
                      type="text"
                      name="format_label"
                      className="field-control"
                      defaultValue={competition.formatLabel ?? ""}
                    />
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-4">
                  <div>
                    <label className="field-label" htmlFor={`location-${competition.id}`}>
                      Venue
                    </label>
                    <input
                      id={`location-${competition.id}`}
                      type="text"
                      name="location"
                      className="field-control"
                      defaultValue={competition.location ?? ""}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor={`starts-${competition.id}`}>
                      Start
                    </label>
                    <input
                      id={`starts-${competition.id}`}
                      type="datetime-local"
                      name="starts_at"
                      className="field-control"
                      defaultValue={formatDateInputValue(competition.startsAt)}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor={`ends-${competition.id}`}>
                      Finish
                    </label>
                    <input
                      id={`ends-${competition.id}`}
                      type="datetime-local"
                      name="ends_at"
                      className="field-control"
                      defaultValue={formatDateInputValue(competition.endsAt)}
                    />
                  </div>
                  <div className="grid gap-4">
                    <label className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-black/16 px-4 py-4 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        name="is_live"
                        defaultChecked={competition.isLive}
                        className="h-4 w-4 accent-[var(--gold)]"
                      />
                      Live now
                    </label>
                    <label className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-black/16 px-4 py-4 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        name="is_published"
                        defaultChecked={competition.isPublished}
                        className="h-4 w-4 accent-[var(--gold)]"
                      />
                      Published
                    </label>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <label className="field-label" htmlFor={`cta-label-${competition.id}`}>
                      CTA label
                    </label>
                    <input
                      id={`cta-label-${competition.id}`}
                      type="text"
                      name="cta_label"
                      className="field-control"
                      defaultValue={competition.ctaLabel ?? ""}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor={`cta-link-${competition.id}`}>
                      CTA link
                    </label>
                    <input
                      id={`cta-link-${competition.id}`}
                      type="text"
                      name="cta_href"
                      className="field-control"
                      defaultValue={competition.ctaHref ?? ""}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <button type="submit" className="btn-primary">
                    Save board settings
                  </button>
                </div>
              </form>

              <div className="mt-8 grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
                <div className="rounded-[1.6rem] border border-white/8 bg-black/18 p-5">
                  <h3 className="text-2xl">Add a score row</h3>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">
                    Add a score and through label. If you want the player handicap
                    shown, include it directly in the name field.
                  </p>

                  <ScoreEntryComposer
                    competitionId={competition.id}
                    competitionSlug={competition.slug}
                  />
                </div>

                <div className="rounded-[1.6rem] border border-white/8 bg-black/18 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-2xl">Current rows</h3>
                    <p className="text-sm text-zinc-400">
                      {competition.entries.length} row
                      {competition.entries.length === 1 ? "" : "s"}
                    </p>
                  </div>

                  {competition.entries.length > 0 ? (
                    <div className="mt-5 space-y-4">
                      {competition.entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-[1.4rem] border border-white/8 bg-black/14 p-4"
                        >
                          <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
                            <form
                              action={updateCompetitionScoreEntryAction}
                              className="space-y-4"
                            >
                              <input type="hidden" name="id" value={entry.id} />
                              <input
                                type="hidden"
                                name="competition_id"
                                value={competition.id}
                              />
                              <input
                                type="hidden"
                                name="competition_slug"
                                value={competition.slug}
                              />

                              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
                                <span className="chip text-zinc-100">
                                  Position {entry.position}
                                </span>
                                <span className="chip text-zinc-100">
                                  Score {entry.grossLabel}
                                </span>
                              </div>

                              <div className="grid gap-4 md:grid-cols-[0.56fr_0.2fr_0.24fr]">
                                <input
                                  type="text"
                                  name="player_name"
                                  className="field-control"
                                  defaultValue={entry.playerName}
                                  required
                                />
                                <input
                                  type="number"
                                  step="0.1"
                                  name="score_value"
                                  className="field-control"
                                  defaultValue={entry.grossScore ?? ""}
                                  required
                                />
                                <input
                                  type="text"
                                  name="thru_label"
                                  className="field-control"
                                  defaultValue={entry.thruLabel ?? ""}
                                  placeholder="Through"
                                />
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <label className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-black/16 px-4 py-4 text-sm text-zinc-300">
                                  <input
                                    type="checkbox"
                                    name="is_cgs_member"
                                    defaultChecked={entry.isCgsMember}
                                    className="h-4 w-4 accent-[var(--gold)]"
                                  />
                                  Show CGS member logo
                                </label>
                                <div className="rounded-[1rem] border border-white/8 bg-black/10 px-4 py-4 text-sm leading-7 text-zinc-400">
                                  Public order updates automatically from the score.
                                  Ties share the same position.
                                </div>
                              </div>

                              <button type="submit" className="btn-secondary">
                                Save row
                              </button>
                            </form>

                            <form
                              action={deleteCompetitionScoreEntryAction}
                              className="flex xl:items-start"
                            >
                              <input type="hidden" name="id" value={entry.id} />
                              <input
                                type="hidden"
                                name="competition_slug"
                                value={competition.slug}
                              />
                              <button type="submit" className="btn-secondary">
                                Delete row
                              </button>
                            </form>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-[1.3rem] border border-dashed border-white/12 bg-black/10 px-4 py-5 text-sm leading-7 text-zinc-400">
                      No player rows yet. Add the first row on the left and the public
                      board will start to come to life.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="panel rounded-[2rem] p-8 text-center md:p-10">
            <h2 className="text-4xl">No competition boards yet</h2>
            <p className="mt-5 text-base leading-8 text-zinc-300">
              Create the first board above, publish it when it is ready, and start
              pushing scores into the public view.
            </p>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
