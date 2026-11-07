/** Load .env into process.env for CLI scripts, if the file exists (Node ≥ 20.12). */
import { existsSync } from 'node:fs';

export function loadDotEnv(path = '.env'): void {
  if (existsSync(path)) process.loadEnvFile(path);
}
