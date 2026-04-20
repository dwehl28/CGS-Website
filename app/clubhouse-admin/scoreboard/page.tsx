import type { Metadata } from "next";
import Link from "next/link";

import ClubhouseAdminLogin from "@/components/ClubhouseAdminLogin";
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
      <main className="min-h-screen text-white">
        <section className="mx-auto max-w-4xl px-6 py-16">
          <div className="panel rounded-[2rem] p-8 md:p-10">
            <div className="eyebrow">Admin setup needed</div>
            <h1 className="mt-6 text-4xl md:text-5xl">Live scoreboard admin is not ready yet</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
              Add <code>CGS_ADMIN_SECRET</code> to the local and hosted
              environment so this internal route can be used safely.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen text-white">
        <section className="mx-auto max-w-4xl px-6 py-16">
          <div className="panel rounded-[2rem] p-8 md:p-10">
            <div className="eyebrow">Private route</div>
            <h1 className="mt-6 text-4xl md:text-5xl">Live scoreboard admin</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
              This hidden page is for setting up competitions and pushing live score
              changes to the public scoreboard.
            </p>

            <ClubhouseAdminLogin />
          </div>
        </section>
      </main>
    );
  }

  const feed = await getAdminCompetitionScoreboards();

  return (
    <main className="min-h-screen text-white">
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow">Internal tools</div>
            <h1 className="mt-6 text-4xl md:text-5xl">Live scoreboard admin</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">
              Create a competition board, publish it when it is ready, and update
              player scores as the round unfolds. Positions are calculated
              automatically, and the public page listens for changes in real time.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/clubhouse-admin" className="btn-secondary">
              Back to clubhouse admin
            </Link>
            <Link href="/scoreboard" className="btn-secondary">
              Open public scoreboard
            </Link>
            <form action={logoutAdminAction}>
              <button type="submit" className="btn-secondary">
                Sign out
              </button>
            </form>
          </div>
        </div>

        <div className="mt-10 grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="panel rounded-[2rem] p-8">
            <h2 className="text-3xl">Create a competition board</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Set up the public page first, then add player rows beneath it. You can
              leave a board unpublished until it is ready to be seen.
            </p>

            <ScoreboardCompetitionComposer />
          </div>

          <div className="panel rounded-[2rem] p-8">
            <h2 className="text-3xl">Feed status</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.25rem] border border-white/8 bg-black/18 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Source</p>
                <p className="mt-2 text-lg text-white">
                  {feed.source === "database" ? "Supabase live tables" : "Fallback only"}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-white/8 bg-black/18 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Boards loaded
                </p>
                <p className="mt-2 text-lg text-white">{feed.competitions.length}</p>
              </div>
              <div className="rounded-[1.25rem] border border-white/8 bg-black/18 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Live boards
                </p>
                <p className="mt-2 text-lg text-white">
                  {feed.competitions.filter((competition) => competition.isLive).length}
                </p>
              </div>
            </div>

            {feed.warningMessage ? (
              <div className="mt-6 rounded-[1.25rem] border border-[var(--tan)]/30 bg-[rgba(202,147,103,0.12)] px-4 py-4 text-sm leading-7 text-zinc-200">
                {feed.warningMessage}
              </div>
            ) : (
              <p className="mt-6 text-sm leading-7 text-zinc-400">
                Published boards appear on the public scoreboard page. If a viewer keeps
                the page open, score changes should appear automatically without a refresh.
              </p>
            )}
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
                      <label className="mb-2 block text-sm text-zinc-300">Title</label>
                      <input
                        type="text"
                        name="title"
                        className="field-control"
                        defaultValue={competition.title}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm text-zinc-300">Slug</label>
                      <input
                        type="text"
                        name="slug"
                        className="field-control"
                        defaultValue={competition.slug}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-zinc-300">Summary</label>
                    <textarea
                      name="summary"
                      rows={3}
                      className="field-control"
                      defaultValue={competition.summary}
                      required
                    />
                  </div>

                  <div className="grid gap-5 lg:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm text-zinc-300">Status label</label>
                      <input
                        type="text"
                        name="status_label"
                        className="field-control"
                        defaultValue={competition.statusLabel}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm text-zinc-300">Round label</label>
                      <input
                        type="text"
                        name="round_label"
                        className="field-control"
                        defaultValue={competition.roundLabel ?? ""}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm text-zinc-300">Format</label>
                      <input
                        type="text"
                        name="format_label"
                        className="field-control"
                        defaultValue={competition.formatLabel ?? ""}
                      />
                    </div>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-4">
                    <div>
                      <label className="mb-2 block text-sm text-zinc-300">Venue</label>
                      <input
                        type="text"
                        name="location"
                        className="field-control"
                        defaultValue={competition.location ?? ""}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm text-zinc-300">Start</label>
                      <input
                        type="datetime-local"
                        name="starts_at"
                        className="field-control"
                        defaultValue={formatDateInputValue(competition.startsAt)}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm text-zinc-300">Finish</label>
                      <input
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
                      <label className="mb-2 block text-sm text-zinc-300">CTA label</label>
                      <input
                        type="text"
                        name="cta_label"
                        className="field-control"
                        defaultValue={competition.ctaLabel ?? ""}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm text-zinc-300">CTA link</label>
                      <input
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
      </section>
    </main>
  );
}
