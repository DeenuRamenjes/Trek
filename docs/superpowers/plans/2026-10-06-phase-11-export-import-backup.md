# Phase 11 (Export, Import and Backup) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Full export (xlsx, JSON, CSV zip), import (xlsx, JSON, CSV zip) with preview and Replace/Merge, backup reminder banner wiring, daily auto-backup keeping 7, Android SAF folder, iOS Files visibility, restore from auto-backup, Settings → Backup screen.

**Architecture:**
- Pure core in `src/services/backup/` (no Expo imports, testable in node):
  - `snapshot.ts`: `readSnapshot(db) → Snapshot` (all 11 tables minus `pending_actions`, plus settings without app-lock state) and `SCHEMA_VERSION` (= number of applied migrations).
  - `jsonBackup.ts`: `toJson(snapshot, meta)` / `parseJson(text)` lossless.
  - `xlsxExporter.ts`: builds README, Dashboard (per goal and per group: completion %, done/partial/skipped/vacation/missed counts, current/best streak, last-30-day rate; formulas only COUNTIFS/SUMIFS/AVERAGEIFS/IFERROR/IF/MAX/MIN over the Logs sheet with app-computed cached values; streak and missed cells are values labelled "calculated by app"; data bars and color scales via Phase 10 `cfRules`), raw sheets Goals, ScheduleVersions, Slots, Reminders, Groups, GroupGoals, GoalPauses, Logs, Vacations, VacationGoals (frozen header, `@` for id/date/time columns, protected without password), Settings, `_Meta` (schemaVersion, appVersion, exportedAt, format "trek-xlsx"). Reuse Phase 10 helpers.
  - `csvExporter.ts`: one CSV per table in a zip (`jszip`), RFC 4180 quoting.
  - `importParser.ts`: reads xlsx (raw sheets + `_Meta` only), JSON or CSV zip into `{ meta, tables: Record<Table, RawRow[]> }`; header match case-insensitive and trimmed; ignore blank rows and unknown columns; coercion: Excel time decimals → `HH:mm`, date serials → `YYYY-MM-DD`, numeric-looking ids → text, booleans from TRUE/FALSE/1/0, empty → null.
  - `importValidate.ts`: zod row schemas from `src/db/rows.ts`; returns valid rows + errors `{ sheet, row, message }`; rejects newer `schemaVersion`.
  - `importApply.ts`: `applyImport(db, parsed, mode: 'replace'|'merge')` in one `withTransaction`; merge matches by id, newer `updatedAt` wins; tables without `updatedAt` follow their parent's outcome (Phase 2 decision); join tables union in merge.
- Expo side `src/services/backup/files.ts`: write/share with `expo-file-system` `File`/`Directory`/`Paths` and `expo-sharing`; pick with `expo-document-picker`; auto-backup dir `Paths.document/backups`; Android SAF via `StorageAccessFramework` (legacy API in expo-file-system) with revoked-access handling.
- `src/services/backup/autoBackup.ts`: on first app open each logical day (lifecycle hook), when `autoBackupEnabled`, write `trek-backup-<yyyyMMdd-HHmmss>.json`, prune to newest 7 (`backupPolicy.filesToPrune`), also write to the SAF folder if set.
- UI: `app/settings/backup.tsx` (export format buttons, backup reminder frequency + format, auto-backup toggle, "Choose backup folder" on Android, "Restore from auto-backup" list with date + size, Import button) and `src/features/backup/ImportPreview.tsx` (counts per table, row errors by sheet/row, confirm to skip invalid rows, Replace or Merge, then apply). Always write a JSON backup before applying an import. After import: reconcile notifications + `refreshWidgets()`. Successful exports set `lastBackupAt`. Today backup banner "Back up now" now runs the default-format export.
- Normative: CLAUDE.md §5.12; design doc `docs/superpowers/specs/2026-10-05-trek-design.md` §3.9, §5.4; Phase 10 notes in `PROGRESS.md`.

**Tech Stack:** @office-kit/xlsx, jszip, expo-file-system, expo-sharing, expo-document-picker (approved; install the picker with `EXPO_OFFLINE=1 npx expo install expo-document-picker`, clean install). iOS `UIFileSharingEnabled` and `LSSupportsOpeningDocumentsInPlace` in `app.json` `ios.infoPlist`.

## Global Constraints

- Approved dependencies only, no schema change, no native code. No charts in xlsx. No emojis in exports.
- Excel and JSON round-trip with zero data loss (every column of every table, nulls preserved, numbers incl. decimals, notes with commas/quotes/newlines).
- Strings in `src/strings/en.ts`; tokens; 44 pt; labels.
- Verification per task: `npx tsc --noEmit`, `npx jest`; phase end iOS + Android `expo export`.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_014qGP2qavm772yGiGc1rSw8`.

### Task 1: Snapshot, JSON, xlsx and CSV export (pure)

**Files:** `src/services/backup/{snapshot.ts,jsonBackup.ts,xlsxExporter.ts,csvExporter.ts}` + tests.

- [ ] Implement per Architecture; Dashboard formulas reference the Logs sheet; cached values computed by `statsCalculator`/`streaks` (completion via app numbers so formula result and cache agree — test that each formula's cached value equals the app value).
- [ ] Tests on the 3-year seed: JSON round-trip deep-equal; xlsx re-read shows `@` formats, frozen headers, protection, dataBar/colorScale, only allowed functions, `_Meta.format`; CSV zip contains one file per table with headers.
- [ ] Commit "Add backup snapshot and exporters".

### Task 2: Import parse, validate, apply

**Files:** `src/services/backup/{importParser.ts,importValidate.ts,importApply.ts}` + tests.

- [ ] Implement per Architecture.
- [ ] Tests: xlsx round-trip (seed → export → parse → replace into empty db → snapshot deep-equal) and JSON round-trip, zero loss; converted-values test (reordered columns, a blank row, decimal times, date serials, numeric ids, unknown column); newer schemaVersion rejected; merge-conflict test (same id, older vs newer updatedAt both directions; child tables follow parent); invalid rows reported with sheet + row; CSV zip import.
- [ ] Commit "Add import parser, validation and apply".

### Task 3: Files, auto-backup, Backup screen, import preview

**Files:** `src/services/backup/{files.ts,autoBackup.ts}`, `app/settings/backup.tsx`, `src/features/backup/{BackupScreen.tsx,ImportPreview.tsx,RestoreList.tsx}`, Today banner wiring, lifecycle hook, `app.json`, strings, tests, `PROGRESS.md`.

- [ ] Implement per Architecture (mock file system adapters in tests).
- [ ] Tests: auto-backup writes once per logical day and keeps exactly 7; export sets lastBackupAt; import preview shows counts and errors and requires confirmation to skip invalid rows; pre-import JSON backup written before apply; after import reconcile + refreshWidgets called; SAF revoked access clears the folder uri and shows a message.
- [ ] PROGRESS.md Phase 11 with real output; device-pending: share sheet, document picker, SAF folder, iOS Files visibility, restore on device.
- [ ] Commit "Add backup screen, auto-backup and restore".
