export type AtlasCategory = 'Festivals' | 'Music' | 'Fairs' | 'Arts & Culture';

export type AtmosphereEffect =
  | 'geese'
  | 'fireworks'
  | 'fog'
  | 'snow'
  | 'balloons'
  | 'ferrisGlow';

export type AtlasEvent = {
  searchAliases?: string[];
  pageArchetype?: 'standard' | 'livingScrapbook';
  eventPageKind?: 'manifest';
  iconType?: 'music' | 'fair' | 'food' | 'fireworks' | 'flower' | 'harvest' | 'waterfront' | 'winter' | 'art' | 'heritage';
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  coordinateSource?: {
    label: string;
    url: string;
    method: 'venue-address-geocode' | 'official-coordinates' | 'manual-verification';
  };
  atmosphereLabel: string;
  blurb: string;
  category: AtlasCategory;
  cardTag?: string;
  officialUrl?: `https://${string}`;
  publishedDiscovery?: {
    canonicalEventId: string;
    lifecycleState: 'active';
    verificationState: 'verified';
    packageId: string;
    packageVersion: number;
    targetYear: number;
    packagePublishedAt?: string;
    eventPageVersionId: string;
    eventPageVersionNumber: number;
    eventPagePublishedAt?: string;
  };
  flyerSrc?: `/event-media/${string}` | `https://${string}`;
  x: number;
  y: number;
  atlasNotes?: string[];
  atlasMemories?: string[];
  localFlavor?: string[];
  atmosphere?: {
    effects?: AtmosphereEffect[];
    intensity?: 'subtle' | 'medium' | 'signature';
  };
  regionAtmosphere?: 'lakeshore' | 'northwoods' | 'urban' | 'harvest' | 'winter';
  dateRange?: {
    startDate: string;
    endDate?: string;
    timeZone?: string;
    isEstimated?: boolean;
  };
  cardMedia?: {
    mediaType?: 'image' | 'video';
    mediaSrc?: string;
    posterSrc?: string;
    atmosphereTitle?: string;
    mediaPosition?: string;
    mediaScale?: number;
    mediaMaskProfile?: 'romeoPeach';
    thumbnailSrc?: string;
    thumbnailOverrideSrc?: string;
    thumbnailAlt?: string;
    thumbnailSourceType?: 'override' | 'generated' | 'fallback';
    thumbnailGenerationStatus?: 'manualOverride' | 'generated' | 'fallbackReady' | 'needsGeneration' | 'failed';
    mediaDelayMs?: number;
    mediaFadeDurationMs?: number;
  };
  fullCardBriefing?: {
    intro: string;
    date: string;
    venue: string;
    source: string;
    officialSite: string;
    sections: { title: string; items?: string[]; body?: string }[];
  };
  detailPage?: {
    shortStory: string;
    atmosphereLine?: string;
    posterSrc?: string;
    mediaType?: 'image' | 'video';
    mediaSrc?: string;
    introVideoSrc?: string;
    detailIntro?: string;
    storySections?: string[];
    archivalNote?: string;
    visitorMood?: string;
    eventSnapshot?: {
      typicalMonth?: string;
      setting?: string;
      bestFor?: string;
      signatureMoment?: string;
    };
  };
};

function atmosphere(
  effects: AtmosphereEffect[],
  intensity: NonNullable<AtlasEvent['atmosphere']>['intensity'] = 'subtle'
): AtlasEvent['atmosphere'] {
  return { effects, intensity };
}

export const ATLAS_EVENTS: AtlasEvent[] = [
  {
    id: 'romeo-peach',
    name: 'Romeo Peach Festival',
    location: 'Romeo, MI',
    latitude: 42.8028,
    longitude: -83.01299,
    atmosphereLabel: 'First Peach Queen',
    blurb: 'A hometown peach celebration with orchard charm, live performances, and summer food traditions.',
    category: 'Festivals',
    eventPageKind: 'manifest',
    iconType: 'harvest',
    x: 66,
    y: 40,
    atmosphere: atmosphere(['balloons'], 'subtle'),
    regionAtmosphere: 'harvest',
    dateRange: {
      startDate: '2026-09-03',
      endDate: '2026-09-07',
      isEstimated: false,
    },
    cardMedia: {
      mediaType: 'video',
      mediaSrc: '/event-media/romeo-peach-loop.mp4',
      atmosphereTitle: 'First Peach Queen',
      mediaPosition: '43% 18%',
      mediaScale: 1,
      mediaMaskProfile: 'romeoPeach',
      thumbnailSrc: '/event-media/generated/romeo-peach-festival-thumb.webp',
      thumbnailSourceType: 'generated',
      thumbnailGenerationStatus: 'generated',
      thumbnailAlt: 'Atmospheric Romeo Peach Festival memory artwork',
    },
    detailPage: {
      atmosphereLine: 'Golden-hour orchards, brass-band echoes, and warm peach sugar in the air.',
      mediaType: 'video',
      mediaSrc: '/event-media/romeo-peach-loop.mp4',
      shortStory:
        'Every September, downtown Romeo shifts into a slower rhythm: parade footsteps, porch conversations, and the glow of longtime family traditions. The Peach Festival started as a harvest celebration and still feels deeply local—neighbors running booths, students carrying banners, and generations trading stories under the same trees. It is less about spectacle and more about memory: the familiar scent of peach pie, the first evening lights, and a town gathering for one more summer chapter.',
      detailIntro:
        'Every September, downtown Romeo shifts into a slower rhythm: parade footsteps, porch conversations, and the glow of longtime family traditions.',
      storySections: [
        'The Peach Festival started as a harvest celebration and still feels deeply local—neighbors running booths, students carrying banners, and generations trading stories under the same trees.',
        'It is less about spectacle and more about memory: the familiar scent of peach pie, the first evening lights, and a town gathering for one more summer chapter.',
      ],
      archivalNote: 'Early programs framed the festival as a harvest-homecoming for orchard families across northern Macomb County.',
      visitorMood: 'Nostalgic and warm, with a lingering late-summer sweetness.',
      eventSnapshot: {
        typicalMonth: 'September',
        setting: 'Historic downtown streets near orchard country',
        bestFor: 'Families, local-history lovers, and late-summer day trips',
        signatureMoment: 'Evening parade glow followed by warm peach pie lines at dusk',
      },
    },
    atlasNotes: [
      'Field recordings from the late 1970s describe a brass cadence that started at Main and drifted toward the old depot as evening booths lit up.',
      'Longtime volunteers still refer to the peach pie stand line as the unofficial clock of the festival—when it doubles, dusk has arrived.',
    ],
    atlasMemories: [
      'The midway lights reflected in the rain.',
      'Peach crates stacked behind the grandstand.',
      'The music carried through the trees after midnight.',
    ],
    localFlavor: [
      'Warm hand pies dusted with cinnamon sugar from church-bake tables.',
      'Parade marshals handing orchard ribbons to kids along Main Street.',
      'Late-evening porch bands drifting over peach crate stalls.',
    ],
  },
  {
    id: 'detroit-jazz',
    name: 'Detroit Jazz Festival',
    location: 'Detroit, MI',
    latitude: 42.3314,
    longitude: -83.0458,
    atmosphereLabel: 'Hart Plaza jazz weekend',
    blurb: 'The world’s largest free jazz festival returns to Hart Plaza over Labor Day weekend with jazz legends and innovators.',
    category: 'Music',
    cardTag: 'Free jazz festival',
    eventPageKind: 'manifest',
    iconType: 'music',
    x: 75,
    y: 44,
    atmosphere: atmosphere([], 'medium'),
    regionAtmosphere: 'urban',
    cardMedia: {
      thumbnailSrc: '/event-media/generated/detroit-jazz-thumb.webp',
      thumbnailSourceType: 'generated',
      thumbnailGenerationStatus: 'generated',
      thumbnailAlt: 'Detroit Jazz Festival generated thumbnail',
    },
    dateRange: {
      startDate: '2026-09-04',
      endDate: '2026-09-07',
      isEstimated: false,
    },
    fullCardBriefing: {
      intro:
        'Don’t miss the 2026 Detroit Jazz Festival. The world’s largest free jazz festival returns to Hart Plaza in downtown Detroit over Labor Day weekend, September 4–7, with an all-star lineup of jazz legends and innovators.',
      date: 'September 4–7, 2026',
      venue: 'Hart Plaza, Downtown Detroit',
      source: 'Detroit Jazz Festival',
      officialSite: 'https://detroitjazzfest.org',
      sections: [
        {
          title: '2026 Highlights',
          items: [
            'Ron Carter & Foursight',
            'Bob James',
            'Ravi Coltrane Quartet — Centennial Celebration',
            'Kurt Elling & Yellowjackets Celebrate Weather Report',
            'Artemis',
            '2026 Artist-in-Residence Joe Lovano with special projects including Paramount Quartet and Coltrane 100',
            'Take 6',
            'Cindy Blackman Santana',
            'Vijay Iyer Trio',
            'Joey Alexander',
            'Additional artists and programming',
          ],
        },
        {
          title: 'What to Expect',
          body:
            'Experience world-class jazz in the heart of Detroit — completely free and open to all. A must-attend celebration of music, culture, and community.',
        },
        {
          title: 'Plan Your Visit',
          items: [
            'Hart Plaza, downtown Detroit',
            'Public transit and People Mover access',
            'Bring a chair or blanket for comfort where appropriate',
            'Food and drink vendors on site',
            'Review official festival guidance for current schedule and access details',
          ],
        },
      ],
    },
  },
  {
    id: 'armada-fair', name: 'Armada Fair', location: 'Armada, MI', latitude: 42.8442, longitude: -82.8841, atmosphereLabel: 'Midway lights', blurb: 'Classic fair rides, livestock showcases, and local midway favorites in late summer.', category: 'Fairs', iconType: 'fair', x: 70, y: 35, atmosphere: atmosphere(['ferrisGlow'], 'medium'), regionAtmosphere: 'harvest' },
  { id: 'mackinac-lilac', name: 'Mackinac Island Lilac Festival', location: 'Mackinac Island, MI', latitude: 45.8492, longitude: -84.6189, atmosphereLabel: 'Harbor bloom breeze', blurb: 'Historic waterfront streets and harbor breezes framed by lilac blooms and island traditions.', category: 'Festivals', iconType: 'flower', x: 49, y: 14, atmosphere: atmosphere([], 'subtle'), regionAtmosphere: 'lakeshore', cardMedia: { atmosphereTitle: 'Harbor bloom breeze', mediaPosition: '50% 32%', mediaScale: 1.03, thumbnailSrc: '/event-media/generated/mackinac-lilac-thumb.webp', thumbnailSourceType: 'generated', thumbnailGenerationStatus: 'generated', thumbnailAlt: 'Mackinac Island Lilac Festival generated thumbnail', mediaDelayMs: 1100, mediaFadeDurationMs: 1400 } },
  {
    id: 'electric-forest',
    name: 'Electric Forest',
    location: 'Rothbury, MI',
    latitude: 43.5061,
    longitude: -86.3487,
    atmosphereLabel: 'Neon woodland pulse',
    blurb: 'A glowing woodland music gathering with immersive art and all-night festival energy.',
    category: 'Music',
    iconType: 'art',
    x: 34,
    y: 42,
    atmosphere: atmosphere(['fireworks'], 'signature'),
    regionAtmosphere: 'northwoods',
    cardMedia: {
      mediaType: 'video',
      mediaSrc: '/event-media/electric-forest-loop.mp4',
      atmosphereTitle: 'Neon woodland pulse',
      mediaPosition: '56% 36%',
      mediaScale: 1.04,
      mediaMaskProfile: 'romeoPeach',
      thumbnailOverrideSrc: '/event-media/electric-forest-poster.jpg',
      thumbnailSourceType: 'override',
      thumbnailGenerationStatus: 'manualOverride',
      thumbnailAlt: 'Electric Forest atmospheric poster frame',
      mediaDelayMs: 0,
      mediaFadeDurationMs: 900,
    },
    detailPage: {
      atmosphereLine: 'Pine-shadow pathways, basslines between trees, and kaleidoscopic light after dusk.',
      mediaType: 'video',
      mediaSrc: '/event-media/electric-forest-loop.mp4',
      introVideoSrc: '/event-media/electric-forest-intro.mp4',
      shortStory:
        'As day fades in Rothbury, the forest turns into a living gallery of lantern canopies, projection art, and stages hidden among the pines. Electric Forest blends major electronic acts with wandering discovery—one path leads to a surprise set, another to an installation that feels like a dreamscape. Camp neighbors trade bracelets, stories, and directions to their favorite corners, and the entire weekend feels like a shared nighttime city built from music, light, and imagination.',
      detailIntro:
        'As day fades in Rothbury, the forest turns into a living gallery of lantern canopies, projection art, and stages hidden among the pines.',
      storySections: [
        'Electric Forest blends major electronic acts with wandering discovery—one path leads to a surprise set, another to an installation that feels like a dreamscape.',
        'Camp neighbors trade bracelets, stories, and directions to their favorite corners, and the entire weekend feels like a shared nighttime city built from music, light, and imagination.',
      ],
      archivalNote:
        'The festival emerged from earlier Rothbury-era gatherings and is now known for its hybrid of curated electronic music and interactive woodland art.',
      visitorMood: 'Euphoric, curious, and connected—like staying awake inside a neon fairytale.',
      eventSnapshot: {
        typicalMonth: 'June',
        setting: 'Woodland venue with immersive art paths and multi-stage clearings',
        bestFor: 'Night owls, electronic music fans, and experiential festival explorers',
        signatureMoment: 'First full-dark hour when lantern canopies and basslines take over the forest',
      },
    },
    atlasNotes: [
      'Early crowd journals mention that the first full dark hour, not the headliner slot, is when the forest atmosphere fully “switches on.”',
      'Returning attendees map favorite pathways by light texture—neon canopies, lantern corridors, and the quieter amber edges near camp.',
    ],
    localFlavor: [
      'Pine air mixed with kettle corn and campfire coffee at midnight.',
      'Tiny trinket swaps and kandi bracelets traded between strangers.',
      'Whispered route tips to hidden art paths just after dusk.',
      'Barefoot hammock circles humming with distant basslines.',
    ],
  },
  {
    id: 'traverse-city-cherry',
    name: 'National Cherry Festival',
    location: 'Traverse City, MI',
    latitude: 44.7666995,
    longitude: -85.6249394,
    coordinateSource: {
      label: 'OpenStreetMap Nominatim venue geocode for Open Space Park',
      url: 'https://nominatim.openstreetmap.org/ui/search.html?q=Open+Space+Park%2C+Traverse+City%2C+Michigan',
      method: 'venue-address-geocode',
    },
    atmosphereLabel: 'Bayfront summer glow',
    blurb: 'A week of cherry treats, parades, and bayfront gatherings in Traverse City each summer.',
    category: 'Festivals',
    iconType: 'food',
    x: 30,
    y: 28,
    regionAtmosphere: 'lakeshore',
    cardMedia: {
      thumbnailSrc: '/event-media/generated/traverse-city-cherry-thumb.webp',
      thumbnailSourceType: 'generated',
      thumbnailGenerationStatus: 'generated',
      thumbnailAlt: 'National Cherry Festival generated thumbnail',
    },
  },
  { id: 'coast-guard-festival', name: 'Coast Guard Festival', location: 'Grand Haven, MI', latitude: 43.0631, longitude: -86.2284, atmosphereLabel: 'Shoreline honor lights', blurb: 'Grand Haven hosts ship tours, concerts, and shoreline fireworks honoring Coast Guard heritage.', category: 'Festivals', iconType: 'heritage', x: 24, y: 44, atmosphere: atmosphere(['fireworks'], 'medium'), regionAtmosphere: 'lakeshore' },
  { id: 'holland-tulip-time', name: 'Tulip Time Festival', location: 'Holland, MI', latitude: 42.7875, longitude: -86.1089, atmosphereLabel: 'Spring street color', blurb: 'Spring blooms, Dutch dance, and family street events color downtown Holland.', category: 'Festivals', iconType: 'flower', x: 30, y: 49, regionAtmosphere: 'lakeshore', cardMedia: { thumbnailSrc: '/event-media/generated/holland-tulip-time-thumb.webp', thumbnailSourceType: 'generated', thumbnailGenerationStatus: 'generated', thumbnailAlt: 'Tulip Time Festival generated thumbnail' } },
  {
    id: 'alpena-brown-trout',
    name: 'Brown Trout Festival',
    searchAliases: ['Michigan Brown Trout Festival', 'Alpena Brown Trout Festival'],
    location: 'Alpena, MI',
    latitude: 45.0590675,
    longitude: -83.428529,
    coordinateSource: {
      label: 'OpenStreetMap Nominatim venue-address geocode',
      url: 'https://nominatim.openstreetmap.org/ui/search.html?q=Alpena+Marina%2C+400+E+Chisholm+St%2C+Alpena%2C+MI+49707',
      method: 'venue-address-geocode',
    },
    atmosphereLabel: 'Thunder Bay tournament nights',
    blurb: 'Ten days of fishing tournaments, live Michigan bands, family events, and waterfront traditions at Alpena Marina.',
    category: 'Festivals',
    cardTag: 'Fishing festival',
    eventPageKind: 'manifest',
    iconType: 'waterfront',
    x: 58,
    y: 21,
    atmosphere: atmosphere([], 'subtle'),
    regionAtmosphere: 'lakeshore',
    dateRange: {
      startDate: '2026-07-17',
      endDate: '2026-07-26',
      isEstimated: false,
    },
    cardMedia: {
      thumbnailSrc: '/event-media/brown-trout/brown-trout-hero-v1.webp',
      thumbnailSourceType: 'generated',
      thumbnailGenerationStatus: 'generated',
      thumbnailAlt: 'Celebration Atlas artwork for the Michigan Brown Trout Festival on the Alpena waterfront',
    },
  },
  { id: 'charlevoix-venetian', name: 'Charlevoix Venetian Festival', location: 'Charlevoix, MI', latitude: 45.3181, longitude: -85.2584, atmosphereLabel: 'Marina twilight rhythm', blurb: 'A harbor-centered summer celebration featuring waterfront music and a boat parade.', category: 'Festivals', iconType: 'waterfront', x: 40, y: 22, atmosphere: atmosphere([], 'subtle'), regionAtmosphere: 'lakeshore' },
  { id: 'cheboygan-4th-fireworks', name: 'Cheboygan Independence Day Festival', location: 'Cheboygan, MI', latitude: 45.6469, longitude: -84.4745, atmosphereLabel: 'Patriotic night burst', blurb: 'Holiday crowds gather for parades, family activities, and fireworks by the water.', category: 'Festivals', iconType: 'fireworks', x: 50, y: 16, atmosphere: atmosphere(['fireworks'], 'signature'), regionAtmosphere: 'lakeshore' },
  { id: 'muskegon-summer-celebration', name: 'Muskegon Summer Celebration', location: 'Muskegon, MI', latitude: 43.2342, longitude: -86.2484, atmosphereLabel: 'Lakefront stage energy', blurb: 'Lakefront performances and food vendors keep this multi-day event lively into the night.', category: 'Music', iconType: 'music', x: 24, y: 42, atmosphere: atmosphere([], 'medium'), regionAtmosphere: 'lakeshore' },
  { id: 'faster-horses', name: 'Faster Horses Festival', location: 'Brooklyn, MI', latitude: 42.1059, longitude: -84.2483, atmosphereLabel: 'Speedway campfire chorus', blurb: 'A major country music weekend at Michigan International Speedway with camping crowds.', category: 'Music', iconType: 'music', x: 56, y: 57, regionAtmosphere: 'urban' },
  { id: 'common-ground-lansing', name: 'Common Ground Music Festival', location: 'Lansing, MI', latitude: 42.7325, longitude: -84.5555, atmosphereLabel: 'Capital city night sets', blurb: 'Downtown Lansing welcomes national acts and local favorites in a summer concert series.', category: 'Music', iconType: 'music', x: 47, y: 50, regionAtmosphere: 'urban' },
  { id: 'allendale-balloon-fest', name: 'Allendale Balloon Festival', location: 'Allendale, MI', latitude: 42.9723, longitude: -85.9537, atmosphereLabel: 'Sky lantern uplift', blurb: 'Colorful hot-air balloons, evening glows, and family food stands fill open summer skies.', category: 'Festivals', iconType: 'fair', x: 27, y: 46, atmosphere: atmosphere(['balloons'], 'medium'), regionAtmosphere: 'lakeshore' },

  // Test event for on-site validation of event cards and Atlas Scout/artifact workflow.
  {
    id: 'black-river-tattoo',
    name: 'Black River Tattoo Convention',
    location: 'Port Huron, MI',
    latitude: 42.99856,
    longitude: -82.42682,
    coordinateSource: {
      label: 'OpenStreetMap venue coordinates for Blue Water Convention Center',
      url: 'https://www.openstreetmap.org/way/687195718',
      method: 'venue-address-geocode',
    },
    atmosphereLabel: 'Event-floor discovery',
    blurb: 'A tattoo, art, and culture convention in Port Huron featuring artists, vendors, live energy, and event-floor discovery.',
    category: 'Arts & Culture',
    cardTag: 'Arts & Culture',
    iconType: 'art',
    searchAliases: ['Black River Tattoo Convention', 'Port Huron tattoo convention', 'Blue Water tattoo convention'],
    x: 82,
    y: 34,
    atmosphere: atmosphere([], 'subtle'),
    regionAtmosphere: 'urban',
    detailPage: {
      shortStory: 'A temporary test entry for validating the on-site Atlas Scout and artifact workflow around an indoor tattoo, art, and culture convention in the Port Huron / Blue Water area.',
      atmosphereLine: 'Indoor convention-floor energy, artist booths, vendors, and discovery cues in the Blue Water area.',
      detailIntro: 'Black River Tattoo Convention is staged here as a test event for validating the Atlas event-card and artifact-capture experience on site.',
      storySections: [
        'Use this placeholder detail page to walk the event-floor flow, confirm the Enter Event path, and test how Atlas Scout prompts can guide discovery at vendor tables, artist booths, and indoor culture moments.',
      ],
      archivalNote: 'Approximate Port Huron / Blue Water placement only until exact venue coordinates are confirmed.',
      visitorMood: 'High-energy, creative, and built for event-floor discovery.',
      eventSnapshot: {
        setting: 'Indoor tattoo, art, and culture convention in the Port Huron / Blue Water area',
        bestFor: 'Testing event cards, Atlas Scout prompts, and artifact workflow validation',
        signatureMoment: 'Finding the first artist booth or vendor story worth capturing as an Atlas artifact',
      },
    },
  },

  {
    id: 'goodells-fair',
    name: 'St. Clair County 4-H & Youth Fair',
    location: 'Goodells, Michigan',
    latitude: 42.9811,
    longitude: -82.6677,
    atmosphereLabel: 'Barn-lantern midway glow',
    blurb: 'A St. Clair County tradition featuring 4-H exhibits, youth showcases, livestock judging, and evening midway lights.',
    category: 'Fairs',
    iconType: 'fair',
    searchAliases: ['Goodells Fair', 'St. Clair County Fair', '4-H Fair', 'Youth Fair'],
    pageArchetype: 'livingScrapbook',
    x: 79,
    y: 37,
    atmosphere: atmosphere(['ferrisGlow'], 'medium'),
    regionAtmosphere: 'harvest',
    cardMedia: {
      thumbnailSrc: '/event-media/generated/goodells-fair-thumb.webp',
      thumbnailSourceType: 'generated',
      thumbnailGenerationStatus: 'generated',
      thumbnailAlt: 'Goodells Fair generated thumbnail',
    },
    detailPage: {
      shortStory: 'A lightweight scrapbook entry anchored in youth livestock traditions and county-fair summer nights.',
      atmosphereLine: 'Rural barns, show rings, and twilight midway lights in Goodells.',
      mediaType: 'video',
      mediaSrc: '/event-media/goodells/goodells-fair-intro.mp4',
    },
  },
  { id: 'shiawassee-fair', name: 'Shiawassee County Fair', location: 'Corunna, MI', latitude: 42.9819, longitude: -84.1177, atmosphereLabel: 'County fair nostalgia', blurb: 'A classic county fair with agricultural exhibits, midway rides, and grandstand entertainment.', category: 'Fairs', iconType: 'fair', x: 54, y: 49, atmosphere: atmosphere(['ferrisGlow'], 'medium'), regionAtmosphere: 'harvest' },
  { id: 'upper-peninsula-state-fair', name: 'Upper Peninsula State Fair', location: 'Escanaba, MI', latitude: 45.7452, longitude: -87.0646, atmosphereLabel: 'Northern midway glow', blurb: 'Escanaba hosts livestock shows, rides, and regional food traditions each August.', category: 'Fairs', iconType: 'fair', x: 34, y: 8, atmosphere: atmosphere(['ferrisGlow'], 'medium'), regionAtmosphere: 'northwoods' },
];
