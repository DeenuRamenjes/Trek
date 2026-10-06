import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

/** Satisfied by the expo-sqlite (sync) db and the sqlite-proxy (async) test db. Always `await` queries. */
export type TrekDb = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof schema>;

let instance: ExpoSQLiteDatabase<typeof schema> | null = null;

export function getDb(): ExpoSQLiteDatabase<typeof schema> {
  if (!instance) {
    const expoDb = openDatabaseSync('trek.db', { enableChangeListener: true });
    expoDb.execSync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    instance = drizzle(expoDb, { schema });
  }
  return instance;
}
