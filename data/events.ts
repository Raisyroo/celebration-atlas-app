export type AtlasCategory = 'Festivals' | 'Music' | 'Fairs';

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
  iconType?: 'music' | 'fair' | 'food' | 'fireworks' | 'flower' | 'harvest' | 'waterfront' | 'winter' | 'art' | 'heritage';
  id: string;
  name: string;
  location: string;
  atmosphereLabel: string;
  blurb: string;
  category: AtlasCategory;
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
  cardMedia?: {
    mediaType?: 'image' | 'video';
    mediaSrc?: string;
    posterSrc?: string;
    atmosphereTitle?: string;
    mediaPosition?: string;
    mediaScale?: number;
    mediaMaskProfile?: 'romeoPeach';
    mediaDelayMs?: number;
    mediaFadeDurationMs?: number;
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
    atmosphereLabel: 'First Peach Queen',
    blurb: 'A hometown peach celebration with orchard charm, live performances, and summer food traditions.',
    category: 'Festivals',
    iconType: 'harvest',
    x: 66,
    y: 40,
    atmosphere: atmosphere(['balloons'], 'subtle'),
    regionAtmosphere: 'harvest',
    cardMedia: {
      mediaType: 'video',
      mediaSrc: '/event-media/romeo-peach-loop.mp4',
      atmosphereTitle: 'Orchard glow',
      mediaPosition: '43% 18%',
      mediaScale: 1,
      mediaMaskProfile: 'romeoPeach',
      mediaDelayMs: 900,
      mediaFadeDurationMs: 1300,
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
    name: 'Detroit Jazz Weekend',
    location: 'Detroit, MI',
    atmosphereLabel: 'Midnight jazz haze',
    blurb: 'Open-air stages and night sets bring Michigan jazz scenes together near downtown Detroit.',
    category: 'Music',
    iconType: 'music',
    x: 75,
    y: 44,
    atmosphere: atmosphere([], 'medium'),
    regionAtmosphere: 'urban',
  },
  {
    id: 'armada-fair', name: 'Armada Fair', location: 'Armada, MI', atmosphereLabel: 'Midway lights', blurb: 'Classic fair rides, livestock showcases, and local midway favorites in late summer.', category: 'Fairs', iconType: 'fair', x: 70, y: 35, atmosphere: atmosphere(['ferrisGlow'], 'medium'), regionAtmosphere: 'harvest' },
  { id: 'mackinac-lilac', name: 'Mackinac Island Lilac Festival', location: 'Mackinac Island, MI', atmosphereLabel: 'Harbor bloom breeze', blurb: 'Historic waterfront streets and harbor breezes framed by lilac blooms and island traditions.', category: 'Festivals', iconType: 'flower', x: 49, y: 14, atmosphere: atmosphere([], 'subtle'), regionAtmosphere: 'lakeshore', cardMedia: { atmosphereTitle: 'Harbor bloom breeze', mediaPosition: '50% 32%', mediaScale: 1.03, mediaDelayMs: 1100, mediaFadeDurationMs: 1400 } },
  {
    id: 'electric-forest',
    name: 'Electric Forest',
    location: 'Rothbury, MI',
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
  { id: 'traverse-city-cherry', name: 'National Cherry Festival', location: 'Traverse City, MI', atmosphereLabel: 'Bayfront summer glow', blurb: 'A week of cherry treats, parades, and bayfront gatherings in Traverse City each summer.', category: 'Festivals', iconType: 'food', x: 30, y: 28, regionAtmosphere: 'lakeshore' },
  { id: 'west-michigan-coast-guard', name: 'Coast Guard Festival', location: 'Grand Haven, MI', atmosphereLabel: 'Shoreline honor lights', blurb: 'Grand Haven hosts ship tours, concerts, and shoreline fireworks honoring Coast Guard heritage.', category: 'Festivals', iconType: 'heritage', x: 24, y: 44, atmosphere: atmosphere(['fireworks'], 'medium'), regionAtmosphere: 'lakeshore' },
  { id: 'holland-tulip-time', name: 'Tulip Time Festival', location: 'Holland, MI', atmosphereLabel: 'Spring street color', blurb: 'Spring blooms, Dutch dance, and family street events color downtown Holland.', category: 'Festivals', iconType: 'flower', x: 30, y: 49, regionAtmosphere: 'lakeshore' },
  { id: 'alpena-brown-trout', name: 'Brown Trout Festival', location: 'Alpena, MI', atmosphereLabel: 'Riverfront carnival dusk', blurb: 'A Northeast Michigan tradition with carnival rides, food booths, and riverfront festivities.', category: 'Festivals', iconType: 'fair', x: 58, y: 21, atmosphere: atmosphere(['ferrisGlow'], 'subtle'), regionAtmosphere: 'lakeshore' },
  { id: 'charlevoix-venetian', name: 'Charlevoix Venetian Festival', location: 'Charlevoix, MI', atmosphereLabel: 'Marina twilight rhythm', blurb: 'A harbor-centered summer celebration featuring waterfront music and a boat parade.', category: 'Festivals', iconType: 'waterfront', x: 40, y: 22, atmosphere: atmosphere([], 'subtle'), regionAtmosphere: 'lakeshore' },
  { id: 'cheboygan-4th-fireworks', name: 'Cheboygan Independence Day Festival', location: 'Cheboygan, MI', atmosphereLabel: 'Patriotic night burst', blurb: 'Holiday crowds gather for parades, family activities, and fireworks by the water.', category: 'Festivals', iconType: 'fireworks', x: 50, y: 16, atmosphere: atmosphere(['fireworks'], 'signature'), regionAtmosphere: 'lakeshore' },
  { id: 'muskegon-summer-celebration', name: 'Muskegon Summer Celebration', location: 'Muskegon, MI', atmosphereLabel: 'Lakefront stage energy', blurb: 'Lakefront performances and food vendors keep this multi-day event lively into the night.', category: 'Music', iconType: 'music', x: 24, y: 42, atmosphere: atmosphere([], 'medium'), regionAtmosphere: 'lakeshore' },
  { id: 'faster-horses', name: 'Faster Horses Festival', location: 'Brooklyn, MI', atmosphereLabel: 'Speedway campfire chorus', blurb: 'A major country music weekend at Michigan International Speedway with camping crowds.', category: 'Music', iconType: 'music', x: 56, y: 57, regionAtmosphere: 'urban' },
  { id: 'common-ground-lansing', name: 'Common Ground Music Festival', location: 'Lansing, MI', atmosphereLabel: 'Capital city night sets', blurb: 'Downtown Lansing welcomes national acts and local favorites in a summer concert series.', category: 'Music', iconType: 'music', x: 47, y: 50, regionAtmosphere: 'urban' },
  { id: 'allendale-balloon-fest', name: 'Allendale Balloon Festival', location: 'Allendale, MI', atmosphereLabel: 'Sky lantern uplift', blurb: 'Colorful hot-air balloons, evening glows, and family food stands fill open summer skies.', category: 'Festivals', iconType: 'fair', x: 27, y: 46, atmosphere: atmosphere(['balloons'], 'medium'), regionAtmosphere: 'lakeshore' },

  {
    id: 'goodells-fair',
    name: 'St. Clair County 4-H & Youth Fair',
    location: 'Goodells, Michigan',
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
    detailPage: {
      shortStory: 'A lightweight scrapbook entry anchored in youth livestock traditions and county-fair summer nights.',
      atmosphereLine: 'Rural barns, show rings, and twilight midway lights in Goodells.',
      mediaType: 'video',
      mediaSrc: '/event-media/goodells-fair-intro.mp4',
    },
  },
  { id: 'shiawassee-fair', name: 'Shiawassee County Fair', location: 'Corunna, MI', atmosphereLabel: 'County fair nostalgia', blurb: 'A classic county fair with agricultural exhibits, midway rides, and grandstand entertainment.', category: 'Fairs', iconType: 'fair', x: 54, y: 49, atmosphere: atmosphere(['ferrisGlow'], 'medium'), regionAtmosphere: 'harvest' },
  { id: 'upper-peninsula-state-fair', name: 'Upper Peninsula State Fair', location: 'Escanaba, MI', atmosphereLabel: 'Northern midway glow', blurb: 'Escanaba hosts livestock shows, rides, and regional food traditions each August.', category: 'Fairs', iconType: 'fair', x: 34, y: 8, atmosphere: atmosphere(['ferrisGlow'], 'medium'), regionAtmosphere: 'northwoods' },
];
