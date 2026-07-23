import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDirectory = path.join(root, 'supabase', 'migrations');
const migrationFiles = fs
  .readdirSync(migrationsDirectory)
  .filter((name) => /^\d+_[a-z0-9_]+\.sql$/i.test(name))
  .sort();

assert(migrationFiles.length > 0, 'No numbered Supabase migrations were found');

const migrations = migrationFiles.map((name) => ({
  name,
  sql: fs.readFileSync(path.join(migrationsDirectory, name), 'utf8'),
}));
const combinedSql = migrations.map(({ sql }) => sql).join('\n');
const guardrail = migrations.find(({ name }) => name.startsWith('016_'));

assert(guardrail, 'Migration 016 public-schema security guardrail is missing');
for (const requiredFragment of [
  'revoke execute on functions from public, anon, authenticated',
  'revoke all privileges on tables from public, anon, authenticated',
  'a public table lacks RLS',
  'an application routine is browser-executable',
]) {
  assert(
    guardrail.sql.includes(requiredFragment),
    `Migration 016 is missing guardrail: ${requiredFragment}`,
  );
}

const createdTables = [
  ...combinedSql.matchAll(
    /\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/gi,
  ),
].map((match) => match[1]);

for (const tableName of new Set(createdTables)) {
  const rlsPattern = new RegExp(
    `\\balter\\s+table\\s+(?:if\\s+exists\\s+)?public\\.${tableName}\\s+enable\\s+row\\s+level\\s+security\\b`,
    'i',
  );
  assert(rlsPattern.test(combinedSql), `Public table ${tableName} is created without enabling RLS`);
}

const createdRoutines = [
  ...combinedSql.matchAll(
    /\bcreate\s+(?:or\s+replace\s+)?(function|procedure)\s+public\.([a-z_][a-z0-9_]*)\s*\(/gi,
  ),
].map((match) => ({ kind: match[1].toLowerCase(), name: match[2] }));

for (const routine of createdRoutines) {
  const revokePattern = new RegExp(
    `\\brevoke\\s+(?:all(?:\\s+privileges)?|execute)\\s+on\\s+${routine.kind}\\s+public\\.${routine.name}\\s*\\([^;]*?\\)\\s+from\\s+([^;]+);`,
    'gi',
  );
  const revocations = [...combinedSql.matchAll(revokePattern)];
  const hasCompleteBrowserRevoke = revocations.some((match) => {
    const grantees = new Set(match[1].toLowerCase().split(',').map((value) => value.trim()));
    return ['public', 'anon', 'authenticated'].every((role) => grantees.has(role));
  });
  assert(
    hasCompleteBrowserRevoke,
    `Public ${routine.kind} ${routine.name} lacks an explicit PUBLIC, anon, authenticated EXECUTE revoke`,
  );
}

const browserGrantPattern =
  /\bgrant\s+execute\s+on\s+(?:function|procedure|routine)\s+public\.[^;]+?\s+to\s+([^;]+);/gi;
for (const match of combinedSql.matchAll(browserGrantPattern)) {
  const grantees = new Set(match[1].toLowerCase().split(',').map((value) => value.trim()));
  const browserGrantee = ['public', 'anon', 'authenticated'].find((role) => grantees.has(role));
  assert(!browserGrantee, `A public application routine grants EXECUTE to ${browserGrantee}`);
}

console.log(
  `Public-schema security validation passed (${new Set(createdTables).size} tables, ${createdRoutines.length} routine definitions).`,
);
