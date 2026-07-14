import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import nextEnv from '@next/env';
import { CELEBRATION_ATLAS_MEDIA_BUCKET } from '../data/eventMedia.ts';
import { ATLAS_EVENTS } from '../data/events.ts';
import { getCanonicalEventSlug } from '../data/eventCanonicalSlugs.ts';

const { loadEnvConfig } = nextEnv;

type EventRow = { id: string; slug: string };

const MIME_BY_EXTENSION: Record<string, string> = {
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function safeFilename(name: string): string {
  return path.basename(name, path.extname(name))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'flyer';
}

function printUsage() {
  console.log('Usage: npm run upload:flyer -- <event-id> <path-to-image>');
  console.log('');
  console.log('Examples:');
  console.log('  npm run upload:flyer -- alpena-brown-trout "C:\\Users\\Ray\\Downloads\\brown-trout.png"');
  console.log('  npm run upload:flyer -- romeo-peach "C:\\Users\\Ray\\Downloads\\romeo-flyer.webp"');
  console.log('');
  console.log('Known event ids:');
  for (const event of ATLAS_EVENTS) console.log(`  ${event.id} - ${event.name}`);
}

async function main() {
  loadEnvConfig(process.cwd());

  const [, , eventId, rawFilePath] = process.argv;
  if (!eventId || !rawFilePath || eventId === '--help' || eventId === '-h') {
    printUsage();
    process.exit(eventId ? 0 : 1);
  }

  const event = ATLAS_EVENTS.find((candidate) => candidate.id === eventId);
  if (!event) {
    console.error(`Unknown event id: ${eventId}`);
    printUsage();
    process.exit(1);
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.');
    process.exit(1);
  }

  const filePath = path.resolve(rawFilePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_BY_EXTENSION[ext];
  if (!contentType) {
    console.error('Flyer must be a JPG, PNG, WEBP, or GIF image.');
    process.exit(1);
  }

  const file = await fs.readFile(filePath);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const canonicalSlug = getCanonicalEventSlug(event);
  const { data: eventRow, error: eventError } = await supabase
    .from('events')
    .select('id,slug')
    .eq('slug', canonicalSlug)
    .maybeSingle<EventRow>();

  if (eventError || !eventRow?.id) {
    throw new Error(`Supabase event row not found for ${canonicalSlug}.`);
  }

  const storagePath = `events/${canonicalSlug}/flyer/${Date.now()}-${safeFilename(filePath)}${ext}`;
  const upload = await supabase.storage.from(CELEBRATION_ATLAS_MEDIA_BUCKET).upload(storagePath, file, {
    contentType,
    upsert: true,
  });

  if (upload.error) throw new Error(`Flyer upload failed: ${upload.error.message}`);

  const { data: publicUrlData } = supabase.storage.from(CELEBRATION_ATLAS_MEDIA_BUCKET).getPublicUrl(storagePath);
  const publicUrl = publicUrlData.publicUrl;

  await supabase
    .from('event_media')
    .update({ status: 'archived' })
    .eq('event_id', eventRow.id)
    .eq('media_role', 'flyer')
    .eq('source', 'supabase')
    .eq('status', 'approved');

  const insert = await supabase.from('event_media').insert({
    event_id: eventRow.id,
    media_role: 'flyer',
    source: 'supabase',
    status: 'approved',
    storage_bucket: CELEBRATION_ATLAS_MEDIA_BUCKET,
    storage_path: storagePath,
    public_url: publicUrl,
    title: `${event.name} flyer`,
    alt_text: `${event.name} flyer`,
    updated_at: new Date().toISOString(),
  }).select('id,public_url,storage_path').single();

  if (insert.error) throw new Error(`Flyer uploaded, but media approval row failed: ${insert.error.message}`);

  console.log(`Uploaded and approved flyer for ${event.name}.`);
  console.log(`Event: ${canonicalSlug}`);
  console.log(`Storage path: ${storagePath}`);
  console.log(`Public URL: ${publicUrl}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
