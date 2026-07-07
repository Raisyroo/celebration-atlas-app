import fs from 'node:fs';

const atlasMap = fs.readFileSync('components/AtlasMap.tsx', 'utf8');
const globals = fs.readFileSync('app/globals.css', 'utf8');
const failures = [];

const relevantStyleNames = [
  'resultTextLabel',
  'resultTextLabelName',
  'resultTextLabelLocation',
  'resultTextCluster',
  'resultTextClusterSheet',
  'resultTextClusterKicker',
  'resultTextClusterTitle',
  'resultTextClusterEvent',
  'resultTextClusterEventName',
  'resultTextClusterEventLocation',
  'resultTextFontDiagnostic',
];

if (!atlasMap.includes("import localFont from 'next/font/local';")) {
  failures.push('Floating result labels must use the app-managed next/font/local loader.');
}

if (!atlasMap.includes("variable: '--font-atlas-result-label'")) {
  failures.push('Floating result labels must expose the --font-atlas-result-label font token.');
}

if (!atlasMap.includes('data-result-label-font="atlas-result-label-serif"')) {
  failures.push('Floating title labels must carry the verifiable selected font token hook.');
}

if (/fonts\.gstatic\.com|https:\/\/fonts\.googleapis\.com/.test(globals)) {
  failures.push('app/globals.css still contains manual remote Google font URLs.');
}

for (const name of relevantStyleNames) {
  const objectMatch = atlasMap.match(new RegExp(`\\n  ${name}: \\{([\\s\\S]*?)\\n  \\}${name === relevantStyleNames.at(-1) ? '' : ','}`));
  if (!objectMatch) continue;

  const body = objectMatch[1];
  const keyCounts = new Map();
  for (const match of body.matchAll(/^\s{4}([A-Za-z_$][\w$]*):/gm)) {
    keyCounts.set(match[1], (keyCounts.get(match[1]) ?? 0) + 1);
  }
  for (const [key, count] of keyCounts) {
    if (count > 1) failures.push(`${name} contains duplicate style key ${key}.`);
  }

  for (const match of body.matchAll(/fontWeight:\s*([0-9]+)/g)) {
    const weight = Number(match[1]);
    if (weight > 500) failures.push(`${name} uses fontWeight ${weight}, above the floating-label maximum of 500.`);
  }
}

if (!/resultTextLabel:\s*\{[\s\S]*?fontFamily:\s*RESULT_LABEL_SERIF_FONT_STACK/.test(atlasMap)) {
  failures.push('resultTextLabel does not resolve to RESULT_LABEL_SERIF_FONT_STACK.');
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('Floating result label typography validation passed.');
