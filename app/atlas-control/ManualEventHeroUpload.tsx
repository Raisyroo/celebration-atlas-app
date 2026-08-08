"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { FileCheck, ImageOff, Upload } from "lucide-react";
import NextImage from "next/image";
import type { EventFactoryItem, EventVisualWorkflowSummary } from "@/lib/event-factory/types";
import {
  EVENT_HERO_UPLOAD_SPEC,
  eventHeroFormatForMimeType,
  validateEventHeroUploadMetadata,
} from "@/lib/event-factory/heroUploadSpec";

type Props = {
  items: EventFactoryItem[];
  workflows: EventVisualWorkflowSummary[];
  onComplete: () => Promise<void>;
};

const EMPTY_CONFIRMATIONS = {
  correctEvent: false,
  rightsConfirmed: false,
  noInventedMarks: false,
  fullFrameReviewed: false,
};

async function imageDimensions(file: File) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("The selected file could not be decoded as an image."));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ManualEventHeroUpload({ items, workflows, onComplete }: Props) {
  const eligibleItems = useMemo(
    () => items.filter((item) => item.publishedPackageId && item.stage === "live"),
    [items],
  );
  const [packageId, setPackageId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [confirmations, setConfirmations] = useState(EMPTY_CONFIRMATIONS);
  const [workflowId, setWorkflowId] = useState("");
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const selected = eligibleItems.find((item) => item.publishedPackageId === packageId);
  const allConfirmed = Object.values(confirmations).every(Boolean);

  useEffect(() => () => {
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function selectEvent(nextPackageId: string) {
    const nextItem = eligibleItems.find((item) => item.publishedPackageId === nextPackageId);
    const pendingWorkflow = nextItem?.publicationArtState === "image_uploaded_awaiting_approval"
      ? workflows.find((workflow) => workflow.id === nextItem.visualWorkflowId)
      : undefined;
    setPackageId(nextPackageId);
    setWorkflowId(pendingWorkflow?.id ?? "");
    setMessage(pendingWorkflow ? "A retained finished image is awaiting approval. Review its complete frame, then approve and attach it." : "");
    setAltText(pendingWorkflow?.asset?.altText ?? "");
    setPreviewUrl(pendingWorkflow?.asset?.publicUrl ?? "");
    setFile(null);
    setConfirmations(EMPTY_CONFIRMATIONS);
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(null);
    setWorkflowId("");
    setMessage("");
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    if (!nextFile) return;
    try {
      const dimensions = await imageDimensions(nextFile);
      const validation = validateEventHeroUploadMetadata({
        ...dimensions,
        byteSize: nextFile.size,
        mimeType: nextFile.type,
        format: eventHeroFormatForMimeType(nextFile.type),
      });
      if (!validation.ok) {
        event.target.value = "";
        setMessage(validation.errors.join(" "));
        return;
      }
      setFile(nextFile);
      setPreviewUrl(URL.createObjectURL(nextFile));
      setMessage("Image specification verified locally. Upload will automatically optimize it to WebP; review the complete frame before upload.");
    } catch (error) {
      event.target.value = "";
      setMessage(error instanceof Error ? error.message : "The selected image could not be inspected.");
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected?.publishedPackageId || !file || !altText.trim() || !allConfirmed) {
      setMessage("Choose an event and valid image, add alt text, and complete every review confirmation.");
      return;
    }
    setPending("upload");
    setMessage("Optimizing the finished asset to WebP, uploading it, and retaining its provenance...");
    const body = new FormData();
    body.set("sourcePackageId", selected.publishedPackageId);
    body.set("altText", altText.trim());
    body.set("hero", file);
    for (const [key, value] of Object.entries(confirmations)) body.set(key, String(value));
    const response = await fetch("/api/atlas-control/event-visuals/upload", { method: "POST", body });
    const result = await response.json().catch(() => ({}));
    setPending("");
    if (!response.ok) {
      setMessage(result.error ?? "The finished image could not be uploaded.");
      return;
    }
    const nextWorkflowId = String(result.result?.workflow_id ?? "");
    if (!nextWorkflowId) {
      setMessage("The upload completed without a review workflow identifier.");
      return;
    }
    setWorkflowId(nextWorkflowId);
    const sourceKilobytes = Math.round(Number(result.sourceByteSize ?? file.size) / 1024);
    const optimizedKilobytes = Math.round(Number(result.byteSize ?? 0) / 1024);
    const savingsPercent = Math.round(Number(result.savingsPercent ?? 0));
    setMessage(`Upload retained as WebP: ${sourceKilobytes} KB to ${optimizedKilobytes} KB (${savingsPercent}% smaller). It is awaiting explicit approval and attachment.`);
    await onComplete();
  }

  async function approveAndAttach() {
    if (!selected?.publishedPackageId || !workflowId) return;
    if (!window.confirm(`Approve this finished image and attach it to ${selected.name} on /events/${selected.slug}?`)) return;
    setPending("approve");
    setMessage("Approving the retained asset and activating an audited Event Hub revision...");
    const response = await fetch("/api/atlas-control/event-visuals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "approve_manual_and_attach",
        workflowId,
        sourcePackageId: selected.publishedPackageId,
        notes: "Approved externally supplied finished Event Hub hero from Atlas Control.",
      }),
    });
    const result = await response.json().catch(() => ({}));
    setPending("");
    if (!response.ok) {
      setMessage(result.error ?? "The image could not be approved and attached.");
      return;
    }
    setMessage(`Approved image attached. The public URL remains ${result.publicPath ?? `/events/${selected.slug}`}.`);
    setWorkflowId("");
    await onComplete();
  }

  async function removeImage() {
    if (!selected?.publishedPackageId) return;
    if (!window.confirm(`Remove the current hero image from ${selected.name} and publish its image-free hero? The event and prior revisions will be retained.`)) return;
    setPending("remove");
    setMessage("Preparing and publishing an audited image-free Event Hub revision...");
    const response = await fetch("/api/atlas-control/event-factory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "remove_art_and_publish",
        packageId: selected.publishedPackageId,
        notes: "Approved removal of current Event Hub hero; prior package and media retained.",
      }),
    });
    const result = await response.json().catch(() => ({}));
    setPending("");
    if (!response.ok) {
      setMessage(result.error ?? "The image-free revision could not be published.");
      return;
    }
    setMessage(`Image removed. The public URL remains ${result.publicPath ?? `/events/${selected.slug}`}.`);
    await onComplete();
  }

  return (
    <section className="manual-hero-workflow" aria-labelledby="manual-hero-heading">
      <div className="visual-title-row">
        <div>
          <p className="eyebrow">Finished image upload</p>
          <h3 id="manual-hero-heading">Attach external Event Hub art</h3>
          <p>
            Exact canvas: {EVENT_HERO_UPLOAD_SPEC.width} x {EVENT_HERO_UPLOAD_SPEC.height}px ({EVENT_HERO_UPLOAD_SPEC.aspectRatio}).
            JPG, PNG, or WebP; maximum {EVENT_HERO_UPLOAD_SPEC.maxMegabytes} MB. Uploads are automatically optimized to WebP for fast delivery. The complete canvas is shown without cropping.
          </p>
        </div>
      </div>

      {message && <p className="factory-result" role="status">{message}</p>}

      <form className="manual-hero-form" onSubmit={upload}>
        <label>
          Published event
          <select value={packageId} onChange={(event) => selectEvent(event.target.value)}>
            <option value="">Choose an event</option>
            {eligibleItems.map((item) => (
              <option key={item.publishedPackageId} value={item.publishedPackageId ?? ""}>
                {item.name} — {item.city ?? "Michigan"} — {item.publicationArtState.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>

        <label>
          Finished hero file
          <input
            type="file"
            accept={EVENT_HERO_UPLOAD_SPEC.acceptedMimeTypes.join(",")}
            onChange={selectFile}
            disabled={!selected || Boolean(pending) || Boolean(workflowId)}
          />
        </label>

        <div className="manual-hero-preview" data-complete-canvas-preview="true">
          {previewUrl ? <NextImage src={previewUrl} alt="" fill unoptimized sizes="(max-width: 780px) 100vw, 50vw" /> : <div className="manual-hero-empty">Complete hero preview</div>}
          <div className="manual-hero-preview-copy">
            <strong>{selected?.name ?? "Event name"}</strong>
            <span>{selected?.city ?? "Municipality"}, Michigan</span>
          </div>
        </div>

        <label>
          Image alt text
          <textarea
            rows={3}
            value={altText}
            onChange={(event) => setAltText(event.target.value)}
            disabled={!file || Boolean(pending)}
            placeholder="Describe the finished image for a visitor who cannot see it."
          />
        </label>

        <fieldset className="visual-qa manual-hero-checks">
          <legend>Upload review</legend>
          {([
            ["correctEvent", "This finished image belongs to the selected event"],
            ["rightsConfirmed", "Celebration Atlas has permission to store and publish this supplied image"],
            ["noInventedMarks", "The image contains no unreviewed event claims, logos, text, or marks"],
            ["fullFrameReviewed", "The complete 2:3 canvas is correct in the Event Hub preview"],
          ] as Array<[keyof typeof confirmations, string]>).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={confirmations[key]}
                disabled={!file || Boolean(pending)}
                onChange={(event) => setConfirmations((current) => ({ ...current, [key]: event.target.checked }))}
              />
              {label}
            </label>
          ))}
        </fieldset>

        <div className="visual-form-actions">
          <button type="submit" disabled={!selected || !file || !altText.trim() || !allConfirmed || Boolean(pending) || Boolean(workflowId)}>
            <Upload size={15} aria-hidden="true" />
            {pending === "upload" ? "Uploading..." : "Upload for approval"}
          </button>
          {workflowId && (
            <button type="button" onClick={approveAndAttach} disabled={Boolean(pending)}>
              <FileCheck size={15} aria-hidden="true" />
              {pending === "approve" ? "Approving..." : "Approve and attach"}
            </button>
          )}
          {selected?.publicationArtState === "published_with_approved_art" && (
            <button type="button" className="factory-reject" onClick={removeImage} disabled={Boolean(pending)}>
              <ImageOff size={15} aria-hidden="true" />
              {pending === "remove" ? "Removing..." : "Remove current image"}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
