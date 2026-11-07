import { describe, expect, it } from 'vitest';
import { authenticate } from '@/server/auth';
import { generateApiKey, hashApiKey, hashesEqual, KEY_PREFIX, parseBearer } from '@/server/keys';
import { MemoryStore } from '@/server/store';

describe('API key generation and hashing', () => {
  it('generates distinct high-entropy keys with a display prefix and a SHA-256 hash', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.plaintext).not.toBe(b.plaintext);
    expect(a.plaintext.startsWith(KEY_PREFIX)).toBe(true);
    expect(a.plaintext.length).toBe(KEY_PREFIX.length + 43);
    expect(a.prefix).toBe(a.plaintext.slice(0, KEY_PREFIX.length + 4));
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).toBe(hashApiKey(a.plaintext));
  });

  it('hash comparison is exact', () => {
    const k = generateApiKey();
    expect(hashesEqual(k.hash, hashApiKey(k.plaintext))).toBe(true);
    expect(hashesEqual(k.hash, hashApiKey(k.plaintext + 'x'))).toBe(false);
  });

  it('parses Bearer headers', () => {
    expect(parseBearer('Bearer abc')).toBe('abc');
    expect(parseBearer('bearer   abc  ')).toBe('abc');
    expect(parseBearer('Basic abc')).toBeNull();
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer('Bearer')).toBeNull();
  });
});

describe('authenticate', () => {
  async function setup() {
    const store = new MemoryStore();
    const key = generateApiKey();
    await store.create({ name: 't', keyPrefix: key.prefix, keyHash: key.hash, plan: 'free' });
    return { store, key };
  }

  it('accepts a valid key, and the store holds only the hash', async () => {
    const { store, key } = await setup();
    const r = await authenticate(`Bearer ${key.plaintext}`, store);
    expect(r.ok).toBe(true);
    expect(JSON.stringify(store.keys)).not.toContain(key.plaintext);
  });

  it('rejects missing, malformed, wrong and revoked keys with 401', async () => {
    const { store, key } = await setup();
    for (const header of [null, 'Token x', `Bearer ${key.plaintext}x`]) {
      const r = await authenticate(header, store);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(401);
    }
    store.keys[0]!.revokedAt = new Date(0);
    const r = await authenticate(`Bearer ${key.plaintext}`, store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/revoked/);
  });
});
