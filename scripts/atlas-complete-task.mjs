#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const queueRelativePath = 'docs/ATLAS_TASK_QUEUE.md';
const queuePath = resolve(process.cwd(), queueRelativePath);
const dryRun = process.argv.includes('--dry-run');

if (!existsSync(queuePath)) {
  console.error(`Task queue file not found: ${queueRelativePath}`);
  process.exit(1);
}

const queueMarkdown = readFileSync(queuePath, 'utf8');
const currentQueueRange = getSectionRange(queueMarkdown, 'Current Queue');

if (!currentQueueRange) {
  console.log('No Current Queue section was found in docs/ATLAS_TASK_QUEUE.md.');
  process.exit(0);
}

const tasks = parseTasks(queueMarkdown, currentQueueRange);
const currentTask = tasks.find((task) => normalize(task.status.value) === 'next');

if (!currentTask) {
  console.log('No current task marked Status: next was found. Nothing was changed.');
  console.log('Run npm run atlas:next to review the current queue state.');
  process.exit(0);
}

const promotedTask = tasks.find(
  (task) => task.startIndex > currentTask.startIndex && normalize(task.status.value) === 'future',
);

const replacements = [
  { field: currentTask.status, value: 'completed' },
];

if (promotedTask) {
  replacements.push({ field: promotedTask.status, value: 'next' });
}

const updatedMarkdown = applyReplacements(queueMarkdown, replacements);

if (!dryRun) {
  writeFileSync(queuePath, updatedMarkdown, 'utf8');
}

console.log(dryRun ? 'Atlas task completion dry run' : 'Atlas task completion');
console.log('------------------------------');
console.log(`Completed task: ${currentTask.title}`);

if (promotedTask) {
  console.log(`Promoted next task: ${promotedTask.title}`);
} else {
  console.log('Current task completed. No future task was promoted to next.');
}

if (dryRun) {
  console.log('Dry run only. docs/ATLAS_TASK_QUEUE.md was not modified.');
}

console.log('Reminder: run npm run atlas:prompt to generate the prompt for the next task.');
process.exit(0);

function getSectionRange(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const headingPattern = new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, 'i');
  let offset = 0;
  let startIndex = -1;
  let contentStart = -1;

  for (const line of lines) {
    const lineLengthWithBreak = line.length + newlineLengthAt(markdown, offset + line.length);

    if (startIndex === -1 && headingPattern.test(line.trim())) {
      startIndex = offset;
      contentStart = offset + lineLengthWithBreak;
      break;
    }

    offset += lineLengthWithBreak;
  }

  if (startIndex === -1) {
    return null;
  }

  let endIndex = markdown.length;
  const rest = markdown.slice(contentStart);
  const nextHeadingMatch = rest.match(/^##\s+/m);

  if (nextHeadingMatch?.index !== undefined) {
    endIndex = contentStart + nextHeadingMatch.index;
  }

  return { startIndex: contentStart, endIndex };
}

function parseTasks(markdown, range) {
  const section = markdown.slice(range.startIndex, range.endIndex);
  const taskHeadingPattern = /^###\s+(.+)$/gm;
  const headings = [...section.matchAll(taskHeadingPattern)];

  return headings
    .map((headingMatch, index) => {
      const taskStart = range.startIndex + headingMatch.index;
      const nextHeading = headings[index + 1];
      const taskEnd = nextHeading ? range.startIndex + nextHeading.index : range.endIndex;
      const block = markdown.slice(taskStart, taskEnd);
      const status = readField(block, taskStart, 'Status');

      return {
        title: headingMatch[1].trim(),
        startIndex: taskStart,
        endIndex: taskEnd,
        status,
      };
    })
    .filter((task) => task.status);
}

function readField(block, blockStartIndex, fieldName) {
  const fieldPattern = new RegExp(
    `^(\\s*-\\s+\\*\\*${escapeRegExp(fieldName)}:\\*\\*\\s*)(.*?)(\\s*)$`,
    'im',
  );
  const match = fieldPattern.exec(block);

  if (!match || match.index === undefined) {
    return null;
  }

  return {
    value: match[2].trim(),
    valueStart: blockStartIndex + match.index + match[1].length,
    valueEnd: blockStartIndex + match.index + match[1].length + match[2].length,
  };
}

function applyReplacements(markdown, replacements) {
  return replacements
    .toSorted((left, right) => right.field.valueStart - left.field.valueStart)
    .reduce(
      (updatedMarkdown, replacement) => `${updatedMarkdown.slice(0, replacement.field.valueStart)}${replacement.value}${updatedMarkdown.slice(replacement.field.valueEnd)}`,
      markdown,
    );
}

function normalize(value) {
  return value.trim().toLowerCase();
}

function newlineLengthAt(markdown, index) {
  if (markdown[index] === '\r' && markdown[index + 1] === '\n') {
    return 2;
  }

  if (markdown[index] === '\n') {
    return 1;
  }

  return 0;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
