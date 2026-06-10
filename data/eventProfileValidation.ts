import type { EventProfile } from './eventProfileTypes';

type EventProfileReadinessLevel = 'basic' | 'practical' | 'experience' | 'living' | 'worldBuilt';

type CoverageSummary = {
  hasIdentity: boolean;
  hasDiscovery: boolean;
  hasTiming: boolean;
  hasExperience: boolean;
  hasPractical: boolean;
  hasMedia: boolean;
  hasSources: boolean;
  hasTrust: boolean;
};

type EventMediaValidationFields = {
  altText?: string;
  mediaType?: string;
  rightsStatus?: string;
};

const VERIFIED_SOURCE_STATUSES = new Set([
  'official',
  'fieldVerified',
  'officialConfirmed',
]);

function hasText(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasItems<T>(value: T[] | undefined | null): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

function hasCoverageLevel(profile: EventProfile): boolean {
  return hasText(profile.coverageLevel);
}

function getScheduleStatus(profile: EventProfile): string | undefined {
  return profile.scheduleStatus ?? profile.practicalAttendance?.scheduleStatus;
}

function isConfirmedSchedule(profile: EventProfile): boolean {
  const scheduleStatus = getScheduleStatus(profile);

  return scheduleStatus === 'confirmed' || scheduleStatus === 'currentPublished';
}

function getMediaType(mediaItem: NonNullable<EventProfile['media']>[number]): string {
  const validationFields = mediaItem as typeof mediaItem & EventMediaValidationFields;

  return validationFields.mediaType ?? mediaItem.kind;
}

function getMediaAltText(mediaItem: NonNullable<EventProfile['media']>[number]): string | undefined {
  const validationFields = mediaItem as typeof mediaItem & EventMediaValidationFields;

  return validationFields.altText ?? mediaItem.alt;
}

function getMediaRightsStatus(
  mediaItem: NonNullable<EventProfile['media']>[number],
): string | undefined {
  const validationFields = mediaItem as typeof mediaItem & EventMediaValidationFields;

  return validationFields.rightsStatus;
}

export function validateEventProfile(profile: EventProfile): string[] {
  const warnings: string[] = [];

  if (!hasText(profile.id)) {
    warnings.push('EventProfile is missing an id.');
  }

  if (!hasText(profile.slug)) {
    warnings.push('EventProfile is missing a slug.');
  }

  if (!hasText(profile.name)) {
    warnings.push('EventProfile is missing a name.');
  }

  if (!hasText(profile.shortDescription)) {
    warnings.push('EventProfile is missing a shortDescription.');
  }

  if (!hasText(profile.locationName)) {
    warnings.push('EventProfile is missing geography.locationLabel.');
  }

  if (!profile.coordinates) {
    warnings.push('EventProfile is missing geography.coordinates.');
  }

  if (!hasItems(profile.eventTypes)) {
    warnings.push('EventProfile is missing discovery.eventTypes.');
  }

  if (!hasItems(profile.categories)) {
    warnings.push('EventProfile is missing discovery.categories.');
  }

  if (!hasCoverageLevel(profile)) {
    warnings.push('EventProfile is missing discovery.coverageLevel.');
  }

  if (!profile.trust || !hasText(profile.trust.sourceStatus)) {
    warnings.push('EventProfile is missing trust.sourceStatus.');
  }

  if (!profile.trust || typeof profile.trust.confidenceScore !== 'number') {
    warnings.push('EventProfile is missing trust.confidenceScore.');
  } else if (profile.trust.confidenceScore < 0 || profile.trust.confidenceScore > 1) {
    warnings.push('EventProfile trust.confidenceScore must be between 0 and 1.');
  }

  if (
    profile.trust &&
    VERIFIED_SOURCE_STATUSES.has(profile.trust.sourceStatus) &&
    !hasItems(profile.sources)
  ) {
    warnings.push('EventProfile trust.sourceStatus is official or fieldVerified, but no sources are attached.');
  }

  profile.media?.forEach((mediaItem) => {
    const mediaLabel = mediaItem.id || mediaItem.src || 'unknown media item';

    if (getMediaType(mediaItem) === 'image' && !hasText(getMediaAltText(mediaItem))) {
      warnings.push(`EventProfile media item "${mediaLabel}" is an image without altText.`);
    }

    if (!hasText(getMediaRightsStatus(mediaItem))) {
      warnings.push(`EventProfile media item "${mediaLabel}" is missing rightsStatus.`);
    }
  });

  if (isConfirmedSchedule(profile)) {
    profile.schedule?.forEach((scheduleItem) => {
      if (!hasItems(scheduleItem.sourceIds)) {
        warnings.push(
          `EventProfile schedule item "${scheduleItem.id || scheduleItem.title}" is confirmed without sourceIds.`,
        );
      }
    });
  }

  return warnings;
}

export function getEventProfileCoverageSummary(profile: EventProfile): CoverageSummary {
  return {
    hasIdentity:
      hasText(profile.id) &&
      hasText(profile.slug) &&
      hasText(profile.name) &&
      hasText(profile.shortDescription),
    hasDiscovery:
      hasItems(profile.eventTypes) && hasItems(profile.categories) && hasCoverageLevel(profile),
    hasTiming:
      Boolean(profile.dateRange) &&
      (hasText(profile.dateRange.startDate) || hasText(profile.dateRange.displayText)),
    hasExperience: hasItems(profile.experiences) || hasItems(profile.curiosityItems),
    hasPractical: Boolean(profile.practicalAttendance),
    hasMedia: hasItems(profile.media),
    hasSources: hasItems(profile.sources),
    hasTrust:
      Boolean(profile.trust) &&
      hasText(profile.trust.sourceStatus) &&
      typeof profile.trust.confidenceScore === 'number',
  };
}

export function getEventProfileReadinessLevel(profile: EventProfile): EventProfileReadinessLevel {
  switch (profile.coverageLevel) {
    case 'basicNationalCoverage':
      return 'basic';
    case 'stateDiscoveryCoverage':
      return 'practical';
    case 'practicalEventPage':
      return 'experience';
    case 'atlasExperiencePage':
      return 'living';
    case 'livingCelebration':
      return 'worldBuilt';
    default:
      return 'basic';
  }
}
