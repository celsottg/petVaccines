import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

import type { Db } from './types';

// Test-only: production code uses the expo-sqlite client in `src/db/client.ts`.

/** In-memory database with foreign keys on and the app's real `.sql` migrations applied. */
export function createTestDb(): Db {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle({ client: sqlite });
  migrate(db, { migrationsFolder: path.resolve(__dirname, '../db/migrations') });
  return db;
}
