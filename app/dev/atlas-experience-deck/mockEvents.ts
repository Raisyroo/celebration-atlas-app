import type { EventDeckItem } from '../../../components/atlas-experience-deck/types';

const asset = (index: number) =>
  `/dev/atlas-experience-deck/mock/event-${String(index).padStart(2, '0')}.svg`;

export const mockMichiganEvents: readonly EventDeckItem[] = [
  { id: 'brown-trout', kind: 'event', title: 'Michigan Brown Trout Festival', location: 'Alpena, MI', dateLabel: 'Jul 17–26', imageUrl: asset(1), imageAlt: 'Graphic sunset over water', href: '/events/michigan-brown-trout-festival', badge: { label: 'LIVE', tone: 'live' }, distanceLabel: '37 mi', categoryLabel: 'Outdoors · Fishing', clusterId: 'mock-38' },
  { id: 'st-clair-4h', kind: 'event', title: 'St. Clair County 4-H & Youth Fair', location: 'Goodells, MI', dateLabel: 'Jul 20–25', imageUrl: asset(2), imageAlt: 'Graphic county fair midway', href: '/events/st-clair-county-4-h-youth-fair', badge: { label: 'LIVE', tone: 'live' }, distanceLabel: '12 mi', categoryLabel: 'Family · Fair', clusterId: 'mock-38' },
  { id: 'coast-guard', kind: 'event', title: 'Grand Haven Coast Guard Festival', location: 'Grand Haven, MI', dateLabel: 'Jul 24–Aug 2', imageUrl: asset(3), imageAlt: 'Graphic lighthouse and waterfront', href: '/events/grand-haven-coast-guard-festival', badge: { label: 'LIVE', tone: 'live' }, distanceLabel: '71 mi', categoryLabel: 'Civic · Waterfront', clusterId: 'mock-38' },
  { id: 'armada-fair', kind: 'event', title: 'Armada Fair', location: 'Armada, MI', dateLabel: 'Aug 17–23', imageUrl: asset(4), imageAlt: 'Graphic fair rides at dusk', href: '/events/armada-fair', badge: { label: 'UPCOMING', tone: 'upcoming' }, distanceLabel: '23 mi', categoryLabel: 'Agriculture · Fair', clusterId: 'mock-38' },
  { id: 'romeo-peach', kind: 'event', title: 'Romeo Peach Festival', location: 'Romeo, MI', dateLabel: 'Sep 3–7', imageUrl: asset(5), imageAlt: 'Graphic peach orchard celebration', href: '/events/romeo-peach-festival', badge: { label: 'UPCOMING', tone: 'upcoming' }, distanceLabel: '28 mi', categoryLabel: 'Food · Tradition', clusterId: 'mock-38' },
  { id: 'sterlingfest', kind: 'event', title: 'Sterlingfest Art & Music Fair', location: 'Sterling Heights, MI', dateLabel: 'Jul 23–25', imageUrl: asset(6), imageAlt: 'Graphic outdoor music and art fair', href: '/events/sterlingfest', badge: { label: 'TODAY', tone: 'today' }, distanceLabel: '31 mi', categoryLabel: 'Music · Art', clusterId: 'mock-38' },
  { id: 'bay-rama', kind: 'event', title: 'Bay-Rama Fishfly Festival', location: 'New Baltimore, MI', dateLabel: 'Jun 24–28', imageUrl: asset(7), imageAlt: 'Graphic waterfront carnival', href: '/events/bay-rama-fishfly-festival', distanceLabel: '18 mi', categoryLabel: 'Waterfront · Carnival', clusterId: 'mock-38' },
  { id: 'tulip-time', kind: 'event', title: 'Tulip Time Festival', location: 'Holland, MI', dateLabel: 'May 1–10', imageUrl: asset(8), imageAlt: 'Graphic tulip fields and windmill', href: '/events/tulip-time-festival', categoryLabel: 'Flowers · Heritage', clusterId: 'mock-38' },
  { id: 'cherry-festival', kind: 'event', title: 'National Cherry Festival', location: 'Traverse City, MI', dateLabel: 'Jun 27–Jul 4', imageUrl: asset(9), imageAlt: 'Graphic cherry celebration near the bay', href: '/events/national-cherry-festival', categoryLabel: 'Food · Waterfront', clusterId: 'mock-38' },
  { id: 'mackinac-lilac', kind: 'event', title: 'Mackinac Island Lilac Festival', location: 'Mackinac Island, MI', dateLabel: 'Jun 5–14', imageUrl: asset(10), imageAlt: 'Graphic lilacs and historic island street', href: '/events/mackinac-island-lilac-festival', categoryLabel: 'Flowers · Island', clusterId: 'mock-38' },
  { id: 'upper-peninsula-fair', kind: 'event', title: 'Upper Peninsula State Fair', location: 'Escanaba, MI', dateLabel: 'Aug 17–23', imageUrl: asset(11), imageAlt: 'Graphic state fair at night', href: '/events/upper-peninsula-state-fair', categoryLabel: 'Agriculture · Fair', clusterId: 'mock-38' },
  { id: 'detroit-jazz', kind: 'event', title: 'Detroit Jazz Festival', location: 'Detroit, MI', dateLabel: 'Sep 4–7', imageUrl: asset(12), imageAlt: 'Graphic jazz performance by the riverfront', href: '/events/detroit-jazz-festival', categoryLabel: 'Music · City', clusterId: 'mock-38' },
];

function cloneMockEvent(item: EventDeckItem, index: number): EventDeckItem {
  const cycle = Math.floor(index / mockMichiganEvents.length) + 1;
  const isLongTitleFixture = index === 18;
  const isMissingImageFixture = index === 7;
  const isSparseFixture = index === 10;

  return {
    ...item,
    id: `${item.id}-${index + 1}`,
    title: isLongTitleFixture
      ? 'Great Lakes Heritage, Lantern & Waterfront Celebration'
      : cycle > 1
        ? `${item.title} · Discovery ${cycle}`
        : item.title,
    location: isLongTitleFixture
      ? 'Historic Waterfront District and Municipal Harbor, Michigan'
      : item.location,
    imageUrl: isMissingImageFixture ? undefined : item.imageUrl,
    distanceLabel: isSparseFixture ? undefined : item.distanceLabel,
    categoryLabel: isSparseFixture ? undefined : item.categoryLabel,
    href: `/dev/atlas-experience-deck/open/${item.id}-${index + 1}`,
    accessibilityLabel: `Open ${isLongTitleFixture ? 'Great Lakes Heritage, Lantern & Waterfront Celebration' : item.title}`,
  };
}

export function createMockEventDataset(total: number): EventDeckItem[] {
  return Array.from({ length: total }, (_, index) =>
    cloneMockEvent(mockMichiganEvents[index % mockMichiganEvents.length], index),
  );
}

export const mockDatasets = {
  '0': [] as EventDeckItem[],
  '1': createMockEventDataset(1),
  '2': createMockEventDataset(2),
  '3': createMockEventDataset(3),
  '38': createMockEventDataset(38),
  '500': createMockEventDataset(500),
} as const;

export type MockDatasetKey = keyof typeof mockDatasets;
