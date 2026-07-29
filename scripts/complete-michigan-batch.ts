import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import {
  parseMichiganCompletionManifest,
  stableCompletionJson,
} from "../lib/michigan-completion/manifest.ts";
import {
  executeMichiganCompletionRun,
} from "../lib/michigan-completion/orchestrator.ts";
import {
  createSupabaseMichiganCompletionExecutor,
} from "../lib/michigan-completion/runtime.ts";
import {
  createMichiganCompletionEditorialExecutor,
} from "../lib/michigan-completion/editorialExecutor.ts";
import {
  createSupabaseMichiganCompletionStore,
} from "../lib/michigan-completion/supabaseStore.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CliOptions = {
  help: boolean;
  resume: boolean;
  runId?: string;
  manifestPath?: string;
  county?: string;
  authorizePrivateWrites: boolean;
  deterministicOnly: boolean;
  concurrency: number;
  modelBudgetTokens: number;
  perEventModelBudgetTokens: number;
  actorIdentity: string;
  reportPath?: string;
};

function usage() {
  return [
    "Michigan Completion Operating Layer v1",
    "",
    "Start a persistent dry run:",
    "  npm run atlas:complete-michigan-batch -- --manifest <path> --county <county> --dry-run",
    "",
    "Resume a retained run:",
    "  npm run atlas:complete-michigan-batch -- --run-id <uuid> --resume",
    "",
    "Options:",
    "  --authorize-private-writes   Permit private candidate/synthesis/package writes; never publishes",
    "  --deterministic-only         Disable all model-assisted routes",
    "  --model-budget <tokens>      Total run token reservation cap (default 0)",
    "  --per-event-model-budget <tokens>  Default event token cap (default 0)",
    "  --concurrency <1-16>         Bounded event concurrency (default 3)",
    "  --actor <identity>           Audit identity (default michigan-completion-cli)",
    "  --report <path>              Structured JSON report destination",
    "  --help                       Show this help",
    "",
    "The command has no publication option. Dry-run is the default.",
  ].join("\n");
}

function requireValue(args: string[], index: number, flag: string) {
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
    throw new Error(`${flag} must be a non-negative integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${flag} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    help: false,
    resume: false,
    authorizePrivateWrites: false,
    deterministicOnly: false,
    concurrency: 3,
    modelBudgetTokens: 0,
    perEventModelBudgetTokens: 0,
    actorIdentity:
      process.env.ATLAS_COMPLETION_ACTOR?.trim() ||
      "michigan-completion-cli",
  };

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--help" || flag === "-h") {
      options.help = true;
    } else if (flag === "--resume") {
      options.resume = true;
    } else if (flag === "--run-id") {
      options.runId = requireValue(args, index, flag);
      index += 1;
    } else if (flag === "--manifest") {
      options.manifestPath = requireValue(args, index, flag);
      index += 1;
    } else if (flag === "--county") {
      options.county = requireValue(args, index, flag).trim().toLowerCase();
      index += 1;
    } else if (flag === "--dry-run") {
      // Dry-run is already the default. The explicit flag is accepted so the
      // operational command remains self-documenting.
    } else if (flag === "--authorize-private-writes") {
      options.authorizePrivateWrites = true;
    } else if (flag === "--deterministic-only") {
      options.deterministicOnly = true;
    } else if (flag === "--concurrency") {
      options.concurrency = boundedInteger(
        requireValue(args, index, flag),
        flag,
        1,
        16,
      );
      index += 1;
    } else if (flag === "--model-budget") {
      options.modelBudgetTokens = boundedInteger(
        requireValue(args, index, flag),
        flag,
        0,
        10_000_000,
      );
      index += 1;
    } else if (flag === "--per-event-model-budget") {
      options.perEventModelBudgetTokens = boundedInteger(
        requireValue(args, index, flag),
        flag,
        0,
        10_000_000,
      );
      index += 1;
    } else if (flag === "--actor") {
      options.actorIdentity = requireValue(args, index, flag).trim();
      index += 1;
    } else if (flag === "--report") {
      options.reportPath = requireValue(args, index, flag);
      index += 1;
    } else {
      throw new Error(`Unknown argument ${flag}.`);
    }
  }

  if (options.help) return options;
  if (!options.actorIdentity || options.actorIdentity.length > 300) {
    throw new Error("--actor must be 1 to 300 characters.");
  }
  if (options.resume) {
    if (!options.runId || !UUID_PATTERN.test(options.runId)) {
      throw new Error("--resume requires a valid --run-id UUID.");
    }
    if (options.manifestPath || options.county) {
      throw new Error(
        "A resume uses the immutable persisted manifest; omit --manifest and --county.",
      );
    }
    if (options.authorizePrivateWrites) {
      throw new Error(
        "A resumed run keeps its persisted dry-run authorization; omit --authorize-private-writes.",
      );
    }
  } else {
    if (!options.manifestPath || !options.county) {
      throw new Error(
        "Starting a run requires both --manifest and --county.",
      );
    }
    if (options.runId) {
      throw new Error("--run-id is valid only with --resume.");
    }
  }
  if (
    options.deterministicOnly &&
    (options.modelBudgetTokens > 0 ||
      options.perEventModelBudgetTokens > 0)
  ) {
    throw new Error(
      "Deterministic-only runs must use zero model budgets.",
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
      "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the managed environment.",
    );
  }
  return { url, key };
}

async function loadManifest(options: CliOptions) {
  if (!options.manifestPath) return undefined;
  const absolutePath = path.resolve(options.manifestPath);
  const parsedJson = JSON.parse(await readFile(absolutePath, "utf8")) as unknown;
  const parsed = parseMichiganCompletionManifest(parsedJson, {
    defaultPerEventModelBudgetTokens:
      options.perEventModelBudgetTokens,
  });
  if (!parsed.ok) {
    throw new Error(
      `Michigan completion manifest is invalid:\n- ${parsed.errors.join("\n- ")}`,
    );
  }
  if (parsed.value.countyCode !== options.county) {
    throw new Error(
      `--county ${options.county} does not match manifest county ${parsed.value.countyCode}.`,
    );
  }
  return parsed;
}

async function writeReport(
  report: Record<string, unknown>,
  runId: string,
  requestedPath?: string,
) {
  const reportPath = path.resolve(
    requestedPath ??
      path.join(
        "artifacts",
        "michigan-completion",
        runId,
        "run-report.json",
      ),
  );
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(
    reportPath,
    `${stableCompletionJson(report)}\n`,
    "utf8",
  );
  return reportPath;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return 0;
  }
  const manifest = await loadManifest(options);
  const { url, key } = serviceConfiguration();
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const store = createSupabaseMichiganCompletionStore(client);
  const executor = createSupabaseMichiganCompletionExecutor(client, {
    executeModel: createMichiganCompletionEditorialExecutor(),
  });
  const result = await executeMichiganCompletionRun({
    store,
    executor,
    ...(manifest
      ? {
          manifest: manifest.value,
          inputHash: manifest.inputHash,
        }
      : {}),
    ...(options.resume && options.runId
      ? { resumeRunId: options.runId }
      : {}),
    actorIdentity: options.actorIdentity,
    dryRun: !options.authorizePrivateWrites,
    deterministicOnly: options.deterministicOnly,
    maxConcurrency: options.concurrency,
    modelBudgetTokens: options.modelBudgetTokens,
    perEventModelBudgetTokens:
      options.perEventModelBudgetTokens,
  });
  const reportPath = await writeReport(
    result.report as unknown as Record<string, unknown>,
    result.snapshot.run.id,
    options.reportPath,
  );
  console.log(
    [
      `Michigan completion run ${result.snapshot.run.id}`,
      `status=${result.snapshot.run.status}`,
      `events=${result.report.counts.events}`,
      `completed=${result.report.counts.completed}`,
      `ready_for_review=${result.report.counts.readyForReview}`,
      `blocked=${result.report.counts.blocked}`,
      `failed=${result.report.counts.failed}`,
      `open_exceptions=${result.report.counts.openExceptions}`,
      `model_actions=${result.report.counts.modelActions}`,
      `model_usage_tokens=${result.report.counts.modelUsageTokens}`,
      "publication_invoked=false",
      `report=${reportPath}`,
    ].join(" "),
  );
  if (result.report.failure) {
    console.error(
      `Michigan completion failed: ${result.report.failure.errorMessage}`,
    );
  }
  return result.exitCode;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(
    error instanceof Error
      ? `Michigan completion failed: ${error.message}`
      : "Michigan completion failed with an unexpected error.",
  );
  process.exitCode = 1;
}
