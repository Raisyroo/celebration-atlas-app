import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { CELEBRATION_ATLAS_MEDIA_BUCKET } from "../data/eventMedia.ts";
import { createAtlasServiceClient } from "../lib/atlas-control/service.ts";
import {
  EVENT_HERO_OPTIMIZATION_SPEC,
  optimizeEventHeroUpload,
} from "../lib/event-factory/heroOptimization.ts";
import {
  matchHeroFileToWorkflow,
  normalizedHeroFilename,
} from "../lib/event-factory/heroBatchUpload.ts";
import {
  listEventVisualWorkflows,
  saveEventVisualWorkflow,
} from "../lib/event-factory/visuals.ts";
import type { EventVisualWorkflowSummary } from "../lib/event-factory/types.ts";

const IMAGE_EXTENSION = /\.(?:jpe?g|png|webp)$/i;

type Options = {
  inputs: string[];
  actor: string;
  authorizePrivateWrites: boolean;
  qaReviewed: boolean;
  rightsConfirmed: boolean;
  altText: Record<string, string>;
};

function usage() {
  return [
    "Usage:",
    "  npm run atlas:attach-fast-track-heroes -- --input <file-or-directory> [--input <path> ...]",
    "    --actor <identity> [--alt-json <file>]",
    "    [--authorize-private-writes --qa-reviewed --rights-confirmed]",
    "",
    "Dry-run is the default. Filenames must match an event key or event-name slug.",
  ].join("\n");
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    inputs: [],
    actor: "",
    authorizePrivateWrites: false,
    qaReviewed: false,
    rightsConfirmed: false,
    altText: {},
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") options.inputs.push(argv[++index] ?? "");
    else if (arg === "--actor") options.actor = argv[++index] ?? "";
    else if (arg === "--alt-json") {
      const altPath = path.resolve(argv[++index] ?? "");
      options.altText = JSON.parse(readFileSync(altPath, "utf8")) as Record<string, string>;
    } else if (arg === "--authorize-private-writes") options.authorizePrivateWrites = true;
    else if (arg === "--qa-reviewed") options.qaReviewed = true;
    else if (arg === "--rights-confirmed") options.rightsConfirmed = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  options.inputs = options.inputs.filter(Boolean);
  if (!options.inputs.length) throw new Error("At least one --input file or directory is required.");
  if (!options.actor.trim()) throw new Error("--actor is required.");
  if (options.authorizePrivateWrites && (!options.qaReviewed || !options.rightsConfirmed)) {
    throw new Error("Private upload requires --qa-reviewed and --rights-confirmed.");
  }
  return options;
}

function imageFiles(inputs: string[]) {
  const files = inputs.flatMap((input) => {
    const resolved = path.resolve(input);
    const stats = statSync(resolved);
    if (stats.isFile()) return [resolved];
    if (!stats.isDirectory()) throw new Error(`${resolved} is not a file or directory.`);
    return readdirSync(resolved, { withFileTypes: true })
      .filter((entry) => entry.isFile() && IMAGE_EXTENSION.test(entry.name))
      .map((entry) => path.join(resolved, entry.name));
  }).filter((file) => IMAGE_EXTENSION.test(file));
  return [...new Set(files)].sort((left, right) => left.localeCompare(right));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const files = imageFiles(options.inputs);
  if (!files.length) throw new Error("No JPG, PNG, or WebP files were found.");
  const { items: workflows, error } = await listEventVisualWorkflows();
  if (error) throw new Error(error);

  const planned: Array<{
    file: string;
    bytes: Buffer;
    contentType: string;
    sourceByteSize: number;
    savingsPercent: number;
    cacheControl: string;
    workflow: EventVisualWorkflowSummary;
  }> = [];
  for (const file of files) {
    const matched = matchHeroFileToWorkflow(file, workflows);
    if (!matched.ok) throw new Error(`${path.basename(file)}: ${matched.reason}`);
    const sourceBytes = readFileSync(file);
    const extension = path.extname(file).toLowerCase();
    const sourceContentType = extension === ".png"
      ? "image/png"
      : extension === ".webp"
      ? "image/webp"
      : "image/jpeg";
    const optimized = await optimizeEventHeroUpload(sourceBytes, sourceContentType);
    if (!optimized.ok) throw new Error(`${path.basename(file)}: ${optimized.errors.join(" ")}`);
    planned.push({
      file,
      bytes: optimized.hero.bytes,
      contentType: optimized.hero.contentType,
      sourceByteSize: optimized.hero.sourceByteSize,
      savingsPercent: optimized.hero.savingsPercent,
      cacheControl: optimized.hero.cacheControl,
      workflow: matched.workflow,
    });
  }

  const duplicateWorkflows = planned.filter((item, index) => (
    planned.findIndex((candidate) => candidate.workflow.id === item.workflow.id) !== index
  ));
  if (duplicateWorkflows.length) {
    throw new Error(`More than one file matches ${duplicateWorkflows[0].workflow.eventName}. Keep one image per event.`);
  }

  if (!options.authorizePrivateWrites) {
    console.log(JSON.stringify({
      mode: "dry_run",
      files: planned.map((item) => ({
        filename: path.basename(item.file),
        eventKey: item.workflow.eventKey,
        eventName: item.workflow.eventName,
        workflowId: item.workflow.id,
        targetYear: item.workflow.targetYear,
        sourceByteSize: item.sourceByteSize,
        optimizedByteSize: item.bytes.byteLength,
        savingsPercent: item.savingsPercent,
        outputFormat: "webp",
      })),
    }, null, 2));
    return;
  }

  const supabase = createAtlasServiceClient();
  if (!supabase) throw new Error("Atlas Supabase service configuration is incomplete.");
  const uploaded = [];
  for (const item of planned) {
    const storagePath = `events/${item.workflow.eventKey}/hero/${Date.now()}-${normalizedHeroFilename(item.file)}.webp`;
    const storage = await supabase.storage
      .from(CELEBRATION_ATLAS_MEDIA_BUCKET)
      .upload(storagePath, item.bytes, {
        contentType: item.contentType,
        cacheControl: item.cacheControl,
        upsert: false,
      });
    if (storage.error) throw new Error(`${item.workflow.eventName}: ${storage.error.message}`);
    try {
      const publicUrl = supabase.storage
        .from(CELEBRATION_ATLAS_MEDIA_BUCKET)
        .getPublicUrl(storagePath).data.publicUrl;
      const publicResponse = await fetch(publicUrl, { method: "HEAD", cache: "no-store" }).catch(() => null);
      if (!publicResponse?.ok || !publicResponse.headers.get("content-type")?.startsWith("image/")) {
        throw new Error("Uploaded hero is not publicly reachable.");
      }
      const altText = options.altText[item.workflow.eventKey]
        || options.altText[normalizedHeroFilename(item.file)]
        || `Hero artwork for ${item.workflow.eventName} in ${item.workflow.locationLabel}.`;
      const result = await saveEventVisualWorkflow({
        candidateId: item.workflow.candidateId,
        sourceBundleId: item.workflow.sourceBundleId,
        targetYear: item.workflow.targetYear,
        eventKey: item.workflow.eventKey,
        eventName: item.workflow.eventName,
        locationLabel: item.workflow.locationLabel,
        lane: item.workflow.lane,
        searchQuery: item.workflow.searchQuery,
        reviewedThumbnailCount: item.workflow.reviewedThumbnailCount,
        referenceSources: item.workflow.referenceSources,
        motifs: item.workflow.visualSignature.motifs,
        heroMoment: item.workflow.visualSignature.heroMoment,
        asset: {
          publicUrl,
          altText,
          credit: "Provided to Celebration Atlas",
          sourceKind: "supabase",
          storageBucket: CELEBRATION_ATLAS_MEDIA_BUCKET,
          storagePath,
          contentType: item.contentType,
          byteSize: item.bytes.byteLength,
          width: 1024,
          height: 1536,
          sourceFilename: path.basename(item.file).slice(0, 255),
          sourceContentType: path.extname(item.file).toLowerCase() === ".png"
            ? "image/png"
            : path.extname(item.file).toLowerCase() === ".webp"
            ? "image/webp"
            : "image/jpeg",
          sourceByteSize: item.sourceByteSize,
          optimization: {
            strategy: "webp",
            quality: EVENT_HERO_OPTIMIZATION_SPEC.quality,
            originalByteSize: item.sourceByteSize,
            optimizedByteSize: item.bytes.byteLength,
            savingsPercent: item.savingsPercent,
          },
          uploadedBy: options.actor.trim(),
          uploadedAt: new Date().toISOString(),
          provenanceCategory: "externally_supplied",
        },
        qaChecks: {
          visualElementsVerified: true,
          independentComposition: true,
          noInventedTextOrMarks: true,
          mobileCropVerified: true,
          publicAssetVerified: true,
        },
        actorIdentity: options.actor.trim(),
      });
      uploaded.push({
        eventKey: item.workflow.eventKey,
        eventName: item.workflow.eventName,
        workflowId: item.workflow.id,
        storagePath,
        publicUrl,
        result,
      });
    } catch (uploadError) {
      await supabase.storage.from(CELEBRATION_ATLAS_MEDIA_BUCKET).remove([storagePath]);
      throw uploadError;
    }
  }
  console.log(JSON.stringify({ mode: "private_write", uploaded }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
