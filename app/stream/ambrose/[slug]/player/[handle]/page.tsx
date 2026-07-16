import type { Metadata } from "next";
import { notFound } from "next/navigation";

import StreamPlayerIntroOverlay from "@/components/ambrose/StreamPlayerIntroOverlay";
import {
  getPublicPlayerProfileByHandle,
  getPublishedAmbroseEventBySlug,
  type AmbroseEvent,
} from "@/lib/ambrose-events";

type StreamPlayerIntroPageProps = {
  params: Promise<{
    slug: string;
    handle: string;
  }>;
};

export const dynamic = "force-dynamic";

function normalizeHandle(value: string) {
  return value.trim().toLowerCase();
}

function findEventPlayer(event: AmbroseEvent, handle: string) {
  const normalizedHandle = normalizeHandle(handle);

  for (const team of event.teams) {
    const member = team.members.find(
      (teamMember) =>
        teamMember.profile &&
        normalizeHandle(teamMember.profile.handle) === normalizedHandle
    );

    if (member?.profile) {
      return member.profile;
    }
  }

  return null;
}

export async function generateMetadata({
  params,
}: StreamPlayerIntroPageProps): Promise<Metadata> {
  const { slug, handle } = await params;
  const event = await getPublishedAmbroseEventBySlug(slug);
  const profile = event ? findEventPlayer(event, handle) : null;
  const displayName =
    profile?.nickname || profile?.displayName || profile?.handle || "CGS Player";

  return {
    title: `${displayName} Stream Player Intro`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function StreamPlayerIntroPage({
  params,
}: StreamPlayerIntroPageProps) {
  const { slug, handle } = await params;
  const event = await getPublishedAmbroseEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const profile = findEventPlayer(event, handle);

  if (!profile) {
    notFound();
  }

  const publicProfile = await getPublicPlayerProfileByHandle(profile.handle);

  return (
    <main className="stream-player-page">
      <StreamPlayerIntroOverlay
        handle={profile.handle}
        initialEvent={event}
        initialSeasonStats={publicProfile?.stats ?? null}
      />
    </main>
  );
}
