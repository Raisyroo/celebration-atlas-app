import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import {
  buildCountyOperationReport,
  executeCountyOperation,
  planCountyOperation,
} from "../lib/michigan-completion/countyOperator.ts";
import { loadApprovedCountyInventory } from "../lib/michigan-completion/countyInventory.ts";
import { loadSupabaseCountyOperatorSnapshot } from "../lib/michigan-completion/countyOperatorSupabase.ts";
import { createMichiganCompletionEditorialExecutor } from "../lib/michigan-completion/editorialExecutor.ts";
import { stableCompletionJson } from "../lib/michigan-completion/manifest.ts";
import { executeMichiganCompletionRun } from "../lib/michigan-completion/orchestrator.ts";
import { createSupabaseMichiganCompletionExecutor } from "../lib/michigan-completion/runtime.ts";
import { createSupabaseMichiganCompletionStore } from "../lib/michigan-completion/supabaseStore.ts";

type CountyCliOptions = {
  help: boolean;
  countyInput: string;
  planOnly: boolean;
  authorizePrivateWrites: boolean;
  actorIdentity: string;
  actorProvided: boolean;
  batchSize: number;
  concurrency: number;
  workbookPath?: string;
  reportPath?: string;
  manifestDirectory?: string;
};

function usage() {
  return [
    "Michigan county completion operator",
    "",
    "Classify a county and start or resume its default-safe dry runs:",
    "  npm run atlas:create-county-events -- macomb",
    "",
    "Prepare classification, manifests, and the aggregate report without a run:",
    "  npm run atlas:create-county-events -- macomb --plan-only",
    "",
    "Authorize private workflow records after reviewing the county plan:",
    "  npm run atlas:create-county-events -- macomb --authorize-private-writes --actor <allowlisted-admin-email>",
    "",
    "Options:",
    "  --plan-only                    Do not start or resume completion runs",
    "  --authorize-private-writes     Permit only the existing private completion effects",
    "  --actor <identity>             Required explicitly for private writes",
    "  --batch-size <1-500>           Events per immutable completion manifest (default 5)",
    "  --concurrency <1-16>           Completion event concurrency (default 1)",
    "  --workbook <path>              Recompute and verify the registered workbook/sheet fingerprints",
    "  --report <path>                Aggregate county report destination",
    "  --manifest-directory <path>    Generated immutable manifest directory",
    "  --dry-run                      Accepted for clarity; dry-run is the default",
    "  --help                         Show this help",
    "",
    "Model budgets are fixed at zero. The command has no image, canonicalization, approval, or publication option.",
  ].join("\n");
}

function valueAfter(args: string[], index: number, flag: string) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function boundedInteger(
  value: string,
  flag: string,
  minimum: number,
  maximum: number,
) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${flag} must be an integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${flag} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function parseArgs(args: string[]): CountyCliOptions {
  const options: CountyCliOptions = {
    help: false,
    countyInput: "",
    planOnly: false,
    authorizePrivateWrites: false,
    actorIdentity:
      process.env.ATLAS_COMPLETION_ACTOR?.trim() ||
      "michigan-county-completion-cli",
    actorProvided: false,
    batchSize: 5,
    concurrency: 1,
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith("-") && !options.countyInput) {
      options.countyInput = argument;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else if (argument === "--plan-only") {
      options.planOnly = true;
    } else if (argument === "--dry-run") {
      // Dry-run is the default and remains explicit in the generated plan.
    } else if (argument === "--authorize-private-writes") {
      options.authorizePrivateWrites = true;
    } else if (argument === "--actor") {
      options.actorIdentity = valueAfter(args, index, argument).trim();
      options.actorProvided = true;
      index += 1;
    } else if (argument === "--batch-size") {
      options.batchSize = boundedInteger(
        valueAfter(args, index, argument),
        argument,
        1,
        500,
      );
      index += 1;
    } else if (argument === "--concurrency") {
      options.concurrency = boundedInteger(
        valueAfter(args, index, argument),
        argument,
        1,
        16,
      );
      index += 1;
    } else if (argument === "--workbook") {
      options.workbookPath = valueAfter(args, index, argument);
      index += 1;
    } else if (argument === "--report") {
      options.reportPath = valueAfter(args, index, argument);
      index += 1;
    } else if (argument === "--manifest-directory") {
      options.manifestDirectory = valueAfter(args, index, argument);
      index += 1;
    } else {
      throw new Error(`Unknown county operator argument ${argument}.`);
    }
  }
  if (options.help) return options;
  if (!options.countyInput) {
    throw new Error("A registered Michigan county name or code is required.");
  }
  if (!options.actorIdentity || options.actorIdentity.length > 300) {
    throw new Error("--actor must be 1 to 300 characters.");
  }
  if (options.authorizePrivateWrites && !options.actorProvided) {
    throw new Error(
      "--authorize-private-writes requires an explicit --actor identity.",
    );
  }
  return options;
}

function serviceConfiguration() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "Missing Supabase URL or service-role credentials in the managed environment.",
    );
  }
  return { url, key };
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${stableCompletionJson(value)}\n`, "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return 0;
  }
  const repositoryRoot = process.cwd();
  const inventory = await loadApprovedCountyInventory({
    repositoryRoot,
    countyInput: options.countyInput,
    workbookPath: options.workbookPath,
  });
  const { url, key } = serviceConfiguration();
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const store = createSupabaseMichiganCompletionStore(client);
  const snapshot = await loadSupabaseCountyOperatorSnapshot({
    client,
    store,
    countyCode: inventory.config.countyCode,
  });
  const plan = planCountyOperation({
    inventory,
    snapshot,
    authorizePrivateWrites: options.authorizePrivateWrites,
    batchSize: options.batchSize,
    concurrency: options.concurrency,
  });
  const mode = options.authorizePrivateWrites ? "private" : "dry-run";
  const manifestDirectory = path.resolve(
    options.manifestDirectory ??
      path.join(
        "artifacts",
        "michigan-completion",
        inventory.config.countyCode,
        "county-operator",
        mode,
        inventory.inventorySha256.slice(0, 16),
      ),
  );
  for (const [index, batch] of plan.batches.entries()) {
    await writeJson(
      path.join(
        manifestDirectory,
        `batch-${String(index + 1).padStart(3, "0")}-${batch.manifestHash.slice(0, 16)}.json`,
      ),
      batch.manifest,
    );
  }

  const executor = createSupabaseMichiganCompletionExecutor(client, {
    executeModel: createMichiganCompletionEditorialExecutor(),
  });
  const operation = await executeCountyOperation({
    plan,
    planOnly: options.planOnly,
    async startBatch(batch) {
      const result = await executeMichiganCompletionRun({
        store,
        executor,
        manifest: batch.manifest,
        inputHash: batch.manifestHash,
        actorIdentity: options.actorIdentity,
        dryRun: !options.authorizePrivateWrites,
        deterministicOnly: true,
        maxConcurrency: options.concurrency,
        modelBudgetTokens: 0,
        perEventModelBudgetTokens: 0,
      });
      return {
        runId: result.snapshot.run.id,
        exitCode: result.exitCode,
        snapshot: result.snapshot,
        report: result.report,
      };
    },
    async resumeRun(runId) {
      const result = await executeMichiganCompletionRun({
        store,
        executor,
        resumeRunId: runId,
        actorIdentity: options.actorIdentity,
      });
      return {
        runId: result.snapshot.run.id,
        exitCode: result.exitCode,
        snapshot: result.snapshot,
        report: result.report,
      };
    },
  });
  const report = operation.report ?? buildCountyOperationReport({ plan });
  const reportPath = path.resolve(
    options.reportPath ??
      path.join(
        "artifacts",
        "michigan-completion",
        inventory.config.countyCode,
        "county-operation-report-v1.json",
      ),
  );
  await writeJson(reportPath, report);

  console.log(
    [
      `Michigan county operator county=${inventory.config.countyCode}`,
      `records=${report.counts.total}`,
      `eligible=${report.counts.eligible_for_guarded_staging}`,
      `resumable=${report.counts.active_or_resumable}`,
      `protected=${report.counts.protected_or_editorially_held}`,
      `insufficient=${report.counts.insufficient_for_staging}`,
      `batches=${report.counts.batches}`,
      `started=${report.counts.startedRuns}`,
      `resumed=${report.counts.resumedRuns}`,
      `model_usage_tokens=${report.counts.modelUsageTokens}`,
      "image_actions=0",
      "publication_actions=0",
      `report=${reportPath}`,
    ].join(" "),
  );
  if (report.counts.runFailures > 0) return 1;
  if (
    report.records.some(
      (record) =>
        record.activity === "exception" ||
        record.status === "active_or_resumable",
    )
  ) {
    return 2;
  }
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(
    error instanceof Error
      ? `Michigan county operator failed: ${error.message}`
      : "Michigan county operator failed with an unexpected error.",
  );
  process.exitCode = 1;
}
