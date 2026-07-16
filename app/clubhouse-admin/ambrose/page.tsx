import type { Metadata } from "next";
import Link from "next/link";

import {
  addAmbroseTeamMemberAction,
  createAmbroseEventAction,
  createAmbroseTeamWithMembersAction,
  removeAmbroseTeamMemberAction,
  updateAmbroseEntryAction,
  updateAmbroseEventAction,
  updateAmbroseTeamAction,
  updateCgsPlayerProfileAction,
} from "@/app/clubhouse-admin/ambrose/actions";
import { logoutAdminAction } from "@/app/clubhouse-admin/actions";
import AdminMetricCard from "@/components/admin/AdminMetricCard";
import AdminShell, { AdminAccessState } from "@/components/admin/AdminShell";
import ClubhouseAdminLogin from "@/components/ClubhouseAdminLogin";
import {
  hasAdminSecretConfigured,
  isAdminAuthenticated,
} from "@/lib/admin-auth";
import {
  type AmbroseEntry,
  type AmbroseTeam,
  getAdminAmbroseEvents,
  getAllProfilesForAdmin,
  getAmbroseSnapshot,
  getBroadcastProfileStats,
} from "@/lib/ambrose-events";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Ambrose Event Admin",
    description:
      "Private CGS admin area for team Ambrose setup, player assignment, live scoring, and stream overlays.",
    path: "/clubhouse-admin/ambrose",
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

function getProfileLabel(profile: {
  displayName: string;
  nickname: string;
  handle: string;
  email: string;
}) {
  const name = profile.nickname || profile.displayName || profile.email;
  return `${name} (@${profile.handle})`;
}

function getEntryForTeamHole(
  entries: AmbroseEntry[],
  teamId: number,
  holeId: number
) {
  return entries.find((entry) => entry.teamId === teamId && entry.holeId === holeId);
}

function formatNullableNumberInput(value: number | null) {
  return value === null || !Number.isFinite(value) ? "" : String(value);
}

function TeamMemberOptions({ team }: { team: AmbroseTeam }) {
  return (
    <>
      <option value="">Not recorded</option>
      {team.members.map((member) =>
        member.profile ? (
          <option key={member.profileId} value={member.profileId}>
            {member.profile.nickname ||
              member.profile.displayName ||
              member.profile.email}
          </option>
        ) : null
      )}
    </>
  );
}

export default async function AmbroseAdminPage() {
  const hasSecretConfigured = hasAdminSecretConfigured();
  const isAuthenticated = hasSecretConfigured
    ? await isAdminAuthenticated()
    : false;

  if (!hasSecretConfigured) {
    return (
      <AdminAccessState
        eyebrow="Admin setup needed"
        title="Ambrose admin is not ready yet"
        description="Add CGS_ADMIN_SECRET to the local and hosted environment so this internal route can be used safely."
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <AdminAccessState
        eyebrow="Private route"
        title="Ambrose event admin"
        description="This hidden page is for creating team Ambrose events, assigning signed-up players, and pushing live round data to the player app and stream overlays."
      >
        <ClubhouseAdminLogin />
      </AdminAccessState>
    );
  }

  const [feed, profiles] = await Promise.all([
    getAdminAmbroseEvents(),
    getAllProfilesForAdmin(),
  ]);
  const snapshots = feed.events.map(getAmbroseSnapshot);
  const liveEvents = feed.events.filter((event) => event.isLive).length;
  const totalTeams = feed.events.reduce(
    (total, event) => total + event.teams.length,
    0
  );
  const totalPlayers = feed.events.reduce(
    (total, event) =>
      total +
      event.teams.reduce((teamTotal, team) => teamTotal + team.members.length, 0),
    0
  );
  const totalEntries = feed.events.reduce(
    (total, event) =>
      total +
      event.entries.filter((entry) => entry.grossStrokes !== null).length,
    0
  );

  return (
    <AdminShell
      eyebrow="Internal tools"
      title="Ambrose event admin"
      description="Create a CGS team Ambrose event for up to three GSPro bays, assign two players per team, and let either team member or any admin submit the shared team score."
      actions={
        <>
          <Link href="/play" className="btn-secondary">
            Player app
          </Link>
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
      {feed.warningMessage ? (
        <div className="rounded-[1.35rem] border border-[var(--tan)]/30 bg-[rgba(202,147,103,0.12)] px-5 py-4 text-sm leading-7 text-zinc-200">
          {feed.warningMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Ambrose events"
          value={feed.events.length}
          detail="Team Ambrose event shells available in the new app model."
        />
        <AdminMetricCard
          label="Live events"
          value={liveEvents}
          detail="Events currently available for live player entry and stream coverage."
        />
        <AdminMetricCard
          label="Assigned players"
          value={totalPlayers}
          detail={`${totalTeams} team${totalTeams === 1 ? "" : "s"} across the event list.`}
        />
        <AdminMetricCard
          label="Hole entries"
          value={totalEntries}
          detail="Saved Ambrose team-hole scores across all events."
        />
      </div>

      <div className="mt-8 grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <details className="simple-details panel rounded-[1.6rem] p-5 md:p-6">
          <summary>Create competition</summary>
          <p className="mt-3 text-sm leading-7 text-zinc-400">
            Start with the event shell. The system creates default holes, then
            you can add teams, assign players, and publish the player app link.
          </p>

          <form action={createAmbroseEventAction} className="mt-6 grid gap-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="new-ambrose-title">
                  Title
                </label>
                <input
                  id="new-ambrose-title"
                  name="title"
                  className="field-control"
                  defaultValue="CGS Ambrose Sim Night"
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor="new-ambrose-slug">
                  Slug
                </label>
                <input
                  id="new-ambrose-slug"
                  name="slug"
                  className="field-control"
                  defaultValue="cgs-ambrose-sim-night"
                />
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="new-ambrose-summary">
                Summary
              </label>
              <textarea
                id="new-ambrose-summary"
                name="summary"
                className="field-control"
                rows={3}
                defaultValue="Team Ambrose competition built for three GSPro bays, shared team entry, live leaderboard movement, and stream-ready player profile data."
                required
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <div>
                <label className="field-label" htmlFor="new-ambrose-season">
                  Season label
                </label>
                <input
                  id="new-ambrose-season"
                  name="season_label"
                  className="field-control"
                  defaultValue="CGS Team Event"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="new-ambrose-course">
                  GSPro course
                </label>
                <input
                  id="new-ambrose-course"
                  name="course_name"
                  className="field-control"
                  defaultValue="GSPro course TBC"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="new-ambrose-status">
                  Status label
                </label>
                <input
                  id="new-ambrose-status"
                  name="status_label"
                  className="field-control"
                  defaultValue="Ambrose setup"
                />
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-4">
              <div>
                <label className="field-label" htmlFor="new-ambrose-bays">
                  Bays
                </label>
                <input
                  id="new-ambrose-bays"
                  name="bay_count"
                  type="number"
                  min={1}
                  max={3}
                  className="field-control"
                  defaultValue={3}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="new-ambrose-holes">
                  Holes
                </label>
                <input
                  id="new-ambrose-holes"
                  name="hole_count"
                  type="number"
                  min={1}
                  max={18}
                  className="field-control"
                  defaultValue={18}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="new-ambrose-start">
                  Start
                </label>
                <input
                  id="new-ambrose-start"
                  name="starts_at"
                  type="datetime-local"
                  className="field-control"
                />
              </div>
              <div className="grid gap-3">
                <label className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-black/16 px-4 py-4 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    name="is_live"
                    className="h-4 w-4 accent-[var(--gold)]"
                    defaultChecked
                  />
                  Live now
                </label>
                <label className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-black/16 px-4 py-4 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    name="is_published"
                    className="h-4 w-4 accent-[var(--gold)]"
                    defaultChecked
                  />
                  Published
                </label>
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="new-ambrose-notes">
                Scoring notes
              </label>
              <textarea
                id="new-ambrose-notes"
                name="scoring_notes"
                className="field-control"
                rows={2}
                defaultValue="Team Ambrose. Either allocated team member can enter the team hole result."
              />
            </div>

            <button type="submit" className="btn-primary">
              Create event
            </button>
          </form>
        </details>

        <details
          id="ambrose-profiles"
          className="simple-details panel rounded-[1.6rem] p-5 md:p-6"
        >
          <summary>Signed-up players</summary>
          <p className="mt-3 text-sm leading-7 text-zinc-400">
            Anyone can sign up from `/play`. Admin can also maintain photos and
            stream intro details for each player here.
          </p>

          {profiles.length > 0 ? (
            <div className="mt-6 grid gap-5">
              {profiles.map((profile) => {
                const broadcastStats = getBroadcastProfileStats(profile.seasonStats);

                return (
                  <form
                    key={profile.id}
                    action={updateCgsPlayerProfileAction}
                    className="subtle-grid-card rounded-[1.35rem] px-4 py-4"
                    encType="multipart/form-data"
                  >
                    <input type="hidden" name="profile_id" value={profile.id} />
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">
                          {profile.nickname || profile.displayName || profile.email}
                        </p>
                        <p className="mt-1 text-sm text-zinc-400">
                          @{profile.handle}
                          {profile.handicap !== null
                            ? ` | HCP ${profile.handicap}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/players/${profile.handle}`}
                          className="btn-secondary"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Public profile
                        </Link>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <div>
                        <label
                          className="field-label"
                          htmlFor={`profile-name-${profile.id}`}
                        >
                          Name
                        </label>
                        <input
                          id={`profile-name-${profile.id}`}
                          name="display_name"
                          className="field-control"
                          defaultValue={profile.displayName}
                          required
                        />
                      </div>
                      <div>
                        <label
                          className="field-label"
                          htmlFor={`profile-nickname-${profile.id}`}
                        >
                          Nickname
                        </label>
                        <input
                          id={`profile-nickname-${profile.id}`}
                          name="nickname"
                          className="field-control"
                          defaultValue={profile.nickname}
                        />
                      </div>
                      <div>
                        <label
                          className="field-label"
                          htmlFor={`profile-handle-${profile.id}`}
                        >
                          Handle
                        </label>
                        <input
                          id={`profile-handle-${profile.id}`}
                          name="handle"
                          className="field-control"
                          defaultValue={profile.handle}
                          required
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <div>
                        <label
                          className="field-label"
                          htmlFor={`profile-handicap-${profile.id}`}
                        >
                          Handicap
                        </label>
                        <input
                          id={`profile-handicap-${profile.id}`}
                          name="handicap"
                          type="number"
                          step="0.1"
                          min={-10}
                          max={54}
                          className="field-control"
                          defaultValue={formatNullableNumberInput(profile.handicap)}
                        />
                      </div>
                      <div>
                        <label
                          className="field-label"
                          htmlFor={`profile-photo-${profile.id}`}
                        >
                          Upload photo
                        </label>
                        <input
                          id={`profile-photo-${profile.id}`}
                          name="avatar_file"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="field-control"
                        />
                      </div>
                      <div>
                        <label
                          className="field-label"
                          htmlFor={`profile-avatar-${profile.id}`}
                        >
                          Photo URL fallback
                        </label>
                        <input
                          id={`profile-avatar-${profile.id}`}
                          name="avatar_url"
                          className="field-control"
                          defaultValue={profile.avatarUrl}
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <label
                          className="field-label"
                          htmlFor={`profile-average-drive-${profile.id}`}
                        >
                          Average drives
                        </label>
                        <input
                          id={`profile-average-drive-${profile.id}`}
                          name="average_drive"
                          className="field-control"
                          defaultValue={broadcastStats.averageDrive}
                          placeholder="245m carry"
                        />
                      </div>
                      <div>
                        <label
                          className="field-label"
                          htmlFor={`profile-go-to-iron-${profile.id}`}
                        >
                          Go-to irons
                        </label>
                        <input
                          id={`profile-go-to-iron-${profile.id}`}
                          name="go_to_iron"
                          className="field-control"
                          defaultValue={broadcastStats.goToIron}
                          placeholder="7 iron from anywhere"
                        />
                      </div>
                      <div>
                        <label
                          className="field-label"
                          htmlFor={`profile-best-result-${profile.id}`}
                        >
                          Best result
                        </label>
                        <input
                          id={`profile-best-result-${profile.id}`}
                          name="best_result"
                          className="field-control"
                          defaultValue={broadcastStats.bestResult}
                          placeholder="Season 3 Ambrose winner"
                        />
                      </div>
                      <div>
                        <label
                          className="field-label"
                          htmlFor={`profile-weakness-${profile.id}`}
                        >
                          Biggest weakness
                        </label>
                        <input
                          id={`profile-weakness-${profile.id}`}
                          name="biggest_weakness"
                          className="field-control"
                          defaultValue={broadcastStats.biggestWeakness}
                          placeholder="Trusts the hero shot too much"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-black/16 px-4 py-4 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          name="is_public"
                          defaultChecked={profile.isPublic}
                          className="h-4 w-4 accent-[var(--gold)]"
                        />
                        Public profile
                      </label>
                      <button type="submit" className="btn-secondary">
                        Save player
                      </button>
                    </div>
                  </form>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-[1.35rem] border border-dashed border-white/12 bg-black/12 px-5 py-6 text-sm leading-7 text-zinc-400">
              No player accounts yet. Send players to `/play` to sign up, then
              return here to allocate teams.
            </div>
          )}
        </details>
      </div>

      <div className="mt-12 space-y-8">
        {snapshots.map((snapshot) => {
          const { event, leaderboard } = snapshot;

          return (
            <section
              key={event.id}
              id={`ambrose-event-${event.id}`}
              className="panel rounded-[2rem] p-6 md:p-8"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="chip text-zinc-100">{event.statusLabel}</span>
                    <span className="chip text-zinc-100">
                      {event.isLive ? "Live now" : "Not live"}
                    </span>
                    <span className="chip text-zinc-100">
                      {event.isPublished ? "Published" : "Hidden"}
                    </span>
                    <span className="chip text-zinc-100">
                      {event.bayCount} bay{event.bayCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <h2 className="mt-5 text-4xl">{event.title}</h2>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300">
                    {event.summary}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/competitions/${event.slug}`}
                    className="btn-secondary"
                  >
                    Public page
                  </Link>
                  <Link
                    href={`/stream/ambrose/${event.slug}/leaderboard`}
                    className="btn-primary"
                  >
                    OBS leaderboard
                  </Link>
                </div>
              </div>

              <div className="mt-8 grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="grid gap-8">
                  <details className="simple-details rounded-[1.25rem] border border-white/8 bg-black/18 p-5">
                    <summary>Competition settings</summary>
                  <form action={updateAmbroseEventAction} className="mt-5 grid gap-5">
                    <input type="hidden" name="id" value={event.id} />
                    <div className="grid gap-5 lg:grid-cols-2">
                      <div>
                        <label className="field-label" htmlFor={`title-${event.id}`}>
                          Title
                        </label>
                        <input
                          id={`title-${event.id}`}
                          name="title"
                          className="field-control"
                          defaultValue={event.title}
                          required
                        />
                      </div>
                      <div>
                        <label className="field-label" htmlFor={`slug-${event.id}`}>
                          Slug
                        </label>
                        <input
                          id={`slug-${event.id}`}
                          name="slug"
                          className="field-control"
                          defaultValue={event.slug}
                          required
                        />
                      </div>
                    </div>

                    <div className="mt-5">
                      <label
                        className="field-label"
                        htmlFor={`summary-${event.id}`}
                      >
                        Summary
                      </label>
                      <textarea
                        id={`summary-${event.id}`}
                        name="summary"
                        rows={3}
                        className="field-control"
                        defaultValue={event.summary}
                        required
                      />
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-3">
                      <div>
                        <label
                          className="field-label"
                          htmlFor={`season-${event.id}`}
                        >
                          Season
                        </label>
                        <input
                          id={`season-${event.id}`}
                          name="season_label"
                          className="field-control"
                          defaultValue={event.seasonLabel}
                        />
                      </div>
                      <div>
                        <label
                          className="field-label"
                          htmlFor={`course-${event.id}`}
                        >
                          Course
                        </label>
                        <input
                          id={`course-${event.id}`}
                          name="course_name"
                          className="field-control"
                          defaultValue={event.courseName}
                        />
                      </div>
                      <div>
                        <label
                          className="field-label"
                          htmlFor={`status-${event.id}`}
                        >
                          Status
                        </label>
                        <input
                          id={`status-${event.id}`}
                          name="status_label"
                          className="field-control"
                          defaultValue={event.statusLabel}
                        />
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-4">
                      <div>
                        <label className="field-label" htmlFor={`bays-${event.id}`}>
                          Bays
                        </label>
                        <input
                          id={`bays-${event.id}`}
                          name="bay_count"
                          type="number"
                          min={1}
                          max={3}
                          className="field-control"
                          defaultValue={event.bayCount}
                        />
                      </div>
                      <div>
                        <label className="field-label" htmlFor={`holes-${event.id}`}>
                          Holes
                        </label>
                        <input
                          id={`holes-${event.id}`}
                          name="hole_count"
                          type="number"
                          min={1}
                          max={18}
                          className="field-control"
                          defaultValue={event.holeCount}
                        />
                      </div>
                      <div>
                        <label className="field-label" htmlFor={`start-${event.id}`}>
                          Start
                        </label>
                        <input
                          id={`start-${event.id}`}
                          name="starts_at"
                          type="datetime-local"
                          className="field-control"
                          defaultValue={formatDateInputValue(event.startsAt)}
                        />
                      </div>
                      <div className="grid gap-3">
                        <label className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-black/16 px-4 py-4 text-sm text-zinc-300">
                          <input
                            type="checkbox"
                            name="is_live"
                            className="h-4 w-4 accent-[var(--gold)]"
                            defaultChecked={event.isLive}
                          />
                          Live now
                        </label>
                        <label className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-black/16 px-4 py-4 text-sm text-zinc-300">
                          <input
                            type="checkbox"
                            name="is_published"
                            className="h-4 w-4 accent-[var(--gold)]"
                            defaultChecked={event.isPublished}
                          />
                          Published
                        </label>
                      </div>
                    </div>

                    <div className="mt-5">
                      <label className="field-label" htmlFor={`notes-${event.id}`}>
                        Scoring notes
                      </label>
                      <textarea
                        id={`notes-${event.id}`}
                        name="scoring_notes"
                        rows={2}
                        className="field-control"
                        defaultValue={event.scoringNotes}
                      />
                    </div>

                    <button type="submit" className="btn-secondary mt-5">
                      Save event settings
                    </button>
                  </form>
                  </details>

                  <div className="rounded-[1.25rem] border border-white/8 bg-black/18 p-5">
                    <h3 className="text-2xl">Create team</h3>
                    <p className="mt-2 text-sm leading-7 text-zinc-400">
                      Add the team and allocate up to two signed-up players in one save.
                    </p>
                    <form
                      action={createAmbroseTeamWithMembersAction}
                      className="mt-5 grid gap-4"
                    >
                      <input type="hidden" name="event_id" value={event.id} />
                      <input type="hidden" name="event_slug" value={event.slug} />
                      <input
                        type="hidden"
                        name="display_order"
                        value={event.teams.length + 1}
                      />
                      <input type="hidden" name="short_name" value="" />
                      <input type="hidden" name="accent_color" value="#62d7ff" />
                      <input type="hidden" name="starting_hole" value="" />
                      <div className="grid gap-4 md:grid-cols-[1fr_160px]">
                        <input
                          name="name"
                          className="field-control"
                          placeholder="Team name"
                          required
                        />
                        <select name="bay_label" className="field-control" defaultValue="Bay 1">
                          <option>Bay 1</option>
                          <option>Bay 2</option>
                          <option>Bay 3</option>
                          <option>Bay TBC</option>
                        </select>
                      </div>
                      <input type="hidden" name="is_featured" value="on" />
                      <div className="grid gap-4 md:grid-cols-2">
                        <select name="player_one_id" className="field-control">
                          <option value="">Player 1 optional</option>
                          {profiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {getProfileLabel(profile)}
                            </option>
                          ))}
                        </select>
                        <select name="player_two_id" className="field-control">
                          <option value="">Player 2 optional</option>
                          {profiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {getProfileLabel(profile)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button type="submit" className="btn-primary">
                        Create team
                      </button>
                    </form>
                  </div>
                </div>

                <div className="grid gap-6">
                  <details className="simple-details rounded-[1.25rem] border border-white/8 bg-black/18 p-5">
                    <summary>Live leaderboard</summary>
                    <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <h3 className="text-2xl">Live leaderboard</h3>
                        <p className="mt-2 text-sm leading-7 text-zinc-400">
                          Ranked by Ambrose team score to par, then holes
                          completed.
                        </p>
                      </div>
                      <span className="chip text-zinc-100">
                        {snapshot.completeEntries}/{snapshot.totalEntriesPossible} holes
                      </span>
                    </div>

                    {leaderboard.length > 0 ? (
                      <div className="mt-5 space-y-3">
                        {leaderboard.map((summary, index) => (
                          <div
                            key={summary.team.id}
                            className="subtle-grid-card rounded-[1.2rem] px-4 py-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                                  Position {index + 1} | {summary.thruLabel}
                                </p>
                                <h4 className="mt-2 text-xl font-semibold text-white">
                                  {summary.team.name}
                                </h4>
                              </div>
                              <strong className="text-3xl text-[var(--tan)]">
                                {summary.scoreLabel}
                              </strong>
                            </div>
                            <p className="mt-2 text-sm text-zinc-400">
                              {summary.team.bayLabel} |{" "}
                              {summary.team.members.length}/2 players allocated
                              {summary.contributionLeader
                                ? ` | Top contributor: ${summary.contributionLeader.nickname || summary.contributionLeader.displayName}`
                                : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-5 rounded-[1.25rem] border border-dashed border-white/12 bg-black/12 px-5 py-6 text-sm text-zinc-400">
                        Add teams to start the Ambrose leaderboard.
                      </div>
                    )}
                  </details>

                  {event.teams.map((team) => (
                    <div
                      key={team.id}
                      className="rounded-[1.25rem] border border-white/8 bg-black/18 p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-2xl">{team.name}</h3>
                          <p className="mt-1 text-sm text-zinc-400">
                            {team.bayLabel} | {team.members.length}/2 players
                          </p>
                        </div>
                        <span
                          className="h-8 w-8 rounded-full border border-white/20"
                          style={{ backgroundColor: team.accentColor }}
                          aria-hidden="true"
                        />
                      </div>

                      <details className="simple-details mt-4 rounded-[1rem] border border-white/8 bg-black/10 p-4">
                        <summary>Edit team details</summary>
                      <form action={updateAmbroseTeamAction} className="mt-4 grid gap-4">
                        <input type="hidden" name="id" value={team.id} />
                        <input type="hidden" name="event_id" value={event.id} />
                        <input type="hidden" name="event_slug" value={event.slug} />
                        <div className="grid gap-4 md:grid-cols-2">
                          <input
                            name="name"
                            className="field-control"
                            defaultValue={team.name}
                            required
                          />
                          <input
                            name="short_name"
                            className="field-control"
                            defaultValue={team.shortName}
                          />
                        </div>
                        <div className="grid gap-4 md:grid-cols-4">
                          <input
                            name="display_order"
                            type="number"
                            className="field-control"
                            defaultValue={team.displayOrder}
                          />
                          <input
                            name="accent_color"
                            className="field-control"
                            defaultValue={team.accentColor}
                            aria-label="Accent color"
                          />
                          <select
                            name="bay_label"
                            className="field-control"
                            defaultValue={team.bayLabel}
                          >
                            <option>Bay 1</option>
                            <option>Bay 2</option>
                            <option>Bay 3</option>
                            <option>Bay TBC</option>
                          </select>
                          <input
                            name="starting_hole"
                            type="number"
                            className="field-control"
                            defaultValue={team.startingHole ?? ""}
                            placeholder="Start hole"
                          />
                        </div>
                        <label className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-black/16 px-4 py-4 text-sm text-zinc-300">
                          <input
                            type="checkbox"
                            name="is_featured"
                            defaultChecked={team.isFeatured}
                            className="h-4 w-4 accent-[var(--gold)]"
                          />
                          Feature this team on stream
                        </label>
                        <button type="submit" className="btn-secondary">
                          Save team
                        </button>
                      </form>
                      </details>

                      <div className="mt-5 rounded-[1.25rem] border border-white/8 bg-black/10 p-4">
                        <h4 className="text-lg font-semibold text-white">
                          Team members
                        </h4>
                        {team.members.length > 0 ? (
                          <div className="mt-4 space-y-3">
                            {team.members.map((member) => (
                              <div
                                key={member.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-white/8 bg-white/5 px-4 py-3"
                              >
                                <div>
                                  <p className="font-semibold text-white">
                                    {member.profile
                                      ? getProfileLabel(member.profile)
                                      : member.profileId}
                                  </p>
                                  <p className="mt-1 text-sm text-zinc-400">
                                    {member.roleLabel}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {member.profile ? (
                                    <Link
                                      href={`/stream/ambrose/${event.slug}/player/${member.profile.handle}`}
                                      className="btn-secondary"
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      OBS profile
                                    </Link>
                                  ) : null}
                                  <form action={removeAmbroseTeamMemberAction}>
                                    <input
                                      type="hidden"
                                      name="event_id"
                                      value={event.id}
                                    />
                                    <input
                                      type="hidden"
                                      name="event_slug"
                                      value={event.slug}
                                    />
                                    <input
                                      type="hidden"
                                      name="member_id"
                                      value={member.id}
                                    />
                                    <button type="submit" className="btn-secondary">
                                      Remove
                                    </button>
                                  </form>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm leading-7 text-zinc-400">
                            No players allocated yet.
                          </p>
                        )}

                        {team.members.length < 2 ? (
                          <form
                            action={addAmbroseTeamMemberAction}
                            className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_auto_auto]"
                          >
                            <input type="hidden" name="event_id" value={event.id} />
                            <input
                              type="hidden"
                              name="event_slug"
                              value={event.slug}
                            />
                            <input type="hidden" name="team_id" value={team.id} />
                            <select name="profile_id" className="field-control" required>
                              <option value="">Select signed-up player</option>
                              {profiles.map((profile) => (
                                <option key={profile.id} value={profile.id}>
                                  {getProfileLabel(profile)}
                                </option>
                              ))}
                            </select>
                            <input
                              name="display_order"
                              type="number"
                              className="field-control"
                              defaultValue={team.members.length + 1}
                              aria-label="Display order"
                            />
                            <input
                              name="role_label"
                              className="field-control"
                              defaultValue="Player"
                              aria-label="Role label"
                            />
                            <button type="submit" className="btn-primary">
                              Allocate
                            </button>
                          </form>
                        ) : (
                          <div className="mt-4 rounded-[1rem] border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-zinc-100">
                            This team has two allocated players.
                          </div>
                        )}
                      </div>

                      <details className="simple-details mt-5 rounded-[1.25rem] border border-white/8 bg-black/10 p-4">
                        <summary>Admin score entry</summary>
                        <p className="mt-2 text-sm leading-7 text-zinc-400">
                          Admin can submit for any team. Players can only submit
                          through `/play` when allocated to this team.
                        </p>

                        <form
                          action={updateAmbroseEntryAction}
                          className="mt-4 grid gap-4"
                        >
                          <input type="hidden" name="event_id" value={event.id} />
                          <input
                            type="hidden"
                            name="event_slug"
                            value={event.slug}
                          />
                          <input type="hidden" name="team_id" value={team.id} />
                          <div className="grid gap-4 md:grid-cols-4">
                            <select
                              name="hole_id"
                              className="field-control"
                              required
                            >
                              {event.holes.map((hole) => {
                                const entry = getEntryForTeamHole(
                                  event.entries,
                                  team.id,
                                  hole.id
                                );
                                return (
                                  <option key={hole.id} value={hole.id}>
                                    {hole.holeLabel} | Par {hole.par}
                                    {entry ? ` | ${entry.scoreLabel}` : ""}
                                  </option>
                                );
                              })}
                            </select>
                            <input
                              name="gross_strokes"
                              type="number"
                              min={1}
                              max={20}
                              className="field-control"
                              placeholder="Strokes"
                              required
                            />
                            <input
                              name="putts"
                              type="number"
                              min={0}
                              max={10}
                              className="field-control"
                              placeholder="Putts"
                            />
                            <input
                              name="drive_distance_meters"
                              type="number"
                              min={0}
                              max={500}
                              className="field-control"
                              placeholder="Drive metres"
                            />
                          </div>
                          <div className="grid gap-4 md:grid-cols-4">
                            <select name="drive_player_id" className="field-control">
                              <TeamMemberOptions team={team} />
                            </select>
                            <select
                              name="approach_player_id"
                              className="field-control"
                            >
                              <TeamMemberOptions team={team} />
                            </select>
                            <input
                              name="iron_club"
                              className="field-control"
                              placeholder="Iron club"
                            />
                            <input
                              name="iron_distance_meters"
                              type="number"
                              min={0}
                              max={300}
                              className="field-control"
                              placeholder="Iron metres"
                            />
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <fieldset className="rounded-[1rem] border border-white/8 bg-black/16 px-4 py-4">
                              <legend className="px-1 text-sm text-zinc-400">
                                Fairway
                              </legend>
                              <div className="mt-2 flex gap-4 text-sm text-zinc-300">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name="fairway_hit"
                                    value="yes"
                                    className="accent-[var(--gold)]"
                                  />
                                  Yes
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name="fairway_hit"
                                    value="no"
                                    className="accent-[var(--gold)]"
                                  />
                                  No
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name="fairway_hit"
                                    value=""
                                    className="accent-[var(--gold)]"
                                    defaultChecked
                                  />
                                  N/A
                                </label>
                              </div>
                            </fieldset>
                            <fieldset className="rounded-[1rem] border border-white/8 bg-black/16 px-4 py-4">
                              <legend className="px-1 text-sm text-zinc-400">
                                Green in regulation
                              </legend>
                              <div className="mt-2 flex gap-4 text-sm text-zinc-300">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name="green_in_regulation"
                                    value="yes"
                                    className="accent-[var(--gold)]"
                                  />
                                  Yes
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name="green_in_regulation"
                                    value="no"
                                    className="accent-[var(--gold)]"
                                  />
                                  No
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name="green_in_regulation"
                                    value=""
                                    className="accent-[var(--gold)]"
                                    defaultChecked
                                  />
                                  N/A
                                </label>
                              </div>
                            </fieldset>
                          </div>
                          <button type="submit" className="btn-primary">
                            Save team hole
                          </button>
                        </form>
                      </details>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </AdminShell>
  );
}
