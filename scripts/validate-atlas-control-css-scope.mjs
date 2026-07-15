import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';

const controlCssPath = path.join(
  process.cwd(),
  'app',
  'atlas-control',
  'control.css',
);
const shouldFix = process.argv.includes('--fix');
const source = await readFile(controlCssPath, 'utf8');
const root = postcss.parse(source, { from: controlCssPath });

function scopeSelector(selector) {
  const normalized = selector.trim();

  if (normalized === 'body' || normalized === 'body:has(.control-shell)') {
    return 'body:has(.control-shell)';
  }

  if (
    normalized === '.control-shell' ||
    normalized.startsWith('.control-shell ') ||
    normalized.startsWith('.control-shell:') ||
    normalized.startsWith('.control-shell.')
  ) {
    return normalized;
  }

  return `.control-shell ${normalized}`;
}

const violations = [];

root.walkRules((rule) => {
  const scopedSelectors = rule.selectors.map(scopeSelector);
  const scopedSelector = scopedSelectors.join(', ');

  if (rule.selector === scopedSelector) return;

  violations.push({ actual: rule.selector, expected: scopedSelector });
  if (shouldFix) rule.selector = scopedSelector;
});

if (shouldFix) {
  await writeFile(controlCssPath, root.toString(), 'utf8');
  console.log(`Scoped ${violations.length} Atlas Control selector rule(s).`);
  process.exit(0);
}

if (violations.length > 0) {
  console.error('Atlas Control CSS contains selectors that can leak into public routes:');
  violations.slice(0, 12).forEach(({ actual, expected }) => {
    console.error(`- ${actual} -> ${expected}`);
  });
  if (violations.length > 12) {
    console.error(`- ...and ${violations.length - 12} more`);
  }
  process.exit(1);
}

console.log('Atlas Control CSS scope contract passed.');
