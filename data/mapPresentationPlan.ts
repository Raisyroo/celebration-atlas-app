export type MapPresentationMode = 'idle' | 'results' | 'single' | 'selected';

export type MapLabelPlacement =
  | 'near-anchor'
  | 'west-water'
  | 'east-water'
  | 'north-water'
  | 'south-margin'
  | 'manual';

export type MapCalloutConnector = 'none' | 'short-elbow';
export type MapCalloutIconStyle = 'thumbnail' | 'event-icon' | 'none';
export type MapCalloutPriority = 'primary' | 'secondary';

export type MapPresentationCluster = {
  id: string;
  eventIds: readonly string[];
  label: string;
  xPercent: number;
  yPercent: number;
};

export type MapPresentationCallout = {
  eventId: string;
  labelPlacement: MapLabelPlacement;
  labelXPercent?: number;
  labelYPercent?: number;
  connector?: MapCalloutConnector;
  iconStyle?: MapCalloutIconStyle;
  priority?: MapCalloutPriority;
};

export type MapPresentationPlan = {
  mode: MapPresentationMode;
  visibleEventIds: readonly string[];
  clusters?: readonly MapPresentationCluster[];
  callouts?: readonly MapPresentationCallout[];
};

export const MUSIC_PRESENTATION_PRIMARY_EVENT_IDS = [
  'electric-forest',
  'muskegon-summer-celebration',
  'common-ground-lansing',
  'detroit-jazz',
  'faster-horses',
] as const;

export const MUSIC_MOBILE_PRESENTATION_PLAN: MapPresentationPlan = {
  mode: 'results',
  visibleEventIds: MUSIC_PRESENTATION_PRIMARY_EVENT_IDS,
  callouts: [
    {
      eventId: 'electric-forest',
      labelPlacement: 'manual',
      labelXPercent: 21,
      labelYPercent: 34,
      connector: 'none',
      iconStyle: 'event-icon',
      priority: 'primary',
    },
    {
      eventId: 'muskegon-summer-celebration',
      labelPlacement: 'manual',
      labelXPercent: 24,
      labelYPercent: 49,
      connector: 'none',
      iconStyle: 'event-icon',
      priority: 'primary',
    },
    {
      eventId: 'common-ground-lansing',
      labelPlacement: 'manual',
      labelXPercent: 67,
      labelYPercent: 48,
      connector: 'none',
      iconStyle: 'event-icon',
      priority: 'primary',
    },
    {
      eventId: 'detroit-jazz',
      labelPlacement: 'manual',
      labelXPercent: 73,
      labelYPercent: 66,
      connector: 'none',
      iconStyle: 'event-icon',
      priority: 'primary',
    },
    {
      eventId: 'faster-horses',
      labelPlacement: 'manual',
      labelXPercent: 34,
      labelYPercent: 70,
      connector: 'none',
      iconStyle: 'event-icon',
      priority: 'primary',
    },
  ],
};

const normalizePresentationQuery = (query: string) =>
  query.trim().toLowerCase().replace(/\s+/g, ' ');

export const resolveMobileBroadSearchPresentationPlan = ({
  query,
  matchingEventIds,
}: {
  query: string;
  matchingEventIds: ReadonlySet<string>;
}): MapPresentationPlan | null => {
  if (normalizePresentationQuery(query) !== 'music') return null;

  const primaryEventIds = new Set<string>(MUSIC_PRESENTATION_PRIMARY_EVENT_IDS);
  const overflowEventIds = [...matchingEventIds].filter(
    (eventId) => !primaryEventIds.has(eventId),
  );

  return {
    ...MUSIC_MOBILE_PRESENTATION_PLAN,
    clusters:
      overflowEventIds.length > 0
        ? [
            {
              id: 'music-overflow',
              eventIds: overflowEventIds,
              label: `+${overflowEventIds.length}`,
              xPercent: 82,
              yPercent: 38,
            },
          ]
        : undefined,
  };
};

export const EXAMPLE_MICHIGAN_PRESENTATION_PLAN: MapPresentationPlan = {
  mode: 'results',
  visibleEventIds: [
    'romeo-peach',
    'detroit-jazz',
    'electric-forest',
    'armada-fair',
    'goodells-fair',
    'black-river-tattoo',
  ],
  callouts: [
    {
      eventId: 'romeo-peach',
      labelPlacement: 'near-anchor',
      connector: 'none',
      iconStyle: 'event-icon',
      priority: 'primary',
    },
    {
      eventId: 'detroit-jazz',
      labelPlacement: 'west-water',
      labelXPercent: 22,
      labelYPercent: 58,
      connector: 'short-elbow',
      iconStyle: 'thumbnail',
      priority: 'primary',
    },
    {
      eventId: 'electric-forest',
      labelPlacement: 'east-water',
      labelXPercent: 80,
      labelYPercent: 35,
      connector: 'short-elbow',
      iconStyle: 'thumbnail',
      priority: 'secondary',
    },
  ],
  clusters: [
    {
      id: 'thumb-fairs-example',
      eventIds: ['armada-fair', 'goodells-fair', 'black-river-tattoo'],
      label: '+3',
      xPercent: 68,
      yPercent: 61,
    },
  ],
};
