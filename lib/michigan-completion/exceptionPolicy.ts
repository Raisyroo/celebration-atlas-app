import type { CompletionExceptionRecord } from "./types.ts";

export function isOpenBlockingCompletionException(
  exception: CompletionExceptionRecord,
) {
  return (
    ["open", "acknowledged"].includes(exception.status) &&
    exception.publicationBlocking
  );
}

export function completionExceptionAppliesToEvent(
  exception: CompletionExceptionRecord,
  eventKey: string,
) {
  return exception.eventKey === null || exception.eventKey === eventKey;
}

export function openBlockingCompletionExceptionsForEvent(
  exceptions: readonly CompletionExceptionRecord[],
  eventKey: string,
) {
  return exceptions.filter(
    (exception) =>
      completionExceptionAppliesToEvent(exception, eventKey) &&
      isOpenBlockingCompletionException(exception),
  );
}

export function completionEventHasStaleBlockingStage(args: {
  exceptions: readonly CompletionExceptionRecord[];
  eventKey: string;
  runEventId: string;
  checkpoints: ReadonlyArray<{
    runEventId: string;
    stageId: string;
    stageVersion: string;
  }>;
  stages: ReadonlyArray<{ id: string; version: string }>;
}) {
  const currentVersions = new Map(
    args.stages.map((stage) => [stage.id, stage.version]),
  );
  return openBlockingCompletionExceptionsForEvent(
    args.exceptions,
    args.eventKey,
  ).some((exception) => {
    if (exception.eventKey === null) return false;
    const currentVersion = currentVersions.get(exception.stageId);
    if (!currentVersion) return false;
    const retained = args.checkpoints.filter(
      (checkpoint) =>
        checkpoint.runEventId === args.runEventId &&
        checkpoint.stageId === exception.stageId,
    );
    return (
      retained.length > 0 &&
      retained.every(
        (checkpoint) => checkpoint.stageVersion !== currentVersion,
      )
    );
  });
}
