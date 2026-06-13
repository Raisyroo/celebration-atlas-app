#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const requiredScripts = [
  'atlas:next',
  'atlas:prompt',
  'atlas:check',
  'atlas:status',
  'atlas:complete',
  'atlas:handoff',
  'atlas:runbook',
];

const requiredFiles = [
  'docs/ATLAS_DEV_LOOP.md',
  'docs/ATLAS_TASK_QUEUE.md',
  'docs/ATLAS_CODEX_RUN_TEMPLATE.md',
  'scripts/atlas-next-task.mjs',
  'scripts/atlas-codex-prompt.mjs',
  'scripts/atlas-complete-task.mjs',
  'scripts/atlas-handoff.mjs',
  'scripts/atlas-runbook.mjs',
];

const trackedStatuses = [
  'next',
  'completed',
  'future',
  'blocked',
  'paused',
  'needs human review',
];

const packageRelativePath = 'package.json';
const queueRelativePath = 'docs/ATLAS_TASK_QUEUE.md';

const packageJson = readJsonFile(packageRelativePath);
const packageScripts = packageJson.scripts || {};
const scriptResults = requiredScripts.map((scriptName) => ({
  name: scriptName,
  present: typeof packageScripts[scriptName] === 'string' && packageScripts[scriptName].trim().length > 0,
}));
const fileResults = requiredFiles.map((filePath) => ({
  path: filePath,
  present: existsSync(resolve(process.cwd(), filePath)),
}));

let queueMarkdown = '';
const queueFileExists = fileResults.find((file) => file.path === queueRelativePath)?.present;
if (queueFileExists) {
  queueMarkdown = readFileSync(resolve(process.cwd(), queueRelativePath), 'utf8');
}

const currentQueue = queueMarkdown ? getSection(queueMarkdown, 'Current Queue') : '';
const tasks = parseTasks(currentQueue || queueMarkdown);
const statusCounts = countStatuses(tasks, trackedStatuses);
const nextTasks = tasks.filter((task) => normalize(task.status) === 'next');
const missingScripts = scriptResults.filter((script) => !script.present);
const missingFiles = fileResults.filter((file) => !file.present);

console.log('Atlas Dev Loop Doctor');
console.log('======================');
console.log('');

console.log('Package scripts');
console.log('---------------');
for (const script of scriptResults) {
  console.log(`${script.present ? 'OK' : 'MISSING'} ${script.name}`);
}
console.log('');

console.log('Required files');
console.log('--------------');
for (const file of fileResults) {
  console.log(`${file.present ? 'OK' : 'MISSING'} ${file.path}`);
}
console.log('');

console.log('Queue status counts');
console.log('-------------------');
for (const status of trackedStatuses) {
  console.log(`${status}: ${statusCounts[status]}`);
}
console.log('');

if (nextTasks.length === 1) {
  const nextTask = nextTasks[0];
  console.log('Current next task');
  console.log('-----------------');
  console.log(`Title: ${nextTask.title || 'Not specified'}`);
  console.log(`Type: ${nextTask.type || 'Not specified'}`);
  console.log(`Scope: ${nextTask.scope || 'Not specified'}`);
  console.log('');
} else if (nextTasks.length === 0) {
  console.log('WARNING: No task is marked Status: next.');
  console.log('');
} else {
  console.log(`WARNING: ${nextTasks.length} tasks are marked Status: next.`);
  for (const task of nextTasks) {
    console.log(`- ${task.title || 'Untitled task'}`);
  }
  console.log('');
}

if (missingScripts.length === 0 && missingFiles.length === 0 && nextTasks.length === 1) {
  console.log('Health: healthy');
  process.exit(0);
}

if (missingScripts.length === 0 && missingFiles.length === 0 && nextTasks.length === 0) {
  console.log('Health: warning - required loop files exist, but no next task is selected.');
  process.exit(0);
}

if (missingScripts.length > 0 || missingFiles.length > 0) {
  console.log('Health: unhealthy - required package scripts or files are missing.');
  process.exit(1);
}

console.log('Health: unhealthy - more than one next task is selected.');
process.exit(1);

function readJsonFile(relativePath) {
  const filePath = resolve(process.cwd(), relativePath);

  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      console.error(`Required file not found: ${relativePath}`);
      process.exit(1);
    }

    if (error instanceof SyntaxError) {
      console.error(`Unable to parse JSON file: ${relativePath}`);
      process.exit(1);
    }

    throw error;
  }
}

function getSection(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const headingPattern = new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, 'i');
  const startIndex = lines.findIndex((line) => headingPattern.test(line.trim()));

  if (startIndex === -1) {
    return '';
  }

  const sectionLines = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      break;
    }

    sectionLines.push(lines[index]);
  }

  return sectionLines.join('\n');
}

function parseTasks(markdown) {
  const taskHeadingPattern = /^###\s+(.+)$/gm;
  const headings = [...markdown.matchAll(taskHeadingPattern)];

  return headings.map((headingMatch, index) => {
    const startIndex = headingMatch.index || 0;
    const nextHeading = headings[index + 1];
    const endIndex = nextHeading?.index ?? markdown.length;
    const block = markdown.slice(startIndex, endIndex);
    const lines = block.split(/\r?\n/);

    return {
      title: headingMatch[1].trim(),
      type: readField(lines, 'Type'),
      status: readField(lines, 'Status'),
      scope: readField(lines, 'Scope'),
    };
  });
}

function readField(lines, fieldName) {
  const fieldPattern = new RegExp(
    `^-\\s+\\*\\*${escapeRegExp(fieldName)}:\\*\\*\\s*(.*)$`,
    'i',
  );
  const line = lines.find((candidate) => fieldPattern.test(candidate.trim()));

  if (!line) {
    return '';
  }

  return line.trim().match(fieldPattern)?.[1]?.trim() || '';
}

function countStatuses(tasks, statuses) {
  const counts = Object.fromEntries(statuses.map((status) => [status, 0]));

  for (const task of tasks) {
    const normalizedStatus = normalize(task.status);
    const countKey = normalizedStatus === 'complete' ? 'completed' : normalizedStatus;
    if (Object.hasOwn(counts, countKey)) {
      counts[countKey] += 1;
    }
  }

  return counts;
}

function normalize(value) {
  return value.trim().toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
