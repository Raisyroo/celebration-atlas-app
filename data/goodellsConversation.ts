export type ConversationVisual = {
  label: string;
  caption: string;
  localTip?: string;
};

export type ConversationCard = {
  title: string;
  text: string;
  highlights: readonly string[];
  visual?: ConversationVisual;
};

const GOOD_ELLS_FAIR_CARDS = {
  default: {
    title: 'Fair Guide · Quick Start',
    text: 'Happy to help—ask about animals, snacks, parking, or family-friendly stops and I can give you a quick fair plan.',
    highlights: ['4-H barns and livestock', 'Midway snacks and food stands', 'Parking and timing tips'],
  },
  livestock: {
    title: 'Barn Guide · Sheep & Livestock',
    text: 'For sheep and livestock, start with the 4-H barns earlier in the evening when aisles are easier to navigate and exhibitors can chat.',
    highlights: ['Start in 4-H barns first', 'Best before peak grandstand traffic', 'Great stop for animal questions'],
  },
  food: {
    title: 'Snack Guide · Cotton Candy + Fair Food',
    text: 'Grab cotton candy before the late-night rush, then circle back for a savory stand while many guests are at shows.',
    highlights: ['Sweet treat early', 'Savory break during showtime', 'Keep water handy between stops'],
  },
  family: {
    title: 'Family Guide · Kids Route',
    text: 'With kids, begin at youth exhibits and animal barns, then head to rides before lines build after sunset.',
    highlights: ['Youth exhibits first', 'Kid rides before peak', 'Pick a meetup landmark'],
  },
  parking: {
    title: 'Arrival Guide · Parking',
    text: 'Arrive a little early for easier lot access. If main lots are filling, follow overflow signs and use the nearest marked entry gate.',
    highlights: ['Earlier arrival = easier parking', 'Use overflow signage if needed', 'Note your row before heading in'],
  },
  schedule: {
    title: 'Timing Guide · Daily Schedule',
    text: 'Check the posted fair schedule at entry boards first, then plan one barn stop, one food stop, and one headline activity.',
    highlights: ['Start with posted board times', 'Pick 3 anchor stops', 'Leave buffer time for lines'],
  },

  map: {
    title: 'Fairgrounds Map · Orientation View',
    text: "Here's a quick orientation sketch so you can anchor your route before heading into the flow of rides, barns, and food lanes.",
    highlights: ['Start with your closest gate marker', 'Barn corridor runs north of midway lights', 'Save one regroup point for your group'],
    visual: {
      label: 'Fairgrounds Map',
      caption: 'Use this field-note insert to get your bearings: entry gates, barn lanes, midway lights, and the food corridor are shown in a quick visual sweep.',
      localTip: 'Local tip: The west-side entry is usually calmer right after opening hour.',
    },
  },
} as const;

export function getGoodellsMockConversation(question: string): ConversationCard {
  const normalized = question.toLowerCase();

  if (/(sheep|animal|animals|livestock|barn|4-h)/.test(normalized)) return GOOD_ELLS_FAIR_CARDS.livestock;
  if (/(cotton candy|food|eat|snack|funnel cake|corn dog)/.test(normalized)) return GOOD_ELLS_FAIR_CARDS.food;
  if (/(kids|kid|family|child|children|stroller)/.test(normalized)) return GOOD_ELLS_FAIR_CARDS.family;
  if (/(park|parking|lot|shuttle)/.test(normalized)) return GOOD_ELLS_FAIR_CARDS.parking;
  if (/(show me a map|fairgrounds map|map of the fair|where is everything|layout|\bmap\b)/.test(normalized)) return GOOD_ELLS_FAIR_CARDS.map;
  if (/(schedule|time|times|when|agenda)/.test(normalized)) return GOOD_ELLS_FAIR_CARDS.schedule;

  return GOOD_ELLS_FAIR_CARDS.default;
}
