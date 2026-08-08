import type { EventPageManifest } from "./eventPageManifestTypes.ts";

const GENERIC_OFFICIAL_LINK_LABEL =
  /\b(?:official\s+)?(?:website|site|homepage|home\s+page|information|info)\b/i;

const USEFUL_PLAN_LINK_LABEL =
  /\b(?:schedule|program|faq|frequently asked|register|registration|ticket|livestream|live stream|watch|parking|direction|route|map|road closure|shuttle|accessib|rule|vendor|application)\b/i;

function normalizedHost(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function hasOfficialHost(manifest: EventPageManifest, href: string) {
  const targetHost = normalizedHost(href);
  if (!targetHost) return false;
  return manifest.sources.some((source) => {
    if (!source.url || !["officialWebsite", "officialSocial", "organizer"].includes(source.type)) {
      return false;
    }
    const sourceHost = normalizedHost(source.url);
    return Boolean(sourceHost) && (
      targetHost === sourceHost
      || targetHost.endsWith(`.${sourceHost}`)
      || sourceHost.endsWith(`.${targetHost}`)
    );
  });
}

export function isOfficialSourceHref(manifest: EventPageManifest, href: string) {
  return hasOfficialHost(manifest, href);
}

export function isUsefulPlanLink(
  manifest: EventPageManifest,
  link: { label: string; href: string },
) {
  if (!isOfficialSourceHref(manifest, link.href)) return true;
  if (GENERIC_OFFICIAL_LINK_LABEL.test(link.label)) return false;
  if (!USEFUL_PLAN_LINK_LABEL.test(link.label)) return false;

  try {
    const url = new URL(link.href);
    const path = url.pathname.replace(/\/+$/, "");
    return Boolean((path && path !== "/") || url.search || url.hash);
  } catch {
    return false;
  }
}
