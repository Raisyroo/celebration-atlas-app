export type AtlasCategory = 'Festivals' | 'Music' | 'Fairs';

export type AtmosphereEffect =
  | 'geese'
  | 'fireworks'
  | 'fog'
  | 'snow'
  | 'balloons'
  | 'ferrisGlow';

export type AtlasEvent = {
  id: string;
  name: string;
  location: string;
  atmosphereLabel: string;
  blurb: string;
  category: AtlasCategory;
  x: number;
  y: number;
  atmosphere?: {
    effects?: AtmosphereEffect[];
    intensity?: 'subtle' | 'medium' | 'signature';
  };
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
};

/**
 * Lightweight atmosphere helper for event authoring.
 *
 * Effect guidance/examples:
 * - fireworks: major fireworks events
 * - fog: waterfront/island/lake events
 * - ferrisGlow: fairs/carnivals
 * - balloons: balloon festivals
 * - snow: winter/holiday events
 *
 * Note: this only helps with data assignment; it does not add or enable new visual effects.
 */
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
    atmosphereLabel: 'Orchard glow',
    blurb: 'A hometown peach celebration with orchard charm, live performances, and summer food traditions.',
    category: 'Festivals',
    x: 66,
    y: 40,
    atmosphere: atmosphere(['balloons'], 'subtle'),
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
  },
  {
    id: 'detroit-jazz',
    name: 'Detroit Jazz Weekend',
    location: 'Detroit, MI',
    atmosphereLabel: 'Midnight jazz haze',
    blurb: 'Open-air stages and night sets bring Michigan jazz scenes together near downtown Detroit.',
    category: 'Music',
    x: 75,
    y: 44,
    atmosphere: atmosphere([], 'medium'),
  },
  {
    id: 'armada-fair',
    name: 'Armada Fair',
    location: 'Armada, MI',
    atmosphereLabel: 'Midway lights',
    blurb: 'Classic fair rides, livestock showcases, and local midway favorites in late summer.',
    category: 'Fairs',
    x: 70,
    y: 35,
    atmosphere: atmosphere(['ferrisGlow'], 'medium'),
  },

  {
    id: 'mackinac-lilac',
    name: 'Mackinac Island Lilac Festival',
    location: 'Mackinac Island, MI',
    atmosphereLabel: 'Harbor bloom breeze',
    blurb: 'Historic waterfront streets and harbor breezes framed by lilac blooms and island traditions.',
    category: 'Festivals',
    x: 49,
    y: 14,
    atmosphere: atmosphere([], 'subtle'),
    cardMedia: {
      atmosphereTitle: 'Harbor bloom breeze',
      mediaPosition: '50% 32%',
      mediaScale: 1.03,
      mediaDelayMs: 1100,
      mediaFadeDurationMs: 1400,
    },
  },
  {
    id: 'electric-forest',
    name: 'Electric Forest',
    location: 'Rothbury, MI',
    atmosphereLabel: 'Neon woodland pulse',
    blurb: 'A glowing woodland music gathering with immersive art and all-night festival energy.',
    category: 'Music',
    x: 34,
    y: 42,
    atmosphere: atmosphere(['fireworks'], 'signature'),
    cardMedia: {
      mediaType: 'video',
      mediaSrc: '/event-media/electric-forest-loop.mp4',
      atmosphereTitle: 'Neon woodland pulse',
      mediaPosition: '56% 36%',
      mediaScale: 1.04,
      mediaMaskProfile: 'romeoPeach',
      mediaDelayMs: 980,
      mediaFadeDurationMs: 1450,
    },
  },

  {
    id: 'traverse-city-cherry',
    name: 'National Cherry Festival',
    location: 'Traverse City, MI',
    atmosphereLabel: 'Bayfront summer glow',
    blurb: 'A week of cherry treats, parades, and bayfront gatherings in Traverse City each summer.',
    category: 'Festivals',
    x: 30,
    y: 28,
  },
  {
    id: 'west-michigan-coast-guard',
    name: 'Coast Guard Festival',
    location: 'Grand Haven, MI',
    atmosphereLabel: 'Shoreline honor lights',
    blurb: 'Grand Haven hosts ship tours, concerts, and shoreline fireworks honoring Coast Guard heritage.',
    category: 'Festivals',
    x: 24,
    y: 44,
    atmosphere: atmosphere(['fireworks'], 'medium'),
  },
  {
    id: 'holland-tulip-time',
    name: 'Tulip Time Festival',
    location: 'Holland, MI',
    atmosphereLabel: 'Spring street color',
    blurb: 'Spring blooms, Dutch dance, and family street events color downtown Holland.',
    category: 'Festivals',
    x: 30,
    y: 49,
  },
  {
    id: 'alpena-brown-trout',
    name: 'Brown Trout Festival',
    location: 'Alpena, MI',
    atmosphereLabel: 'Riverfront carnival dusk',
    blurb: 'A Northeast Michigan tradition with carnival rides, food booths, and riverfront festivities.',
    category: 'Festivals',
    x: 58,
    y: 21,
    atmosphere: atmosphere(['ferrisGlow'], 'subtle'),
  },
  {
    id: 'charlevoix-venetian',
    name: 'Charlevoix Venetian Festival',
    location: 'Charlevoix, MI',
    atmosphereLabel: 'Marina twilight rhythm',
    blurb: 'A harbor-centered summer celebration featuring waterfront music and a boat parade.',
    category: 'Festivals',
    x: 40,
    y: 22,
    atmosphere: atmosphere([], 'subtle'),
  },
  {
    id: 'cheboygan-4th-fireworks',
    name: 'Cheboygan Independence Day Festival',
    location: 'Cheboygan, MI',
    atmosphereLabel: 'Patriotic night burst',
    blurb: 'Holiday crowds gather for parades, family activities, and fireworks by the water.',
    category: 'Festivals',
    x: 50,
    y: 16,
    atmosphere: atmosphere(['fireworks'], 'signature'),
  },
  {
    id: 'muskegon-summer-celebration',
    name: 'Muskegon Summer Celebration',
    location: 'Muskegon, MI',
    atmosphereLabel: 'Lakefront stage energy',
    blurb: 'Lakefront performances and food vendors keep this multi-day event lively into the night.',
    category: 'Music',
    x: 24,
    y: 42,
    atmosphere: atmosphere([], 'medium'),
  },
  {
    id: 'faster-horses',
    name: 'Faster Horses Festival',
    location: 'Brooklyn, MI',
    atmosphereLabel: 'Speedway campfire chorus',
    blurb: 'A major country music weekend at Michigan International Speedway with camping crowds.',
    category: 'Music',
    x: 56,
    y: 57,
  },
  {
    id: 'common-ground-lansing',
    name: 'Common Ground Music Festival',
    location: 'Lansing, MI',
    atmosphereLabel: 'Capital city night sets',
    blurb: 'Downtown Lansing welcomes national acts and local favorites in a summer concert series.',
    category: 'Music',
    x: 47,
    y: 50,
  },
  {
    id: 'allendale-ballon-fest',
    name: 'Allendale Balloon Festival',
    location: 'Allendale, MI',
    atmosphereLabel: 'Sky lantern uplift',
    blurb: 'Colorful hot-air balloons, evening glows, and family food stands fill open summer skies.',
    category: 'Festivals',
    x: 27,
    y: 46,
    atmosphere: atmosphere(['balloons'], 'medium'),
  },
  {
    id: 'shiawassee-fair',
    name: 'Shiawassee County Fair',
    location: 'Corunna, MI',
    atmosphereLabel: 'County fair nostalgia',
    blurb: 'A classic county fair with agricultural exhibits, midway rides, and grandstand entertainment.',
    category: 'Fairs',
    x: 54,
    y: 49,
    atmosphere: atmosphere(['ferrisGlow'], 'medium'),
  },
  {
    id: 'upper-peninsula-state-fair',
    name: 'Upper Peninsula State Fair',
    location: 'Escanaba, MI',
    atmosphereLabel: 'Northern midway glow',
    blurb: 'Escanaba hosts livestock shows, rides, and regional food traditions each August.',
    category: 'Fairs',
    x: 34,
    y: 8,
    atmosphere: atmosphere(['ferrisGlow'], 'medium'),
  },
];
