export const EVENT_HERO_UPLOAD_SPEC = {
  width: 1024,
  height: 1536,
  aspectRatio: "2:3",
  maxBytes: 8 * 1024 * 1024,
  maxMegabytes: 8,
  acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  acceptedFormats: ["jpeg", "png", "webp"],
} as const;

export type EventHeroUploadMetadata = {
  width: number;
  height: number;
  byteSize: number;
  mimeType: string;
  format: string;
  pages?: number;
};

export type EventHeroUploadValidation =
  | { ok: true; errors: [] }
  | { ok: false; errors: string[] };

export function validateEventHeroUploadMetadata(
  metadata: EventHeroUploadMetadata,
): EventHeroUploadValidation {
  const errors: string[] = [];
  if (
    !EVENT_HERO_UPLOAD_SPEC.acceptedMimeTypes.includes(
      metadata.mimeType as (typeof EVENT_HERO_UPLOAD_SPEC.acceptedMimeTypes)[number],
    )
  ) {
    errors.push("Image format must be JPG, PNG, or WebP.");
  }
  if (
    !EVENT_HERO_UPLOAD_SPEC.acceptedFormats.includes(
      metadata.format as (typeof EVENT_HERO_UPLOAD_SPEC.acceptedFormats)[number],
    )
  ) {
    errors.push("The file contents must be a valid JPG, PNG, or WebP image.");
  }
  if (
    metadata.width !== EVENT_HERO_UPLOAD_SPEC.width ||
    metadata.height !== EVENT_HERO_UPLOAD_SPEC.height
  ) {
    errors.push(
      `Image dimensions must be exactly ${EVENT_HERO_UPLOAD_SPEC.width} × ${EVENT_HERO_UPLOAD_SPEC.height} pixels (${EVENT_HERO_UPLOAD_SPEC.aspectRatio}).`,
    );
  }
  if (
    !Number.isFinite(metadata.byteSize) ||
    metadata.byteSize <= 0 ||
    metadata.byteSize > EVENT_HERO_UPLOAD_SPEC.maxBytes
  ) {
    errors.push(
      `Image file size must be ${EVENT_HERO_UPLOAD_SPEC.maxMegabytes} MB or smaller.`,
    );
  }
  if ((metadata.pages ?? 1) !== 1) {
    errors.push("Animated or multi-page images are not supported.");
  }
  return errors.length ? { ok: false, errors } : { ok: true, errors: [] };
}

export function eventHeroFormatForMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpeg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "";
}
