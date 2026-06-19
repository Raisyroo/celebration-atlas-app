import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ATLAS_EVENTS, type AtlasEvent } from '../data/events.ts';
import { getGeneratedEventThumbnailPath, resolveEventThumbnailFallback } from '../data/eventThumbnail.ts';

const require = createRequire(import.meta.url);
const sharp = require('sharp') as typeof import('sharp');

const outputRoot = path.join(process.cwd(), 'public');
const generatedDir = path.join(outputRoot, 'event-media', 'generated');
const fallbackDir = path.join(outputRoot, 'event-media', 'fallback');

const palettes: Record<AtlasEvent['category'], { a: string; b: string; c: string; symbol: string }> = {
  'Arts & Culture': { a: '#1d1424', b: '#8b4bd8', c: '#f0c27a', symbol: '◆' },
  Fairs: { a: '#20150d', b: '#c86a27', c: '#ffd98a', symbol: '✦' },
  Festivals: { a: '#1b1710', b: '#c45632', c: '#ffe0a2', symbol: '✺' },
  Music: { a: '#101827', b: '#3867c8', c: '#f6c46b', symbol: '♪' },
};

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char] ?? char);
}

function cityFromLocation(location: string): string {
  return location.split(',')[0]?.trim() || location;
}

function buildThumbnailSvg(event: AtlasEvent): string {
  const palette = palettes[event.category];
  const city = cityFromLocation(event.location);
  const season = event.detailPage?.eventSnapshot?.typicalMonth ?? event.dateRange?.startDate?.slice(5, 7) ?? event.regionAtmosphere ?? 'seasonal';
  const title = escapeXml(event.name);
  const meta = escapeXml(`${city} · ${season}`);
  const theme = escapeXml(event.atmosphereLabel);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img" aria-label="${title} Celebration Atlas generated thumbnail">
  <defs>
    <radialGradient id="glow" cx="70%" cy="24%" r="70%"><stop offset="0" stop-color="${palette.c}" stop-opacity="0.78"/><stop offset="0.38" stop-color="${palette.b}" stop-opacity="0.44"/><stop offset="1" stop-color="${palette.a}" stop-opacity="1"/></radialGradient>
    <linearGradient id="haze" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#fff0c6" stop-opacity="0.2"/><stop offset="0.48" stop-color="#0b0f17" stop-opacity="0.1"/><stop offset="1" stop-color="#020308" stop-opacity="0.86"/></linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>
  <rect width="960" height="540" fill="url(#glow)"/>
  <circle cx="760" cy="118" r="128" fill="${palette.c}" opacity="0.2" filter="url(#soft)"/>
  <circle cx="226" cy="388" r="170" fill="${palette.b}" opacity="0.22" filter="url(#soft)"/>
  <path d="M0 368 C160 318 250 430 414 374 C590 313 692 356 960 283 L960 540 L0 540Z" fill="#05070c" opacity="0.54"/>
  <path d="M0 416 C190 364 298 462 476 410 C655 358 744 408 960 352 L960 540 L0 540Z" fill="#020309" opacity="0.58"/>
  <g fill="none" stroke="${palette.c}" stroke-opacity="0.34" stroke-width="2">
    <path d="M132 166 C234 126 326 132 430 168"/>
    <path d="M530 224 C622 182 706 186 820 230"/>
  </g>
  <g fill="${palette.c}" opacity="0.74">
    <text x="76" y="132" font-family="Georgia, serif" font-size="78">${palette.symbol}</text>
    <text x="76" y="414" font-family="Inter, Arial, sans-serif" font-size="25" letter-spacing="5" opacity="0.82">CELEBRATION ATLAS</text>
    <text x="76" y="462" font-family="Inter, Arial, sans-serif" font-size="31" font-weight="700">${title}</text>
    <text x="76" y="499" font-family="Inter, Arial, sans-serif" font-size="23" opacity="0.86">${meta} · ${theme}</text>
  </g>
  <rect width="960" height="540" fill="url(#haze)"/>
</svg>`;
}

function buildFallbackSvg(category: AtlasEvent['category']): string {
  const palette = palettes[category];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="${palette.a}"/><circle cx="690" cy="150" r="220" fill="${palette.b}" opacity="0.42"/><text x="80" y="290" fill="${palette.c}" font-family="Georgia, serif" font-size="132">${palette.symbol}</text><text x="80" y="390" fill="${palette.c}" font-family="Inter, Arial" font-size="44">${escapeXml(category)}</text><text x="80" y="434" fill="${palette.c}" opacity="0.76" font-family="Inter, Arial" font-size="24">Celebration Atlas fallback visual</text></svg>`;
}

async function main() {
  await mkdir(generatedDir, { recursive: true });
  await mkdir(fallbackDir, { recursive: true });

  for (const category of Object.keys(palettes) as AtlasEvent['category'][]) {
    const fallback = resolveEventThumbnailFallback({ category } as AtlasEvent);
    await sharp(Buffer.from(buildFallbackSvg(category))).webp({ quality: 86 }).toFile(path.join(outputRoot, fallback.path));
  }

  for (const event of ATLAS_EVENTS) {
    if (event.cardMedia?.thumbnailOverrideSrc) continue;
    const generatedPath = getGeneratedEventThumbnailPath(event);
    await sharp(Buffer.from(buildThumbnailSvg(event))).webp({ quality: 86 }).toFile(path.join(outputRoot, generatedPath));
  }

  console.log(`Generated Celebration Atlas thumbnails for ${ATLAS_EVENTS.filter((event) => !event.cardMedia?.thumbnailOverrideSrc).length} events.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
