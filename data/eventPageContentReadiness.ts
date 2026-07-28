import type { EventPageManifest } from "./eventPageManifestTypes.ts";
import {
  validateEventPageManifest,
} from "./eventPageManifestValidation.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export type EventPageContentReadinessResult =
  | {
      ok: true;
      value: EventPageManifest;
      artPending: boolean;
      warnings: string[];
    }
  | {
      ok: false;
      errors: string[];
      warnings: string[];
    };

export function validateEventPageContentReadiness(
  input: unknown,
): EventPageContentReadinessResult {
  const strict = validateEventPageManifest(input);
  if (strict.ok) {
    return {
      ok: true,
      value: strict.value,
      artPending: false,
      warnings: strict.warnings,
    };
  }
  if (!isRecord(input) || !isRecord(input.hero)) {
    return { ok: false, errors: strict.errors, warnings: strict.warnings };
  }

  const imageSrc =
    typeof input.hero.imageSrc === "string" ? input.hero.imageSrc.trim() : "";
  const imageAlt =
    typeof input.hero.imageAlt === "string" ? input.hero.imageAlt.trim() : "";
  if (imageSrc || imageAlt) {
    return { ok: false, errors: strict.errors, warnings: strict.warnings };
  }

  // These values exist only inside validation. They are never persisted or
  // rendered; the private preview receives the original empty hero fields.
  const validationProjection = structuredClone(input);
  if (!isRecord(validationProjection.hero)) {
    return { ok: false, errors: strict.errors, warnings: strict.warnings };
  }
  validationProjection.hero.imageSrc = "art-pending-private-preview";
  validationProjection.hero.imageAlt = "Art pending";
  const contentValidation = validateEventPageManifest(validationProjection);
  if (!contentValidation.ok) {
    return {
      ok: false,
      errors: contentValidation.errors,
      warnings: contentValidation.warnings,
    };
  }

  return {
    ok: true,
    value: input as unknown as EventPageManifest,
    artPending: true,
    warnings: [
      ...contentValidation.warnings,
      "Approved hero art is pending; this manifest is valid only for authenticated private content review.",
    ],
  };
}
