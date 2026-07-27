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
const CARD_DRAG_DISTANCE_PX = 128;
const DRAG_STEP_THRESHOLD_PX = 34;
const DISMISS_DISTANCE_PX = 118;
const MOMENTUM_PROJECTION_MS = 120;
const FLICK_VELOCITY_PX_PER_MS = 0.28;
const POSITION_EPSILON = 0.001;

type GestureOrigin = 'card' | 'handle' | 'surface';

type GestureSession = {
  pointerId: number;
  origin: GestureOrigin;
  startY: number;
  lastY: number;
  startPosition: number;
  startedAt: number;
  lastAt: number;
  velocityY: number;
  moved: boolean;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const interpolate = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

const interpolateKeyframes = (
  relativePosition: number,
  values: readonly number[],
) => {
  const clampedPosition = clamp(relativePosition, -1, values.length - 2);
  const lowerPosition = Math.floor(clampedPosition);
  const upperPosition = Math.ceil(clampedPosition);
  const lowerValue = values[lowerPosition + 1];
  const upperValue = values[upperPosition + 1];
  return interpolate(
    lowerValue,
    upperValue,
    clampedPosition - lowerPosition,
  );
};

type DeckCardStyle = CSSProperties & {
  '--deck-card-height': string;
  '--deck-card-media-height': string;
  '--deck-card-media-width': string;
  '--deck-card-content-left': string;
  '--deck-card-content-height': string;
  '--deck-card-title-size': string;
  '--deck-card-location-size': string;
  '--deck-card-date-size': string;
  '--deck-card-category-opacity': string;
  '--deck-card-category-height': string;
  '--deck-card-radius': string;
};

function getCardPresentation(
  relativePosition: number,
  surfaceOffset: number,
): {
  style: DeckCardStyle;
  visible: boolean;
} {
  const activation = clamp(1 - Math.abs(relativePosition), 0, 1);
  const verticalPosition = interpolateKeyframes(
    relativePosition,
    [-128, 0, 240, 279, 314, 346],
  );
  const scale = interpolateKeyframes(
    relativePosition,
    [0.985, 1, 0.976, 0.952, 0.928, 0.904],
  );
  const opacity = interpolateKeyframes(
    relativePosition,
    [0, 1, 0.99, 0.95, 0.9, 0],
  );
  const brightness = interpolateKeyframes(
    relativePosition,
    [0.82, 1, 0.96, 0.89, 0.82, 0.74],
  );
  const saturation = interpolateKeyframes(
    relativePosition,
    [0.76, 1, 0.92, 0.82, 0.72, 0.64],
  );
  const blur = interpolateKeyframes(
    relativePosition,
    [0.2, 0, 0, 0.08, 0.14, 0.22],
  );
  const visibleHeight = interpolateKeyframes(
    relativePosition,
    [58, 278, 70, 64, 58, 52],
  );
  const mediaHeight = interpolate(70, 158, activation);
  const mediaWidthPixels = interpolate(92, 0, activation);
  const mediaWidthPercent = interpolate(0, 100, activation);
  const contentLeft = interpolate(92, 0, activation);
  const contentHeight = interpolate(70, 120, activation);

  return {
    visible: opacity > 0.08 && relativePosition > -0.92,
    style: {
      opacity,
      pointerEvents:
        relativePosition >= -0.05 && relativePosition <= 3.5
          ? 'auto'
          : 'none',
      filter: `brightness(${brightness}) saturate(${saturation}) blur(${blur}px)`,
      transform: `translate3d(0, ${verticalPosition + surfaceOffset}px, 0) scale(${scale})`,
      zIndex: Math.round(100 - relativePosition * 10),
      '--deck-card-height': `${visibleHeight}px`,
      '--deck-card-media-height': `${mediaHeight}px`,
      '--deck-card-media-width': `calc(${mediaWidthPixels}px + ${mediaWidthPercent}%)`,
      '--deck-card-content-left': `${contentLeft}px`,
      '--deck-card-content-height': `${contentHeight}px`,
      '--deck-card-title-size': `${interpolate(12.5, 23, activation)}px`,
      '--deck-card-location-size': `${interpolate(9.5, 12.5, activation)}px`,
      '--deck-card-date-size': `${interpolate(9.5, 12.5, activation)}px`,
      '--deck-card-category-opacity': `${activation}`,
      '--deck-card-category-height': `${interpolate(0, 18, activation)}px`,
      '--deck-card-radius': `${interpolate(16, 21, activation)}px`,
    },
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
  const maximumIndex = Math.max(0, items.length - 1);
  const requestedIndex = clamp(
    selectedIndex ?? internalIndex,
    0,
    maximumIndex,
  );
  const [deckPosition, setDeckPositionState] = useState(requestedIndex);
  const [surfaceOffset, setSurfaceOffset] = useState(0);
  const [motionActive, setMotionActive] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const focusReturnRef = useRef<HTMLElement | null>(null);
  const gestureRef = useRef<GestureSession | null>(null);
  const suppressClickRef = useRef(false);
  const deckPositionRef = useRef(requestedIndex);
  const animationFrameRef = useRef<number | null>(null);

  const visualActiveIndex = clamp(
    Math.round(deckPosition),
    0,
    maximumIndex,
  );

  const updateDeckPosition = useCallback(
    (nextPosition: number) => {
      const boundedPosition = clamp(nextPosition, 0, maximumIndex);
      deckPositionRef.current = boundedPosition;
      setDeckPositionState(boundedPosition);
    },
    [maximumIndex],
  );

  const cancelPositionAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setMotionActive(false);
  }, []);

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

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    },
    [],
  );

  const commitIndex = useCallback(
    (nextIndex: number) => {
      if (!items.length) return;
      const boundedIndex = clamp(nextIndex, 0, maximumIndex);
      if (selectedIndex === undefined) setInternalIndex(boundedIndex);
      if (boundedIndex !== requestedIndex) {
        onSelectedIndexChange?.(boundedIndex, items[boundedIndex]);
      }
    },
    [
      items,
      maximumIndex,
      onSelectedIndexChange,
      requestedIndex,
      selectedIndex,
    ],
  );

  const animateToIndex = useCallback(
    (
      nextIndex: number,
      options: {
        notify?: boolean;
        releaseVelocity?: number;
      } = {},
    ) => {
      if (!items.length) return;
      cancelPositionAnimation();

      const boundedIndex = clamp(
        Math.round(nextIndex),
        0,
        maximumIndex,
      );
      const fromPosition = deckPositionRef.current;
      const distance = Math.abs(boundedIndex - fromPosition);
      const notify = options.notify ?? true;

      if (distance <= POSITION_EPSILON) {
        updateDeckPosition(boundedIndex);
        if (notify) commitIndex(boundedIndex);
        return;
      }

      const releaseSpeed = Math.abs(options.releaseVelocity ?? 0);
      const duration = reducedMotion
        ? clamp(distance * 90, 90, 360)
        : clamp(190 + distance * 95 - releaseSpeed * 24, 190, 620);
      const startedAt = performance.now();
      setMotionActive(true);

      const animateFrame = (now: number) => {
        const linearProgress = clamp((now - startedAt) / duration, 0, 1);
        const easedProgress =
          1 - Math.pow(1 - linearProgress, reducedMotion ? 2 : 3);
        updateDeckPosition(
          interpolate(fromPosition, boundedIndex, easedProgress),
        );

        if (linearProgress < 1) {
          animationFrameRef.current =
            window.requestAnimationFrame(animateFrame);
          return;
        }

        animationFrameRef.current = null;
        updateDeckPosition(boundedIndex);
        setMotionActive(false);
        if (notify) commitIndex(boundedIndex);
      };

      animationFrameRef.current =
        window.requestAnimationFrame(animateFrame);
    },
    [
      cancelPositionAnimation,
      commitIndex,
      items.length,
      maximumIndex,
      reducedMotion,
      updateDeckPosition,
    ],
  );

  useEffect(() => {
    if (
      gestureRef.current ||
      Math.abs(requestedIndex - deckPositionRef.current) <= POSITION_EPSILON
    ) {
      return;
    }
    animateToIndex(requestedIndex, { notify: false });
  }, [animateToIndex, requestedIndex]);

  const selectIndex = useCallback(
    (nextIndex: number) => {
      animateToIndex(nextIndex);
    },
    [animateToIndex],
  );

  const mountedCards = useMemo(() => {
    if (!items.length) return [];
    const start = Math.max(0, visualActiveIndex - WINDOW_BEFORE);
    const end = Math.min(
      items.length,
      visualActiveIndex + WINDOW_AFTER + 1,
    );
    return items.slice(start, end).map((item, offset) => ({
      item,
      index: start + offset,
    }));
  }, [items, visualActiveIndex]);

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
    cancelPositionAnimation();
    gestureRef.current = {
      pointerId: event.pointerId,
      origin,
      startY: event.clientY,
      lastY: event.clientY,
      startPosition: deckPositionRef.current,
      startedAt: now,
      lastAt: now,
      velocityY: 0,
      moved: false,
    };
    setMotionActive(true);
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const now = performance.now();
    const rawDelta = event.clientY - gesture.startY;
    const elapsed = Math.max(1, now - gesture.lastAt);
    const instantaneousVelocity = (event.clientY - gesture.lastY) / elapsed;
    gesture.velocityY =
      gesture.velocityY * 0.58 + instantaneousVelocity * 0.42;
    const isDismissOrigin =
      gesture.origin === 'handle' || gesture.origin === 'surface';

    gesture.lastY = event.clientY;
    gesture.lastAt = now;
    gesture.moved ||= Math.abs(rawDelta) > 8;
    suppressClickRef.current = gesture.moved;

    if (isDismissOrigin && rawDelta > 0) {
      updateDeckPosition(gesture.startPosition);
      setSurfaceOffset(rawDelta * 0.72);
    } else {
      const nextPosition =
        gesture.startPosition - rawDelta / CARD_DRAG_DISTANCE_PX;
      const boundedPosition = clamp(nextPosition, 0, maximumIndex);
      const overscroll =
        nextPosition < 0
          ? -nextPosition
          : nextPosition > maximumIndex
            ? nextPosition - maximumIndex
            : 0;
      updateDeckPosition(boundedPosition);
      setSurfaceOffset(
        overscroll > 0
          ? Math.sign(rawDelta) *
              Math.min(34, overscroll * CARD_DRAG_DISTANCE_PX * 0.18)
          : 0,
      );
    }

    if (gesture.moved) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const finishGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const delta = gesture.lastY - gesture.startY;
    const duration = Math.max(1, gesture.lastAt - gesture.startedAt);
    const averageVelocity = delta / duration;
    const velocity =
      Math.abs(gesture.velocityY) > 0.04
        ? gesture.velocityY
        : averageVelocity;
    const downwardDismiss =
      (gesture.origin === 'handle' || gesture.origin === 'surface') &&
      delta >= DISMISS_DISTANCE_PX &&
      (velocity > 0.32 || delta > DISMISS_DISTANCE_PX * 1.35);

    if (downwardDismiss) {
      cancelPositionAnimation();
      setSurfaceOffset(0);
      gestureRef.current = null;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 80);
      onDismiss();
      return;
    }

    const isDismissOrigin =
      gesture.origin === 'handle' || gesture.origin === 'surface';
    if (isDismissOrigin && delta > 0) {
      setSurfaceOffset(0);
      gestureRef.current = null;
      animateToIndex(Math.round(gesture.startPosition));
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 80);
      return;
    }

    const currentPosition = deckPositionRef.current;
    const positionVelocity = -velocity / CARD_DRAG_DISTANCE_PX;
    const configuredMaximum = Math.max(1, maxCardsPerFlick);
    const momentumDistance = reducedMotion
      ? 0
      : clamp(
          positionVelocity * MOMENTUM_PROJECTION_MS,
          -configuredMaximum,
          configuredMaximum,
        );
    let targetIndex = Math.round(
      clamp(currentPosition + momentumDistance, 0, maximumIndex),
    );
    const startIndex = Math.round(gesture.startPosition);
    const qualifiesAsSwipe =
      Math.abs(delta) >= DRAG_STEP_THRESHOLD_PX ||
      Math.abs(velocity) >= FLICK_VELOCITY_PX_PER_MS;

    if (qualifiesAsSwipe && targetIndex === startIndex) {
      const direction =
        Math.abs(velocity) >= FLICK_VELOCITY_PX_PER_MS
          ? velocity < 0
            ? 1
            : -1
          : delta < 0
            ? 1
            : -1;
      targetIndex = clamp(startIndex + direction, 0, maximumIndex);
    }

    setSurfaceOffset(0);
    gestureRef.current = null;
    animateToIndex(targetIndex, {
      releaseVelocity: positionVelocity,
    });
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 80);
  };

  const cancelGesture = () => {
    setSurfaceOffset(0);
    gestureRef.current = null;
    suppressClickRef.current = false;
    animateToIndex(Math.round(deckPositionRef.current));
  };

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onDismiss();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      selectIndex(visualActiveIndex + 1);
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      selectIndex(visualActiveIndex - 1);
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
      data-deck-motion={motionActive ? 'moving' : 'settled'}
      data-deck-position={deckPosition.toFixed(3)}
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
                ? `Event ${visualActiveIndex + 1} of ${items.length}`
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
            ? `Event ${visualActiveIndex + 1} of ${items.length}.`
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
            data-selected-index={visualActiveIndex}
          >
            {mountedCards.map(({ item, index }) => {
              const relativePosition = index - deckPosition;
              const relativeIndex = index - visualActiveIndex;
              const active = relativeIndex === 0;
              const presentation = getCardPresentation(
                relativePosition,
                surfaceOffset,
              );
              const visible = presentation.visible;

              return (
                <li
                  key={item.id}
                  className={styles.cardItem}
                  style={presentation.style}
                  data-card-index={index}
                  data-card-active={active ? 'true' : 'false'}
                  data-card-relative-position={relativePosition.toFixed(3)}
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
