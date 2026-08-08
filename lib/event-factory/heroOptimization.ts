import sharp from "sharp";
import {
  eventHeroFormatForMimeType,
  validateEventHeroUploadMetadata,
} from "./heroUploadSpec.ts";

export const EVENT_HERO_OPTIMIZATION_SPEC = {
  contentType: "image/webp",
  format: "webp",
  extension: "webp",
  quality: 85,
  alphaQuality: 100,
  effort: 5,
  cacheControl: "31536000",
} as const;

export type OptimizedEventHero = {
  bytes: Buffer;
  contentType: typeof EVENT_HERO_OPTIMIZATION_SPEC.contentType;
  format: typeof EVENT_HERO_OPTIMIZATION_SPEC.format;
  extension: typeof EVENT_HERO_OPTIMIZATION_SPEC.extension;
  width: number;
  height: number;
  byteSize: number;
  cacheControl: typeof EVENT_HERO_OPTIMIZATION_SPEC.cacheControl;
  sourceContentType: string;
  sourceFormat: string;
  sourceByteSize: number;
  savingsPercent: number;
  quality: number;
};

export type EventHeroOptimizationResult =
  | { ok: true; hero: OptimizedEventHero }
  | { ok: false; errors: string[] };

export async function optimizeEventHeroUpload(
  sourceBytes: Uint8Array | Buffer,
  declaredContentType: string,
): Promise<EventHeroOptimizationResult> {
  const input = Buffer.isBuffer(sourceBytes) ? sourceBytes : Buffer.from(sourceBytes);
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata = await sharp(input, { animated: false }).metadata();
  } catch {
    return { ok: false, errors: ["The selected file could not be decoded as an image."] };
  }

  const sourceFormat = metadata.format ?? "";
  const declaredFormat = eventHeroFormatForMimeType(declaredContentType);
  const validation = validateEventHeroUploadMetadata({
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    byteSize: input.byteLength,
    mimeType: declaredContentType,
    format: sourceFormat,
    pages: metadata.pages,
  });
  const errors = validation.ok ? [] : [...validation.errors];
  if (declaredFormat && sourceFormat && declaredFormat !== sourceFormat) {
    errors.push("The file contents do not match the declared image format.");
  }
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };

  const optimized = await sharp(input, { animated: false })
    .webp({
      quality: EVENT_HERO_OPTIMIZATION_SPEC.quality,
      alphaQuality: EVENT_HERO_OPTIMIZATION_SPEC.alphaQuality,
      effort: EVENT_HERO_OPTIMIZATION_SPEC.effort,
      smartSubsample: true,
    })
    .toBuffer({ resolveWithObject: true });
  const optimizedValidation = validateEventHeroUploadMetadata({
    width: optimized.info.width,
    height: optimized.info.height,
    byteSize: optimized.data.byteLength,
    mimeType: EVENT_HERO_OPTIMIZATION_SPEC.contentType,
    format: optimized.info.format,
    pages: 1,
  });
  if (!optimizedValidation.ok) {
    throw new Error(`Optimized hero validation failed: ${optimizedValidation.errors.join(" ")}`);
  }

  return {
    ok: true,
    hero: {
      bytes: optimized.data,
      contentType: EVENT_HERO_OPTIMIZATION_SPEC.contentType,
      format: EVENT_HERO_OPTIMIZATION_SPEC.format,
      extension: EVENT_HERO_OPTIMIZATION_SPEC.extension,
      width: optimized.info.width,
      height: optimized.info.height,
      byteSize: optimized.data.byteLength,
      cacheControl: EVENT_HERO_OPTIMIZATION_SPEC.cacheControl,
      sourceContentType: declaredContentType,
      sourceFormat,
      sourceByteSize: input.byteLength,
      savingsPercent: Math.max(0, Math.round((1 - optimized.data.byteLength / input.byteLength) * 100)),
      quality: EVENT_HERO_OPTIMIZATION_SPEC.quality,
    },
  };
}
