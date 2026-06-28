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
