import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

const sqlite = openDatabaseSync('petvaccines.db', { enableChangeListener: true });
// SQLite leaves foreign keys off by default; cascades depend on them.
sqlite.execSync('PRAGMA foreign_keys = ON');

export const db = drizzle(sqlite);
