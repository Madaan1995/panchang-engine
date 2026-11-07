/** Applies SQL migrations from ./drizzle to DATABASE_URL. Usage: npm run db:migrate */
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '../src/server/db/client';
import { loadDotEnv } from './env';

loadDotEnv();

async function main() {
  const { db, pool } = createDb();
  await migrate(db, { migrationsFolder: './drizzle' });
  await pool.end();
  console.log('Migrations applied.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
