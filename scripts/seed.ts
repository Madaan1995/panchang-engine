/**
 * Development seed. If SEED_API_KEY is set, makes sure a key with that exact
 * plaintext exists (on the "free" plan) so local tools have a known key.
 * Never set SEED_API_KEY in production.
 *
 *   npm run db:seed
 */
import { createDb } from '../src/server/db/client';
import { hashApiKey, keyPrefixOf } from '../src/server/keys';
import { PgStore } from '../src/server/pgStore';
import { loadDotEnv } from './env';

loadDotEnv();

async function main() {
  const plaintext = process.env.SEED_API_KEY;
  if (plaintext === undefined || plaintext === '') {
    console.log('SEED_API_KEY not set; nothing to seed.');
    return;
  }
  const { db, pool } = createDb();
  const store = new PgStore(db);
  const hash = hashApiKey(plaintext);
  if ((await store.findByHash(hash)) === null) {
    await store.create({ name: 'Local development key (seed)', keyPrefix: keyPrefixOf(plaintext), keyHash: hash, plan: 'free' });
    console.log('Seeded development API key from SEED_API_KEY.');
  } else {
    console.log('Development API key already present.');
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
