import type { EventPageManifest } from "./eventPageManifestTypes.ts";
import {
  validateEventPageManifest,
} from "./eventPageManifestValidation.ts";

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
    const artPending =
      !strict.value.hero.imageSrc.trim() &&
      !strict.value.hero.imageAlt.trim();
    return {
      ok: true,
      value: strict.value,
      artPending,
      warnings: artPending
        ? [
            ...strict.warnings,
            "Approved hero art is pending; the intentional image-free Event Hub treatment will render.",
          ]
        : strict.warnings,
    };
  }
  return { ok: false, errors: strict.errors, warnings: strict.warnings };
}
