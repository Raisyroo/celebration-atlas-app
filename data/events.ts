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
];
