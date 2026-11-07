import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CEREMONIES, MUHURAT_RULES, muhuratRuleSchema } from '@/core/muhuratRules';

const DIR = join(__dirname, '..', 'data', 'muhurat-rules');

describe('muhurat rule files (structural checks; rules UNVERIFIED)', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));

  it('includes at least griha pravesh, vivah, namkaran and mundan', () => {
    for (const c of ['griha-pravesh', 'vivah', 'namkaran', 'mundan']) expect(CEREMONIES).toContain(c);
  });

  it('every file in data/muhurat-rules is registered and validates', () => {
    for (const f of files) {
      const json = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
      expect(() => muhuratRuleSchema.parse(json)).not.toThrow();
      expect(MUHURAT_RULES[f.replace(/\.json$/, '')]).toBeDefined();
    }
    expect(files.length).toBe(CEREMONIES.length);
  });

  it('every file carries the UNVERIFIED header and a provenance block', () => {
    for (const rule of Object.values(MUHURAT_RULES)) {
      expect(rule.header).toBe('UNVERIFIED — rules must be reviewed by a priest');
      expect(rule.provenance).toHaveProperty('verifiedBy');
    }
  });
});
