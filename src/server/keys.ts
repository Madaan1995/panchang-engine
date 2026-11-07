/**
 * API key generation and hashing.
 *
 * A key looks like `pk_live_<43 base64url chars>` (32 random bytes). Only its
 * SHA-256 hash is stored. A fast hash is appropriate here (unlike passwords)
 * because the key has 256 bits of entropy, so brute-forcing the hash is
 * infeasible; a slow hash would only add latency to every API call.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const KEY_PREFIX = 'pk_live_';
const DISPLAY_PREFIX_LENGTH = KEY_PREFIX.length + 4;

export interface GeneratedKey {
  /** Show this to the user ONCE. It is never stored. */
  plaintext: string;
  /** Safe to store and display, e.g. "pk_live_Ab3d". */
  prefix: string;
  /** Hex SHA-256 of the plaintext; this is what the database stores. */
  hash: string;
}

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

export function generateApiKey(): GeneratedKey {
  const plaintext = KEY_PREFIX + randomBytes(32).toString('base64url');
  return { plaintext, prefix: plaintext.slice(0, DISPLAY_PREFIX_LENGTH), hash: hashApiKey(plaintext) };
}

/** Display prefix of an existing plaintext key. */
export function keyPrefixOf(plaintext: string): string {
  return plaintext.slice(0, DISPLAY_PREFIX_LENGTH);
}

/** Extract the token from an `Authorization: Bearer <token>` header. */
export function parseBearer(header: string | null): string | null {
  if (header === null) return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return m ? (m[1] as string) : null;
}

/** Constant-time comparison of two hex hashes (defence in depth; lookups are by hash anyway). */
export function hashesEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
