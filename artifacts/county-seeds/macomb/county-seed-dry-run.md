# Macomb County seed dry-run

## Scope and safeguards

- Source sheet: `03_IMPORT_READY`
- Approved seed rows: 83
- Workbook SHA-256: `72ca71ed633d8a8dc309955fe37df971acd1b5f27fd4f581ff32ab47a2c07a27`
- Approved-sheet SHA-256: `4fd822cb6c261a433f2b8942c57027cbce714d363caec689ae7a573241f6a6fc`
- Existing Michigan canonical events read: 19
- Existing Michigan candidates read: 22
- Supabase writes: None
- Candidate creation: None
- Canonical event changes: None
- Event research, publication, and clustering: Not performed

## Classification summary

Primary classifications are exclusive; requirement classifications overlap.

| Classification | Primary | Any classification |
| --- | ---: | ---: |
| Existing canonical event — likely match | 2 | 2 |
| Existing candidate — likely match | 0 | 2 |
| New candidate | 46 | 46 |
| Possible alias or duplicate | 0 | 0 |
| Insufficient information | 35 | 35 |
| Requires current-edition verification | 0 | 83 |
| Requires geocoding or address resolution | 0 | 83 |
| Blocked by schema or data conflict | 0 | 0 |

## Proposed match report

### MAC-001 — Armada Fair

- Proposed canonical: Armada Fair (46d7e6ff-bec5-4801-80da-2d21aa131092)
- Proposed candidate: Armada Fair (f6c3fb7b-0d31-4c97-b335-3cffc3cd202d)
- Signals: exact_official_url (0.990), exact_name_municipality (0.970)
- Confidence: high
- Conflict warnings: None
- Recommended decision: Confirm the canonical UUID and its promoted candidate; do not create a competing candidate identity.

### MAC-050 — Romeo Peach Festival

- Proposed canonical: Romeo Peach Festival (79fab78b-0a08-4439-8cc0-470281d69fb6)
- Proposed candidate: Romeo Peach Festival (f8e47b34-0187-45c3-99b9-b919ee4faf62)
- Signals: exact_official_url (0.990), exact_name_municipality (0.970)
- Confidence: high
- Conflict warnings: Spreadsheet duplicate group DUP-002 is resolved provenance and must not be re-merged automatically.
- Recommended decision: Confirm the canonical UUID and its promoted candidate; do not create a competing candidate identity.


## Proposed batches

### Batch 0 — Match reconciliation

- MAC-001: Armada Fair
- MAC-050: Romeo Peach Festival

### Batch 1 — New-candidate pilot

- MAC-003: Blake's Lavender Festival — Armada
- MAC-004: Blake's Pickle Festival — Armada
- MAC-008: Chesterfield Heritage Days — Chesterfield Township
- MAC-011: Chesterfield Vietnam Era Reenactment — Chesterfield Township
- MAC-041: Art on the Bay — New Baltimore
- MAC-042: Bay-Rama Fishfly Festival — New Baltimore
- MAC-049: Richmond Good Old Days Festival — Richmond

This seven-event northern Macomb group is compact, high-confidence, address-complete, source-backed in the workbook, and marked with announced 2026 editions. Exact current dates and all source evidence still require verification before any staging or publication.

### Recommended first future clustering municipality

Mount Clemens is the best first municipality-level clustering test after its records are completed because the approved workbook retains 14 distinct event series there—the county’s densest municipal group. This recommendation does not begin clustering work.

## All seed classifications

| Clean ID | Event | Primary classification | Proposed match | Current-edition verification | Geocoding/address resolution |
| --- | --- | --- | --- | --- | --- |
| MAC-001 | Armada Fair | Existing canonical event — likely match | Armada Fair (canonical 46d7e6ff-bec5-4801-80da-2d21aa131092) | Yes | Yes |
| MAC-002 | Blake's Cider Dayze Festival | Insufficient information | None | Yes | Yes |
| MAC-003 | Blake's Lavender Festival | New candidate | None | Yes | Yes |
| MAC-004 | Blake's Pickle Festival | New candidate | None | Yes | Yes |
| MAC-005 | Blake's Sunflower Festival | New candidate | None | Yes | Yes |
| MAC-006 | Center Line Independence Festival | New candidate | None | Yes | Yes |
| MAC-007 | Halloween Town | Insufficient information | None | Yes | Yes |
| MAC-008 | Chesterfield Heritage Days | New candidate | None | Yes | Yes |
| MAC-009 | Chesterfield History Alive! | New candidate | None | Yes | Yes |
| MAC-010 | Chesterfield Michigan Log Cabin Day | New candidate | None | Yes | Yes |
| MAC-011 | Chesterfield Vietnam Era Reenactment | New candidate | None | Yes | Yes |
| MAC-012 | North Gratiot Cruise | Insufficient information | None | Yes | Yes |
| MAC-013 | Festival of the Senses | New candidate | None | Yes | Yes |
| MAC-014 | Macomb County Senior Fun Festival | Insufficient information | None | Yes | Yes |
| MAC-015 | Macomb Reads Carnival | New candidate | None | Yes | Yes |
| MAC-016 | Cruisin' Gratiot | New candidate | None | Yes | Yes |
| MAC-017 | Fraser Lions Club Carnival | New candidate | None | Yes | Yes |
| MAC-018 | Harrison Township Parade of Lights | Insufficient information | None | Yes | Yes |
| MAC-019 | St. Hubert Fall Festival | Insufficient information | None | Yes | Yes |
| MAC-020 | Scarefest Scream Park | New candidate | None | Yes | Yes |
| MAC-021 | Halloween Hoopla | Insufficient information | None | Yes | Yes |
| MAC-022 | Holiday Tree Lighting & After Glow | Insufficient information | None | Yes | Yes |
| MAC-023 | St. Isidore Oktoberfest | New candidate | None | Yes | Yes |
| MAC-024 | St. Isidore Strawberry Festival | New candidate | None | Yes | Yes |
| MAC-025 | Tons O' Trucks & Wheeled Wonders | Insufficient information | None | Yes | Yes |
| MAC-026 | Memphis Festival Days | Insufficient information | None | Yes | Yes |
| MAC-027 | Macomb Community Action Walk for Warmth | New candidate | None | Yes | Yes |
| MAC-028 | Macomb County Pride Festival | Insufficient information | None | Yes | Yes |
| MAC-029 | Macomb County Santa Parade | New candidate | None | Yes | Yes |
| MAC-030 | Made in Michigan Show | Insufficient information | None | Yes | Yes |
| MAC-031 | Mount Clemens Bud Light Classic Car Show | New candidate | None | Yes | Yes |
| MAC-032 | Mount Clemens Christmas Light Parade | New candidate | None | Yes | Yes |
| MAC-033 | Mount Clemens Christmas Open House & Tree Lighting | New candidate | None | Yes | Yes |
| MAC-034 | Mount Clemens Fall Art & Craft Show | New candidate | None | Yes | Yes |
| MAC-035 | Mount Clemens Halloween Spooktacular | New candidate | None | Yes | Yes |
| MAC-036 | Mount Clemens Independence Day Celebration & Fireworks | New candidate | None | Yes | Yes |
| MAC-037 | Mount Clemens Monster/Zombie Parade | New candidate | None | Yes | Yes |
| MAC-038 | Mount Clemens New Year's Eve Gala | New candidate | None | Yes | Yes |
| MAC-039 | Super SatARTday | Insufficient information | None | Yes | Yes |
| MAC-040 | Urban Street Fair | New candidate | None | Yes | Yes |
| MAC-041 | Art on the Bay | New candidate | None | Yes | Yes |
| MAC-042 | Bay-Rama Fishfly Festival | New candidate | None | Yes | Yes |
| MAC-043 | New Baltimore Lions Winterfest | New candidate | None | Yes | Yes |
| MAC-044 | New Baltimore Memorial Day Parade | Insufficient information | None | Yes | Yes |
| MAC-045 | Trick or Treat on Washington Street | New candidate | None | Yes | Yes |
| MAC-046 | New Haven Parade of Lights & Tree Lighting | Insufficient information | None | Yes | Yes |
| MAC-047 | Red Hot & Blue Festival | Insufficient information | None | Yes | Yes |
| MAC-048 | Ray Day | Insufficient information | None | Yes | Yes |
| MAC-049 | Richmond Good Old Days Festival | New candidate | None | Yes | Yes |
| MAC-050 | Romeo Peach Festival | Existing canonical event — likely match | Romeo Peach Festival (canonical 79fab78b-0a08-4439-8cc0-470281d69fb6) | Yes | Yes |
| MAC-051 | Terror on Tillson Street | New candidate | None | Yes | Yes |
| MAC-052 | Roseville Memorial Day Parade | Insufficient information | None | Yes | Yes |
| MAC-053 | Clinton River Day | New candidate | None | Yes | Yes |
| MAC-054 | Holland Ponds Migratory Bird Day | New candidate | None | Yes | Yes |
| MAC-055 | Packards & Pours | Insufficient information | None | Yes | Yes |
| MAC-056 | Purple Polka Dot Race | Insufficient information | None | Yes | Yes |
| MAC-057 | Shelby Township Art Fair | New candidate | None | Yes | Yes |
| MAC-058 | Shelby Township Summer Fest | Insufficient information | None | Yes | Yes |
| MAC-059 | Assumption GreekFest | New candidate | None | Yes | Yes |
| MAC-060 | Junefest | Insufficient information | None | Yes | Yes |
| MAC-061 | Michigan Fantasy Festival | Insufficient information | None | Yes | Yes |
| MAC-062 | Shorestoberfest | Insufficient information | None | Yes | Yes |
| MAC-063 | Shorewood Kiwanis Harper Charity Cruise | New candidate | None | Yes | Yes |
| MAC-064 | St. Clair Shores Fireworks | Insufficient information | None | Yes | Yes |
| MAC-065 | St. Clair Shores Memorial Day Parade | New candidate | None | Yes | Yes |
| MAC-066 | St. Patty's in the Park | Insufficient information | None | Yes | Yes |
| MAC-067 | Wine on the Water | Insufficient information | None | Yes | Yes |
| MAC-068 | American Polish Festival & Craft Show | New candidate | None | Yes | Yes |
| MAC-069 | Macomb County HarvestFest | New candidate | None | Yes | Yes |
| MAC-070 | St. Malachy Summerfest | Insufficient information | None | Yes | Yes |
| MAC-071 | Sterling Frights | Insufficient information | None | Yes | Yes |
| MAC-072 | Sterling Heights Memorial Day Parade | Insufficient information | None | Yes | Yes |
| MAC-073 | Sterlingfest Art and Music Fair | New candidate | None | Yes | Yes |
| MAC-074 | St. Lawrence Apple Fest | Insufficient information | None | Yes | Yes |
| MAC-075 | Bangladeshi American Festival | New candidate | None | Yes | Yes |
| MAC-076 | St. Anne Sausage Festival | New candidate | None | Yes | Yes |
| MAC-077 | Warren Asian American and Pacific Islander Celebration | Insufficient information | None | Yes | Yes |
| MAC-078 | Warren Birthday Bash | New candidate | None | Yes | Yes |
| MAC-079 | Warren City Square Street Fair | Insufficient information | None | Yes | Yes |
| MAC-080 | Warren Lions City Fair | New candidate | None | Yes | Yes |
| MAC-081 | Warren Spring Carnival | Insufficient information | None | Yes | Yes |
| MAC-082 | Warren Woods Tower Booster Club Craft Show | New candidate | None | Yes | Yes |
| MAC-083 | Peachy Keen Craft Fair | Insufficient information | None | Yes | Yes |

## Schema parity

No deployed column mismatch blocks the dry-run system. Migration 004 and generated database types remain absent from the tracked repository.
