'use client';

import '@fontsource/cormorant-garamond/600.css';
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  CalendarDays,
  CalendarRange,
  Clock3,
  Compass,
  Crown,
  ExternalLink,
  Fish,
  FlagTriangleRight,
  Heart,
  History,
  Info,
  Map as MapIcon,
  MapPin,
  Music2,
  Palette,
  PartyPopper,
  Repeat2,
  Send,
  Share2,
  Sparkles,
  Store,
  Ticket,
  Trophy,
  Users,
  Utensils,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type {
  EventPageAudienceGroup,
  EventPageManifest,
  EventPageMetric,
  EventPageNavigationIcon,
  HighlightsModuleManifest,
  EventScheduleCategory,
  EventScheduleFilter,
  EventScheduleItem,
  PlanVisitDetail,
  PlanVisitModuleManifest,
  ScheduleModuleManifest,
  ScoutSpotlightPose,
  TraditionsModuleManifest,
  WhyGoModuleManifest,
} from '../data/eventPageManifestTypes';
import { getEventPageVisual } from '../data/eventPageVisuals';
import { getDateKeyInTimeZone, getScheduleItemDateKey } from '../lib/eventScheduleDates';
import {
  createScoutComposerContext,
  type ScoutContentReference,
} from '../lib/scout/composerContext';
import styles from './EventHub.module.css';

const NAVIGATION_ICONS: Record<EventPageNavigationIcon, LucideIcon> = {
  sparkles: Sparkles,
  schedule: CalendarDays,
  music: Music2,
  artists: Users,
  crown: Crown,
  plan: MapIcon,
};

const HIGHLIGHT_ICONS: Record<HighlightsModuleManifest['items'][number]['kind'], LucideIcon> = {
  artists: Users,
  contests: Award,
  liveArt: Palette,
  entertainment: Sparkles,
  marketplace: Store,
  heritage: History,
  community: PartyPopper,
};

const TRADITION_ICONS: Record<TraditionsModuleManifest['items'][number]['kind'], LucideIcon> = {
  pageantry: Crown,
  parade: FlagTriangleRight,
  heritage: History,
  harvest: Wheat,
  community: PartyPopper,
};

const METRIC_ICONS: Record<EventPageMetric['icon'], LucideIcon> = {
  trophy: Trophy,
  calendar: CalendarRange,
  fish: Fish,
  music: Music2,
  ticket: Ticket,
};

const PLAN_ICONS: Record<PlanVisitDetail['icon'], LucideIcon> = {
  mapPin: MapPin,
  badge: BadgeCheck,
  clock: Clock3,
  info: Info,
};

const CATEGORY_ICONS: Record<EventScheduleCategory, LucideIcon> = {
  registration: BadgeCheck,
  fishing: Fish,
  family: Users,
  music: Music2,
  community: Compass,
  food: Utensils,
  awards: Award,
};

const CATEGORY_LABELS: Record<EventScheduleCategory, string> = {
  registration: 'Registration',
  fishing: 'Fishing',
  family: 'Family',
  music: 'Music',
  community: 'Community',
  food: 'Food & Drink',
  awards: 'Awards',
};

const SCOUT_SPOTLIGHT_ARTWORK: Record<ScoutSpotlightPose, string> = {
  resting: '/scout/spotlights/scout-resting-card.webp',
  standing: '/scout/spotlights/scout-standing-card.webp',
  curious: '/scout/spotlights/scout-curious-card.webp',
  running: '/scout/spotlights/scout-running-card.webp',
};

type EventHubProps = {
  manifest: EventPageManifest;
  scoutContentReference?: ScoutContentReference;
};

function getTodayKey(timeZone: string): string {
  return getDateKeyInTimeZone(new Date(), timeZone);
}

function formatScheduleTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatDayLabel(dateKey: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

function formatReviewedDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

function itemMatchesFilter(
  item: EventScheduleItem,
  filter: EventScheduleFilter | undefined,
  todayKey: string,
  timeZone: string,
): boolean {
  if (!filter || filter.mode === 'all') return true;
  if (filter.mode === 'today') return getScheduleItemDateKey(item, timeZone) === todayKey;
  if (filter.mode === 'tag') return Boolean(filter.value && item.tags.includes(filter.value));
  if (filter.mode === 'dateRange') {
    const dateKey = getScheduleItemDateKey(item, timeZone);
    return Boolean(
      filter.startsOn &&
        filter.endsOn &&
        dateKey >= filter.startsOn &&
        dateKey <= filter.endsOn,
    );
  }
  return true;
}

function getScheduleItemsForModule(
  module: ScheduleModuleManifest,
  items: EventScheduleItem[],
  activeFilterId: string | undefined,
  todayKey: string,
  timeZone: string,
): EventScheduleItem[] {
  const filter = module.filters.find((candidate) => candidate.id === activeFilterId);

  return items
    .filter((item) => {
      if (module.includedCategories && !module.includedCategories.includes(item.category)) {
        return false;
      }
      if (
        module.includedTags &&
        !module.includedTags.some((includedTag) => item.tags.includes(includedTag))
      ) {
        return false;
      }
      return itemMatchesFilter(item, filter, todayKey, timeZone);
    })
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
}

function groupScheduleItems(
  items: EventScheduleItem[],
  timeZone: string,
): Array<[string, EventScheduleItem[]]> {
  const grouped = new Map<string, EventScheduleItem[]>();

  for (const item of items) {
    const dateKey = getScheduleItemDateKey(item, timeZone);
    grouped.set(dateKey, [...(grouped.get(dateKey) ?? []), item]);
  }

  return Array.from(grouped.entries());
}

function getSourceIdsForModule(module: EventPageManifest['modules'][number]): string[] {
  if (module.type === 'whyGo') {
    return Array.from(
      new Set([
        ...module.metrics.flatMap((metric) => metric.sourceIds),
        ...module.audienceGroups.flatMap((group) => group.sourceIds),
        ...(module.spotlight?.sourceIds ?? []),
      ]),
    );
  }

  if (module.type === 'planVisit') {
    return Array.from(
      new Set([
        ...module.details.flatMap((detail) => detail.sourceIds),
        ...module.links.map((link) => link.sourceId),
      ]),
    );
  }

  if (module.type === 'schedule') {
    return Array.from(new Set([
      ...(module.sourceIds ?? []),
      ...(module.recurringEvents?.items.flatMap((item) => item.sourceIds) ?? []),
      ...(module.referenceSchedule?.groups.flatMap((group) =>
        group.items.flatMap((item) => item.sourceIds),
      ) ?? []),
    ]));
  }

  if (module.type === 'traditions') {
    return Array.from(new Set(module.items.flatMap((item) => item.sourceIds)));
  }

  if (module.type === 'highlights') {
    return Array.from(new Set([
      ...module.items.flatMap((item) => item.sourceIds),
      ...(module.links?.map((link) => link.sourceId) ?? []),
    ]));
  }

  return [];
}

function VerificationLine({
  manifest,
  sourceIds,
}: {
  manifest: EventPageManifest;
  sourceIds: string[];
}) {
  const firstSource = manifest.sources.find((source) => sourceIds.includes(source.id));
  const sourceLabel = firstSource?.type === 'tourismBoard'
    ? 'Tourism source'
    : firstSource?.type === 'municipal'
      ? 'Government source'
      : firstSource?.type === 'newsArticle'
        ? 'News source'
        : firstSource?.type === 'archive'
          ? 'Archive source'
          : firstSource?.type === 'officialWebsite'
            || firstSource?.type === 'officialSocial'
            || firstSource?.type === 'organizer'
            ? 'Official source'
            : 'Source';

  return (
    <div className={styles.verificationLine}>
      <BadgeCheck size={16} aria-hidden="true" />
      <span>Verified {formatReviewedDate(manifest.reviewedAt)}</span>
      {firstSource?.url ? (
        <a href={firstSource.url} target="_blank" rel="noreferrer">
          {sourceLabel}
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      ) : null}
    </div>
  );
}

function WhyGoModule({
  module,
  manifest,
}: {
  module: WhyGoModuleManifest;
  manifest: EventPageManifest;
}) {
  return (
    <section className={styles.moduleBody} aria-labelledby={`${module.id}-title`}>
      <header className={styles.moduleHeader}>
        <p>{module.eyebrow}</p>
        <h2 id={`${module.id}-title`}>{module.headline}</h2>
        <span>{module.summary}</span>
      </header>

      <div className={styles.metricGrid}>
        {module.metrics.map((metric) => {
          const MetricIcon = METRIC_ICONS[metric.icon];
          return (
            <div className={styles.metric} key={metric.id}>
              <MetricIcon size={24} strokeWidth={1.6} aria-hidden="true" />
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
              {metric.detail ? <small>{metric.detail}</small> : null}
            </div>
          );
        })}
      </div>

      <div className={styles.audienceGrid}>
        {module.audienceGroups.map((group: EventPageAudienceGroup) => (
          <section
            className={`${styles.audienceGroup} ${
              group.tone === 'water' ? styles.audienceWater : styles.audienceSunset
            }`}
            key={group.id}
          >
            <h3>{group.title}</h3>
            <ul>
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {module.spotlight ? (
        <aside
          className={styles.spotlight}
          data-scout-pose={module.spotlight.scoutPose ?? 'curious'}
        >
          <Image
            className={styles.spotlightArtwork}
            src={SCOUT_SPOTLIGHT_ARTWORK[module.spotlight.scoutPose ?? 'curious']}
            alt=""
            width={800}
            height={600}
            sizes="(min-width: 700px) 340px, 48vw"
            aria-hidden="true"
          />
          <Compass size={28} strokeWidth={1.5} aria-hidden="true" />
          <div className={styles.spotlightCopy}>
            <h3>{module.spotlight.title}</h3>
            <p>{module.spotlight.body}</p>
          </div>
        </aside>
      ) : null}

      <VerificationLine manifest={manifest} sourceIds={getSourceIdsForModule(module)} />
    </section>
  );
}

function ScheduleModule({
  module,
  items,
  activeFilterId,
  onFilterChange,
  manifest,
  todayKey,
}: {
  module: ScheduleModuleManifest;
  items: EventScheduleItem[];
  activeFilterId: string;
  onFilterChange: (filterId: string) => void;
  manifest: EventPageManifest;
  todayKey: string;
}) {
  const groups = groupScheduleItems(items, manifest.identity.timezone);
  const activeFilter = module.filters.find((filter) => filter.id === activeFilterId);
  const [activeReferenceGroupId, setActiveReferenceGroupId] = useState(
    module.referenceSchedule?.groups[0]?.id ?? '',
  );
  const activeReferenceGroup = module.referenceSchedule?.groups.find(
    (group) => group.id === activeReferenceGroupId,
  ) ?? module.referenceSchedule?.groups[0];
  const showCurrentFilters = manifest.scheduleItems.length > 0 || module.filters.length > 1;

  let emptyMessage = 'No published events match this filter.';
  if (manifest.scheduleItems.length === 0) {
    emptyMessage = 'The official event schedule has not been published yet.';
  }
  if (activeFilter?.mode === 'today') {
    const nextItem = manifest.scheduleItems
      .filter((item) => getScheduleItemDateKey(item, manifest.identity.timezone) > todayKey)
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt))[0];

    if (nextItem) {
      emptyMessage = `The next published item is ${nextItem.title} on ${formatDayLabel(
        getScheduleItemDateKey(nextItem, manifest.identity.timezone),
      )} at ${formatScheduleTime(nextItem.startsAt, manifest.identity.timezone)}.`;
    } else if (todayKey > manifest.identity.endsOn) {
      emptyMessage = 'This event schedule has concluded. Choose All to review the published program.';
    } else {
      emptyMessage = 'No official schedule items are published for today. Choose All to review the full program.';
    }
  }

  const scheduleSourceIds = Array.from(
    new Set(items.flatMap((item) => item.sourceIds)),
  );

  return (
    <section className={styles.moduleBody} aria-labelledby={`${module.id}-title`}>
      <header className={styles.moduleHeader}>
        <p>{module.eyebrow}</p>
        <h2 id={`${module.id}-title`}>{module.title}</h2>
        <span>{module.subtitle}</span>
      </header>

      {showCurrentFilters ? (
        <div className={styles.filterRow} aria-label={`${module.title} filters`}>
          {module.filters.map((filter) => (
            <button
              type="button"
              key={filter.id}
              className={filter.id === activeFilterId ? styles.filterActive : styles.filterButton}
              aria-pressed={filter.id === activeFilterId}
              onClick={() => onFilterChange(filter.id)}
            >
              {filter.mode === 'today' ? <CalendarDays size={16} aria-hidden="true" /> : null}
              {filter.label}
            </button>
          ))}
        </div>
      ) : null}

      {groups.length ? (
        <div className={styles.scheduleDays}>
          {groups.map(([dateKey, dayItems]) => (
            <section className={styles.scheduleDay} key={dateKey}>
              <h3>{formatDayLabel(dateKey)}</h3>
              <div className={styles.scheduleRows}>
                {dayItems.map((item) => {
                  const CategoryIcon = CATEGORY_ICONS[item.category];
                  const startTime = formatScheduleTime(
                    item.startsAt,
                    manifest.identity.timezone,
                  );
                  const endTime = item.endsAt
                    ? formatScheduleTime(item.endsAt, manifest.identity.timezone)
                    : undefined;
                  return (
                    <article className={styles.scheduleRow} key={item.id}>
                      <time dateTime={item.startsAt}>
                        <span>{startTime}</span>
                        {endTime ? (
                          <>
                            <small>to</small>
                            <span>{endTime}</span>
                          </>
                        ) : null}
                      </time>
                      <div className={styles.scheduleEvent}>
                        <strong>{item.title}</strong>
                        {item.details ? <span>{item.details}</span> : null}
                      </div>
                      <div className={styles.scheduleMeta}>
                        <span>
                          <CategoryIcon size={15} aria-hidden="true" />
                          {CATEGORY_LABELS[item.category]}
                        </span>
                        {item.venue ? <small>{item.venue}</small> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : module.referenceSchedule && manifest.lifecycle === 'completed' ? null : (
        <div
          className={`${styles.emptySchedule} ${
            module.referenceSchedule ? styles.emptyScheduleCompact : ''
          }`}
          role="status"
        >
          <CalendarDays size={25} aria-hidden="true" />
          <p>{emptyMessage}</p>
        </div>
      )}

      {module.referenceSchedule && activeReferenceGroup ? (
        <section
          className={styles.referenceSchedule}
          aria-labelledby={`${module.id}-reference-title`}
        >
          <header className={styles.referenceHeader}>
            <span className={styles.referenceYear}>
              <History size={16} aria-hidden="true" />
              Latest complete program: {module.referenceSchedule.observedYear}
            </span>
            <h3 id={`${module.id}-reference-title`}>{module.referenceSchedule.title}</h3>
            <p>{module.referenceSchedule.summary}</p>
          </header>

          <div className={styles.referenceTabs} aria-label="Reference weekend days" role="tablist">
            {module.referenceSchedule.groups.map((group) => {
              const isActive = group.id === activeReferenceGroup.id;
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={isActive ? styles.referenceTabActive : styles.referenceTab}
                  key={group.id}
                  onClick={() => setActiveReferenceGroupId(group.id)}
                >
                  {group.label}
                </button>
              );
            })}
          </div>

          <section className={styles.referenceGroup} key={activeReferenceGroup.id}>
            <h4 className={styles.referenceGroupTitle}>{activeReferenceGroup.title}</h4>
            <div className={styles.referenceRows}>
              {activeReferenceGroup.items.map((item) => (
                <article className={styles.referenceRow} key={item.id}>
                  <time className={styles.referenceTime}>{item.timeText}</time>
                  <div className={styles.referenceEvent}>
                    <strong>{item.title}</strong>
                    {item.details ? <span>{item.details}</span> : null}
                    {item.venue ? <small>{item.venue}</small> : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <p className={styles.referenceCaveat}>
            <Info size={17} aria-hidden="true" />
            <span>{module.referenceSchedule.caveat}</span>
          </p>
        </section>
      ) : null}

      {module.recurringEvents ? (
        <section className={styles.recurringEvents} aria-labelledby={`${module.id}-recurring-title`}>
          <header className={styles.recurringHeader}>
            <span><Repeat2 size={16} aria-hidden="true" /> Recurring events</span>
            <h3 id={`${module.id}-recurring-title`}>{module.recurringEvents.title}</h3>
            <p>{module.recurringEvents.summary}</p>
          </header>
          <div className={styles.recurringGrid}>
            {module.recurringEvents.items.map((item) => (
              <article className={styles.recurringItem} key={item.id}>
                <Repeat2 size={18} strokeWidth={1.6} aria-hidden="true" />
                <div>
                  <strong>{item.title}</strong>
                  {item.typicalTiming ? <span>{item.typicalTiming}</span> : null}
                  {item.details ? <p>{item.details}</p> : null}
                  {item.venue ? <small>{item.venue}</small> : null}
                </div>
              </article>
            ))}
          </div>
          <p className={styles.recurringCaveat}>
            <Info size={17} aria-hidden="true" />
            <span>{module.recurringEvents.caveat}</span>
          </p>
        </section>
      ) : null}

      {module.notes?.length ? (
        <ul className={styles.scheduleNotes}>
          {module.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      <VerificationLine
        manifest={manifest}
        sourceIds={scheduleSourceIds.length ? scheduleSourceIds : getSourceIdsForModule(module)}
      />
    </section>
  );
}

function TraditionsModule({
  module,
  manifest,
}: {
  module: TraditionsModuleManifest;
  manifest: EventPageManifest;
}) {
  return (
    <section className={styles.moduleBody} aria-labelledby={`${module.id}-title`}>
      <header className={styles.moduleHeader}>
        <p>{module.eyebrow}</p>
        <h2 id={`${module.id}-title`}>{module.headline}</h2>
        <span>{module.summary}</span>
      </header>

      <div className={styles.traditionsGrid}>
        {module.items.map((item) => {
          const TraditionIcon = TRADITION_ICONS[item.kind];
          return (
            <article className={styles.traditionCard} key={item.id}>
              <div className={styles.traditionIcon} aria-hidden="true">
                <TraditionIcon size={22} strokeWidth={1.55} />
              </div>
              <div>
                <p className={styles.traditionKicker}>{item.kicker}</p>
                <h3>{item.title}</h3>
                <p className={styles.traditionSummary}>{item.summary}</p>
                {item.latestObserved ? (
                  <p className={styles.traditionObserved}>{item.latestObserved}</p>
                ) : null}
                {item.currentStatus ? (
                  <p className={styles.traditionStatus}>{item.currentStatus}</p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <VerificationLine manifest={manifest} sourceIds={getSourceIdsForModule(module)} />
    </section>
  );
}

function HighlightsModule({
  module,
  manifest,
}: {
  module: HighlightsModuleManifest;
  manifest: EventPageManifest;
}) {
  return (
    <section className={styles.moduleBody} aria-labelledby={`${module.id}-title`}>
      <header className={styles.moduleHeader}>
        <p>{module.eyebrow}</p>
        <h2 id={`${module.id}-title`}>{module.headline}</h2>
        <span>{module.summary}</span>
      </header>

      <div className={styles.highlightsGrid}>
        {module.items.map((item) => {
          const HighlightIcon = HIGHLIGHT_ICONS[item.kind];
          return (
            <article className={styles.highlightCard} key={item.id}>
              <div className={styles.highlightIcon} aria-hidden="true">
                <HighlightIcon size={23} strokeWidth={1.55} />
              </div>
              <div>
                <p className={styles.highlightKicker}>{item.kicker}</p>
                <h3>{item.title}</h3>
                <p className={styles.highlightSummary}>{item.summary}</p>
                {item.observedEdition ? (
                  <p className={styles.highlightEdition}>{item.observedEdition}</p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {module.links?.length ? (
        <div className={styles.highlightLinks}>
          {module.links.map((link) => (
            <a href={link.href} target="_blank" rel="noreferrer" key={link.id}>
              <span>{link.label}</span>
              <ExternalLink size={17} aria-hidden="true" />
            </a>
          ))}
        </div>
      ) : null}

      <VerificationLine manifest={manifest} sourceIds={getSourceIdsForModule(module)} />
    </section>
  );
}

function PlanVisitModule({
  module,
  manifest,
}: {
  module: PlanVisitModuleManifest;
  manifest: EventPageManifest;
}) {
  return (
    <section className={styles.moduleBody} aria-labelledby={`${module.id}-title`}>
      <header className={styles.moduleHeader}>
        <p>{module.eyebrow}</p>
        <h2 id={`${module.id}-title`}>{module.title}</h2>
        <span>{module.subtitle}</span>
      </header>

      <div className={styles.planLayout}>
        <div className={styles.planDetails}>
          {module.details.map((detail) => {
            const DetailIcon = PLAN_ICONS[detail.icon];
            return (
              <div className={styles.planDetail} key={detail.id}>
                <DetailIcon size={22} strokeWidth={1.6} aria-hidden="true" />
                <div>
                  <strong>{detail.label}</strong>
                  <span>{detail.value}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.planLinks}>
          {module.links.map((link) => (
            <a href={link.href} target="_blank" rel="noreferrer" key={link.id}>
              <span>{link.label}</span>
              <ExternalLink size={17} aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>

      {module.advisory ? <p className={styles.advisory}>{module.advisory}</p> : null}
      <VerificationLine manifest={manifest} sourceIds={getSourceIdsForModule(module)} />
    </section>
  );
}

export default function EventHub({ manifest, scoutContentReference }: EventHubProps) {
  const initialModuleId = manifest.navigation[0]?.targetModuleId ?? manifest.modules[0]?.id;
  const [activeModuleId, setActiveModuleId] = useState(initialModuleId);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      manifest.modules
        .filter((module): module is ScheduleModuleManifest => module.type === 'schedule')
        .map((module) => [module.id, module.filters[0]?.id ?? 'all']),
    ),
  );
  const [isFavorite, setIsFavorite] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const [scoutQuery, setScoutQuery] = useState('');
  const [isScoutInputFocused, setIsScoutInputFocused] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const scoutDockRef = useRef<HTMLElement | null>(null);
  const scoutInputRef = useRef<HTMLInputElement | null>(null);
  const todayKey = useMemo(
    () => getTodayKey(manifest.identity.timezone),
    [manifest.identity.timezone],
  );

  const activeModule =
    manifest.modules.find((module) => module.id === activeModuleId) ?? manifest.modules[0];
  const heroImagePosition =
    manifest.hero.imagePosition ?? getEventPageVisual(manifest.eventId)?.imagePosition;

  const activeScheduleItems = useMemo(() => {
    if (!activeModule || activeModule.type !== 'schedule') return [];
    return getScheduleItemsForModule(
      activeModule,
      manifest.scheduleItems,
      activeFilters[activeModule.id],
      todayKey,
      manifest.identity.timezone,
    );
  }, [activeFilters, activeModule, manifest.identity.timezone, manifest.scheduleItems, todayKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const favoriteKey = `celebration-atlas:event-favorite:${manifest.eventId}`;
      try {
        setIsFavorite(window.localStorage.getItem(favoriteKey) === 'true');
      } catch {
        setIsFavorite(false);
      }

      const requestedModule = window.location.hash.slice(1);
      if (manifest.modules.some((module) => module.id === requestedModule)) {
        setActiveModuleId(requestedModule);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [manifest.eventId, manifest.modules]);

  useEffect(() => {
    if (!shareStatus) return;
    const timer = window.setTimeout(() => setShareStatus(''), 2200);
    return () => window.clearTimeout(timer);
  }, [shareStatus]);

  useEffect(() => {
    const dock = scoutDockRef.current;
    if (!dock) return;

    const visualViewport = window.visualViewport;
    let animationFrame = 0;

    const updateKeyboardInset = () => {
      const visibleBottom = visualViewport
        ? visualViewport.offsetTop + visualViewport.height
        : window.innerHeight;
      const occludedBottom = Math.max(0, window.innerHeight - visibleBottom);
      const keyboardInset = occludedBottom >= 96 ? Math.round(occludedBottom) : 0;
      dock.style.setProperty('--scout-keyboard-inset', `${keyboardInset}px`);
      dock.dataset.keyboardInset = String(keyboardInset);
    };

    const queueKeyboardInsetUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateKeyboardInset);
    };

    queueKeyboardInsetUpdate();
    window.addEventListener('resize', queueKeyboardInsetUpdate);
    visualViewport?.addEventListener('resize', queueKeyboardInsetUpdate);
    visualViewport?.addEventListener('scroll', queueKeyboardInsetUpdate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', queueKeyboardInsetUpdate);
      visualViewport?.removeEventListener('resize', queueKeyboardInsetUpdate);
      visualViewport?.removeEventListener('scroll', queueKeyboardInsetUpdate);
    };
  }, []);

  const selectModule = (moduleId: string, scrollToContent = true) => {
    setActiveModuleId(moduleId);
    window.history.replaceState(null, '', `#${moduleId}`);
    if (scrollToContent) {
      window.requestAnimationFrame(() => {
        contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const toggleFavorite = () => {
    const nextValue = !isFavorite;
    setIsFavorite(nextValue);
    try {
      window.localStorage.setItem(
        `celebration-atlas:event-favorite:${manifest.eventId}`,
        nextValue ? 'true' : 'false',
      );
    } catch {
      // The visual state still works if storage is unavailable.
    }
  };

  const shareEvent = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: manifest.identity.name,
          text: manifest.hero.tagline,
          url: window.location.href,
        });
        setShareStatus('Shared');
        return;
      }
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus('Link copied');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setShareStatus('Unable to share');
    }
  };

  const submitScoutQuery = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!scoutQuery.trim()) {
      scoutInputRef.current?.focus({ preventScroll: true });
      return;
    }

    window.requestAnimationFrame(() => {
      scoutInputRef.current?.focus({ preventScroll: true });
    });
  };

  if (!activeModule) return null;

  const scoutComposerContext = createScoutComposerContext({
    manifest,
    contentReference: scoutContentReference,
    activeSectionId: activeModule.id,
  });
  const isScoutActive = isScoutInputFocused || Boolean(scoutQuery);
  const activeNavigationItem = manifest.navigation.find(
    (item) => item.targetModuleId === activeModule.id,
  );

  return (
    <main className={styles.root}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.iconButton} title="Back to Atlas">
          <ArrowLeft aria-hidden="true" />
          <span className={styles.srOnly}>Back to Atlas</span>
        </Link>
        <div className={styles.topBarTitle}>
          <strong>{manifest.hero.eyebrow}</strong>
          <span>{manifest.identity.shortName}</span>
        </div>
        <div className={styles.topBarActions}>
          <button
            type="button"
            className={`${styles.iconButton} ${isFavorite ? styles.iconButtonActive : ''}`}
            aria-label={isFavorite ? 'Remove event from favorites' : 'Save event to favorites'}
            aria-pressed={isFavorite}
            title={isFavorite ? 'Remove favorite' : 'Save favorite'}
            onClick={toggleFavorite}
          >
            <Heart fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Share event"
            title="Share event"
            onClick={shareEvent}
          >
            <Share2 aria-hidden="true" />
          </button>
        </div>
        <span className={styles.srOnly} role="status" aria-live="polite">
          {shareStatus}
        </span>
      </header>

      <section className={styles.hero} aria-labelledby="event-hub-title">
        <Image
          className={styles.heroImage}
          src={manifest.hero.imageSrc}
          alt={manifest.hero.imageAlt}
          style={heroImagePosition ? { objectPosition: heroImagePosition } : undefined}
          fill
          loading="eager"
          unoptimized
          sizes="100vw"
        />
        <div className={styles.heroScrim} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.edition}>{manifest.identity.edition}</p>
          <h1 id="event-hub-title">{manifest.identity.shortName}</h1>
          <p className={styles.tagline}>{manifest.hero.tagline}</p>
          <div className={styles.heroFacts}>
            <span>
              <MapPin size={18} aria-hidden="true" />
              {manifest.identity.location}
            </span>
            <span>
              <CalendarDays size={18} aria-hidden="true" />
              {manifest.identity.dateText}
            </span>
          </div>
          {manifest.primaryAction ? (
            <a
              className={styles.primaryAction}
              href={manifest.primaryAction.href}
              target="_blank"
              rel="noreferrer"
            >
              {manifest.primaryAction.label}
              <ExternalLink size={18} aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </section>

      {manifest.editionStatus ? (
        <section className={styles.editionStatus} aria-label="Event edition status">
          <History size={22} strokeWidth={1.6} aria-hidden="true" />
          <div>
            <p>{manifest.editionStatus.label}</p>
            <h2>{manifest.editionStatus.title}</h2>
            <span>{manifest.editionStatus.summary}</span>
          </div>
        </section>
      ) : null}

      <nav className={styles.primaryNavigation} aria-label="Event sections" role="tablist">
        {manifest.navigation.map((item) => {
          const NavigationIcon = NAVIGATION_ICONS[item.icon];
          const isActive = item.targetModuleId === activeModule.id;
          return (
            <button
              type="button"
              role="tab"
              id={`event-nav-${item.id}`}
              aria-controls={`event-module-${item.targetModuleId}`}
              aria-selected={isActive}
              className={isActive ? styles.navigationActive : styles.navigationButton}
              key={item.id}
              onClick={() => selectModule(item.targetModuleId)}
            >
              <NavigationIcon size={20} strokeWidth={1.7} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div
        key={activeModule.id}
        className={styles.contentFrame}
        ref={contentRef}
        role="tabpanel"
        id={`event-module-${activeModule.id}`}
        aria-labelledby={activeNavigationItem ? `event-nav-${activeNavigationItem.id}` : undefined}
      >
        {activeModule.type === 'whyGo' ? (
          <WhyGoModule module={activeModule} manifest={manifest} />
        ) : null}
        {activeModule.type === 'schedule' ? (
          <ScheduleModule
            module={activeModule}
            items={activeScheduleItems}
            activeFilterId={activeFilters[activeModule.id] ?? activeModule.filters[0]?.id ?? 'all'}
            onFilterChange={(filterId) =>
              setActiveFilters((current) => ({ ...current, [activeModule.id]: filterId }))
            }
            manifest={manifest}
            todayKey={todayKey}
          />
        ) : null}
        {activeModule.type === 'traditions' ? (
          <TraditionsModule module={activeModule} manifest={manifest} />
        ) : null}
        {activeModule.type === 'highlights' ? (
          <HighlightsModule module={activeModule} manifest={manifest} />
        ) : null}
        {activeModule.type === 'planVisit' ? (
          <PlanVisitModule module={activeModule} manifest={manifest} />
        ) : null}
      </div>

      <section
        ref={scoutDockRef}
        className={styles.scoutDock}
        aria-label="Scout question composer"
        data-testid="scout-composer"
        data-scout-contract-version={scoutComposerContext.contractVersion}
        data-scout-event-id={scoutComposerContext.eventId}
        data-scout-package-id={scoutComposerContext.packageId}
        data-scout-package-version={scoutComposerContext.packageVersion}
        data-scout-source-kind={scoutComposerContext.sourceKind}
        data-scout-active-section-id={scoutComposerContext.activeSectionId}
      >
        <div className={styles.scoutHeader}>
          <div className={styles.scoutPortrait}>
            <Image
              src="/scout/scout-guide-icon.png"
              alt=""
              fill
              loading="eager"
              sizes="58px"
              aria-hidden="true"
            />
          </div>
          {!isScoutActive ? (
            <div className={styles.scoutTitle}>
              <strong>Ask Scout</strong>
              <small>Verified guidance for this event</small>
            </div>
          ) : null}
        </div>

        <form
          className={styles.scoutForm}
          data-testid="scout-composer-form"
          onSubmit={submitScoutQuery}
        >
          <input type="hidden" name="eventId" value={scoutComposerContext.eventId} />
          <input type="hidden" name="packageId" value={scoutComposerContext.packageId} />
          <input
            type="hidden"
            name="packageVersion"
            value={scoutComposerContext.packageVersion}
          />
          <input
            type="hidden"
            name="activeSectionId"
            value={scoutComposerContext.activeSectionId}
          />
          <label htmlFor="scout-event-question" className={styles.srOnly}>
            Ask Scout about {manifest.identity.shortName}
          </label>
          <input
            ref={scoutInputRef}
            id="scout-event-question"
            name="question"
            value={scoutQuery}
            autoComplete="off"
            autoCapitalize="sentences"
            enterKeyHint="send"
            maxLength={500}
            onBlur={() => setIsScoutInputFocused(false)}
            onChange={(event) => setScoutQuery(event.target.value)}
            onFocus={() => setIsScoutInputFocused(true)}
            placeholder={isScoutInputFocused ? '' : 'Ask Scout a question'}
          />
          <button
            type="submit"
            aria-label="Submit question to Scout composer"
            title="Submit question to Scout composer"
          >
            <Send size={19} aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  );
}
