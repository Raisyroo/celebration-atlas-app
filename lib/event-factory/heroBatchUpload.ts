import path from "node:path";
import type { EventVisualWorkflowSummary } from "./types.ts";

const REMOVABLE_SUFFIX = /-(?:hero|image|art|final|approved|v\d+|20\d{2})$/;

export function normalizedHeroFilename(value: string) {
  let normalized = path.basename(value, path.extname(value))
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  while (REMOVABLE_SUFFIX.test(normalized)) normalized = normalized.replace(REMOVABLE_SUFFIX, "");
  return normalized;
}

export function normalizedEventName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function matchHeroFileToWorkflow(
  filename: string,
  workflows: EventVisualWorkflowSummary[],
): { ok: true; workflow: EventVisualWorkflowSummary } | { ok: false; reason: string } {
  const key = normalizedHeroFilename(filename);
  const writable = workflows.filter((workflow) => !["approved", "archived"].includes(workflow.status));
  const candidates = writable.filter((workflow) => (
    workflow.eventKey === key || normalizedEventName(workflow.eventName) === key
  ));
  if (!candidates.length) {
    return { ok: false, reason: `No writable visual workflow matches filename key "${key}".` };
  }
  const latestYear = Math.max(...candidates.map((workflow) => workflow.targetYear));
  const latest = candidates
    .filter((workflow) => workflow.targetYear === latestYear)
    .sort((left, right) => right.revisionNumber - left.revisionNumber);
  if (latest.length > 1 && latest[0].revisionNumber === latest[1].revisionNumber) {
    return { ok: false, reason: `Filename key "${key}" matches more than one active workflow.` };
  }
  return { ok: true, workflow: latest[0] };
}
