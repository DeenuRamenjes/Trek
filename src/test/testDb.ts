import fs from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from '../db/schema';

type Sqlite = typeof import('node:sqlite');

// node:sqlite prints an ExperimentalWarning on first load; silence it only here.
function loadSqlite(): Sqlite {
  const original = process.emitWarning;
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    const text = typeof warning === 'string' ? warning : warning.message;
    if (text.includes('SQLite is an experimental feature')) return;
    return (original as (...args: unknown[]) => void).call(process, warning, ...rest);
  }) as typeof process.emitWarning;
  // Not restored: the warning is emitted asynchronously, after require returns.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('node:sqlite') as Sqlite;
}

const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');

function migrationStatements(): string[] {
  const journal = JSON.parse(fs.readFileSync(path.join(migrationsDir, 'meta', '_journal.json'), 'utf8')) as {
    entries: { tag: string }[];
  };
  return journal.entries.flatMap((entry) =>
    fs
      .readFileSync(path.join(migrationsDir, `${entry.tag}.sql`), 'utf8')
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function createTestDb() {
  const { DatabaseSync } = loadSqlite();
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  for (const statement of migrationStatements()) raw.exec(statement);

  const db = drizzle(
    async (sql, params, method) => {
      const stmt = raw.prepare(sql);
      const args = params as (string | number | bigint | null)[];
      if (method === 'run') {
        stmt.run(...args);
        return { rows: [] };
      }
      stmt.setReturnArrays(true);
      if (method === 'get') {
        const row = stmt.get(...args) as unknown[] | undefined;
        return { rows: row as unknown[] };
      }
      return { rows: stmt.all(...args) as unknown as unknown[][] };
    },
    { schema },
  );
  return { db, raw };
}

export type TestDb = ReturnType<typeof createTestDb>['db'];
