export type MapPresentationMode = 'idle' | 'results' | 'single' | 'selected';
export type MichiganMobilePlacementZoneId =
  | 'west-water-upper' | 'west-water-middle' | 'west-water-lower'
  | 'east-water-upper' | 'east-water-middle' | 'east-water-lower'
  | 'north-water' | 'central-left' | 'central-right'
  | 'lower-left' | 'lower-right' | 'southeast-cluster';
export type MapLabelStyle = 'text' | 'icon-text' | 'thumbnail-text';
export type MapLabelAlignment = 'left' | 'right' | 'center';
export type MapCalloutConnector = 'none' | 'short-elbow';
export type MapAnchorVisibility = 'ambient-light' | 'subtle-dot' | 'emphasized';
export type MapCalloutPriority = 'primary' | 'secondary';
export type MapOverflowCountStyle = 'compact' | 'pill' | 'quiet';

export type PercentBounds = { minX: number; maxX: number; minY: number; maxY: number };
export type MichiganMobilePlacementZone = PercentBounds & {
  id: MichiganMobilePlacementZoneId;
  preferredAlign: 'left' | 'center' | 'right';
  connectorAllowed: boolean;
  reservedSpaceNotes: string;
};
export type ProtectedMapRegion = PercentBounds & { id: string; label: string };

export type MapPresentationCallout = {
  eventId: string;
  placementZone: MichiganMobilePlacementZoneId;
  labelXPercent?: number;
  labelYPercent?: number;
  labelStyle: MapLabelStyle;
  labelAlignment?: MapLabelAlignment;
  connector: MapCalloutConnector;
  anchorVisibility: MapAnchorVisibility;
  priority: MapCalloutPriority;
};

export type MapOverflowGroup = {
  id: string;
  eventIds: readonly string[];
  label: string;
  placementZone: MichiganMobilePlacementZoneId;
  countStyle?: MapOverflowCountStyle;
  labelXPercent?: number;
  labelYPercent?: number;
};

export type MapPresentationPlan = {
  mode: MapPresentationMode;
  queryIntent?: string;
  queryKey?: string;
  visibleEventIds: readonly string[];
  overflowGroups?: readonly MapOverflowGroup[];
  callouts?: readonly MapPresentationCallout[];
  selectedEventId?: string;
};

export const MICHIGAN_MOBILE_PLACEMENT_ZONES = [
  { id: 'west-water-upper', minX: 8, maxX: 31, minY: 25, maxY: 38, preferredAlign: 'left', connectorAllowed: true, reservedSpaceNotes: 'Open Lake Michigan water above the mid-lake markers.' },
  { id: 'west-water-middle', minX: 8, maxX: 32, minY: 39, maxY: 54, preferredAlign: 'left', connectorAllowed: true, reservedSpaceNotes: 'Quiet central Lake Michigan water; avoid thumbnail rail below.' },
  { id: 'west-water-lower', minX: 9, maxX: 35, minY: 55, maxY: 70, preferredAlign: 'left', connectorAllowed: true, reservedSpaceNotes: 'Lower Lake Michigan water with room for one compact label.' },
  { id: 'east-water-upper', minX: 68, maxX: 90, minY: 25, maxY: 39, preferredAlign: 'right', connectorAllowed: true, reservedSpaceNotes: 'Lake Huron water clear of top controls.' },
  { id: 'east-water-middle', minX: 68, maxX: 91, minY: 40, maxY: 55, preferredAlign: 'right', connectorAllowed: true, reservedSpaceNotes: 'Central Lake Huron water for secondary labels.' },
  { id: 'east-water-lower', minX: 69, maxX: 91, minY: 56, maxY: 70, preferredAlign: 'right', connectorAllowed: true, reservedSpaceNotes: 'Lower east water; keep away from Ask box.' },
  { id: 'north-water', minX: 31, maxX: 67, minY: 18, maxY: 30, preferredAlign: 'center', connectorAllowed: false, reservedSpaceNotes: 'Top water band below title/header, for short labels only.' },
  { id: 'central-left', minX: 33, maxX: 48, minY: 38, maxY: 54, preferredAlign: 'left', connectorAllowed: false, reservedSpaceNotes: 'Inland quiet pocket; avoid dense marker fields.' },
  { id: 'central-right', minX: 52, maxX: 67, minY: 38, maxY: 55, preferredAlign: 'right', connectorAllowed: false, reservedSpaceNotes: 'Inland quiet pocket before east-water labels.' },
  { id: 'lower-left', minX: 28, maxX: 45, minY: 62, maxY: 74, preferredAlign: 'left', connectorAllowed: false, reservedSpaceNotes: 'Lower-left inland space above thumbnail rail.' },
  { id: 'lower-right', minX: 55, maxX: 72, minY: 62, maxY: 74, preferredAlign: 'right', connectorAllowed: false, reservedSpaceNotes: 'Lower-right inland space above Ask box and rail.' },
  { id: 'southeast-cluster', minX: 72, maxX: 88, minY: 62, maxY: 75, preferredAlign: 'right', connectorAllowed: false, reservedSpaceNotes: 'Compact Detroit/Thumb overflow cluster area only.' },
] as const satisfies readonly MichiganMobilePlacementZone[];

export const MICHIGAN_MOBILE_PROTECTED_REGIONS = [
  { id: 'title-header', label: 'Michigan title/header', minX: 0, maxX: 100, minY: 0, maxY: 14 },
  { id: 'menu-favorites', label: 'hamburger/favorites controls', minX: 0, maxX: 26, minY: 0, maxY: 18 },
  { id: 'filter-control', label: 'filter control', minX: 70, maxX: 100, minY: 0, maxY: 18 },
  { id: 'ask-box', label: 'Ask Celebration Atlas box', minX: 5, maxX: 95, minY: 76, maxY: 88 },
  { id: 'thumbnail-rail', label: 'thumbnail rail', minX: 0, maxX: 100, minY: 88, maxY: 100 },
  { id: 'map-edges', label: 'map edges / clipping margins', minX: 0, maxX: 100, minY: 0, maxY: 100 },
] as const satisfies readonly ProtectedMapRegion[];

export const MUSIC_PRESENTATION_PRIMARY_EVENT_IDS = ['electric-forest','muskegon-summer-celebration','common-ground-lansing','detroit-jazz','faster-horses'] as const;

export const MICHIGAN_COMPOSITION_SAMPLE_PLANS = {
  music: {
    mode: 'results', queryKey: 'music', queryIntent: 'broad-category-preview', visibleEventIds: MUSIC_PRESENTATION_PRIMARY_EVENT_IDS,
    callouts: [
      { eventId: 'electric-forest', placementZone: 'west-water-upper', labelXPercent: 21, labelYPercent: 34, labelStyle: 'icon-text', connector: 'none', anchorVisibility: 'emphasized', priority: 'primary' },
      { eventId: 'muskegon-summer-celebration', placementZone: 'west-water-middle', labelXPercent: 24, labelYPercent: 49, labelStyle: 'icon-text', connector: 'none', anchorVisibility: 'emphasized', priority: 'primary' },
      { eventId: 'common-ground-lansing', placementZone: 'east-water-middle', labelXPercent: 75, labelYPercent: 48, labelStyle: 'icon-text', connector: 'none', anchorVisibility: 'subtle-dot', priority: 'secondary' },
      { eventId: 'detroit-jazz', placementZone: 'east-water-lower', labelXPercent: 78, labelYPercent: 66, labelStyle: 'icon-text', connector: 'none', anchorVisibility: 'emphasized', priority: 'primary' },
      { eventId: 'faster-horses', placementZone: 'west-water-lower', labelXPercent: 30, labelYPercent: 67, labelStyle: 'text', connector: 'none', anchorVisibility: 'subtle-dot', priority: 'secondary' },
    ],
    overflowGroups: [{ id: 'music-overflow', eventIds: ['allendale-balloon-fest'], label: '+1', placementZone: 'east-water-upper', countStyle: 'pill', labelXPercent: 82, labelYPercent: 34 }],
  },
  fair: {
    mode: 'results', queryKey: 'fair', queryIntent: 'broad-category-preview', visibleEventIds: ['armada-fair','goodells-fair','shiawassee-fair','upper-peninsula-state-fair'],
    callouts: [
      { eventId: 'upper-peninsula-state-fair', placementZone: 'north-water', labelXPercent: 48, labelYPercent: 24, labelStyle: 'text', connector: 'none', anchorVisibility: 'subtle-dot', priority: 'secondary' },
      { eventId: 'armada-fair', placementZone: 'southeast-cluster', labelXPercent: 80, labelYPercent: 68, labelStyle: 'text', connector: 'none', anchorVisibility: 'subtle-dot', priority: 'secondary' },
    ],
    overflowGroups: [{ id: 'fair-thumb-overflow', eventIds: ['goodells-fair','shiawassee-fair'], label: '+2 fairs', placementZone: 'central-right', countStyle: 'compact', labelXPercent: 61, labelYPercent: 47 }],
  },
  'Romeo Peach Festival': {
    mode: 'single', queryKey: 'Romeo Peach Festival', queryIntent: 'exact-event-preview', selectedEventId: 'romeo-peach', visibleEventIds: ['romeo-peach'],
    callouts: [{ eventId: 'romeo-peach', placementZone: 'east-water-lower', labelXPercent: 82, labelYPercent: 64, labelStyle: 'thumbnail-text', connector: 'short-elbow', anchorVisibility: 'emphasized', priority: 'primary' }],
  },
} as const satisfies Record<string, MapPresentationPlan>;

export const EXAMPLE_MICHIGAN_PRESENTATION_PLAN = MICHIGAN_COMPOSITION_SAMPLE_PLANS.music;

export const resolveMobileBroadSearchPresentationPlan = (): MapPresentationPlan | null => null;
