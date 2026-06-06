import type { Metadata } from "next";

import PageIntro from "@/components/PageIntro";
import { getMediaHubData } from "@/lib/media";
import { buildMetadata } from "@/lib/seo";
import { siteConfig, socialLinks } from "@/lib/site-content";

export const metadata: Metadata = buildMetadata({
  title: "Media",
  description:
    "Follow Crossodog Golf Society across Instagram, TikTok, YouTube, and Twitch for clips, events, and livestreams.",
  path: "/media",
});

export default async function MediaPage() {
  const mediaData = await getMediaHubData(6);

  return (
    <main className="min-h-screen text-white">
      <section className="page-shell">
        <PageIntro
          eyebrow="Creator-led golf media"
          title="CGS Media Room"
          description="Start with the latest upload, then move into the full mix of highlights, livestreams, and short-form clips."
          align="center"
          actions={[
            {
              href: siteConfig.youtubeChannelUrl,
              label: "Open YouTube",
              external: true,
            },
            {
              href: siteConfig.linktreeUrl,
              label: "Open Linktree",
              external: true,
              variant: "secondary",
            },
          ]}
        >
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
            <span className="chip text-zinc-100">{mediaData.feedStatusLabel}</span>
            <span className="text-zinc-500">
              Updated {mediaData.feedSyncedLabel}
            </span>
          </div>
        </PageIntro>

        <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <a
            href={mediaData.featuredVideo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="panel rounded-[2rem] p-5 md:p-6"
          >
            <div
              className="video-thumb min-h-[20rem] rounded-[1.5rem] border border-white/10"
              style={{
                backgroundImage: `url(${mediaData.featuredVideo.thumbnail})`,
              }}
            />

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-[var(--accent)]">
                  Featured upload
                </p>
                <h2 className="mt-3 text-4xl">{mediaData.featuredVideo.title}</h2>
              </div>
              <span className="chip text-xs uppercase tracking-[0.16em] text-zinc-100">
                {mediaData.featuredVideo.viewCountLabel}
              </span>
            </div>

            <p className="mt-4 max-w-3xl leading-7 text-zinc-300">
              {mediaData.featuredVideo.description}
            </p>
            <p className="mt-4 text-sm text-zinc-500">
              Published {mediaData.featuredVideo.publishedLabel}
            </p>
          </a>

          <div className="grid gap-6">
            <div className="panel rounded-[2rem] p-6">
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--accent)]">
                Channel snapshot
              </p>
              <h2 className="mt-3 text-3xl">{siteConfig.creatorBio}</h2>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {mediaData.stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="subtle-grid-card rounded-[1.25rem] px-4 py-4"
                  >
                    <p className="text-2xl font-semibold text-white">{stat.value}</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel rounded-[2rem] p-6">
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--tan)]">
                Follow CGS
              </p>

              <div className="mt-5 grid gap-3">
                {socialLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="subtle-grid-card rounded-[1.2rem] px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                          {link.category}
                        </p>
                        <h3 className="mt-1 text-2xl">{link.label}</h3>
                      </div>
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: link.accent }}
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-3 text-sm leading-7 text-zinc-400">
                      {link.description}
                    </p>
                    <p className="mt-2 text-sm text-zinc-500">{link.handle}</p>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <div className="eyebrow">Recent uploads</div>
              <h2 className="mt-4 text-4xl">Latest from the CGS feed</h2>
            </div>
            <a
              href={siteConfig.youtubeChannelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]"
            >
              View channel
            </a>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {mediaData.videos.map((video) => (
              <a
                key={video.id}
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="panel rounded-[1.75rem] p-4"
              >
                <div
                  className="video-thumb min-h-[14rem] rounded-[1.25rem] border border-white/10"
                  style={{ backgroundImage: `url(${video.thumbnail})` }}
                />

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--tan)]">
                    {video.isShort ? "Short-form clip" : "Long-form video"}
                  </p>
                  <span className="text-xs text-zinc-500">{video.viewCountLabel}</span>
                </div>

                <h3 className="mt-2 text-2xl">{video.title}</h3>
                <p className="mt-3 line-clamp-3 text-sm leading-7 text-zinc-400">
                  {video.description || "Open the video to watch the latest CGS upload."}
                </p>
                <p className="mt-4 text-sm text-zinc-500">{video.publishedLabel}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
