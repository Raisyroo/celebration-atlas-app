import "server-only";
import { generateModelAssistedEditorialSynthesis } from "../event-intake/synthesis.ts";
import type {
  CompletionStageExecutor,
} from "./types.ts";

export function createMichiganCompletionEditorialExecutor(): NonNullable<
  CompletionStageExecutor["executeModel"]
> {
  return async (request, context) => {
    if (context.dryRun || context.deterministicOnly) {
      throw new Error(
        "Model execution is disabled for dry-run and deterministic-only completion runs.",
      );
    }
    if (request.processorId !== "event-source-editorial") {
      throw new Error(
        `Unsupported Michigan completion model processor ${request.processorId}.`,
      );
    }
    if (request.maximumAttempts !== 1) {
      throw new Error(
        "The v1 editorial route permits exactly one pre-budgeted attempt.",
      );
    }
    const deterministic = context.priorOutputs.get(
      "deterministic_synthesis",
    );
    const synthesisId =
      typeof deterministic?.synthesisId === "string"
        ? deterministic.synthesisId
        : "";
    if (!synthesisId) {
      throw new Error(
        "Editorial assistance requires a retained deterministic parent synthesis.",
      );
    }

    const generated = await generateModelAssistedEditorialSynthesis({
      synthesisId,
      actorIdentity: context.actorIdentity,
      configuredModel: request.configuredModel,
      maxCompletionTokens: request.estimatedOutputTokens,
    });
    if (
      generated.modelAction.requestedModel !== request.configuredModel
    ) {
      throw new Error(
        "The editorial provider did not honor the explicitly reserved model route.",
      );
    }
    return {
      output: {
        editorialAccepted: true,
        deterministicContentRetained: true,
        synthesisId: generated.proposal.synthesisId,
        manifestProposal: generated.proposal.manifestProposal,
        reconciledProfile: generated.proposal.reconciledProfile,
        conflicts: generated.proposal.conflicts,
        validationReport: generated.proposal.validationReport,
        isManifestValid: generated.proposal.isManifestValid,
        qualityScore: generated.proposal.qualityScore,
        routeId: request.routeId,
        configuredModel: request.configuredModel,
      },
      providerResponseId: generated.modelAction.responseId,
      actualInputTokens: generated.modelAction.inputTokens,
      actualOutputTokens: generated.modelAction.outputTokens,
      links: {
        synthesisId: generated.proposal.synthesisId,
        publicationEligible: false,
      },
    };
  };
}
