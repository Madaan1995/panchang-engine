import { describe, expect, it } from 'vitest';

describe('toolchain smoke test (mathematical check)', () => {
  it('runs with a pinned non-local system timezone so accidental TZ use is caught', () => {
    expect(process.env.TZ).toBe('Pacific/Chatham');
  });
});
