import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(__dirname, '..', 'drizzle');

describe('SQL migrations (structural checks, no database needed)', () => {
  const journal = JSON.parse(readFileSync(join(DIR, 'meta', '_journal.json'), 'utf8')) as { entries: { tag: string }[] };
  const sqlFiles = readdirSync(DIR).filter((f) => f.endsWith('.sql'));

  it('every journal entry has a SQL file and every SQL file is in the journal', () => {
    expect(journal.entries.map((e) => `${e.tag}.sql`).sort()).toEqual(sqlFiles.sort());
  });

  it('the schema stores only a key hash, never a plaintext key column', () => {
    const all = sqlFiles.map((f) => readFileSync(join(DIR, f), 'utf8')).join('\n');
    expect(all).toMatch(/"key_hash" text NOT NULL/);
    expect(all).not.toMatch(/"key" text|"api_key" text|plaintext/i);
  });

  it('usage_events has an index on (api_key_id, created_at) for monthly quota counts', () => {
    const all = sqlFiles.map((f) => readFileSync(join(DIR, f), 'utf8')).join('\n');
    expect(all).toMatch(/usage_events_key_time_idx.*\("api_key_id","created_at"\)/);
  });
});
