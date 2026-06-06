import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type AdminSubmissionStatus = "new" | "contacted" | "closed";

export type AdminInboxSubmission = {
  id: number;
  type: "membership" | "contact" | "event";
  title: string;
  subtitle: string;
  contactName: string;
  email: string;
  phone: string | null;
  createdAt: string;
  status: AdminSubmissionStatus;
  details: string[];
  href: string;
};

export type AdminDashboardStats = {
  liveBoards: number;
  publishedBoards: number;
  publishedUpdates: number;
  totalUpdates: number;
  newMemberships: number;
  newContacts: number;
  newEventInterest: number;
};

export type AdminDashboardData = {
  stats: AdminDashboardStats;
  latestSubmissions: AdminInboxSubmission[];
  warningMessage: string | null;
  source: "database" | "fallback";
};

type MembershipRow = {
  id: number;
  created_at: string;
  full_name: string;
  email: string;
  membership_type: string;
  handicap: string | null;
  handicap_type: string | null;
  interested_in_events: string | null;
  status: string | null;
};

type ContactRow = {
  id: number;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  enquiry_type: string;
  preferred_contact: string | null;
  subject: string;
  message: string;
  status: string | null;
};

type EventInterestRow = {
  id: number;
  created_at: string;
  event_slug: string;
  event_name: string;
  enquiry_type: string;
  full_name: string;
  email: string;
  phone: string | null;
  membership_status: string | null;
  handicap: string | null;
  notes: string | null;
  status: string | null;
};

const fallbackWarning =
  "Some admin data could not be loaded from Supabase right now. The dashboard is showing what it can.";

function normalizeSubmissionStatus(value: string | null | undefined): AdminSubmissionStatus {
  if (value === "contacted" || value === "closed") {
    return value;
  }

  return "new";
}

function safeArrayCount<T extends { status?: string | null }>(
  rows: T[] | null,
  status: AdminSubmissionStatus
) {
  return (rows ?? []).filter((row) => normalizeSubmissionStatus(row.status) === status).length;
}

function mapMembershipSubmission(row: MembershipRow): AdminInboxSubmission {
  const details = [
    `Membership: ${row.membership_type}`,
    row.interested_in_events ? `Interested in events: ${row.interested_in_events}` : null,
    row.handicap ? `Handicap: ${row.handicap}${row.handicap_type ? ` (${row.handicap_type})` : ""}` : null,
  ].filter(Boolean) as string[];

  return {
    id: row.id,
    type: "membership",
    title: row.membership_type,
    subtitle: "Membership enquiry",
    contactName: row.full_name,
    email: row.email,
    phone: null,
    createdAt: row.created_at,
    status: normalizeSubmissionStatus(row.status),
    details,
    href: "/membership",
  };
}

function mapContactSubmission(row: ContactRow): AdminInboxSubmission {
  const details = [
    `Subject: ${row.subject}`,
    `Enquiry type: ${row.enquiry_type}`,
    row.preferred_contact ? `Preferred contact: ${row.preferred_contact}` : null,
    row.message ? `Message: ${row.message}` : null,
  ].filter(Boolean) as string[];

  return {
    id: row.id,
    type: "contact",
    title: row.subject,
    subtitle: "Contact enquiry",
    contactName: row.full_name,
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at,
    status: normalizeSubmissionStatus(row.status),
    details,
    href: "/contact",
  };
}

function mapEventSubmission(row: EventInterestRow): AdminInboxSubmission {
  const details = [
    `Event: ${row.event_name}`,
    `Interest: ${row.enquiry_type}`,
    row.membership_status ? `Membership status: ${row.membership_status}` : null,
    row.handicap ? `Handicap: ${row.handicap}` : null,
    row.notes ? `Notes: ${row.notes}` : null,
  ].filter(Boolean) as string[];

  return {
    id: row.id,
    type: "event",
    title: row.event_name,
    subtitle: "Event interest",
    contactName: row.full_name,
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at,
    status: normalizeSubmissionStatus(row.status),
    details,
    href: `/events/${row.event_slug}`,
  };
}

function sortSubmissions(submissions: AdminInboxSubmission[]) {
  return [...submissions].sort((left, right) => {
    const leftDate = new Date(left.createdAt).getTime();
    const rightDate = new Date(right.createdAt).getTime();
    return rightDate - leftDate;
  });
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const [
      membershipResponse,
      contactResponse,
      eventResponse,
      updatesResponse,
      scoreboardsResponse,
    ] = await Promise.all([
      supabaseAdmin
        .from("membership_interest")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8),
      supabaseAdmin
        .from("contact_enquiries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8),
      supabaseAdmin
        .from("event_interest")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8),
      supabaseAdmin.from("clubhouse_updates").select("id,is_published"),
      supabaseAdmin.from("competition_scoreboards").select("id,is_live,is_published"),
    ]);

    const responses = [
      membershipResponse,
      contactResponse,
      eventResponse,
      updatesResponse,
      scoreboardsResponse,
    ];

    const firstError = responses.find((response) => response.error)?.error;

    if (firstError) {
      throw firstError;
    }

    const membershipRows = (membershipResponse.data ?? []) as MembershipRow[];
    const contactRows = (contactResponse.data ?? []) as ContactRow[];
    const eventRows = (eventResponse.data ?? []) as EventInterestRow[];
    const updates = updatesResponse.data ?? [];
    const scoreboards = scoreboardsResponse.data ?? [];

    const latestSubmissions = sortSubmissions([
      ...membershipRows.map(mapMembershipSubmission),
      ...contactRows.map(mapContactSubmission),
      ...eventRows.map(mapEventSubmission),
    ]).slice(0, 10);

    return {
      source: "database",
      warningMessage: null,
      latestSubmissions,
      stats: {
        liveBoards: scoreboards.filter((item) => item.is_live).length,
        publishedBoards: scoreboards.filter((item) => item.is_published).length,
        publishedUpdates: updates.filter((item) => item.is_published).length,
        totalUpdates: updates.length,
        newMemberships: safeArrayCount(membershipRows, "new"),
        newContacts: safeArrayCount(contactRows, "new"),
        newEventInterest: safeArrayCount(eventRows, "new"),
      },
    };
  } catch (error) {
    console.error("Admin dashboard data error:", error);

    return {
      source: "fallback",
      warningMessage: fallbackWarning,
      latestSubmissions: [],
      stats: {
        liveBoards: 0,
        publishedBoards: 0,
        publishedUpdates: 0,
        totalUpdates: 0,
        newMemberships: 0,
        newContacts: 0,
        newEventInterest: 0,
      },
    };
  }
}

export async function getAdminInboxData() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const [membershipResponse, contactResponse, eventResponse] = await Promise.all([
      supabaseAdmin
        .from("membership_interest")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("contact_enquiries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("event_interest")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const responses = [membershipResponse, contactResponse, eventResponse];
    const firstError = responses.find((response) => response.error)?.error;

    if (firstError) {
      throw firstError;
    }

    const membershipRows = (membershipResponse.data ?? []) as MembershipRow[];
    const contactRows = (contactResponse.data ?? []) as ContactRow[];
    const eventRows = (eventResponse.data ?? []) as EventInterestRow[];

    const submissions = sortSubmissions([
      ...membershipRows.map(mapMembershipSubmission),
      ...contactRows.map(mapContactSubmission),
      ...eventRows.map(mapEventSubmission),
    ]);

    return {
      source: "database" as const,
      warningMessage: null,
      submissions,
      counts: {
        total: submissions.length,
        new: submissions.filter((item) => item.status === "new").length,
        contacted: submissions.filter((item) => item.status === "contacted").length,
        closed: submissions.filter((item) => item.status === "closed").length,
      },
    };
  } catch (error) {
    console.error("Admin inbox data error:", error);

    return {
      source: "fallback" as const,
      warningMessage: fallbackWarning,
      submissions: [] as AdminInboxSubmission[],
      counts: {
        total: 0,
        new: 0,
        contacted: 0,
        closed: 0,
      },
    };
  }
}

export async function updateInboxSubmissionStatus(
  type: AdminInboxSubmission["type"],
  id: number,
  status: AdminSubmissionStatus
) {
  const supabaseAdmin = getSupabaseAdmin();

  const tableName =
    type === "membership"
      ? "membership_interest"
      : type === "contact"
        ? "contact_enquiries"
        : "event_interest";

  const { error } = await supabaseAdmin
    .from(tableName)
    .update({ status })
    .eq("id", id);

  if (error) {
    throw error;
  }
}
