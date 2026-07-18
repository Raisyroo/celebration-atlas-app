import type { EventCoverageLevel, EventProfile } from './eventProfileTypes';

export type MarkerIntensity =
  | 'dim'
  | 'standard'
  | 'bright'
  | 'active'
  | 'signature';

export type MarkerPresentation = {
  intensity: MarkerIntensity;
  reasons: string[];
  isPulsingEligible: boolean;
};

const MARKER_INTENSITY_ORDER: MarkerIntensity[] = [
  'dim',
  'standard',
  'bright',
  'active',
  'signature',
];

const COVERAGE_INTENSITY: Record<
  EventCoverageLevel,
  { intensity: MarkerIntensity; reason: string }
> = {
  basicNationalCoverage: {
    intensity: 'standard',
    reason: 'Basic national coverage uses the established discovery marker intensity.',
  },
  stateDiscoveryCoverage: {
    intensity: 'bright',
    reason:
      'State discovery coverage uses the established atlas marker intensity.',
  },
  practicalEventPage: {
    intensity: 'active',
    reason: 'Practical event page coverage uses an active planning marker.',
  },
  atlasExperiencePage: {
    intensity: 'signature',
    reason: 'Atlas experience page coverage is treated as a signature marker.',
  },
  livingCelebration: {
    intensity: 'signature',
    reason: 'Living celebration coverage is treated as a signature marker.',
  },
};

function bumpIntensity(intensity: MarkerIntensity): MarkerIntensity {
  const currentIndex = MARKER_INTENSITY_ORDER.indexOf(intensity);
  const nextIndex = Math.min(
    currentIndex + 1,
    MARKER_INTENSITY_ORDER.length - 1,
  );

  return MARKER_INTENSITY_ORDER[nextIndex];
}

export function getEventMarkerPresentation(
  profile: EventProfile,
): MarkerPresentation {
  const reasons: string[] = [];
  let intensity = COVERAGE_INTENSITY[profile.coverageLevel].intensity;

  reasons.push(COVERAGE_INTENSITY[profile.coverageLevel].reason);

  if (profile.featured === true) {
    const bumpedIntensity = bumpIntensity(intensity);

    if (bumpedIntensity !== intensity) {
      reasons.push('Featured atlas placement adds one subtle intensity step.');
      intensity = bumpedIntensity;
    } else {
      reasons.push(
        'Featured atlas placement is present, but intensity is already at the maximum.',
      );
    }
  }

  if (profile.trust.confidenceScore < 0.4) {
    reasons.push(
      'Low confidence is noted but does not dim this first-pass adapted profile.',
    );
  }

  return {
    intensity,
    reasons,
    isPulsingEligible: intensity === 'active' || intensity === 'signature',
  };
}
