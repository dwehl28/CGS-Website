export type NavLink = {
  href: string;
  label: string;
};

export type SelectOption = {
  value: string;
  label: string;
};

export type ProcessStep = {
  title: string;
  description: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type ContentCard = {
  title: string;
  description: string;
};

export type SocialLink = {
  label: string;
  href: string;
  category: string;
  description: string;
  handle: string;
  accent: string;
};

export type EventRecord = {
  slug: string;
  href: string;
  category: string;
  isArchived?: boolean;
  homepageBadge: string;
  title: string;
  titleWithDate: string;
  startDate: string;
  endDate?: string;
  teaser: string;
  summary: string;
  scheduleLabel: string;
  pricingLabel?: string;
  overview: Array<{
    label: string;
    value: string;
  }>;
  body: string[];
  pathways: ContentCard[];
  faqs: FaqItem[];
  interestForm: {
    title: string;
    description: string;
    buttonLabel: string;
    showHandicap: boolean;
    options: SelectOption[];
  };
};

export type CompetitionArchiveRecord = {
  title: string;
  label: string;
  description: string;
  href: string;
  resultLabel: string;
  resultHref: string;
};

export const siteConfig = {
  name: "Crossodog Golf Society",
  shortName: "CGS",
  tagline: "Where golf meets the average person",
  description:
    "Crossodog Golf Society is a golf community for everyday players with events, creator-led content, merch, and a growing clubhouse-style sports hub.",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  email: "crossodoggolf@gmail.com",
  merchUrl: "https://crossodoggolfs-shop.bigcartel.com",
  linktreeUrl: "https://linktr.ee/crossodoggolf",
  twitchChannel: "crossodog",
  youtubeChannelId: "UCzRNAxDer9Hlx52nWQJlbLA",
  youtubeChannelUrl: "https://www.youtube.com/@CrossodogGolfSociety",
  creatorBio:
    "Join the Crossodog Golf Society for fun, camaraderie, and real competition on the green.",
};

export const navigationLinks: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/scoreboard", label: "Scoreboard" },
  { href: "/membership", label: "Membership" },
  { href: "/merch", label: "Merch" },
  { href: "/media", label: "Media" },
  { href: "/contact", label: "Contact" },
  { href: "/sports", label: "Sports Hub" },
];

export const supportLinks: NavLink[] = [
  { href: "/about", label: "About CGS" },
  { href: "/privacy", label: "Privacy" },
  { href: "/contact", label: "Contact" },
];

export const siteRoutes: NavLink[] = [...navigationLinks, ...supportLinks].filter(
  (link, index, routes) =>
    routes.findIndex((candidate) => candidate.href === link.href) === index
);

export const socialLinks: SocialLink[] = [
  {
    label: "Instagram",
    href: "https://instagram.com/crossodoggolf",
    category: "Social",
    description:
      "Daily CGS presence with event visuals, community updates, and polished brand moments.",
    handle: "@crossodoggolf",
    accent: "#f5b5d9",
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@crossogs",
    category: "Short-form",
    description:
      "Fast hooks, short-form clips, promo moments, and the playful side of the CGS brand.",
    handle: "@crossogs",
    accent: "#a9f2ff",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@CrossodogGolfSociety",
    category: "Video",
    description:
      "Home for full highlights, round overviews, season stories, and big-match coverage.",
    handle: "@CrossodogGolfSociety",
    accent: "#ff8f8f",
  },
  {
    label: "Twitch",
    href: "https://www.twitch.tv/crossodog",
    category: "Live",
    description:
      "Live golf rounds, event coverage, and the raw version of CGS as it unfolds in real time.",
    handle: "@crossodog",
    accent: "#c9a4ff",
  },
];

export const clubhouseStats = [
  {
    value: "Season 3",
    label: "Underway after the Monday 25 May launch",
  },
  {
    value: "7 teams",
    label: "CGS teams back into the Ambrose format",
  },
  {
    value: "Ambrose",
    label: "New faces, new teams, and team golf pressure",
  },
  {
    value: "Season 2",
    label: "Finals now archived with result links",
  },
];

export const homeSpotlights = [
  {
    key: "events",
    eyebrow: "Season 3 live",
    title: "The current CGS team season is underway.",
    description:
      "Season 3 launched Monday 25 May 2026 at 7pm AEST with seven CGS teams, new faces, new combinations, and a return to Ambrose competition.",
    href: "/events",
    ctaLabel: "See the calendar",
    highlights: [
      "Seven CGS teams involved from the opening night",
      "Ambrose format returns after the solo Stableford season",
      "Season 2 and Major results stay available in the archive",
    ],
  },
  {
    key: "media",
    eyebrow: "Creator-first golf",
    title: "The media arm gives the brand its pulse.",
    description:
      "CGS is more than a golf content feed. It is a full ecosystem spanning shorts, livestreams, round packages, and social storytelling.",
    href: "/media",
    ctaLabel: "Open media room",
    highlights: [
      "Real YouTube uploads surfaced directly on-site",
      "Distinct platform roles instead of duplicate posts everywhere",
      "Short-form, highlights, and livestream coverage all have a place",
    ],
  },
  {
    key: "membership",
    eyebrow: "Community layer",
    title: "Membership should feel like joining a club with momentum.",
    description:
      "The CGS proposition works because it welcomes followers, players, and future collaborators into one shared identity.",
    href: "/membership",
    ctaLabel: "Join the clubhouse",
    highlights: [
      "Free and paid paths into the community",
      "Clear path from audience member to event player",
      "Designed for growth without losing the casual energy",
    ],
  },
  {
    key: "sports",
    eyebrow: "Clubhouse conversation",
    title: "The Sports Hub extends CGS beyond golf itself.",
    description:
      "AFL, NRL, F1, and PGA coverage gives the site a clubhouse feel and keeps the brand active between event launches.",
    href: "/sports",
    ctaLabel: "Check the hub",
    highlights: [
      "Rotating fixtures, results, and ladder-ready views",
      "A shared sports conversation that suits the community",
      "Future-ready foundation for richer live data feeds",
    ],
  },
];

export const seasonMoments = [
  {
    title: "Season 3 opener",
    label: "25 May",
    description:
      "The new team season launched Monday 25 May 2026 at 7pm AEST, with the first Ambrose night setting the tone.",
  },
  {
    title: "Seven CGS teams",
    label: "Team field",
    description:
      "Seven CGS teams are involved this season, bringing new faces, new pairings, and fresh leaderboard movement.",
  },
  {
    title: "Ambrose is back",
    label: "Format",
    description:
      "Season 3 shifts back into team Ambrose, so decisions, chemistry, and clutch second shots matter again.",
  },
  {
    title: "Results archive",
    label: "Past comps",
    description:
      "Season 2, the CGS Major, and earlier competitions now live as archive entries for anyone checking the history.",
  },
];

export const contentPrograms = [
  {
    title: "Round overviews",
    description:
      "Preview the course, the format, the strategy, and what pressure points matter before the round begins.",
  },
  {
    title: "Highlight packages",
    description:
      "Cut-down edits that capture swings in momentum, clutch shots, mistakes, and reactions.",
  },
  {
    title: "Short-form hooks",
    description:
      "Quick clips for attention, discovery, and repeat exposure across TikTok, Instagram, and YouTube Shorts.",
  },
  {
    title: "Livestream coverage",
    description:
      "Where the audience can watch rounds unfold live, catch personalities in real time, and feel closest to the CGS world.",
  },
];

export const membershipTiers = [
  {
    name: "Online Social",
    price: "Free",
    summary:
      "Perfect for people who want to follow CGS content, keep up with events, and be part of the online community.",
    highlights: [
      "Follow CGS updates",
      "Stay in the loop with events",
      "Connect with the CGS brand and content",
    ],
    ctaLabel: "Join Free",
    featured: false,
  },
  {
    name: "Playing Member",
    price: "Paid",
    summary:
      "Best for golfers who want to play in CGS events, put their hand up for Season 3, access member pricing, and take part in the in-person side of the society.",
    highlights: [
      "Play in CGS events and Season 3 competitions",
      "Discounted event entry",
      "Priority access to selected events",
    ],
    ctaLabel: "Join Now",
    featured: true,
  },
];

export const membershipSteps: ProcessStep[] = [
  {
    title: "Choose your lane",
    description:
      "Pick the free Online Social option if you mainly want updates, or the Playing Member path if you want to get involved in events.",
  },
  {
    title: "Send your interest",
    description:
      "Submit the membership form with the basics CGS needs, including whether you are interested in playing events.",
  },
  {
    title: "Get the next details",
    description:
      "CGS can follow up with membership information, Season 3 timing, and the best next step based on how involved you want to be.",
  },
];

export const membershipFaqs: FaqItem[] = [
  {
    question: "Do I need to be a serious golfer to join?",
    answer:
      "No. The CGS brand is built around everyday players and a more welcoming clubhouse feel, not gatekeeping or elite-only golf culture.",
  },
  {
    question: "Can I join even if I only want the content side?",
    answer:
      "Yes. The Online Social option is there for people who want to follow the events, videos, and wider CGS story without committing to playing.",
  },
  {
    question: "Do I need an official handicap?",
    answer:
      "Not always. If a playing event needs handicap information, CGS can sort out what is useful for that format when following up.",
  },
  {
    question: "What happens after I submit the form?",
    answer:
      "Your details go through to CGS so the right membership or event information can be sent back to you. It is an expression of interest, not a locked contract.",
  },
];

export const aboutPillars: ContentCard[] = [
  {
    title: "Built for everyday golfers",
    description:
      "CGS is meant to feel open, social, and competitive without pretending everyone needs elite credentials to belong.",
  },
  {
    title: "Content with a real season behind it",
    description:
      "The rounds, majors, livestreams, and recap videos all point back to one living calendar instead of isolated one-off posts.",
  },
  {
    title: "A brand with room to grow",
    description:
      "Events, memberships, merch, and community partnerships are designed to scale without losing the relaxed clubhouse energy.",
  },
];

export const aboutCommitments: ProcessStep[] = [
  {
    title: "Show up consistently",
    description:
      "CGS wants the site, content, and events to feel active and maintained, not like a brand that appears once and disappears.",
  },
  {
    title: "Keep the door open",
    description:
      "The whole point is to give casual golfers and curious supporters a place to jump in without needing to decode golf culture first.",
  },
  {
    title: "Make moments feel bigger",
    description:
      "Majors, streams, finals, and merch drops work best when they feel like chapters in one ongoing CGS story.",
  },
];

export const merchItems = [
  {
    name: "CGS Shirts",
    description:
      "Clean CGS-branded shirts built for the community, content, and event days.",
    note: "Sizing and current design options are available through the official CGS store.",
  },
  {
    name: "CGS Golf Balls",
    description:
      "CGS golf balls for players who want to bring the brand onto the course.",
    note: "Limited runs and future merch drops will be listed through the CGS store.",
  },
];

export const merchPrinciples = [
  {
    title: "Wearable, not novelty",
    description:
      "The best CGS merch should feel like something you would actually wear to the range, the sim room, or a casual night out.",
  },
  {
    title: "Clubhouse identity",
    description:
      "Merch is one of the clearest ways to make the audience feel like they belong to something bigger than a content channel.",
  },
  {
    title: "Drop potential",
    description:
      "The brand can grow into seasonal drops, event-specific pieces, and collaborations without changing its core identity.",
  },
];

export const merchSteps: ProcessStep[] = [
  {
    title: "Browse the current drop",
    description:
      "Start in the official CGS store to see what is live right now instead of guessing from social posts or older promos.",
  },
  {
    title: "Order through the official store",
    description:
      "Checkout happens in the external CGS merch store, which keeps product, sizing, and fulfilment details in one clear place.",
  },
  {
    title: "Watch for future releases",
    description:
      "The plan is to grow from staple items into event-specific pieces, seasonal drops, and more polished capsule releases.",
  },
];

export const merchFaqs: FaqItem[] = [
  {
    question: "Where do I actually buy CGS merch?",
    answer:
      "All live products are sold through the official CGS store, which is where current releases, sizing, and drop details are kept up to date.",
  },
  {
    question: "Will there be more than shirts and balls later on?",
    answer:
      "Yes. The current store is the starting point, with room for future event-specific pieces, repeatable staple items, and more intentional seasonal drops.",
  },
  {
    question: "Does the merch matter beyond just selling products?",
    answer:
      "It does. Merch is one of the clearest ways to make the community feel like it belongs to the same club, especially across events, content, and livestreams.",
  },
];

export const sportsSections = [
  {
    label: "Golf",
    title: "PGA Tour",
    description:
      "The golf side of the clubhouse feed, with fixtures, results, and major-championship energy.",
  },
  {
    label: "Football",
    title: "AFL",
    description:
      "Weekly AFL conversation with fixtures, recent scores, and ladder-ready positioning.",
  },
  {
    label: "Rugby League",
    title: "NRL",
    description:
      "NRL matchups, results, and table movement built into the CGS clubhouse rhythm.",
  },
  {
    label: "Motorsport",
    title: "Formula 1",
    description:
      "Race weekends, latest results, and standings-style coverage for the motorsport crowd.",
  },
];

export const partnershipReasons = [
  {
    title: "Clear audience identity",
    description:
      "CGS speaks to everyday players who want golf to feel competitive, social, and welcoming at the same time.",
  },
  {
    title: "Multi-platform reach",
    description:
      "Events, livestreams, long-form videos, and short-form clips create more than one path for a brand to appear naturally.",
  },
  {
    title: "Built-in recurring moments",
    description:
      "League rounds, majors, charity content, and merch drops create regular partnership touchpoints across the calendar.",
  },
];

export const contactFaqs: FaqItem[] = [
  {
    question: "What should I use the contact form for?",
    answer:
      "Use it for general questions, memberships, events, collaborations, merch, or sponsorship conversations. If it relates to CGS, it belongs there.",
  },
  {
    question: "Can brands or creators reach out here?",
    answer:
      "Yes. Sponsors, collaborators, livestream partners, charity supporters, and creators can all reach out here.",
  },
  {
    question: "What if I just want a quick answer?",
    answer:
      "Email is best for simple enquiries, while the form is better when you want to add more context.",
  },
];

export const privacyPrinciples: ContentCard[] = [
  {
    title: "Only the details CGS needs",
    description:
      "Forms on the site are designed to collect enough information to reply properly, not to build an oversized profile on visitors.",
  },
  {
    title: "Used for the conversation you started",
    description:
      "If you submit a membership, event, or contact form, CGS uses those details to follow up about that interest and related club information.",
  },
  {
    title: "Plain-English handling",
    description:
      "The aim is simple: keep data secure, avoid unnecessary sharing, and give people a clear way to ask what is being stored or to request removal.",
  },
];

export const privacyFaqs: FaqItem[] = [
  {
    question: "What information does the site collect?",
    answer:
      "The site collects the details you choose to submit through forms, such as your name, email, phone number, membership interest, or event notes.",
  },
  {
    question: "Why does CGS keep this information?",
    answer:
      "It is used to respond to your enquiry, manage membership and event expressions of interest, and keep communication relevant to the reason you reached out.",
  },
  {
    question: "Can I ask for my details to be removed?",
    answer:
      "Yes. If you email CGS and request deletion, the team can review and remove the stored contact details associated with your enquiry where appropriate.",
  },
];

export const contactEnquiryOptions: SelectOption[] = [
  { value: "general", label: "General question" },
  { value: "membership", label: "Membership question" },
  { value: "event", label: "Event question" },
  { value: "partnership", label: "Sponsor or collaboration" },
  { value: "merch", label: "Merch question" },
];

export const events: EventRecord[] = [
  {
    slug: "season-3",
    href: "/events/season-3",
    category: "Current Season",
    homepageBadge: "Live season",
    title: "Season 3",
    titleWithDate: "Season 3 - Underway after Monday 25 May",
    startDate: "2026-05-25T19:00:00+10:00",
    endDate: "2026-07-06T21:00:00+10:00",
    teaser: "Seven-team Ambrose season",
    summary:
      "Season 3 launched Monday 25 May 2026 at 7pm AEST, with seven CGS teams, new faces, new team combinations, and a return to the Ambrose competition format.",
    scheduleLabel: "Launched Monday 25 May 2026 at 7pm AEST | Seven CGS teams | Ambrose format",
    overview: [
      { label: "Start", value: "Monday 25 May" },
      { label: "Time", value: "7pm AEST" },
      { label: "Format", value: "Team Ambrose" },
      { label: "Teams", value: "7 CGS teams" },
      { label: "Season feel", value: "New faces + new teams" },
      { label: "Status", value: "Underway" },
    ],
    body: [
      "Season 3 resets the CGS competition story and brings the field back into team golf. After the solo Stableford run of Season 2, the league returns to Ambrose with seven CGS teams involved from the opening night.",
      "The season launched Monday 25 May 2026 at 7pm AEST. Expect new faces, new team combinations, and the kind of pressure that comes when every shot can set up the next player.",
    ],
    pathways: [
      {
        title: "For players",
        description:
          "This is the team format returning, so communication, confidence, and knowing when to attack will matter from night one.",
      },
      {
        title: "For members",
        description:
          "Season 3 is the clearest current path into the playing side of CGS, especially for members who want weekly competition rhythm.",
      },
      {
        title: "For followers",
        description:
          "Seven teams gives the leaderboard more movement, more storylines, and more names to follow across the season.",
      },
    ],
    faqs: [
      {
        question: "When does Season 3 start?",
        answer:
          "Season 3 started Monday 25 May 2026 at 7pm AEST.",
      },
      {
        question: "What format is Season 3?",
        answer:
          "Season 3 returns to the Ambrose team format, with seven CGS teams involved this season.",
      },
      {
        question: "Is Season 3 different from Season 2?",
        answer:
          "Yes. Season 2 was a solo Stableford competition, while Season 3 moves back into team Ambrose with new faces and new teams.",
      },
    ],
    interestForm: {
      title: "Register Season 3 interest",
      description:
        "Drop your details if you want to play, join the reserve list, or keep close to Season 3 updates.",
      buttonLabel: "Send Season 3 interest",
      showHandicap: true,
      options: [
        { value: "player", label: "Player" },
        { value: "reserve", label: "Reserve list" },
        { value: "supporter", label: "Follow the season" },
      ],
    },
  },
  {
    slug: "season-2",
    href: "/events/season-2",
    category: "Past Results",
    isArchived: true,
    homepageBadge: "Results Posted",
    title: "Season 2",
    titleWithDate: "Season 2 - Results Archive",
    startDate: "2026-04-07T09:00:00+10:00",
    endDate: "2026-05-18T21:00:00+10:00",
    teaser: "Solo Stableford finals archive",
    summary:
      "Season 2 is now complete. The solo Stableford run built through four weeks of competition, moved into A Grade and B Grade finals, and left a clean results archive for the CGS record.",
    scheduleLabel: "Completed | A Grade Grand Final and B Grade Finals now available",
    overview: [
      { label: "Format", value: "Solo Stableford" },
      { label: "Status", value: "Completed" },
      { label: "A Grade", value: "Grand Final played" },
      { label: "B Grade", value: "Finals played" },
      { label: "Major stop", value: "CGS Major results posted" },
      { label: "Next season", value: "Season 3 Ambrose" },
    ],
    body: [
      "Season 2 closed out the solo Stableford chapter of CGS. The run moved through four competitive weeks and finished with A Grade and B Grade finals content now sitting in the CGS media archive.",
      "The accessible result posts confirm the A Grade Grand Final, the B Grade Finals at Augusta, the first CGS Major results short, and the first YouTube live push as the key public records from the end of the season.",
    ],
    pathways: [
      {
        title: "A Grade Grand Final",
        description:
          "The A Grade final brought the top end of the season together after four weeks of competition, with CGS members fighting into the final mix.",
      },
      {
        title: "B Grade Finals",
        description:
          "The B Grade finalists headed to Augusta, with the youngest CGS member joining the final-night storyline.",
      },
      {
        title: "Major results",
        description:
          "The first CGS Major produced its own results short, keeping the biggest Season 2 event easy to revisit.",
      },
    ],
    faqs: [
      {
        question: "Is Season 2 still open for registration?",
        answer:
          "No. Season 2 is complete and now lives on the site as a results archive.",
      },
      {
        question: "Where can I watch the Season 2 finals?",
        answer:
          "The CGS YouTube channel has the Season 2 A Grade Grand Final and B Grade Finals available to watch.",
      },
      {
        question: "What comes after Season 2?",
        answer:
          "Season 3 started Monday 25 May 2026 at 7pm AEST and returned CGS to team Ambrose.",
      },
    ],
    interestForm: {
      title: "Season 2 is complete",
      description:
        "Use the Season 3 page if you want to get involved in the next competition.",
      buttonLabel: "View Season 3",
      showHandicap: true,
      options: [
        { value: "player", label: "Player" },
        { value: "reserve", label: "Reserve list" },
        { value: "supporter", label: "Follow the season" },
      ],
    },
  },
  {
    slug: "cgs-major",
    href: "/events/cgs-major",
    category: "Past Results",
    isArchived: true,
    homepageBadge: "Results Posted",
    title: "CGS Major",
    titleWithDate: "CGS Major - 2026 Results Archive",
    startDate: "2026-05-02T12:00:00+10:00",
    endDate: "2026-05-02T21:00:00+10:00",
    teaser: "Waste Management Course - Scratch + Handicap",
    summary:
      "The first CGS Major is now in the results archive, with the event stream, results short, and closest-to-the-pin moment preserved for the CGS record.",
    scheduleLabel: "Completed 2 May | Results, stream, and highlights now archived",
    pricingLabel: "Completed event archive",
    overview: [
      { label: "Date", value: "2 May 2026" },
      { label: "Venue", value: "Waste Management Course" },
      { label: "Format", value: "Scratch + Handicap" },
      { label: "Stream", value: "Archived on YouTube" },
      { label: "Session One", value: "12pm - 4pm" },
      { label: "Session Two", value: "5pm - 9pm" },
      { label: "Member Price", value: "$65" },
      { label: "Public Price", value: "$70" },
    ],
    body: [
      "The first CGS Major became one of the first big showcase moments in the CGS archive, with the event stream, a results short, and the closest-to-the-pin winner clip now available through the media feed.",
      "The event has moved out of registration mode and into results mode. It now works as a reference point for future majors, sponsors, members, and anyone checking how the CGS calendar is growing.",
    ],
    pathways: [
      {
        title: "Event stream",
        description:
          "The full Major stream remains available as the long-form record of the day.",
      },
      {
        title: "Results short",
        description:
          "The quick results clip gives followers a simple way to revisit how the first Major shook out.",
      },
      {
        title: "Closest to pin",
        description:
          "Lachy's closest-to-the-pin prize moment is part of the archived Major story.",
      },
    ],
    faqs: [
      {
        question: "Is the CGS Major still open for registration?",
        answer:
          "No. The 2026 CGS Major has been completed and this page now works as a results archive.",
      },
      {
        question: "Where can I watch the Major?",
        answer:
          "The CGS YouTube channel has the event stream, results short, and related Major clips.",
      },
      {
        question: "Will there be future CGS Majors?",
        answer:
          "The Major is now a proven CGS format and can act as the reference point for future feature events.",
      },
    ],
    interestForm: {
      title: "Major complete",
      description:
        "Use the archive links to revisit the event, or jump to Season 3 for the current competition.",
      buttonLabel: "View Season 3",
      showHandicap: true,
      options: [
        { value: "player", label: "Player" },
        { value: "spectator", label: "Spectator" },
        { value: "supporter", label: "Supporter" },
      ],
    },
  },
  {
    slug: "movember-charity-stream",
    href: "/events/movember-charity-stream",
    category: "Charity Stream",
    homepageBadge: "Community Event",
    title: "Movember Charity Stream",
    titleWithDate: "Movember Charity Stream - 28-29 November",
    startDate: "2026-11-28T08:00:00+10:00",
    endDate: "2026-11-29T08:00:00+10:00",
    teaser: "24-hour challenge stream",
    summary:
      "A 24-hour Crossodog Golf Society challenge stream where the CGS team plays golf the entire time to raise awareness, create content, and support the Movember cause.",
    scheduleLabel: "24-hour challenge stream - 28-29 November",
    overview: [
      { label: "Start", value: "Saturday 28 November" },
      { label: "Finish", value: "Sunday 29 November" },
      { label: "Duration", value: "24 hours" },
      { label: "Format", value: "Continuous golf challenge stream" },
      { label: "Purpose", value: "Charity + content + community" },
      { label: "Status", value: "Planning stage" },
    ],
    body: [
      "The Movember Charity Stream is designed to be one of the biggest community and content moments on the CGS calendar. Over the course of 24 hours, the team will take on a continuous golf challenge while livestreaming the full experience.",
      "This event is about more than golf. It is a charity-driven stream built to bring together supporters, viewers, and the broader CGS audience around a meaningful cause while creating a memorable annual event.",
    ],
    pathways: [
      {
        title: "For sponsors",
        description:
          "A strong fit for brands that want to support a charity-focused CGS moment with natural livestream and social content integration.",
      },
      {
        title: "For volunteers",
        description:
          "Useful support can include behind-the-scenes help, moderation, logistics, and helping the stream keep momentum across the full 24 hours.",
      },
      {
        title: "For supporters",
        description:
          "Even if you are not directly involved in production, the event is designed for viewers, donors, and community members to rally around it.",
      },
    ],
    faqs: [
      {
        question: "Do I need to play golf to help with this event?",
        answer:
          "No. The stream needs more than players. Sponsors, volunteers, collaborators, and community supporters can all play a useful role.",
      },
      {
        question: "What kind of support is most valuable?",
        answer:
          "Brand sponsorship, donated prizes, live promotion, content help, and operational support are all useful depending on how close CGS is to the stream date.",
      },
      {
        question: "Is this mainly a content event or a charity event?",
        answer:
          "It is designed to be both. The goal is to create a meaningful charity moment while also producing a memorable annual CGS stream that people want to support and watch.",
      },
    ],
    interestForm: {
      title: "Support or get involved",
      description:
        "Use this form if you want to sponsor, volunteer, collaborate, or help promote the Movember Charity Stream.",
      buttonLabel: "Send Movember interest",
      showHandicap: false,
      options: [
        { value: "sponsor", label: "Sponsor" },
        { value: "volunteer", label: "Volunteer" },
        { value: "creator", label: "Creator or collaborator" },
        { value: "supporter", label: "Supporter" },
      ],
    },
  },
];

export const competitionArchive: CompetitionArchiveRecord[] = [
  {
    title: "Season 2 Results",
    label: "Solo Stableford",
    description:
      "Season 2 is complete, with the A Grade Grand Final, B Grade Finals, and Major results now collected as the public record.",
    href: "/events/season-2",
    resultLabel: "Watch A Grade Grand Final",
    resultHref: "https://www.youtube.com/watch?v=gZjw-iSFTws",
  },
  {
    title: "CGS Major 2026",
    label: "First Major",
    description:
      "The first CGS Major has moved into the archive with the event stream, results short, and closest-to-the-pin moment available.",
    href: "/events/cgs-major",
    resultLabel: "Watch Major results",
    resultHref: "https://www.youtube.com/shorts/FOYhSVt3TsE",
  },
  {
    title: "Season 1 Grand Final",
    label: "Birdie Hunters",
    description:
      "Season 1 closed with Birdie Hunters on top, Eagles & Shanks one shot back, and Bogey Boys disqualified in the final.",
    href: "/scoreboard",
    resultLabel: "Watch Season 1 final",
    resultHref: "https://www.youtube.com/watch?v=NnVYHGyo3mM",
  },
];

export const upcomingEventCards: EventRecord[] = events.filter(
  (event) => !event.isArchived
);

export function getEventBySlug(slug: string) {
  return events.find((event) => event.slug === slug);
}
