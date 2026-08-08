import type { EventPageManifest } from "./eventPageManifestTypes.ts";

export function selectPrimaryOfficialEventSource(manifest: EventPageManifest) {
  return manifest.sources.find((source) => (
    source.type === "officialWebsite" && Boolean(source.url?.trim())
  ));
}
