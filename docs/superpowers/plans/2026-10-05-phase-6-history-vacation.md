# Phase 6 (History and Vacation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The goal history calendar (`goal/[id]/history`) and vacation mode (`/vacation`: create, list past/upcoming, edit, delete, end now; Today banner already wired in Phase 4).

**Architecture:**
- History: `src/features/history/` — a pure `buildMonthModel(ctx, logs, month, today, weekStart)` → header (current/best streak with unit, month completion %) and 6×7 cells `{ date|null, inMonth, status, value, badgeText, quota? }` using `dayStatus`, `streaks`, `statsCalculator`, `weekScoring`. Screen: month grid with pan-to-swipe months, bottom-sheet editor.
- Vacation: `src/features/vacation/` — form (date range, scope all|selected with goal multi-select, note) and list (upcoming/active first, then past) using the vacations repository; changes emit db changes so Today/Stats refresh.
- Normative UX: design doc `docs/superpowers/specs/2026-10-05-trek-design.md` §4.7 (vacation glyph is `airplane` per DESIGN.md); CLAUDE.md §5.6, §5.7.

**Tech Stack:** Reanimated 4, gesture-handler, existing components. No new dependencies.

## Global Constraints

- No new dependencies, no schema change, no framer-motion.
- Strings in `src/strings/en.ts`; no emojis; Ionicons; theme tokens; 44 pt; `accessibilityLabel` on every control; status shown by glyph/fill AND color (reuse `StatusGlyph`).
- Motion via `src/ui/motion`/Reanimated, reduce-motion aware (month swipe jumps, sheet appears instantly). Transform/opacity only.
- Future days read-only everywhere. Writes via repositories (`upsertLog`, `deleteLog`, vacations repo); logical today from `useLogicalToday`.
- Bottom-sheet editor: status (done/partial/skipped), value stepper (count/duration/value), note with a live counter `n/1000`, Clear (deletes the log). Saving a note without progress is allowed here by choosing status (unlike Today's quick sheet): a skipped or partial status with a note is valid; done sets value to at least target.
- Vacation form validation: start ≥ logical today for new vacations (start can be today or future), end ≥ start, selected scope needs ≥ 1 goal. Past vacations are view/delete only.
- Tests: RNTL 14 async; `createTestDb()` via `DbProvider`; mocked expo-router.
- Verification per task: `npx tsc --noEmit`, `npx jest`; phase end: iOS + Android `expo export`.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_014qGP2qavm772yGiGc1rSw8`.

### Task 1: History calendar

**Files:** `app/goal/[id]/history.tsx`, `src/features/history/{monthModel.ts,HistoryScreen.tsx,MonthGrid.tsx,DayCell.tsx,DayEditorSheet.tsx}`, entry point (a "History" button on the goal edit screen and on Goals list rows), strings, tests.

- [ ] `monthModel.ts` + unit tests: statuses per cell incl. vacation and not-due; value badge for count/duration/value; timesPerWeek quota pill per week row "2/3"; header streaks and month %; weekStart respected; month/year boundaries.
- [ ] Grid: pan tracks finger; past 25% width or fast flick springs to next/prev month, else springs back; prev/next IconButtons as accessible alternative; future months allowed to view but cells read-only.
- [ ] Day editor sheet as specified in Global Constraints; tapping a future day does nothing (cell disabled, label says read-only).
- [ ] Also: heatmap on Stats distinguishes vacation days (Phase 5 carry-over): add `vacation` to the stats heatmap cell model and render with the vacation glyph/fill.
- [ ] Tests: render month with fixture logs shows correct glyph labels; next/prev buttons change month; editing a past day saves; clear deletes; future day not editable; note counter.
- [ ] Commit "Add goal history calendar".

### Task 2: Vacation mode

**Files:** `app/vacation.tsx`, `src/features/vacation/{VacationScreen.tsx,VacationForm.tsx,VacationList.tsx}`, Settings entry row "Vacation", strings, tests, `PROGRESS.md`.

- [ ] List: active/upcoming then past, each with range, scope summary, note; designed empty state; actions: edit (upcoming/active), end now (active → `endVacationNow`), delete (confirm).
- [ ] Form: as Global Constraints; create and edit.
- [ ] Integration tests (testDb + domain): a vacation day is neutral for streaks (streak continues across it) and excluded from stats denominators; selected scope affects only selected goals; end now ends at yesterday.
- [ ] UI tests: create all-goals vacation appears in list; selected scope requires a goal; end now moves it to past.
- [ ] PROGRESS.md Phase 6 section with real output; device-pending: month swipe feel, sheet gesture.
- [ ] Commit "Add vacation mode".
