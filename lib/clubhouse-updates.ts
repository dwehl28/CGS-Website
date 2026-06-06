import { withTimeout } from "@/lib/async-timeout";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type ClubhouseUpdate = {
  id: number;
  createdAt: string;
  title: string;
  summary: string;
  statusLabel: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isPinned: boolean;
  isPublished: boolean;
};

export type AdminClubhouseUpdateFeed = {
  updates: ClubhouseUpdate[];
  source: "database" | "fallback";
  warningMessage: string | null;
};

type ClubhouseUpdateInput = {
  title: string;
  summary: string;
  statusLabel: string;
  ctaLabel: string;
  ctaHref: string;
  startsAt: string | null;
  endsAt: string | null;
  isPinned: boolean;
};

const missingTableMessage =
  "Clubhouse updates table is not set up yet. Apply the latest Supabase migration to use the admin workflow.";
const CLUBHOUSE_QUERY_TIMEOUT_MS = 3500;

const fallbackUpdates: ClubhouseUpdate[] = [
  {
    id: 1,
    createdAt: "2026-05-24T09:00:00+10:00",
    title: "Season 3 is underway",
    summary:
      "Season 3 launched Monday 25 May 2026 at 7pm AEST with seven CGS teams, new faces, new team combinations, and the Ambrose format back in play.",
    statusLabel: "Season 3 live",
    ctaLabel: "View Season 3",
    ctaHref: "/events/season-3",
    startsAt: "2026-05-25T19:00:00+10:00",
    endsAt: null,
    isPinned: true,
    isPublished: true,
  },
  {
    id: 2,
    createdAt: "2026-05-24T08:55:00+10:00",
    title: "Season 2 Results are now posted",
    summary:
      "Season 2 is complete. The A Grade Grand Final, B Grade Finals, and first CGS Major results are now collected in the results archive.",
    statusLabel: "Season 2 results",
    ctaLabel: "Open archive",
    ctaHref: "/events/season-2",
    startsAt: "2026-05-24T08:55:00+10:00",
    endsAt: null,
    isPinned: false,
    isPublished: true,
  },
  {
    id: 3,
    createdAt: "2026-05-24T08:50:00+10:00",
    title: "Old competitions now have a results home",
    summary:
      "Season 1, the CGS Major, and Season 2 are being kept as archive placeholders so players and followers can revisit the results story.",
    statusLabel: "Results archive",
    ctaLabel: "View events",
    ctaHref: "/events",
    startsAt: "2026-05-24T08:50:00+10:00",
    endsAt: null,
    isPinned: false,
    isPublished: true,
  },
];

function mapRowToUpdate(row: Record<string, unknown>): ClubhouseUpdate {
  return {
    id: Number(row.id),
    createdAt: String(row.created_at ?? ""),
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    statusLabel: String(row.status_label ?? "Clubhouse note"),
    ctaLabel:
      typeof row.cta_label === "string" && row.cta_label.trim()
        ? row.cta_label
        : null,
    ctaHref:
      typeof row.cta_href === "string" && row.cta_href.trim() ? row.cta_href : null,
    startsAt:
      typeof row.starts_at === "string" && row.starts_at.trim() ? row.starts_at : null,
    endsAt:
      typeof row.ends_at === "string" && row.ends_at.trim() ? row.ends_at : null,
    isPinned: Boolean(row.is_pinned),
    isPublished: Boolean(row.is_published),
  };
}

function getFallbackUpdates(limit: number) {
  return fallbackUpdates.slice(0, limit);
}

export async function getPublishedClubhouseUpdates(limit = 3) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await withTimeout(
      supabaseAdmin
        .from("clubhouse_updates")
        .select("*")
        .eq("is_published", true)
        .order("is_pinned", { ascending: false })
        .order("starts_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(limit),
      CLUBHOUSE_QUERY_TIMEOUT_MS,
      "Published clubhouse updates query"
    );

    if (error) {
      if (error.code !== "42P01") {
        console.error("Clubhouse updates query error:", error);
      }

      return getFallbackUpdates(limit);
    }

    const updates = (data ?? []).map(mapRowToUpdate);
    return updates.length > 0 ? updates : getFallbackUpdates(limit);
  } catch (error) {
    console.error("Clubhouse updates feed error:", error);
    return getFallbackUpdates(limit);
  }
}

export async function getAdminClubhouseUpdates(
  limit = 12
): Promise<AdminClubhouseUpdateFeed> {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await withTimeout(
      supabaseAdmin
        .from("clubhouse_updates")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit),
      CLUBHOUSE_QUERY_TIMEOUT_MS,
      "Admin clubhouse updates query"
    );

    if (error) {
      if (error.code === "42P01") {
        return {
          updates: getFallbackUpdates(limit),
          source: "fallback",
          warningMessage: missingTableMessage,
        };
      }

      console.error("Admin clubhouse updates query error:", error);

      return {
        updates: getFallbackUpdates(limit),
        source: "fallback",
        warningMessage:
          "Live clubhouse updates could not be loaded right now, so fallback notices are being shown.",
      };
    }

    return {
      updates: (data ?? []).map(mapRowToUpdate),
      source: "database",
      warningMessage: null,
    };
  } catch (error) {
    console.error("Admin clubhouse updates feed error:", error);

    return {
      updates: getFallbackUpdates(limit),
      source: "fallback",
      warningMessage:
        "Live clubhouse updates could not be loaded right now, so fallback notices are being shown.",
    };
  }
}

export async function createClubhouseUpdate(input: ClubhouseUpdateInput) {
  const supabaseAdmin = getSupabaseAdmin();

  const { error } = await supabaseAdmin.from("clubhouse_updates").insert([
    {
      title: input.title,
      summary: input.summary,
      status_label: input.statusLabel,
      cta_label: input.ctaLabel || null,
      cta_href: input.ctaHref || null,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      is_pinned: input.isPinned,
      is_published: true,
      updated_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    throw error;
  }
}

export async function setClubhouseUpdatePublishedState(
  id: number,
  isPublished: boolean
) {
  const supabaseAdmin = getSupabaseAdmin();

  const { error } = await supabaseAdmin
    .from("clubhouse_updates")
    .update({
      is_published: isPublished,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }
}
