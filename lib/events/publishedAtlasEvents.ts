import "server-only";
import type { AtlasCategory, AtlasEvent } from "@/data/events";
import { validateEventPageManifest } from "@/data/eventPageManifestValidation";
import { groupPublishedAtlasPackagesByEvent } from "@/data/publishedAtlasPackageSelection";
import {
  getStateAtlasEventCatalog,
  reconcileStateAtlasEvents,
} from "@/data/stateAtlasEvents";
import {
  isStateAtlasDatabaseValue,
  isValidIanaTimeZone,
  resolveStateAtlasRegionAtmosphere,
  type StateAtlasConfig,
} from "@/data/stateAtlasConfig";
import { createAtlasServiceClient } from "@/lib/atlas-control/service";

type PackageRow = {
  id: string;
  event_id: string;
  target_year: number;
  published_at: string | null;
  page_manifest: unknown;
  art_asset: Record<string, unknown>;
};

type EventRow = {
  id: string;
  name: string;
  slug: string;
  event_type: string;
  category: string | null;
  subcategory: string | null;
  city: string | null;
  state: string;
  venue_name: string | null;
  official_website: string | null;
  short_description: string | null;
  latitude: number | null;
  longitude: number | null;
  location_source: string | null;
  location_verified: boolean;
};

const PACKAGE_EVENT_ID_BATCH_SIZE = 100;
const STATE_EVENT_PAGE_SIZE = 500;
const PACKAGE_PAGE_SIZE = 500;

function atlasCategory(event: EventRow): AtlasCategory {
  const category = `${event.category ?? ""} ${event.event_type} ${event.subcategory ?? ""}`.toLowerCase();
  if (/music|concert|jazz/.test(category)) return "Music";
  if (/fair|carnival/.test(category)) return "Fairs";
  if (/art|culture|heritage|museum/.test(category)) return "Arts & Culture";
  return "Festivals";
}

function iconType(event: EventRow): NonNullable<AtlasEvent["iconType"]> {
  const kind = `${event.category ?? ""} ${event.event_type} ${event.subcategory ?? ""}`.toLowerCase();
  if (/music|concert|jazz/.test(kind)) return "music";
  if (/art/.test(kind)) return "art";
  if (/food|harvest|agricultur/.test(kind)) return "harvest";
  if (/water|fish|coast|marina/.test(kind)) return "waterfront";
  if (/winter|ice|snow/.test(kind)) return "winter";
  if (/heritage|culture|parade/.test(kind)) return "heritage";
  return "fair";
}

function packageToAtlasEvent(
  config: StateAtlasConfig,
  event: EventRow,
  eventPackage: PackageRow,
): AtlasEvent | null {
  if (!event.location_verified || event.latitude === null || event.longitude === null) return null;
  if (!isStateAtlasDatabaseValue(config, event.state)) return null;
  const validation = validateEventPageManifest(eventPackage.page_manifest);
  if (!validation.ok || validation.value.eventId !== event.slug || validation.value.slug !== event.slug) return null;
  const manifest = validation.value;
  const artSrc = typeof eventPackage.art_asset?.src === "string" ? eventPackage.art_asset.src : manifest.hero.imageSrc;
  const artAlt = typeof eventPackage.art_asset?.alt === "string" ? eventPackage.art_asset.alt : manifest.hero.imageAlt;
  const category = atlasCategory(event);
  const categoryText = `${event.category ?? ""} ${event.event_type} ${event.subcategory ?? ""}`;

  return {
    id: event.slug,
    name: manifest.identity.shortName || event.name,
    searchAliases: [event.name, manifest.identity.name],
    location: event.city
      ? `${event.city}, ${config.identity.postalCode}`
      : manifest.identity.location,
    latitude: event.latitude,
    longitude: event.longitude,
    coordinateSource: event.location_source
      ? { label: "Approved Event Factory map record", url: event.location_source, method: "manual-verification" }
      : undefined,
    atmosphereLabel: `${event.city ?? config.identity.name} annual celebration`,
    blurb: event.short_description ?? manifest.hero.tagline,
    category,
    cardTag: event.event_type.replaceAll("_", " "),
    eventPageKind: "manifest",
    iconType: iconType(event),
    x: 50,
    y: 50,
    regionAtmosphere: resolveStateAtlasRegionAtmosphere(config, {
      latitude: event.latitude,
      longitude: event.longitude,
      categoryText,
    }),
    dateRange: {
      startDate: manifest.identity.startsOn,
      endDate: manifest.identity.endsOn,
      timeZone: isValidIanaTimeZone(manifest.identity.timezone)
        ? manifest.identity.timezone
        : config.defaultTimeZone,
      isEstimated: false,
    },
    cardMedia: {
      thumbnailSrc: artSrc,
      thumbnailSourceType: "generated",
      thumbnailGenerationStatus: "generated",
      thumbnailAlt: artAlt,
    },
  };
}

export async function resolvePublishedAtlasEvents(
  config: StateAtlasConfig,
): Promise<AtlasEvent[]> {
  const localEvents = getStateAtlasEventCatalog(config.identity.slug);
  const supabase = createAtlasServiceClient();
  if (!supabase) return [...localEvents];

  const loadStateEvents = async (): Promise<EventRow[] | null> => {
    const rows: EventRow[] = [];

    for (let pageStart = 0; ; pageStart += STATE_EVENT_PAGE_SIZE) {
      const result = await supabase
        .from("events")
        .select("id,name,slug,event_type,category,subcategory,city,state,venue_name,official_website,short_description,latitude,longitude,location_source,location_verified")
        .in("state", [...config.identity.databaseStateValues])
        .eq("status", "active")
        .eq("verification_status", "verified")
        .order("name", { ascending: true })
        .order("id", { ascending: true })
        .range(pageStart, pageStart + STATE_EVENT_PAGE_SIZE - 1);
      if (result.error) return null;

      const page = (result.data ?? []) as EventRow[];
      rows.push(...page);
      if (page.length < STATE_EVENT_PAGE_SIZE) return rows;
    }
  };

  const stateEvents = await loadStateEvents();
  if (!stateEvents?.length) return [...localEvents];

  const eventIds = stateEvents.map((event) => event.id);
  const eventIdBatches = Array.from(
    { length: Math.ceil(eventIds.length / PACKAGE_EVENT_ID_BATCH_SIZE) },
    (_, index) => eventIds.slice(
      index * PACKAGE_EVENT_ID_BATCH_SIZE,
      (index + 1) * PACKAGE_EVENT_ID_BATCH_SIZE,
    ),
  );
  const loadPublishedPackages = async (
    eventIdBatch: readonly string[],
  ): Promise<PackageRow[] | null> => {
    const rows: PackageRow[] = [];

    for (let pageStart = 0; ; pageStart += PACKAGE_PAGE_SIZE) {
      const result = await supabase
        .from("event_factory_packages")
        .select("id,event_id,target_year,published_at,page_manifest,art_asset")
        .eq("status", "published")
        .in("event_id", [...eventIdBatch])
        .order("target_year", { ascending: false })
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false })
        .range(pageStart, pageStart + PACKAGE_PAGE_SIZE - 1);
      if (result.error) return null;

      const page = (result.data ?? []) as PackageRow[];
      rows.push(...page);
      if (page.length < PACKAGE_PAGE_SIZE) return rows;
    }
  };

  const packageBatches = await Promise.all(
    eventIdBatches.map(loadPublishedPackages),
  );
  if (packageBatches.some((eventPackages) => eventPackages === null)) {
    return [...localEvents];
  }

  const packages = packageBatches.flatMap((eventPackages) => eventPackages ?? []);
  if (!packages.length) return [...localEvents];
  const packagesByEvent = groupPublishedAtlasPackagesByEvent(packages);
  const approvedEvents = stateEvents.flatMap((event) => {
    const eventPackages = packagesByEvent.get(event.id) ?? [];
    for (const eventPackage of eventPackages) {
      const atlasEvent = packageToAtlasEvent(config, event, eventPackage);
      if (atlasEvent) return [atlasEvent];
    }
    return [];
  });

  return reconcileStateAtlasEvents(localEvents, approvedEvents);
}
