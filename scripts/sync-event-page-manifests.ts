import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import nextEnv from '@next/env';
import { BROWN_TROUT_EVENT_PAGE_MANIFEST } from '../data/brownTroutEventPageManifest.ts';
import { DETROIT_JAZZ_EVENT_PAGE_MANIFEST } from '../data/detroitJazzEventPageManifest.ts';
import {
  stableStringifyEventPageManifest,
  validateEventPageManifest,
} from '../data/eventPageManifestValidation.ts';

const EVENT_PAGE_MANIFESTS = [
  BROWN_TROUT_EVENT_PAGE_MANIFEST,
  DETROIT_JAZZ_EVENT_PAGE_MANIFEST,
];
const { loadEnvConfig } = nextEnv;

function usage() {
  console.log('Usage: npm run sync:event-pages -- [all|event-id] [--apply] [--summary "text"]');
  console.log('');
  console.log('The default is a validation-only dry run. --apply creates immutable drafts only.');
  console.log('Review and publication remain explicit Atlas Control Desk actions.');
  console.log('');
  console.log('Event Hub ids:');
  EVENT_PAGE_MANIFESTS.forEach((manifest) => {
    console.log(`  ${manifest.eventId} - ${manifest.identity.name}`);
  });
}

function parseArguments() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) return { help: true } as const;
  const apply = args.includes('--apply');
  const summaryIndex = args.indexOf('--summary');
  const summary = summaryIndex >= 0 ? args[summaryIndex + 1] : undefined;
  const positional = args.filter((arg, index) => {
    if (arg === '--apply' || arg === '--summary') return false;
    if (summaryIndex >= 0 && index === summaryIndex + 1) return false;
    return !arg.startsWith('--');
  });
  return { help: false, apply, summary, selector: positional[0] ?? 'all' } as const;
}

async function main() {
  const args = parseArguments();
  if (args.help) {
    usage();
    return;
  }

  const selected = args.selector === 'all'
    ? EVENT_PAGE_MANIFESTS
    : EVENT_PAGE_MANIFESTS.filter((manifest) => manifest.eventId === args.selector);
  if (!selected.length) {
    console.error(`Unknown Event Hub id: ${args.selector}`);
    usage();
    process.exit(1);
  }

  const prepared = selected.map((manifest) => {
    const validation = validateEventPageManifest(manifest);
    if (!validation.ok) {
      throw new Error(`${manifest.eventId}: ${validation.errors.join(' ')}`);
    }
    const hash = createHash('sha256')
      .update(stableStringifyEventPageManifest(manifest))
      .digest('hex');
    return { manifest, validation, hash };
  });

  prepared.forEach(({ manifest, hash }) => {
    console.log(`${manifest.eventId}: valid, SHA-256 ${hash}`);
  });

  if (!args.apply) {
    console.log('Dry run complete. Re-run with --apply to create reviewed-publishing drafts.');
    return;
  }

  loadEnvConfig(process.cwd());
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  const actorIdentity = `cli:${process.env.ATLAS_SYNC_ACTOR || process.env.USERNAME || process.env.USER || 'operator'}`;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const { manifest, validation, hash } of prepared) {
    const { data, error } = await supabase.rpc('atlas_create_event_page_draft', {
      p_event_key: manifest.eventId,
      p_slug: manifest.slug,
      p_schema_version: manifest.schemaVersion,
      p_manifest: manifest,
      p_content_hash: hash,
      p_validation_report: { errors: [], warnings: validation.warnings },
      p_source_kind: 'local_seed',
      p_change_summary: args.summary || `Sync checked-in ${manifest.identity.name} manifest`,
      p_actor_identity: actorIdentity,
    });
    if (error) throw new Error(`${manifest.eventId}: ${error.message}`);
    const result = Array.isArray(data) ? data[0] : data;
    console.log(
      `${manifest.eventId}: ${result?.created ? 'created' : 'reused'} draft version ${result?.version_number ?? '?'}`,
    );
  }

  console.log('Draft sync complete. Submit, review, and publish from /atlas-control.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
