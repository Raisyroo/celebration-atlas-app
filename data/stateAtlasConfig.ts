import type { AtlasEvent } from './events';

export type StateAtlasArtworkAsset = {
  id: string;
  src: string;
  width: number;
  height: number;
  sha256: string;
};

export type StateAtlasCalibrationProfileId =
  | 'michigan-artwork-calibration-v1';

export type StateAtlasRegionRule = {
  atmosphere: NonNullable<AtlasEvent['regionAtmosphere']>;
  bounds?: {
    minLatitudeInclusive?: number;
    maxLatitudeExclusive?: number;
    minLongitudeExclusive?: number;
    maxLongitudeInclusive?: number;
  };
  categoryKeywords?: readonly string[];
};

export type StateAtlasConfig = {
  identity: {
    slug: string;
    name: string;
    postalCode: string;
    countryCode: 'US';
    databaseStateValues: readonly [string, ...string[]];
  };
  defaultTimeZone: string;
  presentation: {
    profileId: string;
    assetVersion: string;
    calibrationProfileId: StateAtlasCalibrationProfileId;
    titleArtworkSrc: string;
    desktopArtwork: StateAtlasArtworkAsset;
    mobileArtwork: StateAtlasArtworkAsset;
    atmosphereToken: string;
    defaultRegionAtmosphere: NonNullable<AtlasEvent['regionAtmosphere']>;
    regionRules: readonly StateAtlasRegionRule[];
    copy: {
      desktopKicker: string;
      desktopTitle: string;
      desktopBody: string;
      desktopHint: string;
      askPlaceholder: string;
      askSuggestions: readonly [string, ...string[]];
    };
  };
};

export const MICHIGAN_STATE_ATLAS_CONFIG = {
  identity: {
    slug: 'michigan',
    name: 'Michigan',
    postalCode: 'MI',
    countryCode: 'US',
    databaseStateValues: ['Michigan', 'MI'],
  },
  defaultTimeZone: 'America/Detroit',
  presentation: {
    profileId: 'michigan-illustrated-map-v1',
    assetVersion: '2026-07-15',
    calibrationProfileId: 'michigan-artwork-calibration-v1',
    titleArtworkSrc: '/brand/michigan-landing-lockup.png',
    desktopArtwork: {
      id: 'michigan-desktop-2026-07',
      src: '/maps/michigan-atlas-base.webp',
      width: 2814,
      height: 5000,
      sha256: '2636363779F15D3B876C28845F09FED50E574C43A5427D9F3B0309855E588279',
    },
    mobileArtwork: {
      id: 'michigan-mobile-tall-2026-07',
      src: '/maps/michigan-atlas-base-tall.webp',
      width: 972,
      height: 1619,
      sha256: '55A01F3FD221D153BB901425DAFB101FF6343B8A3EB04761692462B626EC9E49',
    },
    atmosphereToken: 'great-lakes-cinematic',
    defaultRegionAtmosphere: 'lakeshore',
    regionRules: [
      {
        atmosphere: 'urban',
        bounds: {
          maxLatitudeExclusive: 43.5,
          minLongitudeExclusive: -84.2,
        },
      },
      {
        atmosphere: 'northwoods',
        bounds: {
          minLatitudeInclusive: 45.7,
        },
      },
      {
        atmosphere: 'harvest',
        categoryKeywords: ['harvest', 'agricultur', 'fair'],
      },
    ],
    copy: {
      desktopKicker: 'Michigan Atlas',
      desktopTitle: 'Find a celebration by place, date, or atmosphere.',
      desktopBody: 'Ask the Atlas below, or select a star to open its event guide.',
      desktopHint: 'The illustrated map is approximate. Event Hubs preserve verified locations, dates, and official sources.',
      askPlaceholder: 'Ask about Michigan celebrations',
      askSuggestions: ['Ask for festivals, fireworks, fairs, or Romeo Peach Festival'],
    },
  },
} as const satisfies StateAtlasConfig;

export function isStateAtlasDatabaseValue(
  config: StateAtlasConfig,
  value: string | null | undefined,
): boolean {
  if (!value) return false;
  const normalizedValue = value.trim().toLowerCase();
  return config.identity.databaseStateValues.some(
    (candidate) => candidate.trim().toLowerCase() === normalizedValue,
  );
}

export function isValidIanaTimeZone(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function matchesBounds(
  latitude: number | null,
  longitude: number | null,
  bounds: NonNullable<StateAtlasRegionRule['bounds']>,
): boolean {
  if (latitude === null || longitude === null) return false;
  if (bounds.minLatitudeInclusive !== undefined && latitude < bounds.minLatitudeInclusive) return false;
  if (bounds.maxLatitudeExclusive !== undefined && latitude >= bounds.maxLatitudeExclusive) return false;
  if (bounds.minLongitudeExclusive !== undefined && longitude <= bounds.minLongitudeExclusive) return false;
  if (bounds.maxLongitudeInclusive !== undefined && longitude > bounds.maxLongitudeInclusive) return false;
  return true;
}

export function resolveStateAtlasRegionAtmosphere(
  config: StateAtlasConfig,
  event: {
    latitude: number | null;
    longitude: number | null;
    categoryText: string;
  },
): NonNullable<AtlasEvent['regionAtmosphere']> {
  const categoryText = event.categoryText.toLowerCase();

  for (const rule of config.presentation.regionRules) {
    if (rule.bounds && !matchesBounds(event.latitude, event.longitude, rule.bounds)) continue;
    if (
      rule.categoryKeywords &&
      !rule.categoryKeywords.some((keyword) => categoryText.includes(keyword.toLowerCase()))
    ) {
      continue;
    }
    return rule.atmosphere;
  }

  return config.presentation.defaultRegionAtmosphere;
}
