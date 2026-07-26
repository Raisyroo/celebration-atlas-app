'use client';

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { RotateCcw, X } from 'lucide-react';
import styles from './AtlasExperienceDeck.module.css';
import type {
  AtlasDeckItemBase,
  AtlasExperienceDeckProps,
} from './types';

const EXIT_DURATION_MS = 220;
const WINDOW_BEFORE = 2;
const WINDOW_AFTER = 4;
const DRAG_STEP_THRESHOLD_PX = 42;
const DISMISS_DISTANCE_PX = 118;
const FLICK_VELOCITY_PX_PER_MS = 0.72;

type GestureOrigin = 'card' | 'handle' | 'surface';

type GestureSession = {
  pointerId: number;
  origin: GestureOrigin;
  startY: number;
  lastY: number;
  startedAt: number;
  lastAt: number;
  moved: boolean;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function getCardTransform(relativeIndex: number, dragOffset: number) {
  if (relativeIndex < 0) {
    return {
      opacity: 0,
      pointerEvents: 'none' as const,
      filter: 'brightness(.88) saturate(.82)',
      transform: `translate3d(0, ${-22 + dragOffset}px, 0) scale(.985)`,
      zIndex: 6 + relativeIndex,
    };
  }

  const positions = [0, 240, 279, 314, 346];
  const scales = [1, 0.976, 0.952, 0.928, 0.904];
  const filters = [
    'brightness(1) saturate(1)',
    'brightness(.96) saturate(.92)',
    'brightness(.89) saturate(.82) blur(.08px)',
    'brightness(.82) saturate(.72) blur(.14px)',
    'brightness(.74) saturate(.64) blur(.22px)',
  ];
  const depthIndex = Math.min(relativeIndex, positions.length - 1);

  return {
    opacity:
      relativeIndex <= 3
        ? [1, 0.99, 0.95, 0.9, 0.82][depthIndex]
        : 0,
    pointerEvents: relativeIndex <= 3 ? ('auto' as const) : ('none' as const),
    filter: filters[depthIndex],
    transform: `translate3d(0, ${positions[depthIndex] + dragOffset}px, 0) scale(${scales[depthIndex]})`,
    zIndex: 10 - relativeIndex,
  };
}

export default function AtlasExperienceDeck<T extends AtlasDeckItemBase>({
  open,
  items,
  initialIndex = 0,
  selectedIndex,
  title = 'Cluster Event Deck',
  renderCard,
  onSelectedIndexChange,
  onOpenItem,
  onDismiss,
  loading = false,
  error = null,
  onRetry,
  emptyTitle = 'No events in this area',
  reducedMotion = false,
  maxCardsPerFlick = 4,
  className,
}: AtlasExperienceDeckProps<T>) {
  const [present, setPresent] = useState(open);
  const [closing, setClosing] = useState(false);
  const [internalIndex, setInternalIndex] = useState(initialIndex);
  const [dragOffset, setDragOffset] = useState(0);
  const panelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const focusReturnRef = useRef<HTMLElement | null>(null);
  const gestureRef = useRef<GestureSession | null>(null);
  const suppressClickRef = useRef(false);

  const maximumIndex = Math.max(0, items.length - 1);
  const activeIndex = clamp(
    selectedIndex ?? internalIndex,
    0,
    maximumIndex,
  );

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setPresent(true);
        setClosing(false);
      });
      return undefined;
    }

    if (!present) return;
    queueMicrotask(() => setClosing(true));
    const timer = window.setTimeout(() => {
      setPresent(false);
      setClosing(false);
    }, reducedMotion ? 90 : EXIT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [open, present, reducedMotion]);

  useEffect(() => {
    if (!open) return;
    focusReturnRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      const target = focusReturnRef.current;
      if (target?.isConnected) {
        window.requestAnimationFrame(() => target.focus());
      }
      focusReturnRef.current = null;
    };
  }, [open]);

  const selectIndex = useCallback(
    (nextIndex: number) => {
      if (!items.length) return;
      const boundedIndex = clamp(nextIndex, 0, maximumIndex);
      if (selectedIndex === undefined) setInternalIndex(boundedIndex);
      if (boundedIndex !== activeIndex) {
        onSelectedIndexChange?.(boundedIndex, items[boundedIndex]);
      }
    },
    [
      activeIndex,
      items,
      maximumIndex,
      onSelectedIndexChange,
      selectedIndex,
    ],
  );

  const mountedCards = useMemo(() => {
    if (!items.length) return [];
    const start = Math.max(0, activeIndex - WINDOW_BEFORE);
    const end = Math.min(items.length, activeIndex + WINDOW_AFTER + 1);
    return items.slice(start, end).map((item, offset) => ({
      item,
      index: start + offset,
    }));
  }, [activeIndex, items]);

  const beginGesture = (event: ReactPointerEvent<HTMLElement>) => {
    if (
      event.button !== 0 ||
      loading ||
      error ||
      !items.length
    ) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest('[data-deck-ignore-gesture="true"]')) return;

    const origin: GestureOrigin = target.closest('[data-deck-handle="true"]')
      ? 'handle'
      : target.closest('[data-deck-card="true"]')
        ? 'card'
        : 'surface';
    const now = performance.now();
    gestureRef.current = {
      pointerId: event.pointerId,
      origin,
      startY: event.clientY,
      lastY: event.clientY,
      startedAt: now,
      lastAt: now,
      moved: false,
    };
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const now = performance.now();
    const rawDelta = event.clientY - gesture.startY;
    const atFirstBoundary = activeIndex === 0 && rawDelta > 0;
    const atLastBoundary = activeIndex === maximumIndex && rawDelta < 0;
    const isDismissOrigin =
      gesture.origin === 'handle' || gesture.origin === 'surface';
    const resistedDelta =
      (atFirstBoundary && !isDismissOrigin) || atLastBoundary
        ? rawDelta * 0.24
        : rawDelta;

    gesture.lastY = event.clientY;
    gesture.lastAt = now;
    gesture.moved ||= Math.abs(rawDelta) > 8;
    suppressClickRef.current = gesture.moved;
    setDragOffset(resistedDelta);
    if (gesture.moved) event.preventDefault();
  };

  const finishGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const delta = gesture.lastY - gesture.startY;
    const duration = Math.max(1, gesture.lastAt - gesture.startedAt);
    const velocity = delta / duration;
    const downwardDismiss =
      (gesture.origin === 'handle' || gesture.origin === 'surface') &&
      delta >= DISMISS_DISTANCE_PX &&
      (velocity > 0.32 || delta > DISMISS_DISTANCE_PX * 1.35);

    if (downwardDismiss) {
      setDragOffset(0);
      gestureRef.current = null;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 80);
      onDismiss();
      return;
    }

    if (Math.abs(delta) >= DRAG_STEP_THRESHOLD_PX) {
      const direction = delta < 0 ? 1 : -1;
      const configuredMaximum = Math.max(1, maxCardsPerFlick);
      const flickSteps =
        !reducedMotion && Math.abs(velocity) >= FLICK_VELOCITY_PX_PER_MS
          ? configuredMaximum === 1
            ? 1
            : clamp(
                Math.round(Math.abs(velocity) * 3),
                2,
                configuredMaximum,
              )
          : 1;
      selectIndex(activeIndex + direction * flickSteps);
    }

    setDragOffset(0);
    gestureRef.current = null;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 80);
  };

  const cancelGesture = () => {
    setDragOffset(0);
    gestureRef.current = null;
    suppressClickRef.current = false;
  };

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onDismiss();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      selectIndex(activeIndex + 1);
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      selectIndex(activeIndex - 1);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      selectIndex(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      selectIndex(maximumIndex);
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => !element.hasAttribute('inert'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!present) return null;

  const rootClassName = [
    styles.root,
    closing ? styles.closing : '',
    reducedMotion ? styles.reducedMotion : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const contentState = loading
    ? 'loading'
    : error
      ? 'error'
      : items.length === 0
        ? 'empty'
        : 'ready';

  return (
    <div
      className={rootClassName}
      data-deck-state={contentState}
      data-deck-view="stack"
      data-mounted-card-count={mountedCards.length}
    >
      <button
        type="button"
        className={styles.scrim}
        aria-label="Close event deck"
        onClick={onDismiss}
        tabIndex={-1}
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-busy={loading || undefined}
        className={styles.panel}
        onKeyDown={handlePanelKeyDown}
        onPointerDown={beginGesture}
        onPointerMove={moveGesture}
        onPointerUp={finishGesture}
        onPointerCancel={cancelGesture}
      >
        <div
          className={styles.handleZone}
          data-deck-handle="true"
          aria-hidden="true"
        >
          <span className={styles.handle} />
        </div>

        <header className={styles.header}>
          <div className={styles.heading}>
            <p className={styles.kicker}>Celebration Atlas</p>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.position}>
              {items.length
                ? `Event ${activeIndex + 1} of ${items.length}`
                : 'Event discovery'}
            </p>
          </div>
          <div
            className={styles.headerActions}
            data-deck-ignore-gesture="true"
          >
            <button
              ref={closeButtonRef}
              type="button"
              className={styles.closeButton}
              onClick={onDismiss}
              aria-label="Close event deck"
            >
              <X aria-hidden="true" size={21} />
            </button>
          </div>
        </header>

        <p className={styles.srOnly} role="status" aria-live="polite">
          {items.length
            ? `Event ${activeIndex + 1} of ${items.length}.`
            : emptyTitle}
        </p>

        {contentState !== 'ready' ? (
          <div className={styles.statePanel}>
            {loading ? (
              <>
                <span className={styles.loadingGlyph} aria-hidden="true" />
                <h2>Gathering nearby events</h2>
                <p>The deck is preparing this cluster.</p>
              </>
            ) : error ? (
              <>
                <span className={styles.stateGlyph} aria-hidden="true">!</span>
                <h2>Events could not be loaded</h2>
                <p>{error}</p>
                {onRetry ? (
                  <button
                    type="button"
                    className={styles.retryButton}
                    onClick={onRetry}
                    data-deck-ignore-gesture="true"
                  >
                    <RotateCcw aria-hidden="true" size={17} />
                    Try again
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <span className={styles.stateGlyph} aria-hidden="true">✦</span>
                <h2>{emptyTitle}</h2>
                <p>Try exploring a nearby cluster.</p>
              </>
            )}
          </div>
        ) : (
          <ol
            className={styles.stackStage}
            aria-label="Event card stack"
            data-selected-index={activeIndex}
          >
            {mountedCards.map(({ item, index }) => {
              const relativeIndex = index - activeIndex;
              const active = relativeIndex === 0;
              const visible = relativeIndex >= 0 && relativeIndex <= 3;
              const cardStyle: CSSProperties = getCardTransform(
                relativeIndex,
                reducedMotion ? 0 : dragOffset,
              );

              return (
                <li
                  key={item.id}
                  className={styles.cardItem}
                  style={cardStyle}
                  data-card-index={index}
                  data-card-active={active ? 'true' : 'false'}
                  aria-hidden={visible ? undefined : true}
                  aria-posinset={index + 1}
                  aria-setsize={items.length}
                >
                  <button
                    type="button"
                    className={styles.cardSlot}
                    data-deck-card="true"
                    aria-current={active ? 'true' : undefined}
                    aria-label={
                      active
                        ? item.accessibilityLabel ?? `Open ${item.title}`
                        : `Select ${item.title}`
                    }
                    tabIndex={visible ? 0 : -1}
                    onClick={() => {
                      if (suppressClickRef.current) {
                        suppressClickRef.current = false;
                        return;
                      }
                      if (active) {
                        onOpenItem(item, index);
                      } else {
                        selectIndex(index);
                      }
                    }}
                  >
                    {renderCard(item, {
                      index,
                      relativeIndex,
                      active,
                      visible,
                    })}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
