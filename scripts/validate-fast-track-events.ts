import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  assert(
    event.ultraHandoff.acceptanceChecks.some((check) => check.includes("Exactly four")),
    "Ultra must use the concise four-topic navigation contract",
  );
  assert(
    event.stages.find((stage) => stage.id === "retain_official_evidence")?.completionRule.includes("history"),
    "official-site exploration must retain story and tradition material before Ultra authorship",
  );
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

const fastTrackGateMigration = readFileSync(
  "supabase/migrations/033_fast_track_identity_and_date_only_schedule.sql",
  "utf8",
);
assert.match(fastTrackGateMigration, /atlas_clear_fast_track_candidate_identity/);
assert.match(fastTrackGateMigration, /deterministic_clean_no_collision/);
assert.match(fastTrackGateMigration, /canonicalization_attempted', false/);
assert.match(fastTrackGateMigration, /v_has_source_backed_date_schedule/);
assert.doesNotMatch(fastTrackGateMigration, /pg_catalog\.coalesce/);
assert.match(
  fastTrackGateMigration,
  /revoke all on function public\.atlas_clear_fast_track_candidate_identity[\s\S]*from public, anon, authenticated/,
);

const ultraFirstMigration = readFileSync(
  "supabase/migrations/036_enable_ultra_first_event_topics.sql",
  "utf8",
);
assert.match(ultraFirstMigration, /atlas_event_factory_content_ready_v3/);
assert.match(ultraFirstMigration, /jsonb_array_length\(v_modules\) not between 4 and 6/);
assert.match(ultraFirstMigration, /presentationGroups/);
assert.match(ultraFirstMigration, /atlas_event_factory_content_ready_v2\(v_core_manifest\)/);
assert.match(
  ultraFirstMigration,
  /revoke all on function public\.atlas_event_factory_content_ready_v3[\s\S]*from public, anon, authenticated/,
);
const conciseFourTopicMigration = readFileSync(
  "supabase/migrations/037_require_concise_four_topic_event_hubs.sql",
  "utf8",
);
assert.match(conciseFourTopicMigration, /atlas_event_factory_content_ready_v4/);
assert.match(conciseFourTopicMigration, /jsonb_array_length\(v_modules\) <> 4/);
assert.match(conciseFourTopicMigration, /Why Go/);
assert.match(conciseFourTopicMigration, /Schedule/);
assert.match(conciseFourTopicMigration, /Plan/);
assert.match(conciseFourTopicMigration, /official-site links may appear only/i);
assert.match(
  conciseFourTopicMigration,
  /grant execute on function public\.atlas_event_factory_content_ready_v4[\s\S]*to service_role/,
);
const richWhyGoMigration = readFileSync(
  "supabase/migrations/038_restore_rich_why_go_and_plan_links.sql",
  "utf8",
);
assert.match(richWhyGoMigration, /atlas_event_factory_content_ready_v5/);
assert.match(richWhyGoMigration, /v_summary_words not between 18 and 60/);
assert.match(richWhyGoMigration, /jsonb_array_length\(v_why_go->'metrics'\) < 2/);
assert.match(richWhyGoMigration, /jsonb_array_length\(v_why_go->'audienceGroups'\) < 2/);
assert.match(richWhyGoMigration, /task-specific Plan deep links/i);
assert.match(richWhyGoMigration, /schedule\|program\|faq/);
assert.match(
  richWhyGoMigration,
  /grant execute on function public\.atlas_event_factory_content_ready_v5\(jsonb\) to service_role/,
);
assert.match(
  ultraFirstMigration,
  /grant execute on function public\.atlas_event_factory_content_ready_v3[\s\S]*to service_role/,
);
assert.match(
  fastTrackGateMigration,
  /grant execute on function public\.atlas_clear_fast_track_candidate_identity[\s\S]*to service_role/,
);

console.log("Fast Track approved-list validation passed.");
