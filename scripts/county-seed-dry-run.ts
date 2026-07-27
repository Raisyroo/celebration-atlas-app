import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { inspectDeployedSchema, loadExistingMatchRecords } from "../lib/county-seeds/deployedSchema.ts";
import { matchCountySeeds } from "../lib/county-seeds/matching.ts";
import { parseCountySeedWorkbook } from "../lib/county-seeds/workbook.ts";
import type {
  CountySeedWorkbook,
  SchemaParityReport,
  SeedClassification,
  SeedMatchResult,
} from "../lib/county-seeds/types.ts";

const CLASSIFICATIONS: SeedClassification[] = [
  "Existing canonical event — likely match",
  "Existing candidate — likely match",
  "New candidate",
  "Possible alias or duplicate",
  "Insufficient information",
  "Requires current-edition verification",
  "Requires geocoding or address resolution",
  "Blocked by schema or data conflict",
];

function parseArguments(args: string[]) {
  const workbookPath = args.find((argument) => !argument.startsWith("--"));
  if (!workbookPath) {
    throw new Error("Usage: npm run dry-run:county-seeds -- <workbook.xlsx> [--county-code macomb] [--output artifacts/county-seeds/macomb]");
  }
  const option = (name: string, fallback: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] ?? fallback : fallback;
  };
  return {
    workbookPath: path.resolve(workbookPath),
    countyCode: option("--county-code", "macomb").toLowerCase(),
    outputDirectory: path.resolve(option("--output", path.join("artifacts", "county-seeds", "macomb"))),
  };
}

function countClassifications(matches: SeedMatchResult[]) {
  return Object.fromEntries(CLASSIFICATIONS.map((classification) => [
    classification,
    matches.filter((match) => match.classifications.includes(classification)).length,
  ]));
}

function countPrimary(matches: SeedMatchResult[]) {
  return Object.fromEntries(CLASSIFICATIONS.map((classification) => [
    classification,
    matches.filter((match) => match.primaryClassification === classification).length,
  ]));
}

function schemaReportMarkdown(report: SchemaParityReport) {
  const rows = report.inspectedTables.map((table) => (
    `| ${table.table} | ${table.deployed ? "Yes" : "No"} | ${table.missingTrackedColumns.join(", ") || "None"} | ${table.unexpectedDeployedColumns.join(", ") || "None"} | ${table.requiredColumns.join(", ")} |`
  ));
  const constraintRows = report.inspectedTables.map((table) => {
    const keyNotes = Object.entries(table.columns).flatMap(([column, definition]) => {
      const notes: string[] = [];
      if (definition.description?.includes("<pk/>")) notes.push(`${column} primary key`);
      const foreign = definition.description?.match(/<fk table='([^']+)' column='([^']+)'\/>/);
      if (foreign) notes.push(`${column} → ${foreign[1]}.${foreign[2]}`);
      return notes;
    });
    const defaults = Object.entries(table.columns)
      .filter(([, definition]) => definition.default !== undefined)
      .map(([column, definition]) => `${column}=${String(definition.default)}`);
    return `| ${table.table} | ${keyNotes.join("; ") || "None exposed"} | ${defaults.join("; ") || "None exposed"} |`;
  });
  return `# County seed schema-parity report

This report is generated through read-only GET requests to the deployed PostgREST OpenAPI document. It contains no credentials or secret configuration.

| Table | Deployed | Missing tracked columns | Additional deployed columns | Deployed required columns |
| --- | --- | --- | --- | --- |
${rows.join("\n")}

## Exposed keys and defaults

| Table | Primary/foreign-key relationships | Defaults exposed by deployed schema |
| --- | --- | --- |
${constraintRows.join("\n")}

## Repository parity

- Foundational migration 004 tracked: ${report.foundationalMigrationTracked ? "Yes" : "No"}
- Generated database types tracked: ${report.generatedDatabaseTypesTracked ? "Yes" : "No"}
- Column blockers: ${report.blockers.length ? report.blockers.join("; ") : "None"}

The deployed tables satisfy the column contract used by tracked migrations 010 and 011. The unresolved parity gap is that the foundational migration and generated database types are absent from the repository, so the deployed schema remains authoritative for the original table definitions.

## Inspection limits

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}
`;
}

function matchLabel(match: SeedMatchResult) {
  const canonical = match.proposedCanonicalMatch;
  const candidate = match.proposedCandidateMatch;
  if (canonical) return `${canonical.name} (canonical ${canonical.id})`;
  if (candidate) return `${candidate.name} (candidate ${candidate.id})`;
  return "None";
}

function humanReport(args: {
  workbook: CountySeedWorkbook;
  schema: SchemaParityReport;
  matches: SeedMatchResult[];
  eventCount: number;
  candidateCount: number;
  batches: ReturnType<typeof recommendBatches>;
}) {
  const primary = countPrimary(args.matches);
  const overlapping = countClassifications(args.matches);
  const likelyMatches = args.matches.filter((match) => (
    match.proposedCanonicalMatch || match.proposedCandidateMatch
  ));
  const recordRows = args.matches.map((match) => {
    const currentEdition = match.classifications.includes("Requires current-edition verification") ? "Yes" : "No";
    const geocoding = match.classifications.includes("Requires geocoding or address resolution") ? "Yes" : "No";
    return `| ${match.cleanId} | ${match.spreadsheetEventName.replaceAll("|", "\\|")} | ${match.primaryClassification} | ${matchLabel(match).replaceAll("|", "\\|")} | ${currentEdition} | ${geocoding} |`;
  });
  const proposedRows = likelyMatches.map((match) => {
    const warnings = match.conflictWarnings.join("; ") || "None";
    return `### ${match.cleanId} — ${match.spreadsheetEventName}

- Proposed canonical: ${match.proposedCanonicalMatch ? `${match.proposedCanonicalMatch.name} (${match.proposedCanonicalMatch.id})` : "None"}
- Proposed candidate: ${match.proposedCandidateMatch ? `${match.proposedCandidateMatch.name} (${match.proposedCandidateMatch.id})` : "None"}
- Signals: ${match.matchSignals.map((signal) => `${signal.kind} (${signal.score.toFixed(3)})`).join(", ") || "None"}
- Confidence: ${match.confidence}
- Conflict warnings: ${warnings}
- Recommended decision: ${match.recommendedHumanDecision}
`;
  });
  return `# Macomb County seed dry-run

## Scope and safeguards

- Source sheet: \`${args.workbook.sourceSheet}\`
- Approved seed rows: ${args.workbook.seeds.length}
- Workbook SHA-256: \`${args.workbook.workbookFingerprint}\`
- Approved-sheet SHA-256: \`${args.workbook.approvedSheetFingerprint}\`
- Existing Michigan canonical events read: ${args.eventCount}
- Existing Michigan candidates read: ${args.candidateCount}
- Supabase writes: None
- Candidate creation: None
- Canonical event changes: None
- Event research, publication, and clustering: Not performed

## Classification summary

Primary classifications are exclusive; requirement classifications overlap.

| Classification | Primary | Any classification |
| --- | ---: | ---: |
${CLASSIFICATIONS.map((classification) => `| ${classification} | ${primary[classification]} | ${overlapping[classification]} |`).join("\n")}

## Proposed match report

${proposedRows.join("\n") || "No deterministic proposed matches."}

## Proposed batches

### Batch 0 — Match reconciliation

${args.batches.batch0.map((item) => `- ${item.cleanId}: ${item.name}`).join("\n")}

### Batch 1 — New-candidate pilot

${args.batches.batch1.map((item) => `- ${item.cleanId}: ${item.name} — ${item.municipality}`).join("\n")}

This seven-event northern Macomb group is compact, high-confidence, address-complete, source-backed in the workbook, and marked with announced 2026 editions. Exact current dates and all source evidence still require verification before any staging or publication.

### Recommended first future clustering municipality

${args.batches.clusteringRecommendation}

## All seed classifications

| Clean ID | Event | Primary classification | Proposed match | Current-edition verification | Geocoding/address resolution |
| --- | --- | --- | --- | --- | --- |
${recordRows.join("\n")}

## Schema parity

${args.schema.blockers.length ? `Blocked: ${args.schema.blockers.join("; ")}` : "No deployed column mismatch blocks the dry-run system."} Migration 004 and generated database types remain absent from the tracked repository.
`;
}

function recommendBatches(workbook: CountySeedWorkbook) {
  const byId = new Map(workbook.seeds.map((seed) => [seed.cleanId, seed]));
  const requireSeed = (cleanId: string) => {
    const seed = byId.get(cleanId);
    if (!seed) throw new Error(`Required batch seed ${cleanId} is missing.`);
    return { cleanId, name: seed.candidateName, municipality: seed.municipality };
  };
  return {
    batch0: ["MAC-001", "MAC-050"].map(requireSeed),
    batch1: ["MAC-003", "MAC-004", "MAC-008", "MAC-011", "MAC-041", "MAC-042", "MAC-049"].map(requireSeed),
    clusteringRecommendation: "Mount Clemens is the best first municipality-level clustering test after its records are completed because the approved workbook retains 14 distinct event series there—the county’s densest municipal group. This recommendation does not begin clustering work.",
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const [workbook, schema, existing] = await Promise.all([
    parseCountySeedWorkbook(options.workbookPath, options.countyCode),
    inspectDeployedSchema(),
    loadExistingMatchRecords(),
  ]);
  const matches = matchCountySeeds(workbook.seeds, existing.events, existing.candidates, schema.blockers.length > 0);
  const batches = recommendBatches(workbook);
  const artifact = {
    schemaVersion: 1,
    mode: "read-only-dry-run",
    source: {
      workbookFileName: workbook.workbookFileName,
      workbookFingerprint: workbook.workbookFingerprint,
      approvedSheetFingerprint: workbook.approvedSheetFingerprint,
      sourceSheet: workbook.sourceSheet,
      rowCount: workbook.seeds.length,
    },
    safeguards: {
      supabaseWrites: false,
      candidateCreation: false,
      canonicalEventChanges: false,
      eventResearch: false,
      publication: false,
      clustering: false,
    },
    schemaParity: schema,
    readSnapshot: {
      canonicalEventCount: existing.events.length,
      candidateCount: existing.candidates.length,
    },
    summary: {
      primaryClassifications: countPrimary(matches),
      classifications: countClassifications(matches),
    },
    batches,
    records: workbook.seeds.map((seed, index) => ({
      seed,
      match: matches[index],
    })),
  };
  await mkdir(options.outputDirectory, { recursive: true });
  const jsonPath = path.join(options.outputDirectory, "county-seed-dry-run.json");
  const reportPath = path.join(options.outputDirectory, "county-seed-dry-run.md");
  const schemaPath = path.join(options.outputDirectory, "schema-parity.md");
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8"),
    writeFile(reportPath, humanReport({
      workbook,
      schema,
      matches,
      eventCount: existing.events.length,
      candidateCount: existing.candidates.length,
      batches,
    }), "utf8"),
    writeFile(schemaPath, schemaReportMarkdown(schema), "utf8"),
  ]);
  console.log(`County seed dry run complete: ${workbook.seeds.length} seeds, ${matches.filter((match) => match.proposedCanonicalMatch).length} likely canonical matches.`);
  console.log(`Machine artifact: ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`Human report: ${path.relative(process.cwd(), reportPath)}`);
  console.log(`Schema parity: ${path.relative(process.cwd(), schemaPath)}`);
  console.log("Supabase writes: 0.");
}

await main();
