import assert from "node:assert/strict";
import {
  parseFastTrackApprovedList,
  stableFastTrackJson,
} from "../lib/event-fast-track/manifest.ts";
import { planFastTrackApprovedList } from "../lib/event-fast-track/plan.ts";

const fixture = {
  schemaVersion: "celebration-atlas-approved-event-list/v1",
  listId: "ray-approved-august-2026",
  approvedBy: "ray@example.test",
  approvedAt: "2026-08-02T16:00:00.000Z",
  defaultState: "Michigan",
  defaultTargetYear: 2026,
  events: [
    {
      sourceRecordId: "approved-001",
      name: "Example Harbor Festival",
      city: "Example City",
      officialUrl: "https://events.example.test/harbor",
      knownConstraints: ["No waterfront panorama unless source imagery confirms it"],
    },
    {
      sourceRecordId: "approved-002",
      eventKey: "example-art-walk",
      name: "Example Art Walk",
      city: "Sample Village",
      officialUrl: "https://arts.example.test/walk#details",
    },
  ],
};

const parsed = parseFastTrackApprovedList(fixture);
assert(parsed.ok, parsed.ok ? undefined : parsed.errors.join("\n"));
assert.equal(parsed.value.publicationAuthorized, false);
assert.equal(parsed.value.approvalScope, "inclusion_and_private_preparation_only");
assert.equal(parsed.value.events.length, 2);
assert.equal(
  parsed.value.events[0].eventKey,
  "example-harbor-festival-example-city-michigan",
);
assert.equal(
  parsed.value.events[1].officialUrl,
  "https://arts.example.test/walk",
  "URL fragments must not enter retained source identity",
);
assert.match(parsed.inputHash, /^[0-9a-f]{64}$/);
assert.equal(
  stableFastTrackJson(JSON.parse(stableFastTrackJson(parsed.value))),
  stableFastTrackJson(parsed.value),
  "canonical Fast Track JSON must be stable",
);

const plan = planFastTrackApprovedList({
  list: parsed.value,
  inputHash: parsed.inputHash,
  preparedAt: "2026-08-02T17:00:00.000Z",
});
assert.equal(plan.events.length, 2);
assert.equal(plan.executionPolicy.eventIsolation, true);
assert.equal(plan.executionPolicy.continueOnEventFailure, true);
assert.equal(plan.executionPolicy.cohortCompletionRequired, false);
assert.equal(plan.executionPolicy.publicationActionAvailable, false);
assert.equal(plan.executionPolicy.stopBeforePublication, true);
assert.equal(plan.compatibilityPolicy.supportingSourceMinimum, 0);
assert.equal(plan.compatibilityPolicy.separateVerificationQueueWhenFactsComplete, false);

for (const event of plan.events) {
  assert.equal(event.runPolicy.continueOtherEventsOnFailure, true);
  assert.equal(event.runPolicy.publicationAuthorized, false);
  assert.equal(event.terminalState, "awaiting_explicit_package_approval");
  assert.equal(event.stages.at(-1)?.id, "publication_hold");
  assert.equal(
    event.stages.some((stage) => stage.id.includes("publish")),
    false,
    "Fast Track must contain no publication stage",
  );
  assert(
    event.stages.every((stage) => stage.failureScope === "event_only"),
    "every stage failure must remain event-scoped",
  );
  assert.equal(event.ultraHandoff.executionProfile.model, "gpt-5.6-sol");
  assert.equal(event.ultraHandoff.executionProfile.reasoningEffort, "ultra");
  assert.equal(event.ultraHandoff.task, "full_event_hub_manifest_authorship");
  assert.equal(event.ultraHandoff.initialAttemptLimit, 1);
  assert.equal(event.heroHandoff.skill, "$create-celebration-atlas-hero");
  assert.equal(event.heroHandoff.executionProfile.model, "GPT-5.6 Luna");
  assert.equal(event.heroHandoff.executionProfile.reasoningEffort, "max");
  assert.equal(event.heroHandoff.generationPolicy.primaryImageCount, 1);
  assert.equal(
    event.heroHandoff.generationPolicy.alternatives,
    "only_after_rejection_or_low_confidence",
  );
  assert.equal(event.heroHandoff.downstreamBoundary.localOutputIsApproval, false);
}

const publicationAttempt = parseFastTrackApprovedList({
  ...fixture,
  publicationAuthorized: true,
});
assert.equal(publicationAttempt.ok, false);
assert(
  !publicationAttempt.ok &&
    publicationAttempt.errors.includes("list.publicationAuthorized must be false."),
);

const duplicateIdentity = parseFastTrackApprovedList({
  ...fixture,
  events: [fixture.events[1], { ...fixture.events[1], sourceRecordId: "approved-003" }],
});
assert.equal(duplicateIdentity.ok, false);
assert(
  !duplicateIdentity.ok &&
    duplicateIdentity.errors.some((error) => error.includes("duplicate eventKey")),
);

const missingEdition = parseFastTrackApprovedList({
  ...fixture,
  defaultTargetYear: undefined,
  events: [{ name: "Example Event", city: "Example City" }],
});
assert.equal(missingEdition.ok, false);
assert(
  !missingEdition.ok &&
    missingEdition.errors.some((error) => error.includes("targetYear")),
);

console.log("Fast Track approved-list validation passed.");
