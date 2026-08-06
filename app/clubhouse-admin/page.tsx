import type { Metadata } from "next";
import Link from "next/link";

import AdminMetricCard from "@/components/admin/AdminMetricCard";
import AdminShell, {
  AdminAccessState,
  AdminQuickLink,
} from "@/components/admin/AdminShell";
import ClubhouseAdminLogin from "@/components/ClubhouseAdminLogin";
import ClubhouseUpdateComposer from "@/components/ClubhouseUpdateComposer";
import {
  logoutAdminAction,
  toggleClubhouseUpdateVisibilityAction,
} from "@/app/clubhouse-admin/actions";
import {
  hasAdminSecretConfigured,
  isAdminAuthenticated,
} from "@/lib/admin-auth";
import { getAdminDashboardData } from "@/lib/admin-dashboard";
import { getAdminClubhouseUpdates } from "@/lib/clubhouse-updates";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Clubhouse Admin",
    description:
      "Private CGS admin area for publishing short live updates to the site.",
    path: "/clubhouse-admin",
  }),
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

function formatUpdateTime(isoString: string | null) {
  if (!isoString) {
    return "No timing set";
  }

  const parsedDate = new Date(isoString);

  if (Number.isNaN(parsedDate.getTime())) {
    return "No timing set";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
}

export default async function ClubhouseAdminPage() {
  const hasSecretConfigured = hasAdminSecretConfigured();
  const isAuthenticated = hasSecretConfigured
    ? await isAdminAuthenticated()
    : false;

  if (!hasSecretConfigured) {
    return (
      <AdminAccessState
        eyebrow="Admin setup needed"
        title="Clubhouse admin is not ready yet"
        description="Add CGS_ADMIN_SECRET to the local and hosted environment so this internal route can be used safely."
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <AdminAccessState
        eyebrow="Private route"
        title="Clubhouse admin"
        description="This hidden area is where you manage the live noticeboard, scoreboards, and enquiry flow without touching code."
      >
        <ClubhouseAdminLogin />
      </AdminAccessState>
    );
  }

  const feed = await getAdminClubhouseUpdates();
  const dashboard = await getAdminDashboardData();

  return (
    <AdminShell
      eyebrow="Internal tools"
      title="Clubhouse admin"
      description="Run the live site from here: monitor new enquiries, publish noticeboard updates, and jump into scoreboard control when competition days are on."
      actions={
        <>
          <form action={logoutAdminAction}>
            <button type="submit" className="btn-secondary">
              Sign out
            </button>
          </form>
        </>
      }
    >
      {dashboard.warningMessage ? (
        <div className="rounded-[1.35rem] border border-[var(--tan)]/30 bg-[rgba(202,147,103,0.12)] px-5 py-4 text-sm leading-7 text-zinc-200">
          {dashboard.warningMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="New memberships"
          value={dashboard.stats.newMemberships}
          detail="Fresh membership interest waiting in the admin inbox."
        />
        <AdminMetricCard
          label="New contacts"
          value={dashboard.stats.newContacts}
          detail="General enquiries, sponsorship asks, and contact form messages."
        />
        <AdminMetricCard
          label="New event interest"
          value={dashboard.stats.newEventInterest}
          detail="Player, supporter, and event-related submissions across the calendar."
        />
        <AdminMetricCard
          label="Live boards"
          value={dashboard.stats.liveBoards}
          detail={`${dashboard.stats.publishedBoards} published board${dashboard.stats.publishedBoards === 1 ? "" : "s"} total.`}
        />
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="panel rounded-[2rem] p-8">
          <h2 className="text-3xl">Quick access</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-400">
            The three key admin lanes are inbox, noticeboard, and live scoring.
          </p>

          <div className="mt-6 grid gap-4">
            <AdminQuickLink
              href="/clubhouse-admin/par3"
              label="Run the Par 3 Showdown"
              detail="Manage entrants, pool results, CTP qualifiers, finals, and OBS assets."
            />
            <AdminQuickLink
              href="/clubhouse-admin/inbox"
              label="Open admin inbox"
              detail="Review membership, contact, and event submissions in one place."
            />
            <AdminQuickLink
              href="/clubhouse-admin/scoreboard"
              label="Open scoreboard admin"
              detail="Create boards, add player rows, and run live competition scoring."
            />
            <AdminQuickLink
              href="/clubhouse-admin/round-stats"
              label="Open round stats admin"
              detail="Enter hole-by-hole Ambrose stats and review richer team/player displays."
            />
            <AdminQuickLink
              href="/clubhouse-admin/ambrose"
              label="Open Ambrose app admin"
              detail="Create team Ambrose events, allocate signed-up players, and manage phone entry."
            />
            <AdminQuickLink
              href="/scoreboard"
              label="Open public scoreboard"
              detail="Check exactly what visitors can see on the live board side."
            />
            <AdminQuickLink
              href="/"
              label="Open live homepage"
              detail="See how the noticeboard and current public presentation look."
            />
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="subtle-grid-card rounded-[1.25rem] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Noticeboard source
              </p>
              <p className="mt-2 text-lg text-white">
                {feed.source === "database" ? "Supabase live table" : "Fallback notices"}
              </p>
            </div>
            <div className="subtle-grid-card rounded-[1.25rem] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Noticeboard updates
              </p>
              <p className="mt-2 text-lg text-white">
                {dashboard.stats.publishedUpdates} live / {dashboard.stats.totalUpdates} total
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-8">
          <div className="panel rounded-[2rem] p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-3xl">Recent submissions</h2>
                <p className="mt-3 text-sm leading-7 text-zinc-400">
                  The inbox is now the main operational queue for memberships, contact
                  enquiries, and event interest.
                </p>
              </div>

              <Link href="/clubhouse-admin/inbox" className="btn-secondary">
                Open full inbox
              </Link>
            </div>

            {dashboard.latestSubmissions.length > 0 ? (
              <div className="mt-6 space-y-4">
                {dashboard.latestSubmissions.slice(0, 5).map((submission) => (
                  <div
                    key={`${submission.type}-${submission.id}`}
                    className="subtle-grid-card rounded-[1.35rem] px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="chip text-zinc-100">{submission.subtitle}</span>
                        <span className="chip text-zinc-100">
                          {submission.status}
                        </span>
                      </div>
                      <Link href={submission.href} className="text-sm uppercase tracking-[0.16em] text-[var(--sky)]">
                        Open page
                      </Link>
                    </div>

                    <h3 className="mt-4 text-xl text-white">{submission.contactName}</h3>
                    <p className="mt-1 text-sm text-zinc-400">
                      {submission.title} | {submission.email}
                    </p>
                    {submission.details[0] ? (
                      <p className="mt-3 text-sm leading-7 text-zinc-300">
                        {submission.details[0]}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-[1.35rem] border border-dashed border-white/12 bg-black/12 px-5 py-6 text-sm leading-7 text-zinc-400">
                No recent submissions have landed yet, or the inbox data is currently unavailable.
              </div>
            )}
          </div>

          <div className="panel rounded-[2rem] p-6 md:p-8">
            <div>
              <div className="eyebrow">Live scoring</div>
              <h2 className="mt-4 text-3xl">Scoreboard control room</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
                There are currently {dashboard.stats.liveBoards} live board
                {dashboard.stats.liveBoards === 1 ? "" : "s"} and {dashboard.stats.publishedBoards} published
                scoreboard page{dashboard.stats.publishedBoards === 1 ? "" : "s"}.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-4">
              <Link href="/clubhouse-admin/scoreboard" className="btn-secondary">
                Open scoreboard admin
              </Link>
              <Link href="/scoreboard" className="btn-secondary">
                Open public scoreboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="panel rounded-[2rem] p-8">
          <h2 className="text-3xl">Publish a new update</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-400">
            Keep these notices short and useful. They are designed for quick homepage
            context, not long announcements.
          </p>

          <ClubhouseUpdateComposer />
        </div>

        <div className="panel rounded-[2rem] p-8">
          <h2 className="text-3xl">Current clubhouse updates</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-400">
            Published items appear on the homepage noticeboard and can be toggled
            on or off here.
          </p>

          <div className="mt-6 space-y-4">
            {feed.updates.map((update) => (
              <div key={update.id} className="subtle-grid-card rounded-[1.5rem] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip text-zinc-100">{update.statusLabel}</span>
                    <span className="chip text-zinc-100">
                      {update.isPublished ? "Published" : "Archived"}
                    </span>
                  </div>
                  <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Starts {formatUpdateTime(update.startsAt)}
                  </span>
                </div>

                <h3 className="mt-4 text-2xl">{update.title}</h3>
                <p className="mt-4 text-sm leading-7 text-zinc-300">
                  {update.summary}
                </p>

                <div className="mt-5 flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                  {update.isPinned ? <span>Pinned</span> : null}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {update.ctaLabel && update.ctaHref ? (
                    <a
                      href={update.ctaHref}
                      target={update.ctaHref.startsWith("http") ? "_blank" : undefined}
                      rel={
                        update.ctaHref.startsWith("http")
                          ? "noopener noreferrer"
                          : undefined
                      }
                      className="btn-secondary"
                    >
                      {update.ctaLabel}
                    </a>
                  ) : null}

                  {feed.source === "database" ? (
                    <form action={toggleClubhouseUpdateVisibilityAction}>
                      <input type="hidden" name="id" value={update.id} />
                      <input
                        type="hidden"
                        name="next_state"
                        value={update.isPublished ? "archived" : "published"}
                      />
                      <button type="submit" className="btn-secondary">
                        {update.isPublished ? "Archive" : "Republish"}
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
