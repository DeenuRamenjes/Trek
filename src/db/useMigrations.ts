import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import type { Readiness } from '../features/startup/useAppReady';
import { getDb } from './client';
import migrations from './migrations/migrations';

export function useDbMigrations(): Readiness {
  const { success, error } = useMigrations(getDb(), migrations);
  return { ready: success, error: error ?? null };
}
