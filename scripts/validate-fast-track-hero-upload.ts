import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import {
  matchHeroFileToWorkflow,
  normalizedHeroFilename,
} from "../lib/event-factory/heroBatchUpload.ts";
import {
  EVENT_HERO_OPTIMIZATION_SPEC,
  optimizeEventHeroUpload,
} from "../lib/event-factory/heroOptimization.ts";
import type { EventVisualWorkflowSummary } from "../lib/event-factory/types.ts";

const workflow = {
  id: "11111111-1111-4111-8111-111111111111",
  revisionNumber: 1,
  supersedesWorkflowId: null,
  candidateId: "22222222-2222-4222-8222-222222222222",
  eventId: null,
  sourceBundleId: null,
  targetYear: 2026,
  eventKey: "yale-bologna-festival-yale-mi",
  eventName: "Yale Bologna Festival",
  locationLabel: "Yale, Michigan",
  lane: "editorial",
  status: "ready_for_review",
  searchQuery: "Yale Bologna Festival",
  reviewedThumbnailCount: 20,
  referenceSources: [],
  visualSignature: { motifs: [], heroMoment: "" },
  generationBrief: { prompt: "", aspectRatio: "2:3", textPolicy: "no_generated_text", style: "" },
  asset: null,
  qaChecks: {
    visualElementsVerified: false,
    independentComposition: false,
    noInventedTextOrMarks: false,
    mobileCropVerified: false,
    publicAssetVerified: false,
  },
  contentHash: "a".repeat(64),
  reviewedBy: null,
  reviewNotes: null,
  createdAt: "2026-08-04T00:00:00.000Z",
  updatedAt: "2026-08-04T00:00:00.000Z",
  reviewedAt: null,
} satisfies EventVisualWorkflowSummary;

assert.equal(normalizedHeroFilename("Yale Bologna Festival HERO FINAL.png"), "yale-bologna-festival");
assert.equal(normalizedHeroFilename("yale-bologna-festival-yale-mi-2026.webp"), "yale-bologna-festival-yale-mi");
assert.equal(matchHeroFileToWorkflow("yale-bologna-festival.jpg", [workflow]).ok, true);
assert.equal(matchHeroFileToWorkflow("yale-bologna-festival-yale-mi.png", [workflow]).ok, true);
assert.equal(matchHeroFileToWorkflow("wrong-event.png", [workflow]).ok, false);
assert.equal(matchHeroFileToWorkflow("yale-bologna-festival.png", [{ ...workflow, status: "approved" }]).ok, false);

const sourcePng = await sharp({
  create: {
    width: 1024,
    height: 1536,
    channels: 3,
    background: { r: 218, g: 139, b: 72 },
  },
}).png().toBuffer();
const optimized = await optimizeEventHeroUpload(sourcePng, "image/png");
assert.equal(optimized.ok, true);
if (optimized.ok) {
  assert.equal(optimized.hero.contentType, "image/webp");
  assert.equal(optimized.hero.format, "webp");
  assert.equal(optimized.hero.width, 1024);
  assert.equal(optimized.hero.height, 1536);
  assert.equal(optimized.hero.cacheControl, "31536000");
  assert.equal(optimized.hero.quality, EVENT_HERO_OPTIMIZATION_SPEC.quality);
  assert(optimized.hero.byteSize < optimized.hero.sourceByteSize);
}
const mismatched = await optimizeEventHeroUpload(sourcePng, "image/jpeg");
assert.equal(mismatched.ok, false);
if (!mismatched.ok) assert(mismatched.errors.some((error) => error.includes("declared image format")));
const wrongSize = await sharp({
  create: {
    width: 512,
    height: 768,
    channels: 3,
    background: { r: 32, g: 64, b: 96 },
  },
}).png().toBuffer();
assert.equal((await optimizeEventHeroUpload(wrongSize, "image/png")).ok, false);

const batchUpload = readFileSync(new URL("./attach-fast-track-heroes.ts", import.meta.url), "utf8");
assert(batchUpload.includes("optimizeEventHeroUpload"));
assert(batchUpload.includes("cacheControl: item.cacheControl"));
assert(batchUpload.includes(".webp`"));

console.log("Fast Track grouped hero upload validation passed.");
