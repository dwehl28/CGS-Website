"use client";

import Link from "next/link";

type TwitchPanelProps = {
  channel: string;
  href: string;
};

export default function TwitchPanel({ channel, href }: TwitchPanelProps) {
  const src = `https://player.twitch.tv/?channel=${channel}&parent=localhost&parent=127.0.0.1&parent=crossodoggolf.com&parent=www.crossodoggolf.com&muted=true`;

  return (
    <div className="panel rounded-[2rem] p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">
            Live stage
          </p>
          <h3 className="mt-2 text-3xl">Twitch control room</h3>
        </div>

        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-semibold text-white"
        >
          Open Twitch
        </Link>
      </div>

      <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/35">
        <div className="aspect-video w-full">
          <iframe
            src={src}
            title="CGS Twitch channel"
            allowFullScreen
            className="h-full w-full border-0"
          />
        </div>
      </div>

      <p className="mt-4 text-sm text-zinc-400">
        If the stream is offline, the channel page will still be the best place
        to see when CGS goes live next.
      </p>
    </div>
  );
}
