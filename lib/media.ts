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

const FALLBACK_VIDEOS: YouTubeVideo[] = [
  {
    id: "PI0dnoZN_8M",
    title: "CGS A/B Grand Final | Elite Division Showdown at TPC Sawgrass",
    url: "https://www.youtube.com/watch?v=PI0dnoZN_8M",
    thumbnail: "https://i1.ytimg.com/vi/PI0dnoZN_8M/hqdefault.jpg",
    description:
      "The Crossodog Golf Society A/B Grand Final brings together the top players of the season for one final showdown at TPC Sawgrass.",
    publishedAt: "2026-04-03T11:25:37+00:00",
    publishedLabel: "3 Apr 2026",
    viewCount: 0,
    viewCountLabel: "0 views",
    isShort: false,
  },
  {
    id: "UszhKjiAB8I",
    title: "Tee Lounge C/D Grand Final | TPC Sawgrass 18-Hole Scramble",
    url: "https://www.youtube.com/watch?v=UszhKjiAB8I",
    thumbnail: "https://i2.ytimg.com/vi/UszhKjiAB8I/hqdefault.jpg",
    description:
      "The Tee Lounge C/D Grand Final heads to one of the most iconic courses in the world: TPC Sawgrass.",
    publishedAt: "2026-04-03T10:45:56+00:00",
    publishedLabel: "3 Apr 2026",
    viewCount: 1,
    viewCountLabel: "1 view",
    isShort: false,
  },
  {
    id: "3qsxtgQcbR0",
    title: "Round 8 Overview | The Australian Golf Club (CGS Season 1)",
    url: "https://www.youtube.com/watch?v=3qsxtgQcbR0",
    thumbnail: "https://i4.ytimg.com/vi/3qsxtgQcbR0/hqdefault.jpg",
    description:
      "Round 8 takes CGS to one of Australia's most prestigious layouts: The Australian Golf Club in Sydney.",
    publishedAt: "2026-03-21T04:34:03+00:00",
    publishedLabel: "21 Mar 2026",
    viewCount: 49,
    viewCountLabel: "49 views",
    isShort: false,
  },
  {
    id: "gvq3g0DcTIQ",
    title: "Don't miss your chance! #golf #cgs",
    url: "https://www.youtube.com/shorts/gvq3g0DcTIQ",
    thumbnail: "https://i4.ytimg.com/vi/gvq3g0DcTIQ/hqdefault.jpg",
    description: "Short-form CGS promo content built for discovery.",
    publishedAt: "2026-03-19T10:14:45+00:00",
    publishedLabel: "19 Mar 2026",
    viewCount: 4619,
    viewCountLabel: "4.6K views",
    isShort: true,
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
      const response = await fetch(FEED_URL, {
        next: { revalidate: 900 },
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
