import "server-only";
import { connection } from "next/server";

import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type CglTrialPlayer = {
  username: string;
  profileUrl: string;
  scorecardUrl: string | null;
};

export type CglTrialRoster =
  | { status: "available"; players: CglTrialPlayer[] }
  | { status: "unavailable"; players: [] };

const USERS_PER_PAGE = 100;
const MAX_ROSTER_PAGES = 100;

// Scorecard identifiers are supplied by SGT; they cannot be derived from a player ID.
const verifiedScorecards = new Map([
  ["lachlanmacka", "https://simulatorgolftour.com/scorecard/80736/51346"],
]);

function getPublicTrialPlayer(appMetadata: unknown): CglTrialPlayer | null {
  if (!appMetadata || typeof appMetadata !== "object") return null;

  const cgl = (appMetadata as Record<string, unknown>).cgl;
  if (!cgl || typeof cgl !== "object") return null;

  const membership = cgl as Record<string, unknown>;
  if (membership.membership_status !== "trial" || typeof membership.sgt_username !== "string") {
    return null;
  }

  const username = membership.sgt_username.trim();
  if (!username || username.length > 100 || /[\u0000-\u001f\u007f]/.test(username)) {
    return null;
  }

  return {
    username,
    profileUrl: `https://simulatorgolftour.com/profile/${encodeURIComponent(username)}`,
    scorecardUrl: verifiedScorecards.get(username.toLowerCase()) ?? null,
  };
}

/** Returns public CGL identities only, including players who have not set a password. */
export const getCglTrialRoster = cache(async function getCglTrialRoster(): Promise<CglTrialRoster> {
  // Exclude Auth calls from prerendering before entering the failure fallback.
  await connection();
  try {
    const supabase = getSupabaseAdmin();
    const players = new Map<string, CglTrialPlayer>();

    for (let page = 1; page <= MAX_ROSTER_PAGES; page += 1) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: USERS_PER_PAGE,
      });

      if (error) return { status: "unavailable", players: [] };

      for (const user of data.users) {
        // App metadata is maintained by CGS. User-editable metadata is never used here.
        const player = getPublicTrialPlayer(user.app_metadata);
        if (player) players.set(player.username.toLowerCase(), player);
      }

      if (data.users.length < USERS_PER_PAGE) {
        return {
          status: "available",
          players: [...players.values()].sort((left, right) =>
            left.username.localeCompare(right.username, "en-AU", { sensitivity: "base" })
          ),
        };
      }
    }

    // Never publish a partial roster if pagination could not be completed.
    return { status: "unavailable", players: [] };
  } catch {
    return { status: "unavailable", players: [] };
  }
});
