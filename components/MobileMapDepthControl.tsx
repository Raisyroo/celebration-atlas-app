'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  normalizeDeviceOrientationToScreen,
  resolveMobileMapDepthOffsets,
  shortestAngleDelta,
  type MobileMapDepthOffsets,
} from '../data/mobileMapDepth';
import styles from './MobileMapDepthControl.module.css';

type MotionPermission = 'granted' | 'denied';
type MotionPermissionConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<MotionPermission>;
};
type DepthAccessState = 'idle' | 'requesting' | 'denied' | 'unavailable';

type MobileMapDepthControlProps = {
  sceneRef: RefObject<HTMLElement | null>;
  isEligible: boolean;
  isHidden: boolean;
  mapScale: number;
  prefersReducedMotion: boolean;
};

const DEPTH_PERMISSION_SESSION_KEY = 'celebration-atlas:map-depth-permission-v1';
const SETTLE_EPSILON_PX = 0.012;
const INTERPOLATION_FACTOR = 0.18;
const SENSOR_START_TIMEOUT_MS = 2500;
const ZERO_OFFSETS: MobileMapDepthOffsets = Object.freeze({
  shared: Object.freeze({ x: 0, y: 0 }),
  artwork: Object.freeze({ x: 0, y: 0 }),
});

const readSessionPermission = () => {
  try {
    return window.sessionStorage.getItem(DEPTH_PERMISSION_SESSION_KEY);
  } catch {
    return null;
  }
};

const writeSessionPermission = (value: string) => {
  try {
    window.sessionStorage.setItem(DEPTH_PERMISSION_SESSION_KEY, value);
  } catch {
    // Session storage is optional; motion remains usable without persistence.
  }
};

const getMotionPermissionConstructor = () =>
  window.DeviceOrientationEvent as MotionPermissionConstructor | undefined;

const getScreenAngle = () => {
  const legacyWindow = window as Window & { orientation?: number };
  return window.screen.orientation?.angle ?? legacyWindow.orientation ?? 0;
};

const offsetDistance = (
  current: MobileMapDepthOffsets,
  target: MobileMapDepthOffsets,
) =>
  Math.max(
    Math.abs(current.shared.x - target.shared.x),
    Math.abs(current.shared.y - target.shared.y),
    Math.abs(current.artwork.x - target.artwork.x),
    Math.abs(current.artwork.y - target.artwork.y),
  );

const interpolateOffsets = (
  current: MobileMapDepthOffsets,
  target: MobileMapDepthOffsets,
): MobileMapDepthOffsets => ({
  shared: {
    x: current.shared.x + (target.shared.x - current.shared.x) * INTERPOLATION_FACTOR,
    y: current.shared.y + (target.shared.y - current.shared.y) * INTERPOLATION_FACTOR,
  },
  artwork: {
    x: current.artwork.x +
      (target.artwork.x - current.artwork.x) * INTERPOLATION_FACTOR,
    y: current.artwork.y +
      (target.artwork.y - current.artwork.y) * INTERPOLATION_FACTOR,
  },
});

export default function MobileMapDepthControl({
  sceneRef,
  isEligible,
  isHidden,
  mapScale,
  prefersReducedMotion,
}: MobileMapDepthControlProps) {
  const [maySupportOrientation, setMaySupportOrientation] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [accessState, setAccessState] = useState<DepthAccessState>('idle');
  const baselineRef = useRef<{ x: number; y: number } | null>(null);
  const targetRef = useRef<MobileMapDepthOffsets>(ZERO_OFFSETS);
  const renderedRef = useRef<MobileMapDepthOffsets>(ZERO_OFFSETS);
  const animationFrameRef = useRef<number | null>(null);
  const mapScaleRef = useRef(mapScale);

  const applyOffsets = useCallback((offsets: MobileMapDepthOffsets) => {
    const scene = sceneRef.current;
    if (!scene) return;

    const safeScale = Math.max(0.01, mapScaleRef.current);
    scene.style.setProperty(
      '--atlas-depth-shared-x',
      `${offsets.shared.x / safeScale}px`,
    );
    scene.style.setProperty(
      '--atlas-depth-shared-y',
      `${offsets.shared.y / safeScale}px`,
    );
    scene.style.setProperty(
      '--atlas-depth-artwork-x',
      `${offsets.artwork.x / safeScale}px`,
    );
    scene.style.setProperty(
      '--atlas-depth-artwork-y',
      `${offsets.artwork.y / safeScale}px`,
    );
    const hasArtworkOffset =
      Math.abs(offsets.artwork.x) > SETTLE_EPSILON_PX ||
      Math.abs(offsets.artwork.y) > SETTLE_EPSILON_PX;
    scene.style.setProperty(
      '--atlas-depth-artwork-transform',
      hasArtworkOffset
        ? `translate3d(${offsets.artwork.x / safeScale}px, ${offsets.artwork.y / safeScale}px, 0)`
        : 'none',
    );
  }, [sceneRef]);

  const cancelAnimation = useCallback(() => {
    if (animationFrameRef.current === null) return;
    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }, []);

  const animateTowardTarget = useCallback(() => {
    if (animationFrameRef.current !== null) return;

    const tick = () => {
      const next = interpolateOffsets(renderedRef.current, targetRef.current);
      renderedRef.current = next;
      applyOffsets(next);

      if (offsetDistance(next, targetRef.current) <= SETTLE_EPSILON_PX) {
        renderedRef.current = targetRef.current;
        applyOffsets(targetRef.current);
        animationFrameRef.current = null;
        return;
      }

      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);
  }, [applyOffsets]);

  const returnToNeutral = useCallback((immediate = false) => {
    baselineRef.current = null;
    targetRef.current = ZERO_OFFSETS;

    if (immediate) {
      cancelAnimation();
      renderedRef.current = ZERO_OFFSETS;
      applyOffsets(ZERO_OFFSETS);
      return;
    }

    animateTowardTarget();
  }, [animateTowardTarget, applyOffsets, cancelAnimation]);

  useEffect(() => {
    let isCurrent = true;
    queueMicrotask(() => {
      if (!isCurrent) return;

      const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      const constructor = getMotionPermissionConstructor();
      setMaySupportOrientation(
        Boolean(!reducedMotion && typeof constructor === 'function'),
      );

      const storedPermission = readSessionPermission();
      if (storedPermission === 'denied') setAccessState('denied');
      if (storedPermission === 'unavailable') setAccessState('unavailable');
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    mapScaleRef.current = mapScale;
    applyOffsets(renderedRef.current);
  }, [applyOffsets, mapScale]);

  useEffect(() => {
    if (isEligible && !prefersReducedMotion) return;
    returnToNeutral(true);
  }, [isEligible, prefersReducedMotion, returnToNeutral]);

  useEffect(() => {
    if (
      !isEnabled ||
      !isEligible ||
      prefersReducedMotion ||
      accessState === 'denied' ||
      accessState === 'unavailable'
    ) {
      return;
    }

    let sensorTimeout: number | null = null;
    let isListening = false;
    let hasReceivedReading = false;

    const clearSensorTimeout = () => {
      if (!sensorTimeout) return;
      clearTimeout(sensorTimeout);
      sensorTimeout = null;
    };

    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;

      hasReceivedReading = true;
      clearSensorTimeout();
      const normalized = normalizeDeviceOrientationToScreen(
        event.beta,
        event.gamma,
        getScreenAngle(),
      );

      if (!baselineRef.current) {
        baselineRef.current = normalized;
        targetRef.current = ZERO_OFFSETS;
        animateTowardTarget();
        return;
      }

      targetRef.current = resolveMobileMapDepthOffsets(
        shortestAngleDelta(normalized.x, baselineRef.current.x),
        shortestAngleDelta(normalized.y, baselineRef.current.y),
      );
      animateTowardTarget();
    };

    const stopListening = () => {
      if (!isListening) return;
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
      isListening = false;
      clearSensorTimeout();
    };

    const startListening = () => {
      if (isListening || document.visibilityState === 'hidden') return;
      baselineRef.current = null;
      hasReceivedReading = false;
      window.addEventListener('deviceorientation', handleDeviceOrientation);
      isListening = true;
      sensorTimeout = window.setTimeout(() => {
        if (hasReceivedReading) return;
        stopListening();
        writeSessionPermission('unavailable');
        setAccessState('unavailable');
        setIsEnabled(false);
        returnToNeutral();
      }, SENSOR_START_TIMEOUT_MS);
    };

    const recalibrate = () => {
      baselineRef.current = null;
      targetRef.current = ZERO_OFFSETS;
      animateTowardTarget();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopListening();
        returnToNeutral(true);
        return;
      }

      recalibrate();
      startListening();
    };

    startListening();
    window.addEventListener('orientationchange', recalibrate);
    window.screen.orientation?.addEventListener('change', recalibrate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopListening();
      window.removeEventListener('orientationchange', recalibrate);
      window.screen.orientation?.removeEventListener('change', recalibrate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    accessState,
    animateTowardTarget,
    isEligible,
    isEnabled,
    prefersReducedMotion,
    returnToNeutral,
  ]);

  useEffect(() => () => {
    cancelAnimation();
    renderedRef.current = ZERO_OFFSETS;
    applyOffsets(ZERO_OFFSETS);
  }, [applyOffsets, cancelAnimation]);

  const handleToggle = useCallback(async () => {
    if (isEnabled) {
      setIsEnabled(false);
      returnToNeutral();
      return;
    }

    if (
      prefersReducedMotion ||
      !isEligible ||
      accessState === 'requesting' ||
      accessState === 'denied' ||
      accessState === 'unavailable'
    ) {
      return;
    }

    const constructor = getMotionPermissionConstructor();
    if (!constructor) {
      writeSessionPermission('unavailable');
      setAccessState('unavailable');
      returnToNeutral();
      return;
    }

    const storedPermission = readSessionPermission();
    if (constructor.requestPermission && storedPermission !== 'granted') {
      setAccessState('requesting');

      try {
        const permission = await constructor.requestPermission();
        writeSessionPermission(permission);
        if (permission !== 'granted') {
          setAccessState('denied');
          returnToNeutral();
          return;
        }
      } catch {
        writeSessionPermission('denied');
        setAccessState('denied');
        returnToNeutral();
        return;
      }
    }

    setAccessState('idle');
    baselineRef.current = null;
    setIsEnabled(true);
  }, [
    accessState,
    isEligible,
    isEnabled,
    prefersReducedMotion,
    returnToNeutral,
  ]);

  if (
    !maySupportOrientation ||
    !isEligible ||
    prefersReducedMotion ||
    isHidden
  ) {
    return null;
  }

  const isUnavailable =
    accessState === 'denied' || accessState === 'unavailable';
  const label = isUnavailable
    ? 'Depth unavailable'
    : accessState === 'requesting'
      ? 'Requesting Depth…'
      : 'View in Depth';

  return (
    <div
      className={styles.controlWrap}
      data-mobile-depth-state={
        isUnavailable ? 'unavailable' : isEnabled ? 'enabled' : 'disabled'
      }
    >
      <button
        type="button"
        className={styles.control}
        aria-label={isEnabled ? 'Turn off map depth' : label}
        aria-pressed={isEnabled}
        data-active={isEnabled ? 'true' : 'false'}
        disabled={isUnavailable || accessState === 'requesting'}
        onClick={handleToggle}
      >
        {label}
      </button>
    </div>
  );
}
