import type { EventPageManifest } from "./eventPageManifestTypes.ts";
import {
  evaluateEventPageEditorialQuality,
} from "./eventPageEditorialQuality.ts";
import {
  validateEventPageManifest,
} from "./eventPageManifestValidation.ts";

export const EVENT_PAGE_CONTENT_READINESS_VERSION =
  "event-page-content-readiness-v6";

export type EventPageContentReadinessOptions = {
  allowLegacyStructure?: boolean;
};

export type EventPageContentReadinessResult =
  | {
      ok: true;
      value: EventPageManifest;
      artPending: boolean;
      warnings: string[];
    }
  | {
      ok: false;
      errors: string[];
      warnings: string[];
    };

const PLACEHOLDER_COPY =
  /\b(?:start with the moments that define|start with the essentials|plan your visit to|daily details are still being confirmed|location details need review)\b/i;

const GENERIC_SCOUT_COPY =
  /\b(?:arrive early|check the (?:official )?(?:site|website|schedule)|plan ahead|before you go|details (?:can|may) change|something for everyone)\b/i;

const GENERIC_THIRD_TOPIC =
  /^(?:highlights?|traditions?|experience|what to expect|three days|weekend rhythm)$/i;

const EDITION_BOUND_WHY_GO_COPY =
  /\b(?:this year|this edition|current edition|has ended|is over|was held|ran from|returned for|concluded|wrapped up)\b/i;

const ADDRESS_ONLY_PLAN_LABEL =
  /\b(?:address|location|venue|where|grounds|map)\b/i;

function normalizedCopy(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function hasSourceIds(sourceIds: string[]) {
  return sourceIds.length > 0;
}

function normalizedHost(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function officialHosts(manifest: EventPageManifest) {
  return new Set(
    manifest.sources
      .filter((source) => ["officialWebsite", "officialSocial", "organizer"].includes(source.type))
      .flatMap((source) => source.url ? [normalizedHost(source.url)] : [])
      .filter(Boolean),
  );
}

function isOfficialHostLink(value: string, hosts: Set<string>) {
  const host = normalizedHost(value);
  if (!host) return false;
  return [...hosts].some((officialHost) => (
    host === officialHost
    || host.endsWith(`.${officialHost}`)
    || officialHost.endsWith(`.${host}`)
  ));
}

function newPackageContentErrors(manifest: EventPageManifest) {
  const errors: string[] = [];
  const whyGoModules = manifest.modules.filter((module) => module.type === "whyGo");
  const scheduleModules = manifest.modules.filter((module) => module.type === "schedule");
  const experienceModules = manifest.modules.filter(
    (module) => module.type === "highlights" || module.type === "traditions",
  );
  const planModules = manifest.modules.filter((module) => module.type === "planVisit");

  if (manifest.modules.length !== 4 || manifest.navigation.length !== 4) {
    errors.push(
      "New Event Hubs require exactly four primary topics with one navigation destination per topic.",
    );
  }
  if (
    whyGoModules.length !== 1
    || scheduleModules.length !== 1
    || experienceModules.length !== 1
    || planModules.length !== 1
  ) {
    errors.push(
      "New Event Hubs require one Why Go module, one Schedule module, one event-specific Highlights or Traditions topic, and one Plan module.",
    );
  }

  const orderedNavigation = manifest.navigation.map((item) => ({
    label: item.label,
    module: manifest.modules.find((module) => module.id === item.targetModuleId),
  }));
  if (
    orderedNavigation[0]?.label !== "Why Go"
    || orderedNavigation[0]?.module?.type !== "whyGo"
    || orderedNavigation[1]?.label !== "Schedule"
    || orderedNavigation[1]?.module?.type !== "schedule"
    || !["highlights", "traditions"].includes(orderedNavigation[2]?.module?.type ?? "")
    || orderedNavigation[3]?.label !== "Plan"
    || orderedNavigation[3]?.module?.type !== "planVisit"
  ) {
    errors.push(
      "Primary navigation must read Why Go, Schedule, an event-specific topic, and Plan in that order.",
    );
  }
  if (
    !orderedNavigation[2]?.label?.trim()
    || GENERIC_THIRD_TOPIC.test(orderedNavigation[2].label.trim())
  ) {
    errors.push(
      "The third navigation title must be a clear event-specific noun phrase, not a generic editorial category.",
    );
  }

  const navigationTargets = new Set(
    manifest.navigation.map((item) => item.targetModuleId),
  );
  for (const module of manifest.modules) {
    if (!navigationTargets.has(module.id)) {
      errors.push(`The ${module.title} topic is not reachable from primary navigation.`);
    }
  }

  const identityEchoes = new Set(
    [
      manifest.identity.name,
      manifest.identity.shortName,
      manifest.identity.location,
      manifest.identity.dateText,
    ].map(normalizedCopy),
  );
  const heroTagline = normalizedCopy(manifest.hero.tagline);
  if (
    wordCount(manifest.hero.tagline) < 8
    || identityEchoes.has(heroTagline)
    || PLACEHOLDER_COPY.test(manifest.hero.tagline)
  ) {
    errors.push(
      "The Event Hub hero needs a specific source-grounded visitor summary, not an identity echo or template placeholder.",
    );
  }

  const whyGo = whyGoModules[0];
  if (whyGo?.type === "whyGo") {
    const supportingItems = [
      ...whyGo.metrics,
      ...whyGo.audienceGroups,
      ...(whyGo.spotlight ? [whyGo.spotlight] : []),
    ];
    if (
      wordCount(whyGo.summary) < 10
      || identityEchoes.has(normalizedCopy(whyGo.summary))
      || PLACEHOLDER_COPY.test(`${whyGo.headline} ${whyGo.summary}`)
    ) {
      errors.push(
        "Why Go needs a substantive event-specific overview instead of the event name or generic template copy.",
      );
    }
    if (wordCount(whyGo.summary) < 30 || wordCount(whyGo.summary) > 45) {
      errors.push("Why Go needs a concise 30-to-45-word evergreen event pitch.");
    }
    if (EDITION_BOUND_WHY_GO_COPY.test(`${whyGo.headline} ${whyGo.summary}`)) {
      errors.push("Why Go must remain useful from year to year instead of describing the status of one edition.");
    }
    if (supportingItems.length < 2 || supportingItems.some((item) => !hasSourceIds(item.sourceIds))) {
      errors.push(
        "Why Go needs at least two retained, source-backed visitor insights.",
      );
    }
    if (
      whyGo.spotlight
      && (wordCount(whyGo.spotlight.body) < 18 || GENERIC_SCOUT_COPY.test(`${whyGo.spotlight.title} ${whyGo.spotlight.body}`))
    ) {
      errors.push("Scout Spotlight must reveal a distinctive event fact or tradition; omit it when only generic advice is available.");
    }
  }

  for (const experience of experienceModules) {
    if (experience.type === "highlights") {
      const distinctTitles = new Set(
        experience.items.map((item) => normalizedCopy(item.title)),
      );
      const distinctSummaries = new Set(
        experience.items.map((item) => normalizedCopy(item.summary)),
      );
      if (
        experience.items.length < 3
        || experience.items.some((item) => !hasSourceIds(item.sourceIds))
        || distinctTitles.size !== experience.items.length
        || distinctSummaries.size !== experience.items.length
      ) {
        errors.push(
          "Highlights needs at least three distinct source-backed experiences with non-duplicated visitor copy.",
        );
      }
    } else if (experience.type === "traditions") {
      const distinctTitles = new Set(
        experience.items.map((item) => normalizedCopy(item.title)),
      );
      const distinctSummaries = new Set(
        experience.items.map((item) => normalizedCopy(item.summary)),
      );
      if (
        experience.items.length < 2
        || experience.items.some((item) => !hasSourceIds(item.sourceIds))
        || distinctTitles.size !== experience.items.length
        || distinctSummaries.size !== experience.items.length
      ) {
        errors.push(
          "Traditions needs at least two distinct source-backed experiences with non-duplicated visitor copy.",
        );
      }
    }
  }

  const schedule = scheduleModules[0];
  if (schedule?.type === "schedule") {
    const currentItems = manifest.scheduleItems;
    const recurringItems = schedule.recurringEvents?.items ?? [];
    const referenceItems =
      schedule.referenceSchedule?.groups.flatMap((group) => group.items) ?? [];
    const hasSourceBackedDateOnlySchedule = Boolean(
      schedule.sourceIds?.length
      && manifest.identity.startsOn
      && manifest.identity.endsOn,
    );
    if (
      !currentItems.length
      && !recurringItems.length
      && !referenceItems.length
      && !hasSourceBackedDateOnlySchedule
    ) {
      errors.push(
        "Schedule needs retained event dates or hours, current program items, recurring guidance, or a clearly labeled reference program.",
      );
    }
    if (
      currentItems.some((item) => !hasSourceIds(item.sourceIds))
      || recurringItems.some((item) => !hasSourceIds(item.sourceIds))
      || referenceItems.some((item) => !hasSourceIds(item.sourceIds))
    ) {
      errors.push("Every Schedule item must retain source provenance.");
    }
    if (schedule.presentationGroups?.length) {
      const protectedItemIds = new Set(currentItems.map((item) => item.id));
      const presentedItemIds = schedule.presentationGroups.flatMap((group) => group.itemIds);
      if (
        presentedItemIds.some((itemId) => !protectedItemIds.has(itemId))
        || new Set(presentedItemIds).size !== presentedItemIds.length
        || presentedItemIds.length !== protectedItemIds.size
        || schedule.presentationGroups.some((group) => !group.itemIds.length || !hasSourceIds(group.sourceIds))
      ) {
        errors.push("Schedule presentation groups must source, uniquely organize, and preserve every protected current schedule item.");
      }
    }
  }

  const plan = planModules[0];
  if (plan?.type === "planVisit") {
    if (
      plan.details.length < 2
      || plan.details.some((detail) => !hasSourceIds(detail.sourceIds))
    ) {
      errors.push(
        "Plan needs at least two source-backed practical details.",
      );
    }
    if (!plan.details.some((detail) => !ADDRESS_ONLY_PLAN_LABEL.test(detail.label))) {
      errors.push(
        "Plan needs at least one useful access, viewing, transportation, timing, or orientation detail beyond the address.",
      );
    }
  }

  const footerOnlyHosts = officialHosts(manifest);
  const topicLinks = manifest.modules.flatMap((module) => (
    module.type === "planVisit" || module.type === "highlights"
      ? module.links ?? []
      : []
  ));
  const scoutExternalLinks = manifest.scoutSuggestions.flatMap((suggestion) => (
    suggestion.command.type === "openExternal" ? [suggestion.command.href] : []
  ));
  if (
    manifest.primaryAction
    || topicLinks.some((link) => isOfficialHostLink(link.href, footerOnlyHosts))
    || scoutExternalLinks.some((href) => isOfficialHostLink(href, footerOnlyHosts))
  ) {
    errors.push(
      "Official event-site links may appear only in the Event Hub source footer.",
    );
  }

  errors.push(...evaluateEventPageEditorialQuality(manifest).errors);

  return [...new Set(errors)];
}

export function validateEventPageContentReadiness(
  input: unknown,
  options: EventPageContentReadinessOptions = {},
): EventPageContentReadinessResult {
  const strict = validateEventPageManifest(input);
  if (strict.ok) {
    const contentErrors = options.allowLegacyStructure
      ? []
      : newPackageContentErrors(strict.value);
    if (contentErrors.length) {
      return {
        ok: false,
        errors: contentErrors,
        warnings: strict.warnings,
      };
    }
    const artPending =
      !strict.value.hero.imageSrc.trim() &&
      !strict.value.hero.imageAlt.trim();
    return {
      ok: true,
      value: strict.value,
      artPending,
      warnings: artPending
        ? [
            ...strict.warnings,
            "Approved hero art is pending; the intentional image-free Event Hub treatment will render.",
          ]
        : strict.warnings,
    };
  }
  return { ok: false, errors: strict.errors, warnings: strict.warnings };
}
