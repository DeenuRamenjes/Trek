import { createContext, useContext, type ReactNode } from 'react';
import { getDb, type TrekDb } from './client';

const DbContext = createContext<TrekDb | null>(null);

/** Supplies the db to hooks. Tests inject an in-memory db; the app defaults to the expo db. */
export function DbProvider({ db, children }: { db?: TrekDb; children: ReactNode }) {
  return <DbContext.Provider value={db ?? getDb()}>{children}</DbContext.Provider>;
}

export function useDb(): TrekDb {
  return useContext(DbContext) ?? getDb();
}
