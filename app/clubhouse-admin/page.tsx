import type { Metadata } from "next";
import Link from "next/link";

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
      <main className="min-h-screen text-white">
        <section className="mx-auto max-w-4xl px-6 py-16">
          <div className="panel rounded-[2rem] p-8 md:p-10">
            <div className="eyebrow">Admin setup needed</div>
            <h1 className="mt-6 text-4xl md:text-5xl">Clubhouse admin is not ready yet</h1>
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
            <h1 className="mt-6 text-4xl md:text-5xl">Clubhouse admin</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
              This hidden page is for quick live notices only, so you can update
              the homepage noticeboard without changing code.
            </p>

            <ClubhouseAdminLogin />
          </div>
        </section>
      </main>
    );
  }

  const feed = await getAdminClubhouseUpdates();

  return (
    <main className="min-h-screen text-white">
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="eyebrow">Internal tools</div>
            <h1 className="mt-6 text-4xl md:text-5xl">Clubhouse admin</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
              Publish short site notices, keep the homepage fresh, and archive
              updates once they have done their job.
            </p>
          </div>

          <form action={logoutAdminAction}>
            <button type="submit" className="btn-secondary">
              Sign out
            </button>
          </form>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="panel rounded-[2rem] p-8">
            <h2 className="text-3xl">Publish a new update</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Keep these notices short and useful. They are designed for quick
              homepage context, not long announcements.
            </p>

            <ClubhouseUpdateComposer />
          </div>

          <div className="panel rounded-[2rem] p-8">
            <h2 className="text-3xl">Feed status</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-[1.25rem] border border-white/8 bg-black/18 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Source
                </p>
                <p className="mt-2 text-lg text-white">
                  {feed.source === "database" ? "Supabase live table" : "Fallback notices"}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-white/8 bg-black/18 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Updates loaded
                </p>
                <p className="mt-2 text-lg text-white">{feed.updates.length}</p>
              </div>
            </div>

            {feed.warningMessage ? (
              <div className="mt-6 rounded-[1.25rem] border border-[var(--tan)]/30 bg-[rgba(202,147,103,0.12)] px-4 py-4 text-sm leading-7 text-zinc-200">
                {feed.warningMessage}
              </div>
            ) : (
              <p className="mt-6 text-sm leading-7 text-zinc-400">
                Published items appear on the homepage noticeboard and can be
                toggled on or off below.
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 panel rounded-[2rem] p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="eyebrow">New tool</div>
              <h2 className="mt-4 text-3xl">Live scoreboard controls</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
                Create competition boards and update player scores in real time from a
                dedicated admin screen.
              </p>
            </div>

            <Link href="/clubhouse-admin/scoreboard" className="btn-secondary">
              Open scoreboard admin
            </Link>
          </div>
        </div>

        <div className="mt-12">
          <div className="mb-6">
            <div className="eyebrow">Live noticeboard</div>
            <h2 className="mt-4 text-4xl">Current clubhouse updates</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {feed.updates.map((update) => (
              <div key={update.id} className="panel rounded-[1.75rem] p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="chip text-zinc-100">{update.statusLabel}</span>
                  <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    {update.isPublished ? "Published" : "Archived"}
                  </span>
                </div>

                <h3 className="mt-4 text-3xl">{update.title}</h3>
                <p className="mt-4 text-sm leading-7 text-zinc-300">
                  {update.summary}
                </p>

                <div className="mt-5 flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                  {update.isPinned ? <span>Pinned</span> : null}
                  <span>Starts {formatUpdateTime(update.startsAt)}</span>
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
      </section>
    </main>
  );
}
