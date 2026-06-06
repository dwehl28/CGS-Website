import { siteConfig } from "@/lib/site-content";

export type YouTubeVideo = {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  description: string;
  publishedAt: string;
  publishedLabel: string;
  viewCount: number;
  viewCountLabel: string;
  isShort: boolean;
};

export type MediaHubData = {
  channelTitle: string;
  channelUrl: string;
  uploadsPlaylistUrl: string;
  featuredVideo: YouTubeVideo;
  videos: YouTubeVideo[];
  feedMode: "live" | "fallback";
  feedStatusLabel: string;
  feedSyncedLabel: string;
  stats: Array<{
    label: string;
    value: string;
  }>;
};

const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${siteConfig.youtubeChannelId}`;
const YOUTUBE_FEED_TIMEOUT_MS = 3500;

const FALLBACK_VIDEOS: YouTubeVideo[] = [
  {
    id: "Cfv3sKLNVig",
    title: "CGS Season 2 - B Grade Finals",
    url: "https://www.youtube.com/watch?v=Cfv3sKLNVig",
    thumbnail: "https://i4.ytimg.com/vi/Cfv3sKLNVig/hqdefault.jpg",
    description:
      "After four weeks of competition, the B Grade finalists head to Augusta to close out Season 2.",
    publishedAt: "2026-05-14T00:18:06+00:00",
    publishedLabel: "14 May 2026",
    viewCount: 146,
    viewCountLabel: "146 views",
    isShort: false,
  },
  {
    id: "gZjw-iSFTws",
    title: "CGS Season 2 - A Grade Grand Final",
    url: "https://www.youtube.com/watch?v=gZjw-iSFTws",
    thumbnail: "https://i4.ytimg.com/vi/gZjw-iSFTws/hqdefault.jpg",
    description:
      "Four weeks of competition came down to one A Grade Grand Final night.",
    publishedAt: "2026-05-12T12:41:08+00:00",
    publishedLabel: "12 May 2026",
    viewCount: 124,
    viewCountLabel: "124 views",
    isShort: false,
  },
  {
    id: "FOYhSVt3TsE",
    title: "Results from our first ever CGS Major! How did the boys stack up?",
    url: "https://www.youtube.com/shorts/FOYhSVt3TsE",
    thumbnail: "https://i3.ytimg.com/vi/FOYhSVt3TsE/hqdefault.jpg",
    description:
      "A quick results clip from the first CGS Major.",
    publishedAt: "2026-05-09T11:02:10+00:00",
    publishedLabel: "9 May 2026",
    viewCount: 2222,
    viewCountLabel: "2.2K views",
    isShort: true,
  },
  {
    id: "xVcgUB5cco8",
    title: "The Crossodog Golf Society debuts LIVE on YouTube",
    url: "https://www.youtube.com/watch?v=xVcgUB5cco8",
    thumbnail: "https://i1.ytimg.com/vi/xVcgUB5cco8/hqdefault.jpg",
    description:
      "Catch CGS live on Tuesday nights at 7pm AEST as the society moves deeper into live coverage.",
    publishedAt: "2026-05-06T12:38:40+00:00",
    publishedLabel: "6 May 2026",
    viewCount: 1897,
    viewCountLabel: "1.9K views",
    isShort: false,
  },
];

type MediaFeedResult = {
  videos: YouTubeVideo[];
  mode: "live" | "fallback";
  statusLabel: string;
  syncedLabel: string;
};

function decodeXmlEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function cleanText(value: string) {
  return decodeXmlEntities(value).replace(/\s+/g, " ").trim();
}

function getTagValue(block: string, tag: string) {
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  return cleanText(block.match(pattern)?.[1] ?? "");
}

function getAttributeValue(block: string, tag: string, attribute: string) {
  const pattern = new RegExp(
    `<${tag}[^>]*${attribute}="([^"]+)"[^>]*\\/?>`
  );
  return cleanText(block.match(pattern)?.[1] ?? "");
}

function formatPublishedLabel(isoString: string) {
  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return "Recently uploaded";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatViewCount(value: number) {
  if (value <= 0) {
    return "Fresh upload";
  }

  const formatter = new Intl.NumberFormat("en-AU", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  });

  const label = formatter.format(value);
  return `${label} views`;
}

function formatSyncLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function parseFeed(xml: string) {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];

  return entries
    .map((entryMatch) => {
      const entry = entryMatch[1];
      const id = getTagValue(entry, "yt:videoId");
      const title = getTagValue(entry, "title");
      const url = getAttributeValue(entry, "link", "href");
      const thumbnail =
        getAttributeValue(entry, "media:thumbnail", "url") ||
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      const publishedAt = getTagValue(entry, "published");
      const description = getTagValue(entry, "media:description");
      const viewCount = Number.parseInt(
        getAttributeValue(entry, "media:statistics", "views"),
        10
      );
      const safeViewCount = Number.isFinite(viewCount) ? viewCount : 0;

      return {
        id,
        title,
        url,
        thumbnail,
        description,
        publishedAt,
        publishedLabel: formatPublishedLabel(publishedAt),
        viewCount: safeViewCount,
        viewCountLabel: formatViewCount(safeViewCount),
        isShort: url.includes("/shorts/"),
      } satisfies YouTubeVideo;
    })
    .filter((video) => video.id && video.title && video.url);
}

async function fetchYouTubeFeed(): Promise<MediaFeedResult> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, YOUTUBE_FEED_TIMEOUT_MS);

      try {
        const response = await fetch(FEED_URL, {
          next: { revalidate: 900 },
          signal: controller.signal,
          headers: {
            Accept: "application/atom+xml,text/xml;q=0.9,*/*;q=0.8",
            "User-Agent":
              "Mozilla/5.0 (compatible; CrossodogGolfSite/1.0; +https://crossodoggolf.com)",
          },
        });

        if (!response.ok) {
          throw new Error(`YouTube feed failed: ${response.status}`);
        }

        const xml = await response.text();
        const videos = parseFeed(xml);

        if (videos.length > 0) {
          return {
            videos,
            mode: "live",
            statusLabel: "Live YouTube feed",
            syncedLabel: formatSyncLabel(),
          };
        }

        throw new Error("YouTube feed returned no videos.");
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      lastError = error;
    }
  }

  console.error("Unable to fetch CGS YouTube feed", lastError);

  return {
    videos: FALLBACK_VIDEOS,
    mode: "fallback",
    statusLabel: "Curated CGS fallback",
    syncedLabel: formatSyncLabel(),
  };
}

export async function getMediaHubData(limit = 6): Promise<MediaHubData> {
  const feed = await fetchYouTubeFeed();
  const videos = feed.videos.slice(0, limit);
  const featuredVideo = videos[0] ?? FALLBACK_VIDEOS[0];
  const shortCount = videos.filter((video) => video.isShort).length;
  const longFormCount = Math.max(videos.length - shortCount, 0);
  const topViewedVideo = [...videos].sort(
    (left, right) => right.viewCount - left.viewCount
  )[0];

  return {
    channelTitle: siteConfig.name,
    channelUrl: siteConfig.youtubeChannelUrl,
    uploadsPlaylistUrl: `https://www.youtube.com/playlist?list=UU${siteConfig.youtubeChannelId.slice(
      2
    )}`,
    featuredVideo,
    videos,
    feedMode: feed.mode,
    feedStatusLabel: feed.statusLabel,
    feedSyncedLabel: feed.syncedLabel,
    stats: [
      {
        label: "Recent uploads surfaced",
        value: `${videos.length}`,
      },
      {
        label: "Long-form videos",
        value: `${longFormCount}`,
      },
      {
        label: "Short-form clips",
        value: `${shortCount}`,
      },
      {
        label: "Top recent pull",
        value: topViewedVideo?.viewCountLabel ?? "Fresh uploads",
      },
    ],
  };
}
