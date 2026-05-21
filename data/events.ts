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
  blurb: string;
  category: AtlasCategory;
  x: number;
  y: number;
  atmosphere?: {
    effects?: AtmosphereEffect[];
    intensity?: 'subtle' | 'medium' | 'signature';
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
    blurb: 'A hometown peach celebration with orchard charm, live performances, and summer food traditions.',
    category: 'Festivals',
    x: 67,
    y: 39,
    atmosphere: atmosphere(['balloons'], 'subtle'),
  },
  {
    id: 'detroit-jazz',
    name: 'Detroit Jazz Weekend',
    blurb: 'Open-air stages and night sets bring Michigan jazz scenes together near downtown Detroit.',
    category: 'Music',
    x: 73,
    y: 43,
    atmosphere: atmosphere(['fog'], 'medium'),
  },
  {
    id: 'armada-fair',
    name: 'Armada Fair',
    blurb: 'Classic fair rides, livestock showcases, and local midway favorites in late summer.',
    category: 'Fairs',
    x: 69,
    y: 36,
    atmosphere: atmosphere(['ferrisGlow'], 'medium'),
  },

  {
    id: 'mackinac-lilac',
    name: 'Mackinac Island Lilac Festival',
    blurb: 'Historic waterfront streets and harbor breezes framed by lilac blooms and island traditions.',
    category: 'Festivals',
    x: 49,
    y: 14,
    atmosphere: atmosphere(['fog'], 'subtle'),
  },
  {
    id: 'electric-forest',
    name: 'Electric Forest',
    blurb: 'A glowing woodland music gathering with immersive art and all-night festival energy.',
    category: 'Music',
    x: 34,
    y: 42,
    atmosphere: atmosphere(['fog', 'fireworks'], 'signature'),
  },

  {
    id: 'traverse-city-cherry',
    name: 'National Cherry Festival',
    blurb: 'A week of cherry treats, parades, and bayfront gatherings in Traverse City each summer.',
    category: 'Festivals',
    x: 30,
    y: 28,
  },
  {
    id: 'west-michigan-coast-guard',
    name: 'Coast Guard Festival',
    blurb: 'Grand Haven hosts ship tours, concerts, and shoreline fireworks honoring Coast Guard heritage.',
    category: 'Festivals',
    x: 27,
    y: 45,
    atmosphere: atmosphere(['fog', 'fireworks'], 'medium'),
  },
  {
    id: 'holland-tulip-time',
    name: 'Tulip Time Festival',
    blurb: 'Spring blooms, Dutch dance, and family street events color downtown Holland.',
    category: 'Festivals',
    x: 29,
    y: 47,
  },
  {
    id: 'alpena-brown-trout',
    name: 'Brown Trout Festival',
    blurb: 'A Northeast Michigan tradition with carnival rides, food booths, and riverfront festivities.',
    category: 'Festivals',
    x: 58,
    y: 21,
    atmosphere: atmosphere(['ferrisGlow'], 'subtle'),
  },
  {
    id: 'charlevoix-venetian',
    name: 'Charlevoix Venetian Festival',
    blurb: 'A harbor-centered summer celebration featuring waterfront music and a boat parade.',
    category: 'Festivals',
    x: 40,
    y: 22,
    atmosphere: atmosphere(['fog'], 'subtle'),
  },
  {
    id: 'cheboygan-4th-fireworks',
    name: 'Cheboygan Independence Day Festival',
    blurb: 'Holiday crowds gather for parades, family activities, and fireworks by the water.',
    category: 'Festivals',
    x: 50,
    y: 16,
    atmosphere: atmosphere(['fireworks'], 'signature'),
  },
  {
    id: 'muskegon-summer-celebration',
    name: 'Muskegon Summer Celebration',
    blurb: 'Lakefront performances and food vendors keep this multi-day event lively into the night.',
    category: 'Music',
    x: 24,
    y: 42,
    atmosphere: atmosphere(['fog'], 'medium'),
  },
  {
    id: 'faster-horses',
    name: 'Faster Horses Festival',
    blurb: 'A major country music weekend at Michigan International Speedway with camping crowds.',
    category: 'Music',
    x: 56,
    y: 57,
  },
  {
    id: 'common-ground-lansing',
    name: 'Common Ground Music Festival',
    blurb: 'Downtown Lansing welcomes national acts and local favorites in a summer concert series.',
    category: 'Music',
    x: 47,
    y: 50,
  },
  {
    id: 'allendale-ballon-fest',
    name: 'Allendale Balloon Festival',
    blurb: 'Colorful hot-air balloons, evening glows, and family food stands fill open summer skies.',
    category: 'Festivals',
    x: 26,
    y: 46,
    atmosphere: atmosphere(['balloons'], 'medium'),
  },
  {
    id: 'shiawassee-fair',
    name: 'Shiawassee County Fair',
    blurb: 'A classic county fair with agricultural exhibits, midway rides, and grandstand entertainment.',
    category: 'Fairs',
    x: 53,
    y: 47,
    atmosphere: atmosphere(['ferrisGlow'], 'medium'),
  },
  {
    id: 'upper-peninsula-state-fair',
    name: 'Upper Peninsula State Fair',
    blurb: 'Escanaba hosts livestock shows, rides, and regional food traditions each August.',
    category: 'Fairs',
    x: 34,
    y: 8,
    atmosphere: atmosphere(['ferrisGlow'], 'medium'),
  },
];
