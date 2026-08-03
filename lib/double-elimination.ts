import "server-only";

import { BracketsManager, type Database } from "brackets-manager";
import { InMemoryDatabase } from "brackets-memory-db";

import type {
  DoubleEliminationBracket,
  DoubleEliminationData,
} from "@/lib/double-elimination-types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type BracketRow = {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  status_label: string;
  participant_count: number;
  is_published: boolean;
  is_live: boolean;
  bracket_data: DoubleEliminationData;
  updated_at: string;
  created_at: string;
};

export type DoubleEliminationBracketInput = {
  slug: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  participantNames: string[];
  isPublished: boolean;
  isLive: boolean;
};

export type DoubleEliminationBracketSettingsInput = Omit<
  DoubleEliminationBracketInput,
  "participantNames"
>;

function mapBracketRow(row: BracketRow): DoubleEliminationBracket {
  return {
    id: Number(row.id),
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    statusLabel: row.status_label,
    participantCount: Number(row.participant_count),
    isPublished: Boolean(row.is_published),
    isLive: Boolean(row.is_live),
    bracketData: row.bracket_data,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

function cloneBracketData(data: DoubleEliminationData): Database {
  return structuredClone(data) as Database;
}

function getBracketSize(participantCount: number) {
  let size = 2;

  while (size < participantCount) {
    size *= 2;
  }

  return size;
}

export function normalizeParticipantNames(values: string[]) {
  const names: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of values) {
    const name = rawValue.trim().replace(/\s+/g, " ").slice(0, 80);
    const key = name.toLocaleLowerCase("en-AU");

    if (!name || seen.has(key)) {
      continue;
    }

    seen.add(key);
    names.push(name);
  }

  return names.slice(0, 16);
}

export async function generateDoubleEliminationData(
  title: string,
  participantNames: string[]
) {
  const names = normalizeParticipantNames(participantNames);

  if (names.length < 2 || names.length > 16) {
    throw new Error("A double-elimination bracket requires 2 to 16 players.");
  }

  const storage = new InMemoryDatabase();
  const manager = new BracketsManager(storage);

  await manager.create.stage({
    tournamentId: 0,
    name: title,
    type: "double_elimination",
    seeding: names,
    settings: {
      size: getBracketSize(names.length),
      seedOrdering: ["inner_outer"],
      balanceByes: true,
      grandFinal: "double",
    },
  });

  return manager.get.tournamentData(0) as Promise<DoubleEliminationData>;
}

async function getBracketRowById(id: number) {
  const { data, error } = await getSupabaseAdmin()
    .from("cgs_double_elimination_brackets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? (data as BracketRow) : null;
}

export async function getAdminDoubleEliminationBrackets() {
  const { data, error } = await getSupabaseAdmin()
    .from("cgs_double_elimination_brackets")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as BracketRow[]).map(mapBracketRow);
}

export async function getPublishedDoubleEliminationBracketBySlug(
  slug: string
) {
  const { data, error } = await getSupabaseAdmin()
    .from("cgs_double_elimination_brackets")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapBracketRow(data as BracketRow) : null;
}

export async function createDoubleEliminationBracket(
  input: DoubleEliminationBracketInput
) {
  const bracketData = await generateDoubleEliminationData(
    input.title,
    input.participantNames
  );
  const participantCount = bracketData.participant.length;
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("cgs_double_elimination_brackets")
    .insert({
      slug: input.slug,
      title: input.title,
      subtitle: input.subtitle,
      status_label: input.statusLabel,
      participant_count: participantCount,
      is_published: input.isPublished,
      is_live: input.isLive,
      bracket_data: bracketData,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return Number(data.id);
}

export async function updateDoubleEliminationBracketSettings(
  id: number,
  input: DoubleEliminationBracketSettingsInput
) {
  const { error } = await getSupabaseAdmin()
    .from("cgs_double_elimination_brackets")
    .update({
      slug: input.slug,
      title: input.title,
      subtitle: input.subtitle,
      status_label: input.statusLabel,
      is_published: input.isPublished,
      is_live: input.isLive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function recordDoubleEliminationWinner(
  bracketId: number,
  matchId: number,
  winnerSide: 1 | 2
) {
  const row = await getBracketRowById(bracketId);

  if (!row) {
    throw new Error("Bracket not found.");
  }

  const storage = new InMemoryDatabase();
  await storage.setData(cloneBracketData(row.bracket_data));
  const manager = new BracketsManager(storage);

  await manager.update.match({
    id: matchId,
    opponent1: { result: winnerSide === 1 ? "win" : "loss" },
    opponent2: { result: winnerSide === 2 ? "win" : "loss" },
  });

  const bracketData = await manager.get.tournamentData(0);
  const { error } = await getSupabaseAdmin()
    .from("cgs_double_elimination_brackets")
    .update({
      bracket_data: bracketData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bracketId);

  if (error) {
    throw error;
  }
}

export async function resetDoubleEliminationMatch(
  bracketId: number,
  matchId: number
) {
  const row = await getBracketRowById(bracketId);

  if (!row) {
    throw new Error("Bracket not found.");
  }

  const storage = new InMemoryDatabase();
  await storage.setData(cloneBracketData(row.bracket_data));
  const manager = new BracketsManager(storage);

  await manager.reset.matchResults(matchId);

  const bracketData = await manager.get.tournamentData(0);
  const { error } = await getSupabaseAdmin()
    .from("cgs_double_elimination_brackets")
    .update({
      bracket_data: bracketData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bracketId);

  if (error) {
    throw error;
  }
}
