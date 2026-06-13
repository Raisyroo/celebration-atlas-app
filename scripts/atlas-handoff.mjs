#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const queueRelativePath = 'docs/ATLAS_TASK_QUEUE.md';
const queuePath = resolve(process.cwd(), queueRelativePath);

if (!existsSync(queuePath)) {
  console.error(`Task queue file not found: ${queueRelativePath}`);
  process.exit(1);
}

const queueMarkdown = readFileSync(queuePath, 'utf8');
const currentQueue = getSection(queueMarkdown, 'Current Queue');
const tasks = parseTasks(currentQueue || queueMarkdown);
const nextTask = tasks.find((task) => normalize(task.status) === 'next');
const completedTasks = tasks.filter((task) => isCompletedStatus(task.status));
const blockedOrPausedTasks = tasks.filter((task) => isBlockedPausedOrReviewStatus(task.status));
const lastCompletedTask = completedTasks.at(-1);

console.log('Atlas Dev Loop handoff');
console.log('-----------------------');

if (nextTask) {
  console.log('Current next task');
  console.log(`Title: ${nextTask.title || 'Not specified'}`);
  console.log(`Task type: ${nextTask.type || 'Not specified'}`);
  console.log(`Scope: ${nextTask.scope || 'Not specified'}`);
  console.log(`Notes: ${nextTask.notes || 'Not specified'}`);
  console.log('');
  console.log(`Last completed task: ${lastCompletedTask?.title || 'Not detectable'}`);
  console.log(`Blocked / paused tasks count: ${blockedOrPausedTasks.length}`);

  if (blockedOrPausedTasks.length > 0) {
    console.log('Blocked / paused tasks:');
    for (const task of blockedOrPausedTasks) {
      console.log(`- ${task.title} (${task.status || 'status not specified'})`);
    }
  }

  console.log('');
  console.log('Suggested next command:');
  console.log('npm run atlas:prompt');
  process.exit(0);
}

console.log('No task marked Status: next was found.');
console.log(`Last completed task: ${lastCompletedTask?.title || 'Not detectable'}`);
console.log(`Blocked / paused tasks count: ${blockedOrPausedTasks.length}`);
console.log('Suggested next command:');
console.log('npm run atlas:next');
console.log('or update docs/ATLAS_TASK_QUEUE.md.');
process.exit(0);

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

function isCompletedStatus(status) {
  return ['complete', 'completed'].includes(normalize(status));
}

function isBlockedPausedOrReviewStatus(status) {
  const normalizedStatus = normalize(status);

  return normalizedStatus.includes('blocked')
    || normalizedStatus.includes('paused')
    || normalizedStatus.includes('needs human review');
}

function normalize(value) {
  return value.trim().toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
