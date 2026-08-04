import assert from "node:assert/strict";
import {
  matchHeroFileToWorkflow,
  normalizedHeroFilename,
} from "../lib/event-factory/heroBatchUpload.ts";
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

console.log("Fast Track grouped hero upload validation passed.");
