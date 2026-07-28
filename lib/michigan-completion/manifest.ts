import { createHash } from "node:crypto";
import {
  ART_PROVENANCE_CATEGORIES,
  type ArtProvenanceCategory,
  type MichiganCompletionEventInput,
  type MichiganCompletionManifest,
} from "./types.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const KEY_PATTERN = /^[a-z0-9]+(?:[-_:][a-z0-9]+)*$/;
const MODEL_POLICIES = new Set([
  "deterministic_only",
  "economical_if_needed",
  "reasoning_if_ambiguous",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
}

export function stableCompletionJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

export function completionSha256(value: unknown) {
  return createHash("sha256").update(stableCompletionJson(value)).digest("hex");
}

function optionalUuid(
  record: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[],
) {
  const value = record[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    errors.push(`${path}.${key} must be a UUID when provided.`);
    return undefined;
  }
  return value;
}

function parseEvent(
  value: unknown,
  index: number,
  defaultPerEventBudget: number,
  errors: string[],
): MichiganCompletionEventInput | null {
  const path = `manifest.events[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return null;
  }
  const eventKey = typeof value.eventKey === "string" ? value.eventKey.trim() : "";
  const sourceRecordId =
    typeof value.sourceRecordId === "string" ? value.sourceRecordId.trim() : "";
  if (!eventKey || !KEY_PATTERN.test(eventKey)) {
    errors.push(`${path}.eventKey must be a stable lowercase identity.`);
  }
  if (!sourceRecordId || sourceRecordId.length > 200) {
    errors.push(`${path}.sourceRecordId is required and must be 200 characters or fewer.`);
  }

  const referencesValue = isRecord(value.references) ? value.references : {};
  const references = {
    candidateId: optionalUuid(referencesValue, "candidateId", `${path}.references`, errors),
    canonicalEventId: optionalUuid(
      referencesValue,
      "canonicalEventId",
      `${path}.references`,
      errors,
    ),
    sourceBundleId: optionalUuid(
      referencesValue,
      "sourceBundleId",
      `${path}.references`,
      errors,
    ),
    synthesisId: optionalUuid(referencesValue, "synthesisId", `${path}.references`, errors),
    verificationCaseId: optionalUuid(
      referencesValue,
      "verificationCaseId",
      `${path}.references`,
      errors,
    ),
    packageId: optionalUuid(referencesValue, "packageId", `${path}.references`, errors),
    evidenceId: optionalUuid(referencesValue, "evidenceId", `${path}.references`, errors),
  };

  let countySeed: MichiganCompletionEventInput["countySeed"];
  if (value.countySeed !== undefined) {
    if (!isRecord(value.countySeed)) {
      errors.push(`${path}.countySeed must be an object when provided.`);
    } else {
      const seed = value.countySeed;
      const batchId = typeof seed.batchId === "string" ? seed.batchId.trim() : "";
      const manifestHash =
        typeof seed.manifestHash === "string" ? seed.manifestHash.trim() : "";
      const payloadHash =
        typeof seed.payloadHash === "string" ? seed.payloadHash.trim() : "";
      const idempotencyKey =
        typeof seed.idempotencyKey === "string" ? seed.idempotencyKey.trim() : "";
      const candidate = isRecord(seed.candidate) ? seed.candidate : null;
      const sources = Array.isArray(seed.sources)
        ? seed.sources.filter(isRecord)
        : [];
      if (!batchId || !idempotencyKey || !candidate || !sources.length) {
        errors.push(
          `${path}.countySeed requires batchId, idempotencyKey, candidate, and at least one source.`,
        );
      }
      if (!SHA256_PATTERN.test(manifestHash) || !SHA256_PATTERN.test(payloadHash)) {
        errors.push(`${path}.countySeed hashes must be lowercase SHA-256 values.`);
      }
      if (candidate && sources.length) {
        countySeed = {
          batchId,
          manifestHash,
          payloadHash,
          idempotencyKey,
          candidate,
          sources,
        };
      }
    }
  }

  if (!references.candidateId && !references.canonicalEventId && !countySeed) {
    errors.push(
      `${path} requires a retained candidate/canonical reference or guarded countySeed input.`,
    );
  }

  const editorialPolicy =
    typeof value.editorialPolicy === "string"
      ? value.editorialPolicy
      : "deterministic_only";
  if (!MODEL_POLICIES.has(editorialPolicy)) {
    errors.push(`${path}.editorialPolicy is unsupported.`);
  }
  const perEventModelBudgetTokens =
    typeof value.perEventModelBudgetTokens === "number"
      ? value.perEventModelBudgetTokens
      : defaultPerEventBudget;
  if (
    !Number.isSafeInteger(perEventModelBudgetTokens) ||
    perEventModelBudgetTokens < 0 ||
    perEventModelBudgetTokens > 10_000_000
  ) {
    errors.push(`${path}.perEventModelBudgetTokens must be an integer from 0 to 10000000.`);
  }
  const artProvenance =
    typeof value.artProvenance === "string" ? value.artProvenance : "unknown";
  if (
    !ART_PROVENANCE_CATEGORIES.includes(
      artProvenance as ArtProvenanceCategory,
    )
  ) {
    errors.push(`${path}.artProvenance is unsupported.`);
  }

  if (!eventKey || !sourceRecordId) return null;
  const inputForHash = {
    eventKey,
    sourceRecordId,
    references,
    countySeed,
    editorialPolicy,
    perEventModelBudgetTokens,
    artProvenance,
    metadata: isRecord(value.metadata) ? value.metadata : {},
  };
  const suppliedHash = typeof value.inputHash === "string" ? value.inputHash : "";
  const computedHash = completionSha256(inputForHash);
  if (suppliedHash && suppliedHash !== computedHash) {
    errors.push(`${path}.inputHash does not match the canonical event input.`);
  }

  return {
    ...inputForHash,
    inputHash: suppliedHash || computedHash,
    displayName:
      typeof value.displayName === "string" && value.displayName.trim()
        ? value.displayName.trim().slice(0, 200)
        : undefined,
    editorialPolicy:
      editorialPolicy as MichiganCompletionEventInput["editorialPolicy"],
    artProvenance: artProvenance as ArtProvenanceCategory,
  };
}

export function parseMichiganCompletionManifest(
  value: unknown,
  options?: { defaultPerEventModelBudgetTokens?: number },
) {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false as const, errors: ["Manifest must be a JSON object."] };
  }
  if (value.schemaVersion !== "michigan-completion-manifest/v1") {
    errors.push(
      "manifest.schemaVersion must be michigan-completion-manifest/v1.",
    );
  }
  if (value.stateId !== "MI") {
    errors.push("manifest.stateId must be MI for the Michigan v1 workflow.");
  }
  const countyCode =
    typeof value.countyCode === "string" ? value.countyCode.trim().toLowerCase() : "";
  const batchId = typeof value.batchId === "string" ? value.batchId.trim() : "";
  const inputManifestVersion =
    typeof value.inputManifestVersion === "string"
      ? value.inputManifestVersion.trim()
      : "";
  if (!countyCode || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(countyCode)) {
    errors.push("manifest.countyCode must be a stable lowercase county identity.");
  }
  if (!batchId || batchId.length > 300) {
    errors.push("manifest.batchId is required and must be 300 characters or fewer.");
  }
  if (!inputManifestVersion || inputManifestVersion.length > 100) {
    errors.push(
      "manifest.inputManifestVersion is required and must be 100 characters or fewer.",
    );
  }
  if (!Array.isArray(value.events) || !value.events.length) {
    errors.push("manifest.events must contain at least one event.");
  }
  if (Array.isArray(value.events) && value.events.length > 500) {
    errors.push("manifest.events cannot contain more than 500 events.");
  }
  const defaultBudget = options?.defaultPerEventModelBudgetTokens ?? 0;
  const events = Array.isArray(value.events)
    ? value.events
        .map((event, index) => parseEvent(event, index, defaultBudget, errors))
        .filter((event): event is MichiganCompletionEventInput => Boolean(event))
    : [];
  const eventKeys = new Set<string>();
  const sourceRecordIds = new Set<string>();
  for (const event of events) {
    if (eventKeys.has(event.eventKey)) {
      errors.push(`manifest.events contains duplicate eventKey ${event.eventKey}.`);
    }
    if (sourceRecordIds.has(event.sourceRecordId)) {
      errors.push(
        `manifest.events contains duplicate sourceRecordId ${event.sourceRecordId}.`,
      );
    }
    eventKeys.add(event.eventKey);
    sourceRecordIds.add(event.sourceRecordId);
  }
  if (errors.length) return { ok: false as const, errors };

  const manifest: MichiganCompletionManifest = {
    schemaVersion: "michigan-completion-manifest/v1",
    stateId: "MI",
    countyCode,
    batchId,
    inputManifestVersion,
    ...(typeof value.createdAt === "string" ? { createdAt: value.createdAt } : {}),
    events,
    metadata: isRecord(value.metadata) ? value.metadata : {},
  };
  return {
    ok: true as const,
    value: manifest,
    inputHash: completionSha256(manifest),
  };
}
