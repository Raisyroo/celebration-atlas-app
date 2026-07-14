export type EventPageVisual = {
  imageSrc: string;
  imageAlt: string;
  imagePosition?: string;
  credit: string;
};

const EVENT_PAGE_VISUALS: Record<string, EventPageVisual> = {
  'black-river-tattoo-convention': {
    imageSrc: '/event-media/black-river/black-river-hero-v2.webp',
    imageAlt: 'Celebration Atlas artwork of a tattoo artist working on a client inside a busy Black River convention hall.',
    imagePosition: 'center 52%',
    credit: 'Celebration Atlas artwork',
  },
  'national-cherry-festival': {
    imageSrc: '/event-media/national-cherry/national-cherry-hero-v1.webp',
    imageAlt: 'Celebration Atlas artwork of families gathering beside Grand Traverse Bay at sunset, framed by ripe cherries and festival tents.',
    credit: 'Celebration Atlas artwork',
  },
  'st-clair-county-4-h-youth-fair': {
    imageSrc: '/event-media/goodells/goodells-fair-hero-v2.png',
    imageAlt: 'Celebration Atlas artwork of a young fair exhibitor beside a black-and-white calf at sunset, with a Ferris wheel behind them.',
    imagePosition: 'center 47%',
    credit: 'Celebration Atlas artwork',
  },
};

export function getEventPageVisual(eventKey: string): EventPageVisual | undefined {
  return EVENT_PAGE_VISUALS[eventKey];
}
