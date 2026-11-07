# Reference fixtures (for the human to fill in)

Each `*.json` file here holds values copied from an **authoritative panchang** for one
city. `tests/reference-fixtures.test.ts` validates every file and compares every entry
with `"verified": true` against the engine. Entries with `"verified": false` are only
schema-checked. Nothing in this directory was written by the autonomous build except the
empty template.

How to add data:
1. Copy `_template.json` to e.g. `montreal-2026.json`.
2. Fill `source` (publication / website and edition), `checkedBy`, `dateChecked`.
3. For each date, fill only the fields you read from the source; leave others `""`.
   Times are local wall-clock `HH:mm` in the city's timezone (as printed in the source).
   Names use this project's English spellings (see `src/core/names.ts`), e.g.
   `"Krishna Chaturdashi"`, `"Uttara Phalguni"`, `"Kartika"`.
4. Set `"verified": true` and run `npm test`.

A mismatch beyond `toleranceMinutes` fails the test with both values printed. If the
source uses a different convention (e.g. sunrise to the disc centre, or a different
ayanamsa), record that in DECISIONS.md rather than loosening the tolerance silently.
