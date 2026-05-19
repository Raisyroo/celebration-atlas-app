export type AtlasCategory = 'Festivals' | 'Music' | 'Fairs';

export type AtlasEvent = {
  id: string;
  name: string;
  blurb: string;
  category: AtlasCategory;
  x: number;
  y: number;
};

export const ATLAS_EVENTS: AtlasEvent[] = [
  {
    id: 'romeo-peach',
    name: 'Romeo Peach Festival',
    blurb: 'A hometown peach celebration with orchard charm, live performances, and summer food traditions.',
    category: 'Festivals',
    x: 67,
    y: 39,
  },
  {
    id: 'detroit-jazz',
    name: 'Detroit Jazz Weekend',
    blurb: 'Open-air stages and night sets bring Michigan jazz scenes together near downtown Detroit.',
    category: 'Music',
    x: 73,
    y: 43,
  },
  {
    id: 'armada-fair',
    name: 'Armada Fair',
    blurb: 'Classic fair rides, livestock showcases, and local midway favorites in late summer.',
    category: 'Fairs',
    x: 69,
    y: 36,
  },
  {
    id: 'electric-forest',
    name: 'Electric Forest',
    blurb: 'A glowing woodland music gathering with immersive art and all-night festival energy.',
    category: 'Music',
    x: 34,
    y: 42,
  },
];
