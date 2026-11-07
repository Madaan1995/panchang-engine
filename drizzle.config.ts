import { defineConfig } from 'drizzle-kit';

// Used only by `npm run db:generate` (drizzle-kit), which diffs the schema and
// writes SQL migration files into ./drizzle. No database connection is needed
// to generate.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
});
