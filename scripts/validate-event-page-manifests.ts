import { BROWN_TROUT_EVENT_PAGE_MANIFEST } from '../data/brownTroutEventPageManifest.ts';
import { DETROIT_JAZZ_EVENT_PAGE_MANIFEST } from '../data/detroitJazzEventPageManifest.ts';
import { ATLAS_CONSTELLATIONS } from '../data/atlasConstellations.ts';
import { ATLAS_EVENTS } from '../data/events.ts';
import {
  stableStringifyEventPageManifest,
  validateEventPageManifest,
} from '../data/eventPageManifestValidation.ts';
import { getDateKeyInTimeZone } from '../lib/eventScheduleDates.ts';

const manifests = [
  BROWN_TROUT_EVENT_PAGE_MANIFEST,
  DETROIT_JAZZ_EVENT_PAGE_MANIFEST,
];

const failures: string[] = [];

const coastGuardPlaceholders = ATLAS_EVENTS.filter((event) => (
  event.location === 'Grand Haven, MI' && /coast guard festival/i.test(event.name)
));
if (coastGuardPlaceholders.length !== 1 || coastGuardPlaceholders[0]?.id !== 'coast-guard-festival') {
  failures.push('The Grand Haven Coast Guard Festival placeholder must use the canonical published slug so Event Factory data replaces it in the mobile rail.');
}

const atlasEventIds = new Set(ATLAS_EVENTS.map((event) => event.id));
const missingConstellationEventIds = [...new Set(
  ATLAS_CONSTELLATIONS.flatMap((constellation) => (
    constellation.eventIds.filter((eventId) => !atlasEventIds.has(eventId))
  )),
)];
if (missingConstellationEventIds.length) {
  failures.push(`Atlas constellations reference unknown event ids: ${missingConstellationEventIds.join(', ')}.`);
}

if (getDateKeyInTimeZone('2026-07-12T02:30:00.000Z', 'America/Detroit') !== '2026-07-11') {
  failures.push('Late-evening schedule items are not grouped by their event-local date.');
}

for (const manifest of manifests) {
  const result = validateEventPageManifest(manifest);
  if (!result.ok) {
    failures.push(`${manifest.eventId}:\n  ${result.errors.join('\n  ')}`);
    continue;
  }
  const first = stableStringifyEventPageManifest(manifest);
  const reordered = stableStringifyEventPageManifest(
    Object.fromEntries(Object.entries(manifest).reverse()),
  );
  if (first !== reordered) failures.push(`${manifest.eventId}: stable serialization changed with key order.`);
  console.log(
    `${manifest.eventId}: valid (${manifest.modules.length} modules, ${manifest.scheduleItems.length} schedule items, ${manifest.sources.length} sources)`,
  );
}

const brokenNavigation = structuredClone(BROWN_TROUT_EVENT_PAGE_MANIFEST) as unknown as {
  navigation: Array<{ targetModuleId: string }>;
};
brokenNavigation.navigation[0].targetModuleId = 'missing-module';
const brokenNavigationResult = validateEventPageManifest(brokenNavigation);
if (brokenNavigationResult.ok || !brokenNavigationResult.errors.some((error) => error.includes('unknown module'))) {
  failures.push('Validator did not reject a navigation item pointing to an unknown module.');
}

const sponsorReference = structuredClone(DETROIT_JAZZ_EVENT_PAGE_MANIFEST) as unknown as {
  hero: { tagline: string };
};
sponsorReference.hero.tagline = 'Presented by an event sponsor.';
const sponsorResult = validateEventPageManifest(sponsorReference);
if (sponsorResult.ok || !sponsorResult.errors.some((error) => error.includes('sponsor language'))) {
  failures.push('Validator did not reject event sponsor language.');
}

const brokenSource = structuredClone(BROWN_TROUT_EVENT_PAGE_MANIFEST) as unknown as {
  scheduleItems: Array<{ sourceIds: string[] }>;
};
brokenSource.scheduleItems[0].sourceIds = ['missing-source'];
const brokenSourceResult = validateEventPageManifest(brokenSource);
if (brokenSourceResult.ok || !brokenSourceResult.errors.some((error) => error.includes('unknown source'))) {
  failures.push('Validator did not reject an unknown provenance source reference.');
}

const recurringGuide = structuredClone(BROWN_TROUT_EVENT_PAGE_MANIFEST) as unknown as {
  modules: Array<Record<string, unknown>>;
};
const recurringSchedule = recurringGuide.modules.find((module) => module.type === 'schedule');
if (!recurringSchedule) {
  failures.push('Recurring-event fixture could not find a schedule module.');
} else {
  recurringSchedule.recurringEvents = {
    title: 'What usually returns',
    summary: 'Officially documented recurring experiences can orient visitors before current dates are released.',
    caveat: 'Recurring does not mean confirmed for the current edition.',
    items: [
      {
        id: 'recurring-community-parade',
        title: 'Community parade',
        typicalTiming: 'Traditionally on the final day',
        sourceIds: ['brown-trout-official-about'],
      },
    ],
  };
  const recurringResult = validateEventPageManifest(recurringGuide);
  if (!recurringResult.ok) {
    failures.push(`Validator rejected a valid recurring-event guide: ${recurringResult.errors.join(' ')}`);
  }

  const brokenRecurringSource = structuredClone(recurringGuide) as typeof recurringGuide;
  const brokenRecurringSchedule = brokenRecurringSource.modules.find((module) => module.type === 'schedule');
  const recurringEvents = brokenRecurringSchedule?.recurringEvents as {
    items: Array<{ sourceIds: string[] }>;
  } | undefined;
  if (recurringEvents) recurringEvents.items[0].sourceIds = ['missing-source'];
  const brokenRecurringResult = validateEventPageManifest(brokenRecurringSource);
  if (brokenRecurringResult.ok || !brokenRecurringResult.errors.some((error) => error.includes('unknown source'))) {
    failures.push('Validator did not reject an unknown recurring-event provenance source.');
  }
}

const editorialGuide = structuredClone(BROWN_TROUT_EVENT_PAGE_MANIFEST) as unknown as {
  modules: Array<Record<string, unknown>>;
};
const editorialSchedule = editorialGuide.modules.find((module) => module.type === 'schedule');
if (!editorialSchedule) {
  failures.push('Editorial-guide fixture could not find a schedule module.');
} else {
  editorialSchedule.referenceSchedule = {
    observedYear: 2025,
    title: 'How the weekend unfolded in 2025',
    summary: 'A clearly labeled historical program can preserve useful detail without predicting the next edition.',
    caveat: 'These times belong to 2025 and are not confirmed for 2026.',
    groups: [
      {
        id: 'reference-saturday',
        label: 'Sat',
        title: 'Saturday in the 2025 program',
        items: [
          {
            id: 'reference-family-program',
            title: 'Family program',
            timeText: '10 AM-2 PM',
            venue: 'Festival grounds',
            sourceIds: ['brown-trout-official-events'],
          },
        ],
      },
    ],
  };
  editorialGuide.modules.splice(editorialGuide.modules.length - 1, 0, {
    id: 'traditions',
    type: 'traditions',
    title: 'Traditions',
    eyebrow: 'Festival heritage',
    headline: 'The rituals that give the weekend its identity',
    summary: 'History and latest-observed evidence stay separate from current-year confirmations.',
    items: [
      {
        id: 'tradition-parade',
        kind: 'parade',
        kicker: 'Signature procession',
        title: 'Community parade',
        summary: 'A long-running festival tradition documented by official history.',
        latestObserved: 'Included in the latest complete program.',
        currentStatus: 'Current-year route and time pending.',
        sourceIds: ['brown-trout-official-about'],
      },
    ],
  });

  const editorialResult = validateEventPageManifest(editorialGuide);
  if (!editorialResult.ok) {
    failures.push(`Validator rejected a valid editorial guide: ${editorialResult.errors.join(' ')}`);
  }

  const brokenEditorialSource = structuredClone(editorialGuide) as typeof editorialGuide;
  const brokenTraditions = brokenEditorialSource.modules.find((module) => module.type === 'traditions');
  const traditionItems = brokenTraditions?.items as Array<{ sourceIds: string[] }> | undefined;
  if (traditionItems) traditionItems[0].sourceIds = ['missing-source'];
  const brokenEditorialResult = validateEventPageManifest(brokenEditorialSource);
  if (brokenEditorialResult.ok || !brokenEditorialResult.errors.some((error) => error.includes('unknown source'))) {
    failures.push('Validator did not reject an unknown traditions provenance source.');
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Event page manifest validations passed.');
