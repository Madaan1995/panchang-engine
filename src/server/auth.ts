/** Bearer-token authentication against the hashed key store. */
import { hashApiKey, parseBearer } from './keys';
import type { ApiKeyRecord, KeyStore } from './store';

export type AuthResult = { ok: true; key: ApiKeyRecord } | { ok: false; status: 401; message: string };

export async function authenticate(authorizationHeader: string | null, keys: KeyStore): Promise<AuthResult> {
  const token = parseBearer(authorizationHeader);
  if (token === null) {
    return { ok: false, status: 401, message: 'Missing API key. Send `Authorization: Bearer <key>`.' };
  }
  const key = await keys.findByHash(hashApiKey(token));
  if (key === null) return { ok: false, status: 401, message: 'Invalid API key.' };
  if (key.revokedAt !== null) return { ok: false, status: 401, message: 'This API key has been revoked.' };
  return { ok: true, key };
}
