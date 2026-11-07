/**
 * Create an API key and print the plaintext ONCE.
 *
 *   npm run key:create -- --name "PurohitDesk" [--plan pro] [--quota 50000]
 *
 * The database stores only the SHA-256 hash; if the printed key is lost,
 * create a new one.
 */
import { parseArgs } from 'node:util';
import { createDb } from '../src/server/db/client';
import { MockBillingProvider } from '../src/server/billing';
import { generateApiKey } from '../src/server/keys';
import { PgStore } from '../src/server/pgStore';
import { loadDotEnv } from './env';

loadDotEnv();

async function main() {
  const { values } = parseArgs({
    options: { name: { type: 'string' }, plan: { type: 'string', default: 'free' }, quota: { type: 'string' } },
  });
  if (values.name === undefined || values.name.trim() === '') {
    console.error('Usage: npm run key:create -- --name "<label>" [--plan free|starter|pro] [--quota <calls per month>]');
    process.exit(2);
  }
  const billing = new MockBillingProvider();
  if (!billing.knownPlans().includes(values.plan as string)) {
    console.error(`Unknown plan '${values.plan}'. Known plans: ${billing.knownPlans().join(', ')}`);
    process.exit(2);
  }
  const quota = values.quota === undefined ? null : Number.parseInt(values.quota, 10);
  if (quota !== null && (!Number.isInteger(quota) || quota < 0)) {
    console.error('--quota must be a non-negative integer');
    process.exit(2);
  }

  const { db, pool } = createDb();
  const key = generateApiKey();
  const record = await new PgStore(db).create({
    name: values.name,
    keyPrefix: key.prefix,
    keyHash: key.hash,
    plan: values.plan as string,
    monthlyQuotaOverride: quota,
  });
  await pool.end();

  console.log(`Created API key #${record.id} "${record.name}" on plan "${record.plan}".`);
  console.log('');
  console.log(`  ${key.plaintext}`);
  console.log('');
  console.log('This is the only time the key is shown. Store it securely.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
