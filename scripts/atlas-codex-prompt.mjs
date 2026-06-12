#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const queueRelativePath = 'docs/ATLAS_TASK_QUEUE.md';
const templateRelativePath = 'docs/ATLAS_CODEX_RUN_TEMPLATE.md';
const queuePath = resolve(process.cwd(), queueRelativePath);
const templatePath = resolve(process.cwd(), templateRelativePath);

const queueMarkdown = readRequiredFile(queuePath, queueRelativePath);
const templateMarkdown = readRequiredFile(templatePath, templateRelativePath);

const currentQueue = getSection(queueMarkdown, 'Current Queue');
const tasks = parseTasks(currentQueue);
const nextTask = tasks.find((task) => normalize(task.status) === 'next');

if (!nextTask) {
  console.log('No task marked Status: next was found in docs/ATLAS_TASK_QUEUE.md.');
  console.log('Update the Current Queue when a human is ready to select the next Atlas Dev Loop task.');
  process.exit(0);
}

const protectedAreas = getProtectedAreas(templateMarkdown);

console.log(buildPrompt(nextTask, protectedAreas));
process.exit(0);

function readRequiredFile(path, relativePath) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      console.error(`Required file not found: ${relativePath}`);
      process.exit(1);
    }

    throw error;
  }
}

function buildPrompt(task, protectedAreas) {
  const taskProtectedAreas = task.protectedAreas || 'Not specified in task queue.';
  const verification = task.verification || 'No extra checks specified beyond the required Atlas checks.';
  const protectedAreaLines = protectedAreas.length > 0
    ? protectedAreas.map((area) => `- ${area}`).join('\n')
    : '- Not specified in template.';

  return `Read MASTER_ATLAS_CONTEXT.md first.
Then read:
- docs/ATLAS_DEV_LOOP.md
- docs/ATLAS_TASK_QUEUE.md
- docs/ATLAS_CODEX_RUN_TEMPLATE.md

Use npm run atlas:next to confirm the selected queue item.
Take only the next task marked Status: next.
Stop after one task.

Task title: ${task.title || 'Not specified'}
Task type: ${task.type || 'Not specified'}
Status: ${task.status || 'Not specified'}
Scope: ${task.scope || 'Not specified'}
Notes: ${task.notes || 'Not specified'}
Task protected files/areas: ${taskProtectedAreas}
Verification requirement: ${verification}

Protected areas from docs/ATLAS_CODEX_RUN_TEMPLATE.md:
${protectedAreaLines}

Rules:
- If the task is diagnostic, do not modify code.
- If the task is implementation, modify only the smallest safe file set.
- Preserve current app behavior unless the task explicitly changes it.
- Do not continue to any future task.
- Do not run autonomous agent-loop automation.

Run and report:
- npm run atlas:check
- npm run atlas:status
- npm run lint
- npm run build

Stop after one task.`;
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
  const taskBlocks = markdown
    .split(/\n(?=###\s+)/)
    .map((block) => block.trim())
    .filter((block) => /^###\s+/.test(block));

  return taskBlocks.map((block) => {
    const lines = block.split(/\r?\n/);
    const title = lines[0].replace(/^###\s+/, '').trim();

    return {
      title,
      type: readField(lines, 'Type'),
      status: readField(lines, 'Status'),
      scope: readField(lines, 'Scope'),
      protectedAreas: readField(lines, 'Protected files/areas'),
      notes: readField(lines, 'Notes'),
      verification: readField(lines, 'Verification'),
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

function getProtectedAreas(markdown) {
  const fencedTemplate = markdown.match(/```text\n([\s\S]*?)\n```/i)?.[1] || markdown;
  const lines = fencedTemplate.split(/\r?\n/);

  return lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.replace(/^-\s+/, '').trim())
    .filter((line) => isProtectedAreaLine(line));
}

function isProtectedAreaLine(line) {
  const normalizedLine = line.toLowerCase();

  return normalizedLine.includes('protected')
    || normalizedLine.includes('preserve current app behavior')
    || normalizedLine.includes('ui/map/projection/media')
    || normalizedLine.includes('romeo page')
    || normalizedLine.includes('atlas_events')
    || normalizedLine.includes('github actions')
    || normalizedLine.includes('automation code');
}

function normalize(value) {
  return value.trim().toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
