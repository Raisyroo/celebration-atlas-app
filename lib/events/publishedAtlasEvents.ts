import "server-only";
import { ATLAS_EVENTS, type AtlasCategory, type AtlasEvent } from "@/data/events";
import { validateEventPageManifest } from "@/data/eventPageManifestValidation";
import { createAtlasServiceClient } from "@/lib/atlas-control/service";

type PackageRow = {
  event_id: string;
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

function regionAtmosphere(event: EventRow): NonNullable<AtlasEvent["regionAtmosphere"]> {
  if ((event.longitude ?? -85) > -84.2 && (event.latitude ?? 44) < 43.5) return "urban";
  if ((event.latitude ?? 0) >= 45.7) return "northwoods";
  if (/harvest|agricultur|fair/.test(`${event.category ?? ""} ${event.subcategory ?? ""}`.toLowerCase())) return "harvest";
  return "lakeshore";
}

function stateLabel(state: string) {
  return state === "Michigan" ? "MI" : state;
}

function normalizedName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function packageToAtlasEvent(event: EventRow, eventPackage: PackageRow): AtlasEvent | null {
  if (!event.location_verified || event.latitude === null || event.longitude === null) return null;
  const validation = validateEventPageManifest(eventPackage.page_manifest);
  if (!validation.ok || validation.value.eventId !== event.slug || validation.value.slug !== event.slug) return null;
  const manifest = validation.value;
  const artSrc = typeof eventPackage.art_asset?.src === "string" ? eventPackage.art_asset.src : manifest.hero.imageSrc;
  const artAlt = typeof eventPackage.art_asset?.alt === "string" ? eventPackage.art_asset.alt : manifest.hero.imageAlt;
  const category = atlasCategory(event);

  return {
    id: event.slug,
    name: manifest.identity.shortName || event.name,
    searchAliases: [event.name, manifest.identity.name],
    location: `${event.city ?? manifest.identity.location}, ${stateLabel(event.state)}`,
    latitude: event.latitude,
    longitude: event.longitude,
    coordinateSource: event.location_source
      ? { label: "Approved Event Factory map record", url: event.location_source, method: "manual-verification" }
      : undefined,
    atmosphereLabel: `${event.city ?? "Michigan"} annual celebration`,
    blurb: event.short_description ?? manifest.hero.tagline,
    category,
    cardTag: event.event_type.replaceAll("_", " "),
    eventPageKind: "manifest",
    iconType: iconType(event),
    x: 50,
    y: 50,
    regionAtmosphere: regionAtmosphere(event),
    dateRange: {
      startDate: manifest.identity.startsOn,
      endDate: manifest.identity.endsOn,
    },
    cardMedia: {
      thumbnailSrc: artSrc,
      thumbnailSourceType: "generated",
      thumbnailGenerationStatus: "generated",
      thumbnailAlt: artAlt,
    },
  };
}

export async function resolvePublishedAtlasEvents(): Promise<AtlasEvent[]> {
  const supabase = createAtlasServiceClient();
  if (!supabase) return ATLAS_EVENTS;

  const packageResult = await supabase
    .from("event_factory_packages")
    .select("event_id,page_manifest,art_asset")
    .eq("status", "published")
    .not("event_id", "is", null)
    .limit(2000);
  if (packageResult.error || !packageResult.data?.length) return ATLAS_EVENTS;

  const packages = packageResult.data as PackageRow[];
  const eventIds = packages.map((eventPackage) => eventPackage.event_id);
  const eventResult = await supabase
    .from("events")
    .select("id,name,slug,event_type,category,subcategory,city,state,venue_name,official_website,short_description,latitude,longitude,location_source,location_verified")
    .in("id", eventIds)
    .eq("status", "active")
    .eq("verification_status", "verified")
    .limit(2000);
  if (eventResult.error) return ATLAS_EVENTS;

  const packageByEvent = new Map(packages.map((eventPackage) => [eventPackage.event_id, eventPackage]));
  const approvedEvents = ((eventResult.data ?? []) as EventRow[]).flatMap((event) => {
    const eventPackage = packageByEvent.get(event.id);
    if (!eventPackage) return [];
    const atlasEvent = packageToAtlasEvent(event, eventPackage);
    return atlasEvent ? [atlasEvent] : [];
  });
  const approvedById = new Map(approvedEvents.map((event) => [event.id, event]));
  const approvedAliasCounts = new Map<string, number>();
  const localNameCounts = new Map<string, number>();
  for (const event of approvedEvents) {
    const keys = new Set([event.name, ...(event.searchAliases ?? [])].map(normalizedName));
    for (const key of keys) {
      approvedAliasCounts.set(key, (approvedAliasCounts.get(key) ?? 0) + 1);
    }
  }
  for (const event of ATLAS_EVENTS) {
    const key = normalizedName(event.name);
    localNameCounts.set(key, (localNameCounts.get(key) ?? 0) + 1);
  }
  const approvedByUniqueAlias = new Map<string, AtlasEvent>();
  for (const event of approvedEvents) {
    const keys = new Set([event.name, ...(event.searchAliases ?? [])].map(normalizedName));
    for (const key of keys) {
      if (approvedAliasCounts.get(key) === 1) approvedByUniqueAlias.set(key, event);
    }
  }
  const resolvedApprovedIds = new Set<string>();

  const reconciledLocalEvents = ATLAS_EVENTS.map((event) => {
    const byId = approvedById.get(event.id);
    const nameKey = normalizedName(event.name);
    const byUniqueAlias = localNameCounts.get(nameKey) === 1 ? approvedByUniqueAlias.get(nameKey) : undefined;
    const approved = byId ?? byUniqueAlias;
    if (approved) resolvedApprovedIds.add(approved.id);
    return approved ?? event;
  });

  return [...reconciledLocalEvents, ...approvedEvents.filter((event) => !resolvedApprovedIds.has(event.id))];
}
