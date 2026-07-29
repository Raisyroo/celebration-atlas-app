# Michigan County Completion Operator

Status: implemented locally as a thin orchestration layer over the Michigan Completion Operating Layer. It does not add a second event pipeline and it does not authorize a county run, migration deployment, canonicalization, image work, approval, or publication.

## Operator command

The persistent county-level entry point is:

```powershell
npm run atlas:create-county-events -- macomb
```

The default is a deterministic, zero-model-budget dry run. It reads the registered retained inventory and current private control-plane state, writes bounded immutable manifests and one aggregate local report, then starts new dry runs or resumes only compatible exception-cleared dry runs through the existing Michigan Completion orchestrator.

To classify the county and create local manifests/report without starting or resuming a run:

```powershell
npm run atlas:create-county-events -- macomb --plan-only
```

Private workflow records require a separate explicit authorization:

```powershell
npm run atlas:create-county-events -- macomb --authorize-private-writes --actor <allowlisted-admin-email>
```

There is no model, image, canonicalization, approval, or publication flag. Model budgets are fixed at zero. Private mode is still limited to the existing candidate, retained-evidence, deterministic-synthesis, verification, private-package, private-preview, exception, checkpoint, and audit contracts.

## Inventory registry

`lib/michigan-completion/countyInventory.ts` is the fail-closed registry of approved county inventories. A registered inventory binds:

- state and county identity;
- the retained county-seed artifact path and exact byte hash;
- workbook file name and workbook hash;
- approved sheet name and sheet hash;
- expected record count;
- the complete 40-column county-seed row contract;
- explicit protected or editorial holds.

Macomb binds the retained 83-record `03_IMPORT_READY` inventory. Every row must retain its Clean ID, county, row fingerprint, source fingerprints, qualification, and keep decision. `--workbook <path>` optionally recomputes the workbook and approved-sheet fingerprints through the existing county-seed parser. A mismatch stops planning.

Adding another county requires a separately approved retained inventory and a new registry entry. It does not require another operator implementation.

## Complete county disposition

Planning classifies every approved inventory row exactly once:

| Classification | Operator behavior |
| --- | --- |
| `existing_canonical_or_completed` | Reuse the canonical/completed record; do not stage it. |
| `active_or_resumable` | Reuse the compatible run; resume only when it is partial and all exceptions are closed. |
| `protected_or_editorially_held` | Exclude it and retain the configured reason. |
| `disputed_or_ambiguous_identity` | Exclude it for human identity review. Fuzzy similarity never clears or merges identity. |
| `insufficient_for_staging` | Exclude it and report missing identity/source/location inputs. |
| `eligible_for_guarded_staging` | Put it in one bounded, hashed manifest using the generalized county guard. |
| `evidence_or_current_edition_verification_required` | Reuse the private candidate and continue only through retained evidence and human verification gates. |

The aggregate report retains, for all rows, the source record ID, selected canonical/candidate/run references, activity, status, reason, exception, source-bundle/synthesis/verification/package/visual references, current-edition requirement, location-verification requirement, and content/art/publication readiness.

## Batches, hashes, replay, and resume

- The default batch size is five; the accepted range is 1–500.
- Dry-run and private-write manifests have different immutable batch identities.
- Every manifest is validated by `parseMichiganCompletionManifest`.
- Every manifest uses the canonical Michigan Completion sorted-key SHA-256 implementation.
- Manifest candidate payloads use the existing county-seed staging adapter and guarded staging RPC.
- Existing candidates, canonical records, bundles, syntheses, verification cases, packages, visual workflows, compatible runs, checkpoints, exceptions, and reports are reused.
- A compatible exact run is never started again.
- A partial run is resumed only when all of its exceptions are closed. An open exception is reported and left untouched.
- One failed batch is recorded in the aggregate report; later independent batches continue.

Generated artifacts default to:

```text
artifacts/michigan-completion/<county>/county-operator/<mode>/<inventory-hash-prefix>/
artifacts/michigan-completion/<county>/county-operation-report-v1.json
```

The report has its own canonical hash and states the inventory hash, manifest hashes, executions, resumable runs, every record disposition, model usage, and zero image/publication actions.

## Deterministic private progression

Migration `026_generalize_county_completion_staging.sql` is the smallest database extension required by the county operator. It is forward-only and is not deployed by the operator.

It:

- preserves both historical guarded county dispositions;
- adds `reviewed_county_completion_manifest` only when the payload carries explicit private-write authorization and the reviewed inventory hash;
- adds a service-role-only deterministic identity-clearance action bound to the immutable completion run and candidate payload;
- rechecks canonical/candidate URL, normalized name and municipality, slug, source ownership, promotion, and duplicate state under lock;
- records a distinct-new-private-candidate decision without creating a canonical event or candidate match;
- treats fuzzy similarity only as a human-review signal.

After identity clearance, the existing source-bundle service composes a retained bundle from one official source plus bounded supporting sources. Per-support-source failure is retained without discarding successful captures. The existing verification service composes and submits an evidence-backed case for human review. The operator never verifies its own case. Package preparation requires an already verified case.

## Non-negotiable safeguards

The county operator:

- does not invent facts or identifiers;
- does not call a model;
- does not search for, generate, copy, upload, select, approve, or substitute imagery;
- does not create a canonical event;
- does not activate a public Event Page;
- does not alter public discovery;
- does not approve or publish a package;
- does not automatically resolve exceptions;
- does not retry a failed source capture or failed batch command;
- does not treat planning, synthesis, package preparation, or `publication_eligible` as publication.

The focused contract is validated by:

```powershell
npm run validate:county-completion-operator
```

That validator covers the complete 83-record Macomb disposition, stable hashes, exclusions, canonical/candidate reuse, generalized guarded payloads, deterministic identity decisions, bounded source composition, verification review, exact replay, safe resume, mixed batch continuation, aggregate reporting, and zero model/image/publication effects without running Macomb.
