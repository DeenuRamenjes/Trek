# Phase 10 (Export Proof of Concept) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Prove, inside React Native, that `@office-kit/xlsx` can write a workbook with formulas plus cached values, TEXT-formatted columns, data bars and a colour scale, frozen header rows and password-less sheet protection, save it with the `expo-file-system` `File` API and share it with `expo-sharing`. Automated re-read checks gate the phase.

**Architecture:**
- `src/services/xlsx/workbookPoc.ts`: pure (no Expo imports) `buildPocWorkbook(): Promise<Uint8Array>` producing a small workbook: a `Logs` sheet (ID, date, time as TEXT `@`; numeric value), a `Dashboard` sheet with COUNTIFS/SUMIFS/AVERAGEIFS/IFERROR formulas each carrying an app-computed cached result, a dataBar and a colour-scale conditional format, frozen header rows, protection without a password, and a `_Meta` sheet with `format = "trek-xlsx"`.
- `src/services/xlsx/readBack.ts`: pure `inspectWorkbook(bytes)` re-reading the file with the same library (and, where the library hides details, by unzipping with `jszip` and parsing the sheet XML) to report: formula + cached value per cell, number formats, conditional format types, pane state, sheet protection, `_Meta.format`.
- `src/services/xlsx/exportPoc.ts` (Expo side): writes bytes to `Paths.cache` with the `File` API and calls `Sharing.shareAsync` with the xlsx MIME type and UTI. Dev-only button "Export xlsx test file" on the Settings developer card.
- If Hermes lacks `TextDecoder`/`TextEncoder` where the library needs them, add a small in-repo UTF-8 polyfill installed only when missing (`src/services/xlsx/textCodec.ts`), no dependency.
- Normative: CLAUDE.md §5.12 (export rules), §7 Phase 10; design doc §5.4.

**Tech Stack:** @office-kit/xlsx, jszip, expo-file-system, expo-sharing (all approved; `EXPO_OFFLINE=1 npx expo install expo-file-system expo-sharing` and `npm i @office-kit/xlsx jszip`, then clean install).

## Global Constraints

- Approved dependencies only. No charts in the workbook. Formulas use ONLY COUNTIFS, SUMIFS, AVERAGEIFS, IFERROR, IF, MAX, MIN — never FILTER, LET, XLOOKUP or dynamic arrays.
- Every formula cell carries its cached result. ID, date and time columns use number format `@`.
- STOP and report if any automated check fails (CLAUDE.md §7 Phase 10). Opening in Excel, Google Sheets and the iOS Files preview is device verification pending (Phase 13).
- No emojis in the workbook.
- Verification: `npx tsc --noEmit`, `npx jest` (round-trip test in the node project), iOS + Android `expo export` must bundle `@office-kit/xlsx` (Metro resolves its `exports`).
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_014qGP2qavm772yGiGc1rSw8`.

### Task 1: xlsx proof of concept

**Files:** `package.json`, `src/services/xlsx/{workbookPoc.ts,readBack.ts,exportPoc.ts,textCodec.ts?}`, `src/services/xlsx/__tests__/workbookPoc.test.ts`, Settings developer card button, strings, `PROGRESS.md`.

- [ ] Install deps; read the library's README/types in `node_modules/@office-kit/xlsx` to find the APIs for formulas with cached values, number formats, conditional formats (dataBar, colorScale), freeze panes and sheet protection.
- [ ] Test (written first): build → inspect asserts: each Dashboard formula cell has formula text using only allowed functions and a cached value equal to the expected number; ID/date/time cells have format `@` and string values; at least one dataBar and one colorScale rule; frozen pane at row 1 on every data sheet; protected sheets with no password hash; `_Meta.format === 'trek-xlsx'`.
- [ ] Implement `workbookPoc.ts`, `readBack.ts` until green. If the library cannot write a required feature, STOP and report (do not hand-roll the XML without approval).
- [ ] `exportPoc.ts` + dev button; textCodec only if needed.
- [ ] Run both `expo export`s; record in PROGRESS.md Phase 10 the real outputs, the library API notes for Phase 11, and device-pending: opens in Excel, Google Sheets, iOS Files preview; share sheet works.
- [ ] Commit "Add xlsx export proof of concept".
