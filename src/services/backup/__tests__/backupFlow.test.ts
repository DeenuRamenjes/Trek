import '../../xlsx/textCodec';
import { createTestDb } from '../../../test/testDb';
import type { TrekDb } from '../../../db/client';
import { seedDemoData } from '../../../db/seed';
import { DEFAULT_SETTINGS, type Settings } from '../../../domain/settings';
import {
  listAutoBackups,
  runAutoBackup,
  SafAccessError,
  takeSafRevokedNotice,
  type BackupFs,
} from '../autoBackup';
import { canApplyImport, exportBackup, ImportNotConfirmedError, previewImport, runImport, type ExportFile } from '../backupFlow';
import { toJson } from '../jsonBackup';
import { readSnapshot } from '../snapshot';

const TODAY = '2026-10-05';
const newDb = () => createTestDb().db as unknown as TrekDb;

function memFs() {
  const files = new Map<string, string>();
  const calls: string[] = [];
  const saf: string[] = [];
  let safFails = false;
  const fs: BackupFs = {
    async writeLocal(name, text) {
      calls.push(`write:${name}`);
      files.set(name, text);
    },
    async listLocal() {
      return [...files].map(([name, text]) => ({ name, size: text.length }));
    },
    async readLocal(name) {
      return files.get(name)!;
    },
    async deleteLocal(name) {
      files.delete(name);
    },
    async writeSaf(_folder, name) {
      if (safFails) throw new SafAccessError();
      saf.push(name);
    },
  };
  return { fs, files, calls, saf, failSaf: () => (safFails = true) };
}

function settingsHolder(initial: Settings = DEFAULT_SETTINGS) {
  const h = { settings: initial };
  const update = (patch: Partial<Settings>) => {
    h.settings = { ...h.settings, ...patch };
  };
  return { h, update };
}

let db: TrekDb;
beforeAll(async () => {
  db = newDb();
  await seedDemoData(db, { today: TODAY });
}, 60000);

describe('auto-backup', () => {
  it('writes once per logical day and keeps exactly 7', async () => {
    const m = memFs();
    const s = settingsHolder();
    const run = (now: Date) =>
      runAutoBackup({ db, fs: m.fs, settings: s.h.settings, updateSettings: s.update, now, appVersion: '1' });

    const first = await run(new Date(2026, 9, 1, 9, 0, 0));
    expect(first.status).toBe('written');
    expect((await run(new Date(2026, 9, 1, 18, 0, 0))).status).toBe('already-done');
    expect(m.files.size).toBe(1);

    for (let day = 2; day <= 10; day++) await run(new Date(2026, 9, day, 9, 0, 0));
    const names = [...m.files.keys()].sort();
    expect(names).toHaveLength(7);
    expect(names[0]).toBe('trek-backup-20261004-090000.json');
    expect(names[6]).toBe('trek-backup-20261010-090000.json');
  }, 60000);

  it('respects dayEndsAt for the logical day', async () => {
    const m = memFs();
    const s = settingsHolder({ ...DEFAULT_SETTINGS, dayEndsAt: 3 });
    const run = (now: Date) =>
      runAutoBackup({ db, fs: m.fs, settings: s.h.settings, updateSettings: s.update, now, appVersion: '1' });
    expect((await run(new Date(2026, 9, 1, 20, 0, 0))).status).toBe('written');
    // 01:30 next calendar day still belongs to Oct 1
    expect((await run(new Date(2026, 9, 2, 1, 30, 0))).status).toBe('already-done');
    expect((await run(new Date(2026, 9, 2, 4, 0, 0))).status).toBe('written');
  }, 60000);

  it('does nothing when disabled', async () => {
    const m = memFs();
    const s = settingsHolder({ ...DEFAULT_SETTINGS, autoBackupEnabled: false });
    const r = await runAutoBackup({ db, fs: m.fs, settings: s.h.settings, updateSettings: s.update, now: new Date(), appVersion: '1' });
    expect(r.status).toBe('disabled');
    expect(m.files.size).toBe(0);
  });

  it('mirrors to the SAF folder; revoked access clears the uri and raises the notice', async () => {
    const m = memFs();
    const s = settingsHolder({ ...DEFAULT_SETTINGS, androidBackupFolderUri: 'content://tree/x' });
    const run = (now: Date) =>
      runAutoBackup({ db, fs: m.fs, settings: s.h.settings, updateSettings: s.update, now, appVersion: '1' });
    await run(new Date(2026, 9, 1, 9, 0, 0));
    expect(m.saf).toEqual(['trek-backup-20261001-090000.json']);
    expect(takeSafRevokedNotice()).toBe(false);

    m.failSaf();
    const r = await run(new Date(2026, 9, 2, 9, 0, 0));
    expect(r.status).toBe('written');
    expect(r.safRevoked).toBe(true);
    expect(s.h.settings.androidBackupFolderUri).toBeUndefined();
    expect(takeSafRevokedNotice()).toBe(true);
    expect(takeSafRevokedNotice()).toBe(false);
    expect(m.files.size).toBe(2);
  }, 60000);

  it('lists auto-backups newest first and ignores other files', async () => {
    const m = memFs();
    m.files.set('trek-backup-20261001-090000.json', 'aaaa');
    m.files.set('trek-backup-20261003-090000.json', 'bb');
    m.files.set('trek-preimport-20261003-100000.json', 'c');
    const list = await listAutoBackups(m.fs);
    expect(list.map((i) => i.name)).toEqual(['trek-backup-20261003-090000.json', 'trek-backup-20261001-090000.json']);
    expect(list[0].label).toBe('3 Oct 2026, 09:00');
  });
});

describe('export', () => {
  it('shares each file and sets lastBackupAt', async () => {
    const s = settingsHolder();
    const shared: ExportFile[] = [];
    const now = new Date(2026, 9, 5, 12, 0, 0);
    const names = await exportBackup(
      { db, settings: s.h.settings, now, today: TODAY, appVersion: '1', share: async (f) => void shared.push(f), updateSettings: s.update },
      ['json', 'csv'],
    );
    expect(names).toHaveLength(2);
    expect(shared.map((f) => f.mime)).toEqual(['application/json', 'application/zip']);
    expect(s.h.settings.lastBackupAt).toBe(now.toISOString());
  }, 60000);

  it('does not set lastBackupAt when sharing fails', async () => {
    const s = settingsHolder();
    await expect(
      exportBackup(
        { db, settings: s.h.settings, now: new Date(), today: TODAY, appVersion: '1', share: async () => Promise.reject(new Error('x')), updateSettings: s.update },
        ['json'],
      ),
    ).rejects.toThrow();
    expect(s.h.settings.lastBackupAt).toBeUndefined();
  }, 60000);
});

describe('import flow', () => {
  async function jsonWithBadRow() {
    const snap = await readSnapshot(db, DEFAULT_SETTINGS);
    const text = JSON.parse(toJson(snap, { appVersion: '1', exportedAt: '2026-10-05T10:00:00.000Z' }));
    text.tables.groups[0].color = 'not-a-color';
    text.tables.groups[0].name = null;
    return JSON.stringify(text);
  }

  it('preview shows counts and errors; skipping needs confirmation', async () => {
    const v = await previewImport(await jsonWithBadRow());
    expect(v.errors.length).toBeGreaterThan(0);
    expect(v.errors[0]).toEqual(expect.objectContaining({ sheet: 'Groups', row: expect.any(Number) }));
    expect(v.counts.goals.valid).toBe(v.counts.goals.total);
    expect(canApplyImport(v, false)).toBe(false);
    expect(canApplyImport(v, true)).toBe(true);

    const m = memFs();
    const s = settingsHolder();
    const target = newDb();
    await expect(
      runImport(
        { db: target, fs: m.fs, settings: s.h.settings, updateSettings: s.update, now: new Date(), appVersion: '1', reconcile: async () => undefined, refreshWidgets: async () => undefined },
        v,
        'replace',
        false,
      ),
    ).rejects.toBeInstanceOf(ImportNotConfirmedError);
    expect(m.files.size).toBe(0);
  }, 60000);

  it('writes the safety backup before apply, then reconciles and refreshes widgets; app lock untouched', async () => {
    const source = await readSnapshot(db, DEFAULT_SETTINGS);
    const text = toJson({ ...source, settings: { ...source.settings, haptics: false, androidBackupFolderUri: 'content://other' } }, { appVersion: '1', exportedAt: '2026-10-05T10:00:00.000Z' });
    const v = await previewImport(text);

    const target = newDb();
    const m = memFs();
    const order: string[] = [];
    const s = settingsHolder({ ...DEFAULT_SETTINGS, appLock: { ...DEFAULT_SETTINGS.appLock, enabled: true } });
    const origWrite = m.fs.writeLocal;
    m.fs.writeLocal = async (n, t) => {
      order.push('backup');
      await origWrite(n, t);
    };
    const { backupName, result } = await runImport(
      {
        db: target,
        fs: m.fs,
        settings: s.h.settings,
        updateSettings: s.update,
        now: new Date(2026, 9, 5, 12, 0, 0),
        appVersion: '1',
        reconcile: async () => void order.push('reconcile'),
        refreshWidgets: async () => void order.push('widgets'),
      },
      v,
      'replace',
      false,
    );
    expect(order).toEqual(['backup', 'reconcile', 'widgets']);
    expect(backupName).toBe('trek-preimport-20261005-120000.json');
    expect(m.files.has(backupName)).toBe(true);
    expect(result.goals.added).toBe(source.tables.goals.length);
    expect(s.h.settings.haptics).toBe(false);
    expect(s.h.settings.appLock.enabled).toBe(true);
    expect(s.h.settings.androidBackupFolderUri).toBeUndefined();
    expect((await readSnapshot(target, DEFAULT_SETTINGS)).tables).toEqual(source.tables);
  }, 60000);
});
