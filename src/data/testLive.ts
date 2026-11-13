import { useEffect, useReducer } from 'react';

import { createTestDb } from './testDb';
import type { Db } from './types';

// Test-only. In the app, `useLiveQuery` (drizzle-orm/expo-sqlite) re-runs a query
// when expo-sqlite's native change listener fires, and that listener does not
// exist under Jest. `jest/setup.js` swaps the hook for the one below, which runs
// the same query synchronously against the better-sqlite3 test database and
// re-renders its component whenever a write transaction commits.

const listeners = new Set<() => void>();

/** Test database whose committed write transactions wake every mounted live query. */
export function createLiveTestDb(): Db {
  const db = createTestDb();
  const transaction = db.transaction.bind(db) as (...args: unknown[]) => unknown;
  (db as unknown as { transaction: typeof transaction }).transaction = (...args) => {
    const result = transaction(...args);
    listeners.forEach((notify) => notify());
    return result;
  };
  return db;
}

export function useLiveQuery(query: { all(): unknown[] }) {
  const [, rerun] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    listeners.add(rerun);
    return () => {
      listeners.delete(rerun);
    };
  }, []);
  return { data: query.all(), error: undefined, updatedAt: new Date(0) };
}
