import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  parseFastTrackApprovedList,
  stableFastTrackJson,
} from "../lib/event-fast-track/manifest.ts";
import { planFastTrackApprovedList } from "../lib/event-fast-track/plan.ts";

type Options = {
  help: boolean;
  inputPath: string;
  outputPath?: string;
  preparedAt?: string;
};

function usage() {
  return [
    "Celebration Atlas approved-list Fast Track planner",
    "",
    "Create event-isolated Codex, Ultra, hero, and private-package handoffs:",
    "  npm run atlas:prepare-fast-track -- --input <approved-events.json>",
    "",
    "Options:",
    "  --input <path>         Approved-list JSON (required)",
    "  --output <directory>  Artifact destination (default: artifacts/fast-track/<list>/<hash>)",
    "  --prepared-at <ISO>   Fixed plan timestamp for a reproducible review artifact",
    "  --help                Show this help",
    "",
    "This command creates local private-preparation handoffs only. It has no database, approval, canonicalization, or publication action.",
  ].join("\n");
}

function valueAfter(args: string[], index: number, flag: string) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parseArgs(args: string[]): Options {
  const options: Options = { help: false, inputPath: "" };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else if (argument === "--input") {
      options.inputPath = valueAfter(args, index, argument);
      index += 1;
    } else if (argument === "--output") {
      options.outputPath = valueAfter(args, index, argument);
      index += 1;
    } else if (argument === "--prepared-at") {
      options.preparedAt = valueAfter(args, index, argument);
      index += 1;
    } else {
      throw new Error(`Unknown Fast Track argument ${argument}.`);
    }
  }
  if (!options.help && !options.inputPath) {
    throw new Error("--input is required.");
  }
  if (options.preparedAt && Number.isNaN(Date.parse(options.preparedAt))) {
    throw new Error("--prepared-at must be a valid timestamp.");
  }
  return options;
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const stableValue = JSON.parse(stableFastTrackJson(value)) as unknown;
  await writeFile(filePath, `${JSON.stringify(stableValue, null, 2)}\n`, "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const inputPath = path.resolve(options.inputPath);
  const raw = JSON.parse(await readFile(inputPath, "utf8")) as unknown;
  const parsed = parseFastTrackApprovedList(raw);
  if (!parsed.ok) {
    throw new Error(
      ["Approved-list validation failed:", ...parsed.errors.map((error) => `- ${error}`)].join(
        "\n",
      ),
    );
  }
  const plan = planFastTrackApprovedList({
    list: parsed.value,
    inputHash: parsed.inputHash,
    preparedAt: options.preparedAt,
  });
  const outputPath = path.resolve(
    options.outputPath ??
      path.join(
        "artifacts",
        "fast-track",
        parsed.value.listId,
        parsed.inputHash.slice(0, 16),
      ),
  );

  await writeJson(path.join(outputPath, "approved-list.normalized.json"), parsed.value);
  await writeJson(path.join(outputPath, "fast-track-plan.json"), plan);
  for (const event of plan.events) {
    const eventPath = path.join(outputPath, "events", event.eventKey);
    await writeJson(path.join(eventPath, "operator-plan.json"), event);
    await writeJson(path.join(eventPath, "ultra-handoff.json"), event.ultraHandoff);
    await writeJson(path.join(eventPath, "hero-handoff.json"), event.heroHandoff);
  }

  console.log(
    [
      `Prepared ${plan.events.length} isolated Fast Track event${plan.events.length === 1 ? "" : "s"}.`,
      `Plan: ${path.join(outputPath, "fast-track-plan.json")}`,
      "Ultra: one full-manifest handoff per event.",
      "Hero: one Luna Max skill handoff per event; alternatives only after rejection or low confidence.",
      "Publication actions: 0. Every event stops at explicit package approval.",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
