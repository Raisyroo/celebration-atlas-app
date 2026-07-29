export type DeterministicIdentityClearanceInput = {
  needsReview: boolean;
  duplicateStatus: string;
  countyDisposition: string;
  executionApproval: string;
  reviewedInventoryHash: string;
  exactCollisionIds: string[];
  fuzzyReviewSignals: string[];
};

export type DeterministicIdentityClearanceDecision = {
  disposition: "already_clear" | "clear_distinct_private_candidate" | "human_review";
  reasonCode:
    | "candidate_already_clear"
    | "disputed_duplicate_state"
    | "exact_identity_collision"
    | "fuzzy_signal_requires_review"
    | "outside_reviewed_county_scope"
    | "deterministic_clean_no_collision";
};

export function evaluateDeterministicIdentityClearance(
  input: DeterministicIdentityClearanceInput,
): DeterministicIdentityClearanceDecision {
  if (!input.needsReview) {
    return {
      disposition: "already_clear",
      reasonCode: "candidate_already_clear",
    };
  }
  if (
    ["possible_duplicate", "duplicate", "merged"].includes(
      input.duplicateStatus,
    )
  ) {
    return {
      disposition: "human_review",
      reasonCode: "disputed_duplicate_state",
    };
  }
  if (input.exactCollisionIds.length) {
    return {
      disposition: "human_review",
      reasonCode: "exact_identity_collision",
    };
  }
  if (input.fuzzyReviewSignals.length) {
    return {
      disposition: "human_review",
      reasonCode: "fuzzy_signal_requires_review",
    };
  }
  if (
    input.countyDisposition !== "reviewed_county_completion_manifest" ||
    input.executionApproval !== "private_writes_explicitly_authorized" ||
    !/^[0-9a-f]{64}$/.test(input.reviewedInventoryHash)
  ) {
    return {
      disposition: "human_review",
      reasonCode: "outside_reviewed_county_scope",
    };
  }
  return {
    disposition: "clear_distinct_private_candidate",
    reasonCode: "deterministic_clean_no_collision",
  };
}
