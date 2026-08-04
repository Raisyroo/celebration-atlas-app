import type { EventPageManifest } from './eventPageManifestTypes';

const MAX_MANIFEST_BYTES = 1_000_000;
const EVENT_PAGE_RECIPES = new Set(['simpleEvent', 'multiDayFestival', 'competitionFestival']);
const EVENT_PAGE_LIFECYCLES = new Set(['upcoming', 'live', 'completed', 'cancelled']);
const MODULE_TYPES = new Set(['whyGo', 'schedule', 'highlights', 'traditions', 'planVisit']);
const NAVIGATION_ICONS = new Set(['sparkles', 'schedule', 'music', 'artists', 'crown', 'plan']);
const ACTION_TYPES = new Set(['officialInfo', 'registration', 'tickets', 'directions']);
const SOURCE_TYPES = new Set([
  'officialWebsite',
  'officialSocial',
  'organizer',
  'municipal',
  'tourismBoard',
  'newsArticle',
  'archive',
  'fieldScout',
  'attendeeContribution',
  'partnerFeed',
  'generatedArtifact',
  'other',
]);
const CONFIDENCE_LEVELS = new Set(['unknown', 'low', 'medium', 'high', 'verified']);
const SCHEDULE_CATEGORIES = new Set([
  'registration',
  'fishing',
  'livestock',
  'exhibits',
  'grandstand',
  'midway',
  'family',
  'music',
  'community',
  'food',
  'awards',
]);
const SCOUT_SPOTLIGHT_POSES = new Set(['resting', 'standing', 'curious', 'running']);
const TRADITION_KINDS = new Set(['pageantry', 'parade', 'heritage', 'harvest', 'community']);
const HIGHLIGHT_KINDS = new Set([
  'artists',
  'contests',
  'liveArt',
  'entertainment',
  'marketplace',
  'heritage',
  'community',
]);
const SPONSOR_LANGUAGE = /\b(?:sponsor(?:ed|ship|s)?|presented by|presenting partner|title partner|powered by)\b/i;

type JsonRecord = Record<string, unknown>;

export type EventPageManifestValidationResult =
  | { ok: true; value: EventPageManifest; errors: []; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredString(
  record: JsonRecord,
  key: string,
  path: string,
  errors: string[],
): string {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${path}.${key} must be a non-empty string.`);
    return '';
  }
  return value.trim();
}

function optionalString(record: JsonRecord, key: string, path: string, errors: string[]) {
  const value = record[key];
  if (value !== undefined && (typeof value !== 'string' || !value.trim())) {
    errors.push(`${path}.${key} must be a non-empty string when provided.`);
  }
}

function requiredRecord(
  record: JsonRecord,
  key: string,
  path: string,
  errors: string[],
): JsonRecord {
  const value = record[key];
  if (!isRecord(value)) {
    errors.push(`${path}.${key} must be an object.`);
    return {};
  }
  return value;
}

function requiredArray(
  record: JsonRecord,
  key: string,
  path: string,
  errors: string[],
): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    errors.push(`${path}.${key} must be an array.`);
    return [];
  }
  return value;
}

function requiredStringArray(
  record: JsonRecord,
  key: string,
  path: string,
  errors: string[],
): string[] {
  const values = requiredArray(record, key, path, errors);
  const strings: string[] = [];
  values.forEach((value, index) => {
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`${path}.${key}[${index}] must be a non-empty string.`);
    } else {
      strings.push(value.trim());
    }
  });
  return strings;
}

function optionalStringArray(
  record: JsonRecord,
  key: string,
  path: string,
  errors: string[],
): string[] | undefined {
  if (record[key] === undefined) return undefined;
  return requiredStringArray(record, key, path, errors);
}

function validateEnum(
  value: unknown,
  allowed: Set<string>,
  path: string,
  errors: string[],
) {
  if (typeof value !== 'string' || !allowed.has(value)) {
    errors.push(`${path} has an unsupported value.`);
  }
}

function validateDate(value: string, path: string, errors: string[]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    errors.push(`${path} must use a valid YYYY-MM-DD date.`);
  }
}

function validateDateTime(value: string, path: string, errors: string[]) {
  if (Number.isNaN(Date.parse(value)) || !/T\d{2}:\d{2}/.test(value)) {
    errors.push(`${path} must be a valid ISO date-time.`);
  }
}

function validateHttpUrl(value: string, path: string, errors: string[]) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      errors.push(`${path} must use http:// or https://.`);
    }
  } catch {
    errors.push(`${path} must be a valid URL.`);
  }
}

function validateUniqueIds(
  records: unknown[],
  path: string,
  errors: string[],
): Map<string, JsonRecord> {
  const found = new Map<string, JsonRecord>();
  records.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`${path}[${index}] must be an object.`);
      return;
    }
    const id = requiredString(item, 'id', `${path}[${index}]`, errors);
    if (!id) return;
    if (found.has(id)) errors.push(`${path} contains duplicate id "${id}".`);
    found.set(id, item);
  });
  return found;
}

function collectSourceReferences(
  values: string[],
  path: string,
  references: Array<{ id: string; path: string }>,
) {
  values.forEach((id) => references.push({ id, path }));
}

function scanSponsorLanguage(value: unknown, path: string, errors: string[]) {
  if (typeof value === 'string') {
    if (SPONSOR_LANGUAGE.test(value)) {
      errors.push(`${path} contains event sponsor language, which is not permitted on Event Hub pages.`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanSponsorLanguage(item, `${path}[${index}]`, errors));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'href' || key === 'url' || key === 'imageSrc') continue;
    scanSponsorLanguage(child, `${path}.${key}`, errors);
  }
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!isRecord(value)) return value;
  return Object.keys(value)
    .sort()
    .reduce<JsonRecord>((sorted, key) => {
      const child = value[key];
      if (child !== undefined) sorted[key] = sortJson(child);
      return sorted;
    }, {});
}

export function stableStringifyEventPageManifest(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

export function validateEventPageManifest(input: unknown): EventPageManifestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(input)) {
    return { ok: false, errors: ['Manifest must be a JSON object.'], warnings };
  }

  let serialized = '';
  try {
    serialized = JSON.stringify(input);
  } catch {
    errors.push('Manifest must be JSON serializable.');
  }
  if (serialized && new TextEncoder().encode(serialized).byteLength > MAX_MANIFEST_BYTES) {
    errors.push(`Manifest exceeds the ${MAX_MANIFEST_BYTES.toLocaleString()} byte limit.`);
  }

  if (input.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
  requiredString(input, 'id', 'manifest', errors);
  const eventId = requiredString(input, 'eventId', 'manifest', errors);
  const slug = requiredString(input, 'slug', 'manifest', errors);
  if (eventId && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eventId)) {
    errors.push('manifest.eventId must be a lowercase kebab-case key.');
  }
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errors.push('manifest.slug must be a lowercase kebab-case slug.');
  }
  validateEnum(input.recipe, EVENT_PAGE_RECIPES, 'manifest.recipe', errors);
  validateEnum(input.lifecycle, EVENT_PAGE_LIFECYCLES, 'manifest.lifecycle', errors);

  const identity = requiredRecord(input, 'identity', 'manifest', errors);
  ['name', 'shortName', 'location', 'dateText', 'startsOn', 'endsOn', 'timezone'].forEach((key) => {
    requiredString(identity, key, 'manifest.identity', errors);
  });
  optionalString(identity, 'edition', 'manifest.identity', errors);
  optionalString(identity, 'venue', 'manifest.identity', errors);
  const startsOn = typeof identity.startsOn === 'string' ? identity.startsOn : '';
  const endsOn = typeof identity.endsOn === 'string' ? identity.endsOn : '';
  if (startsOn) validateDate(startsOn, 'manifest.identity.startsOn', errors);
  if (endsOn) validateDate(endsOn, 'manifest.identity.endsOn', errors);
  if (startsOn && endsOn && endsOn < startsOn) {
    errors.push('manifest.identity.endsOn must be on or after startsOn.');
  }

  const hero = requiredRecord(input, 'hero', 'manifest', errors);
  ['eyebrow', 'tagline'].forEach((key) => {
    requiredString(hero, key, 'manifest.hero', errors);
  });
  const imageSrc = typeof hero.imageSrc === 'string' ? hero.imageSrc.trim() : '';
  const imageAlt = typeof hero.imageAlt === 'string' ? hero.imageAlt.trim() : '';
  if (typeof hero.imageSrc !== 'string' || typeof hero.imageAlt !== 'string') {
    errors.push('manifest.hero.imageSrc and manifest.hero.imageAlt must be strings.');
  } else if (Boolean(imageSrc) !== Boolean(imageAlt)) {
    errors.push('manifest.hero.imageSrc and manifest.hero.imageAlt must both be supplied or both be empty.');
  }
  optionalString(hero, 'imagePosition', 'manifest.hero', errors);
  optionalString(hero, 'credit', 'manifest.hero', errors);

  const sourceReferences: Array<{ id: string; path: string }> = [];
  const presentationItemReferences: Array<{ id: string; path: string }> = [];

  if (input.editionStatus !== undefined) {
    if (!isRecord(input.editionStatus)) {
      errors.push('manifest.editionStatus must be an object when provided.');
    } else {
      ['label', 'title', 'summary'].forEach((key) => {
        requiredString(input.editionStatus as JsonRecord, key, 'manifest.editionStatus', errors);
      });
      collectSourceReferences(
        requiredStringArray(input.editionStatus, 'sourceIds', 'manifest.editionStatus', errors),
        'manifest.editionStatus.sourceIds',
        sourceReferences,
      );
    }
  }

  const sources = requiredArray(input, 'sources', 'manifest', errors);
  const sourceMap = validateUniqueIds(sources, 'manifest.sources', errors);
  sourceMap.forEach((source, id) => {
    const path = `manifest.sources[${id}]`;
    requiredString(source, 'title', path, errors);
    validateEnum(source.type, SOURCE_TYPES, `${path}.type`, errors);
    validateEnum(source.confidence, CONFIDENCE_LEVELS, `${path}.confidence`, errors);
    if (typeof source.url === 'string') validateHttpUrl(source.url, `${path}.url`, errors);
  });

  if (input.primaryAction !== undefined) {
    if (!isRecord(input.primaryAction)) {
      errors.push('manifest.primaryAction must be an object when provided.');
    } else {
      const action = input.primaryAction;
      requiredString(action, 'label', 'manifest.primaryAction', errors);
      const href = requiredString(action, 'href', 'manifest.primaryAction', errors);
      if (href) validateHttpUrl(href, 'manifest.primaryAction.href', errors);
      validateEnum(action.type, ACTION_TYPES, 'manifest.primaryAction.type', errors);
      const sourceId = requiredString(action, 'sourceId', 'manifest.primaryAction', errors);
      if (sourceId) collectSourceReferences([sourceId], 'manifest.primaryAction.sourceId', sourceReferences);
    }
  }

  const modules = requiredArray(input, 'modules', 'manifest', errors);
  const moduleMap = validateUniqueIds(modules, 'manifest.modules', errors);
  const filtersByModule = new Map<string, Set<string>>();
  moduleMap.forEach((module, moduleId) => {
    const path = `manifest.modules[${moduleId}]`;
    validateEnum(module.type, MODULE_TYPES, `${path}.type`, errors);
    ['title', 'eyebrow'].forEach((key) => requiredString(module, key, path, errors));

    if (module.type === 'whyGo') {
      ['headline', 'summary'].forEach((key) => requiredString(module, key, path, errors));
      const metrics = requiredArray(module, 'metrics', path, errors);
      validateUniqueIds(metrics, `${path}.metrics`, errors).forEach((metric, metricId) => {
        const metricPath = `${path}.metrics[${metricId}]`;
        ['value', 'label', 'icon'].forEach((key) => requiredString(metric, key, metricPath, errors));
        optionalString(metric, 'detail', metricPath, errors);
        collectSourceReferences(
          requiredStringArray(metric, 'sourceIds', metricPath, errors),
          `${metricPath}.sourceIds`,
          sourceReferences,
        );
      });
      const audiences = requiredArray(module, 'audienceGroups', path, errors);
      validateUniqueIds(audiences, `${path}.audienceGroups`, errors).forEach((group, groupId) => {
        const groupPath = `${path}.audienceGroups[${groupId}]`;
        requiredString(group, 'title', groupPath, errors);
        validateEnum(group.tone, new Set(['water', 'sunset']), `${groupPath}.tone`, errors);
        requiredStringArray(group, 'items', groupPath, errors);
        collectSourceReferences(
          requiredStringArray(group, 'sourceIds', groupPath, errors),
          `${groupPath}.sourceIds`,
          sourceReferences,
        );
      });
      if (module.spotlight !== undefined) {
        if (!isRecord(module.spotlight)) {
          errors.push(`${path}.spotlight must be an object.`);
        } else {
          requiredString(module.spotlight, 'title', `${path}.spotlight`, errors);
          requiredString(module.spotlight, 'body', `${path}.spotlight`, errors);
          if (module.spotlight.scoutPose !== undefined) {
            validateEnum(
              module.spotlight.scoutPose,
              SCOUT_SPOTLIGHT_POSES,
              `${path}.spotlight.scoutPose`,
              errors,
            );
          }
          collectSourceReferences(
            requiredStringArray(module.spotlight, 'sourceIds', `${path}.spotlight`, errors),
            `${path}.spotlight.sourceIds`,
            sourceReferences,
          );
        }
      }
    }

    if (module.type === 'schedule') {
      requiredString(module, 'subtitle', path, errors);
      optionalStringArray(module, 'includedCategories', path, errors)?.forEach((category) => {
        validateEnum(category, SCHEDULE_CATEGORIES, `${path}.includedCategories`, errors);
      });
      optionalStringArray(module, 'includedTags', path, errors);
      optionalStringArray(module, 'notes', path, errors);
      const scheduleSourceIds = optionalStringArray(module, 'sourceIds', path, errors);
      if (scheduleSourceIds) {
        collectSourceReferences(scheduleSourceIds, `${path}.sourceIds`, sourceReferences);
      }
      if (module.presentationGroups !== undefined) {
        const presentationGroups = requiredArray(module, 'presentationGroups', path, errors);
        validateUniqueIds(presentationGroups, `${path}.presentationGroups`, errors).forEach((group, groupId) => {
          const groupPath = `${path}.presentationGroups[${groupId}]`;
          requiredString(group, 'title', groupPath, errors);
          optionalString(group, 'summary', groupPath, errors);
          requiredStringArray(group, 'itemIds', groupPath, errors).forEach((id) => {
            presentationItemReferences.push({ id, path: `${groupPath}.itemIds` });
          });
          collectSourceReferences(
            requiredStringArray(group, 'sourceIds', groupPath, errors),
            `${groupPath}.sourceIds`,
            sourceReferences,
          );
        });
      }
      if (module.recurringEvents !== undefined) {
        if (!isRecord(module.recurringEvents)) {
          errors.push(`${path}.recurringEvents must be an object.`);
        } else {
          const recurringPath = `${path}.recurringEvents`;
          ['title', 'summary', 'caveat'].forEach((key) => {
            requiredString(module.recurringEvents as Record<string, unknown>, key, recurringPath, errors);
          });
          const recurringItems = requiredArray(module.recurringEvents, 'items', recurringPath, errors);
          validateUniqueIds(recurringItems, `${recurringPath}.items`, errors).forEach((item, itemId) => {
            const itemPath = `${recurringPath}.items[${itemId}]`;
            requiredString(item, 'title', itemPath, errors);
            optionalString(item, 'typicalTiming', itemPath, errors);
            optionalString(item, 'venue', itemPath, errors);
            optionalString(item, 'details', itemPath, errors);
            collectSourceReferences(
              requiredStringArray(item, 'sourceIds', itemPath, errors),
              `${itemPath}.sourceIds`,
              sourceReferences,
            );
          });
        }
      }
      if (module.referenceSchedule !== undefined) {
        if (!isRecord(module.referenceSchedule)) {
          errors.push(`${path}.referenceSchedule must be an object.`);
        } else {
          const referencePath = `${path}.referenceSchedule`;
          ['title', 'summary', 'caveat'].forEach((key) => {
            requiredString(module.referenceSchedule as Record<string, unknown>, key, referencePath, errors);
          });
          const observedYear = module.referenceSchedule.observedYear;
          if (!Number.isInteger(observedYear) || Number(observedYear) < 1900 || Number(observedYear) > 2100) {
            errors.push(`${referencePath}.observedYear must be an integer between 1900 and 2100.`);
          }
          const referenceGroups = requiredArray(module.referenceSchedule, 'groups', referencePath, errors);
          validateUniqueIds(referenceGroups, `${referencePath}.groups`, errors).forEach((group, groupId) => {
            const groupPath = `${referencePath}.groups[${groupId}]`;
            requiredString(group, 'label', groupPath, errors);
            requiredString(group, 'title', groupPath, errors);
            const referenceItems = requiredArray(group, 'items', groupPath, errors);
            validateUniqueIds(referenceItems, `${groupPath}.items`, errors).forEach((item, itemId) => {
              const itemPath = `${groupPath}.items[${itemId}]`;
              requiredString(item, 'title', itemPath, errors);
              requiredString(item, 'timeText', itemPath, errors);
              optionalString(item, 'venue', itemPath, errors);
              optionalString(item, 'details', itemPath, errors);
              collectSourceReferences(
                requiredStringArray(item, 'sourceIds', itemPath, errors),
                `${itemPath}.sourceIds`,
                sourceReferences,
              );
            });
          });
        }
      }
      const filters = requiredArray(module, 'filters', path, errors);
      const filterMap = validateUniqueIds(filters, `${path}.filters`, errors);
      filtersByModule.set(moduleId, new Set(filterMap.keys()));
      filterMap.forEach((filter, filterId) => {
        const filterPath = `${path}.filters[${filterId}]`;
        requiredString(filter, 'label', filterPath, errors);
        validateEnum(filter.mode, new Set(['all', 'today', 'tag', 'dateRange']), `${filterPath}.mode`, errors);
        if (filter.mode === 'tag') requiredString(filter, 'value', filterPath, errors);
        if (filter.mode === 'dateRange') {
          const filterStart = requiredString(filter, 'startsOn', filterPath, errors);
          const filterEnd = requiredString(filter, 'endsOn', filterPath, errors);
          if (filterStart) validateDate(filterStart, `${filterPath}.startsOn`, errors);
          if (filterEnd) validateDate(filterEnd, `${filterPath}.endsOn`, errors);
          if (filterStart && filterEnd && filterEnd < filterStart) {
            errors.push(`${filterPath}.endsOn must be on or after startsOn.`);
          }
        }
      });
    }

    if (module.type === 'traditions') {
      ['headline', 'summary'].forEach((key) => requiredString(module, key, path, errors));
      const traditions = requiredArray(module, 'items', path, errors);
      validateUniqueIds(traditions, `${path}.items`, errors).forEach((item, itemId) => {
        const itemPath = `${path}.items[${itemId}]`;
        ['kicker', 'title', 'summary'].forEach((key) => {
          requiredString(item, key, itemPath, errors);
        });
        validateEnum(item.kind, TRADITION_KINDS, `${itemPath}.kind`, errors);
        optionalString(item, 'latestObserved', itemPath, errors);
        optionalString(item, 'currentStatus', itemPath, errors);
        collectSourceReferences(
          requiredStringArray(item, 'sourceIds', itemPath, errors),
          `${itemPath}.sourceIds`,
          sourceReferences,
        );
      });
    }

    if (module.type === 'highlights') {
      ['headline', 'summary'].forEach((key) => requiredString(module, key, path, errors));
      const highlights = requiredArray(module, 'items', path, errors);
      validateUniqueIds(highlights, `${path}.items`, errors).forEach((item, itemId) => {
        const itemPath = `${path}.items[${itemId}]`;
        ['kicker', 'title', 'summary'].forEach((key) => {
          requiredString(item, key, itemPath, errors);
        });
        validateEnum(item.kind, HIGHLIGHT_KINDS, `${itemPath}.kind`, errors);
        optionalString(item, 'observedEdition', itemPath, errors);
        collectSourceReferences(
          requiredStringArray(item, 'sourceIds', itemPath, errors),
          `${itemPath}.sourceIds`,
          sourceReferences,
        );
      });
      if (module.links !== undefined) {
        const links = requiredArray(module, 'links', path, errors);
        validateUniqueIds(links, `${path}.links`, errors).forEach((link, linkId) => {
          const linkPath = `${path}.links[${linkId}]`;
          requiredString(link, 'label', linkPath, errors);
          const href = requiredString(link, 'href', linkPath, errors);
          if (href) validateHttpUrl(href, `${linkPath}.href`, errors);
          validateEnum(link.type, ACTION_TYPES, `${linkPath}.type`, errors);
          const sourceId = requiredString(link, 'sourceId', linkPath, errors);
          if (sourceId) collectSourceReferences([sourceId], `${linkPath}.sourceId`, sourceReferences);
        });
      }
    }

    if (module.type === 'planVisit') {
      requiredString(module, 'subtitle', path, errors);
      optionalString(module, 'advisory', path, errors);
      const details = requiredArray(module, 'details', path, errors);
      validateUniqueIds(details, `${path}.details`, errors).forEach((detail, detailId) => {
        const detailPath = `${path}.details[${detailId}]`;
        ['label', 'value', 'icon'].forEach((key) => requiredString(detail, key, detailPath, errors));
        collectSourceReferences(
          requiredStringArray(detail, 'sourceIds', detailPath, errors),
          `${detailPath}.sourceIds`,
          sourceReferences,
        );
      });
      const links = requiredArray(module, 'links', path, errors);
      validateUniqueIds(links, `${path}.links`, errors).forEach((link, linkId) => {
        const linkPath = `${path}.links[${linkId}]`;
        requiredString(link, 'label', linkPath, errors);
        const href = requiredString(link, 'href', linkPath, errors);
        if (href) validateHttpUrl(href, `${linkPath}.href`, errors);
        validateEnum(link.type, ACTION_TYPES, `${linkPath}.type`, errors);
        const sourceId = requiredString(link, 'sourceId', linkPath, errors);
        if (sourceId) collectSourceReferences([sourceId], `${linkPath}.sourceId`, sourceReferences);
      });
    }
  });

  const navigation = requiredArray(input, 'navigation', 'manifest', errors);
  validateUniqueIds(navigation, 'manifest.navigation', errors).forEach((item, itemId) => {
    const path = `manifest.navigation[${itemId}]`;
    requiredString(item, 'label', path, errors);
    validateEnum(item.icon, NAVIGATION_ICONS, `${path}.icon`, errors);
    const target = requiredString(item, 'targetModuleId', path, errors);
    if (target && !moduleMap.has(target)) errors.push(`${path}.targetModuleId references unknown module "${target}".`);
  });

  const scheduleItems = requiredArray(input, 'scheduleItems', 'manifest', errors);
  const scheduleItemMap = validateUniqueIds(scheduleItems, 'manifest.scheduleItems', errors);
  scheduleItemMap.forEach((item, itemId) => {
    const path = `manifest.scheduleItems[${itemId}]`;
    requiredString(item, 'title', path, errors);
    const startsAt = requiredString(item, 'startsAt', path, errors);
    if (startsAt) validateDateTime(startsAt, `${path}.startsAt`, errors);
    if (typeof item.endsAt === 'string') validateDateTime(item.endsAt, `${path}.endsAt`, errors);
    if (startsAt && typeof item.endsAt === 'string' && Date.parse(item.endsAt) < Date.parse(startsAt)) {
      errors.push(`${path}.endsAt must be on or after startsAt.`);
    }
    validateEnum(item.category, SCHEDULE_CATEGORIES, `${path}.category`, errors);
    requiredStringArray(item, 'tags', path, errors);
    collectSourceReferences(
      requiredStringArray(item, 'sourceIds', path, errors),
      `${path}.sourceIds`,
      sourceReferences,
    );
    validateEnum(item.confidence, CONFIDENCE_LEVELS, `${path}.confidence`, errors);
    optionalString(item, 'venue', path, errors);
    optionalString(item, 'details', path, errors);
  });
  presentationItemReferences.forEach(({ id, path }) => {
    if (!scheduleItemMap.has(id)) errors.push(`${path} references unknown schedule item "${id}".`);
  });

  const suggestions = requiredArray(input, 'scoutSuggestions', 'manifest', errors);
  validateUniqueIds(suggestions, 'manifest.scoutSuggestions', errors).forEach((suggestion, suggestionId) => {
    const path = `manifest.scoutSuggestions[${suggestionId}]`;
    requiredString(suggestion, 'label', path, errors);
    requiredString(suggestion, 'response', path, errors);
    const scopes = requiredStringArray(suggestion, 'scopeModuleIds', path, errors);
    scopes.forEach((moduleId) => {
      if (!moduleMap.has(moduleId)) errors.push(`${path}.scopeModuleIds references unknown module "${moduleId}".`);
    });
    collectSourceReferences(
      requiredStringArray(suggestion, 'sourceIds', path, errors),
      `${path}.sourceIds`,
      sourceReferences,
    );
    const command = requiredRecord(suggestion, 'command', path, errors);
    const commandType = requiredString(command, 'type', `${path}.command`, errors);
    validateEnum(commandType, new Set(['openModule', 'filterSchedule', 'openExternal']), `${path}.command.type`, errors);
    if (commandType === 'openModule' || commandType === 'filterSchedule') {
      const moduleId = requiredString(command, 'moduleId', `${path}.command`, errors);
      if (moduleId && !moduleMap.has(moduleId)) {
        errors.push(`${path}.command.moduleId references unknown module "${moduleId}".`);
      }
      if (commandType === 'filterSchedule') {
        const filterId = requiredString(command, 'filterId', `${path}.command`, errors);
        if (moduleId && filterId && !filtersByModule.get(moduleId)?.has(filterId)) {
          errors.push(`${path}.command.filterId references unknown filter "${filterId}" on module "${moduleId}".`);
        }
      }
    }
    if (commandType === 'openExternal') {
      const href = requiredString(command, 'href', `${path}.command`, errors);
      if (href) validateHttpUrl(href, `${path}.command.href`, errors);
    }
  });

  sourceReferences.forEach(({ id, path }) => {
    if (!sourceMap.has(id)) errors.push(`${path} references unknown source "${id}".`);
  });

  const publishedAt = requiredString(input, 'publishedAt', 'manifest', errors);
  const reviewedAt = requiredString(input, 'reviewedAt', 'manifest', errors);
  if (publishedAt) validateDate(publishedAt, 'manifest.publishedAt', errors);
  if (reviewedAt) validateDate(reviewedAt, 'manifest.reviewedAt', errors);

  scanSponsorLanguage(input, 'manifest', errors);

  if (!navigation.length) warnings.push('Manifest has no navigation items.');
  if (!suggestions.length) warnings.push('Manifest has no Scout suggestions.');
  if (!sources.length) warnings.push('Manifest has no provenance sources.');
  if (!imageSrc && !imageAlt) {
    warnings.push('Manifest intentionally uses the image-free Event Hub hero treatment.');
  }

  if (errors.length) return { ok: false, errors: [...new Set(errors)], warnings };
  return { ok: true, value: input as unknown as EventPageManifest, errors: [], warnings };
}
