import type { ReactNode } from 'react';

export type AtlasDeckView = 'stack' | 'list';

export type AtlasDeckBadgeTone =
  | 'live'
  | 'today'
  | 'upcoming'
  | 'neutral';

export interface AtlasDeckItemBase {
  id: string;
  title: string;
  imageUrl?: string;
  imageAlt?: string;
  href: string;
  badge?: {
    label: string;
    tone?: AtlasDeckBadgeTone;
  };
  accessibilityLabel?: string;
}

export interface EventDeckItem extends AtlasDeckItemBase {
  kind: 'event';
  location: string;
  dateLabel: string;
  distanceLabel?: string;
  categoryLabel?: string;
  clusterId?: string;
}

export interface AtlasDeckCardRenderState {
  index: number;
  relativeIndex: number;
  active: boolean;
  visible: boolean;
}

export interface AtlasExperienceDeckProps<T extends AtlasDeckItemBase> {
  open: boolean;
  items: readonly T[];
  initialIndex?: number;
  selectedIndex?: number;
  view?: AtlasDeckView;
  title?: string;
  renderCard: (item: T, state: AtlasDeckCardRenderState) => ReactNode;
  renderListItem?: (item: T, index: number) => ReactNode;
  onSelectedIndexChange?: (index: number, item: T) => void;
  onOpenItem: (item: T, index: number) => void;
  onDismiss: () => void;
  onViewChange?: (view: AtlasDeckView) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  reducedMotion?: boolean;
  maxCardsPerFlick?: number;
  className?: string;
}
