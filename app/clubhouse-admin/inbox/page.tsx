import type { Metadata } from "next";
import Link from "next/link";

import AdminMetricCard from "@/components/admin/AdminMetricCard";
import AdminShell, {
  AdminAccessState,
} from "@/components/admin/AdminShell";
import ClubhouseAdminLogin from "@/components/ClubhouseAdminLogin";
import { logoutAdminAction } from "@/app/clubhouse-admin/actions";
import { updateInboxSubmissionStatusAction } from "@/app/clubhouse-admin/inbox/actions";
import { type AdminInboxSubmission, getAdminInboxData } from "@/lib/admin-dashboard";
import {
  hasAdminSecretConfigured,
  isAdminAuthenticated,
} from "@/lib/admin-auth";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Admin Inbox",
    description:
      "Private CGS admin inbox for memberships, contact enquiries, and event interest submissions.",
    path: "/clubhouse-admin/inbox",
  }),
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

const inboxStatusFilters = ["all", "new", "contacted", "closed"] as const;
const inboxTypeFilters = ["all", "membership", "contact", "event"] as const;

type InboxStatusFilter = (typeof inboxStatusFilters)[number];
type InboxTypeFilter = (typeof inboxTypeFilters)[number];

type InboxSearchParams = {
  status?: string | string[] | undefined;
  type?: string | string[] | undefined;
  q?: string | string[] | undefined;
};

function normalizeSingleSearchParam(
  value: string | string[] | undefined
): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (Array.isArray(value) && value[0]) {
    return value[0].trim() || null;
  }

  return null;
}

function normalizeStatusFilter(value: string | string[] | undefined): InboxStatusFilter {
  const normalizedValue = normalizeSingleSearchParam(value);

  if (
    normalizedValue &&
    inboxStatusFilters.includes(normalizedValue as InboxStatusFilter)
  ) {
    return normalizedValue as InboxStatusFilter;
  }

  return "all";
}

function normalizeTypeFilter(value: string | string[] | undefined): InboxTypeFilter {
  const normalizedValue = normalizeSingleSearchParam(value);

  if (normalizedValue && inboxTypeFilters.includes(normalizedValue as InboxTypeFilter)) {
    return normalizedValue as InboxTypeFilter;
  }

  return "all";
}

function normalizeSearchQuery(value: string | string[] | undefined) {
  return normalizeSingleSearchParam(value) ?? "";
}

function buildInboxHref(filters: {
  status?: InboxStatusFilter;
  type?: InboxTypeFilter;
  query?: string;
}) {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.type && filters.type !== "all") {
    params.set("type", filters.type);
  }

  if (filters.query?.trim()) {
    params.set("q", filters.query.trim());
  }

  const queryString = params.toString();
  return queryString ? `/clubhouse-admin/inbox?${queryString}` : "/clubhouse-admin/inbox";
}

function formatSubmissionTimestamp(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
}

function getSubmissionTypeLabel(type: AdminInboxSubmission["type"]) {
  if (type === "membership") {
    return "Membership";
  }

  if (type === "contact") {
    return "Contact";
  }

  return "Event";
}

function getStatusButtonLabel(status: "new" | "contacted" | "closed") {
  if (status === "new") {
    return "Mark new";
  }

  if (status === "contacted") {
    return "Mark contacted";
  }

  return "Close out";
}

function getStatusBadgeClass(status: AdminInboxSubmission["status"]) {
  if (status === "contacted") {
    return "bg-[rgba(87,177,255,0.14)] text-[var(--sky)]";
  }

  if (status === "closed") {
    return "bg-white/8 text-zinc-200";
  }

  return "bg-[rgba(202,147,103,0.16)] text-[var(--gold)]";
}

function matchesFilters(
  submission: AdminInboxSubmission,
  statusFilter: InboxStatusFilter,
  typeFilter: InboxTypeFilter,
  searchQuery: string
) {
  if (statusFilter !== "all" && submission.status !== statusFilter) {
    return false;
  }

  if (typeFilter !== "all" && submission.type !== typeFilter) {
    return false;
  }

  if (!searchQuery) {
    return true;
  }

  const searchableContent = [
    submission.contactName,
    submission.email,
    submission.phone ?? "",
    submission.title,
    submission.subtitle,
    submission.details.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return searchableContent.includes(searchQuery.toLowerCase());
}

export default async function ClubhouseAdminInboxPage({
  searchParams,
}: {
  searchParams: Promise<InboxSearchParams>;
}) {
  const hasSecretConfigured = hasAdminSecretConfigured();
  const isAuthenticated = hasSecretConfigured
    ? await isAdminAuthenticated()
    : false;

  if (!hasSecretConfigured) {
    return (
      <AdminAccessState
        eyebrow="Admin setup needed"
        title="Admin inbox is not ready yet"
        description="Add CGS_ADMIN_SECRET to the local and hosted environment so this internal route can be used safely."
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <AdminAccessState
        eyebrow="Private route"
        title="Admin inbox"
        description="This hidden area is where you work through memberships, contact leads, and event interest without touching code."
      >
        <ClubhouseAdminLogin />
      </AdminAccessState>
    );
  }

  const resolvedSearchParams = await searchParams;
  const statusFilter = normalizeStatusFilter(resolvedSearchParams.status);
  const typeFilter = normalizeTypeFilter(resolvedSearchParams.type);
  const searchQuery = normalizeSearchQuery(resolvedSearchParams.q);
  const inbox = await getAdminInboxData();

  const filteredSubmissions = inbox.submissions.filter((submission) =>
    matchesFilters(submission, statusFilter, typeFilter, searchQuery)
  );

  const membershipCount = inbox.submissions.filter(
    (submission) => submission.type === "membership"
  ).length;
  const contactCount = inbox.submissions.filter(
    (submission) => submission.type === "contact"
  ).length;
  const eventCount = inbox.submissions.filter(
    (submission) => submission.type === "event"
  ).length;
  const currentViewHref = buildInboxHref({
    status: statusFilter,
    type: typeFilter,
    query: searchQuery,
  });

  return (
    <AdminShell
      eyebrow="Internal tools"
      title="Admin inbox"
      description="Everything submitted through the site lands here. Work through leads, mark their progress, and keep the club's admin side tidy."
      actions={
        <>
          <Link href="/clubhouse-admin" className="btn-secondary">
            Dashboard
          </Link>
          <Link href="/clubhouse-admin/scoreboard" className="btn-secondary">
            Scoreboards
          </Link>
          <form action={logoutAdminAction}>
            <button type="submit" className="btn-secondary">
              Sign out
            </button>
          </form>
        </>
      }
    >
      {inbox.warningMessage ? (
        <div className="rounded-[1.35rem] border border-[var(--tan)]/30 bg-[rgba(202,147,103,0.12)] px-5 py-4 text-sm leading-7 text-zinc-200">
          {inbox.warningMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Total submissions"
          value={inbox.counts.total}
          detail="All stored leads across membership, contact, and event forms."
        />
        <AdminMetricCard
          label="New"
          value={inbox.counts.new}
          detail="Fresh submissions that still need their first response."
        />
        <AdminMetricCard
          label="Contacted"
          value={inbox.counts.contacted}
          detail="People who have been acknowledged and are in progress."
        />
        <AdminMetricCard
          label="Closed"
          value={inbox.counts.closed}
          detail="Completed leads or submissions that do not need more action."
        />
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[0.78fr_1.22fr]">
        <aside className="panel rounded-[2rem] p-8">
          <h2 className="text-3xl">Filter the queue</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-400">
            Narrow the inbox by progress state, submission type, or a quick text
            search so the important items surface fast.
          </p>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Status
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {inboxStatusFilters.map((filterValue) => {
                const isActive = statusFilter === filterValue;
                const href = buildInboxHref({
                  status: filterValue,
                  type: typeFilter,
                  query: searchQuery,
                });

                return (
                  <Link
                    key={filterValue}
                    href={href}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      isActive
                        ? "bg-[var(--accent-soft)] text-white"
                        : "border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/8"
                    }`}
                  >
                    {filterValue === "all"
                      ? "All"
                      : filterValue.charAt(0).toUpperCase() + filterValue.slice(1)}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Submission type
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {inboxTypeFilters.map((filterValue) => {
                const isActive = typeFilter === filterValue;
                const href = buildInboxHref({
                  status: statusFilter,
                  type: filterValue,
                  query: searchQuery,
                });
                const count =
                  filterValue === "membership"
                    ? membershipCount
                    : filterValue === "contact"
                      ? contactCount
                      : filterValue === "event"
                        ? eventCount
                        : inbox.counts.total;

                return (
                  <Link
                    key={filterValue}
                    href={href}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      isActive
                        ? "bg-[var(--accent-soft)] text-white"
                        : "border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/8"
                    }`}
                  >
                    {filterValue === "all"
                      ? `All (${count})`
                      : `${getSubmissionTypeLabel(filterValue)} (${count})`}
                  </Link>
                );
              })}
            </div>
          </div>

          <form action="/clubhouse-admin/inbox" className="mt-6 space-y-4">
            {statusFilter !== "all" ? (
              <input type="hidden" name="status" value={statusFilter} />
            ) : null}
            {typeFilter !== "all" ? (
              <input type="hidden" name="type" value={typeFilter} />
            ) : null}

            <div className="page-split-card rounded-[1.35rem] p-5">
              <label className="field-label" htmlFor="admin-inbox-search">
                Search the inbox
              </label>
              <input
                id="admin-inbox-search"
                type="search"
                name="q"
                className="field-control"
                defaultValue={searchQuery}
                placeholder="Search names, emails, titles, or notes"
              />
              <p className="field-hint">
                Helpful for finding one player, one sponsor, or a specific enquiry.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn-primary">
                Apply search
              </button>
              <Link href="/clubhouse-admin/inbox" className="btn-secondary">
                Clear filters
              </Link>
            </div>
          </form>

          <div className="mt-8 rounded-[1.4rem] border border-white/8 bg-black/16 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Working flow
            </p>
            <div className="mt-3 space-y-3 text-sm leading-7 text-zinc-300">
              <p>New means nobody has properly picked it up yet.</p>
              <p>Contacted means the response has started and the lead is active.</p>
              <p>Closed is for finished threads, resolved questions, or completed follow-up.</p>
            </div>
          </div>
        </aside>

        <div className="panel rounded-[2rem] p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl">Inbox items</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                Showing {filteredSubmissions.length} of {inbox.counts.total} total
                submissions in the current view.
              </p>
            </div>

            <div className="text-sm leading-7 text-zinc-400">
              Source: {inbox.source === "database" ? "Supabase live tables" : "Fallback only"}
            </div>
          </div>

          {filteredSubmissions.length > 0 ? (
            <div className="mt-6 space-y-4">
              {filteredSubmissions.map((submission) => (
                <article
                  key={`${submission.type}-${submission.id}`}
                  className="subtle-grid-card rounded-[1.5rem] p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="chip text-zinc-100">
                          {getSubmissionTypeLabel(submission.type)}
                        </span>
                        <span
                          className={`chip border-0 ${getStatusBadgeClass(submission.status)}`}
                        >
                          {submission.status}
                        </span>
                        <span className="chip text-zinc-100">
                          Received {formatSubmissionTimestamp(submission.createdAt)}
                        </span>
                      </div>

                      <h3 className="mt-4 text-2xl text-white">
                        {submission.contactName}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-zinc-300">
                        {submission.title}
                      </p>
                    </div>

                    <Link href={submission.href} className="btn-secondary">
                      Open source page
                    </Link>
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-[0.5fr_0.5fr]">
                    <div className="rounded-[1.25rem] border border-white/8 bg-black/16 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        Contact
                      </p>
                      <div className="mt-3 space-y-2 text-sm leading-7 text-zinc-300">
                        <p>
                          Email:{" "}
                          <a
                            href={`mailto:${submission.email}`}
                            className="text-[var(--sky)] underline-offset-4 hover:underline"
                          >
                            {submission.email}
                          </a>
                        </p>
                        {submission.phone ? (
                          <p>
                            Phone:{" "}
                            <a
                              href={`tel:${submission.phone}`}
                              className="text-[var(--sky)] underline-offset-4 hover:underline"
                            >
                              {submission.phone}
                            </a>
                          </p>
                        ) : (
                          <p>Phone: Not supplied</p>
                        )}
                        <p>Source: {submission.subtitle}</p>
                      </div>
                    </div>

                    <div className="rounded-[1.25rem] border border-white/8 bg-black/16 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        Details
                      </p>
                      {submission.details.length > 0 ? (
                        <ul className="mt-3 space-y-2 text-sm leading-7 text-zinc-300">
                          {submission.details.map((detail) => (
                            <li key={detail}>{detail}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-sm leading-7 text-zinc-400">
                          No extra details were supplied.
                        </p>
                      )}
                    </div>
                  </div>

                  <form
                    action={updateInboxSubmissionStatusAction}
                    className="mt-5 flex flex-wrap gap-3"
                  >
                    <input type="hidden" name="id" value={submission.id} />
                    <input type="hidden" name="type" value={submission.type} />
                    <input type="hidden" name="return_to" value={currentViewHref} />

                    {(["new", "contacted", "closed"] as const).map((nextStatus) => (
                      <button
                        key={nextStatus}
                        type="submit"
                        name="status"
                        value={nextStatus}
                        disabled={submission.status === nextStatus}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          submission.status === nextStatus
                            ? "cursor-not-allowed border border-white/10 bg-white/10 text-zinc-500"
                            : "border border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10"
                        }`}
                      >
                        {getStatusButtonLabel(nextStatus)}
                      </button>
                    ))}
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[1.35rem] border border-dashed border-white/12 bg-black/12 px-5 py-6 text-sm leading-7 text-zinc-400">
              Nothing matches this view yet. Try clearing the filters or search to
              bring everything back into the queue.
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
