#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const queuePath = resolve(process.cwd(), 'docs/ATLAS_TASK_QUEUE.md');

let queueMarkdown;
try {
  queueMarkdown = readFileSync(queuePath, 'utf8');
} catch (error) {
  if (error && error.code === 'ENOENT') {
    console.error('Task queue file not found: docs/ATLAS_TASK_QUEUE.md');
    process.exit(1);
  }

  throw error;
}

const currentQueue = getSection(queueMarkdown, 'Current Queue');
const tasks = parseTasks(currentQueue);
const nextTask = tasks.find((task) => normalize(task.status) === 'next');

if (!nextTask) {
  console.log('No task marked Status: next was found.');
  process.exit(0);
}

console.log('Next Atlas task');
console.log('---------------');
console.log(`Title: ${nextTask.title}`);
console.log(`Type: ${nextTask.type || 'Not specified'}`);
console.log(`Status: ${nextTask.status || 'Not specified'}`);
console.log(`Scope: ${nextTask.scope || 'Not specified'}`);
console.log(`Notes: ${nextTask.notes || 'Not specified'}`);

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
    .filter(Boolean);

  return taskBlocks.map((block) => {
    const lines = block.split(/\r?\n/);
    const title = lines[0].replace(/^###\s+/, '').trim();

    return {
      title,
      type: readField(lines, 'Type'),
      status: readField(lines, 'Status'),
      scope: readField(lines, 'Scope'),
      notes: readField(lines, 'Notes'),
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

function normalize(value) {
  return value.trim().toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
