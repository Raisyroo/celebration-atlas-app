import { inspectOfficialEventSource } from '../lib/event-intake/officialSourceInspectionCore.ts';

async function main() {
  const sourceUrl = process.argv[2];
  if (!sourceUrl || sourceUrl === '--help' || sourceUrl === '-h') {
    console.log('Usage: npm run inspect:event-source -- https://official-event.example/');
    process.exit(sourceUrl ? 0 : 1);
  }

  const inspection = await inspectOfficialEventSource(sourceUrl);
  console.log(JSON.stringify(inspection, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
