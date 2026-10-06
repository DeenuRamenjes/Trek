# Phase 4 (Goals and Today) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Goal create/edit/duplicate/pause/archive/reorder and the Today tab (checklist, gestures, slot chips, undo, haptics, date strip, check-off animation, milestone confetti, banner placeholders).

**Architecture:**
- Feature hooks in `src/features/goals` and `src/features/tracking` read live data (`src/db/live.ts`) and call repositories; screens stay thin. Domain answers every "is it due / what status / streak" question (`src/domain/*`).
- A clock hook `useLogicalToday()` (in `src/features/tracking`) derives the logical today from `settings.dayEndsAt` and re-renders at the rollover (`dayRolloverAt`).
- A goal-context loader `loadGoalContexts(db)` builds `GoalContext[]` (goal, versions, slots, pauses, vacations) for the domain; shared by Today now and Stats/History later.
- Normative UX: design doc `docs/superpowers/specs/2026-10-05-trek-design.md` §4.4 (Today) and §4.6 (Create/edit), CLAUDE.md §5.2, §5.3, §6. DESIGN.md has the screen layouts; `src/dev/preview/TodayPreview.tsx` and `CreateGoalPreview.tsx` are the visual reference.

**Tech Stack:** react-hook-form, expo-haptics (approved; `EXPO_OFFLINE=1 npx expo install react-hook-form expo-haptics`, then clean install), Reanimated 4, gesture-handler, Skia, zod.

## Global Constraints

- Approved dependencies only. No framer-motion. No schema change.
- All strings in `src/strings/en.ts`; no emojis; icons from `src/ui/icons.ts` (Ionicons); colors from theme tokens; 44 pt tap targets; every control has an `accessibilityLabel`; status never by color alone (use `StatusGlyph`).
- All motion via `src/ui/motion` and honours reduce motion; animate transform/opacity only (layout transitions excepted).
- Haptics only when `settings.haptics` is true, through one helper `src/features/tracking/haptics.ts`.
- Writes go through repositories (`src/db/repositories`); domain stays pure. Logs only via `upsertLog`; check-off of a past date allowed for the 7-day strip, future dates read-only.
- Weekday convention ISO 0 = Monday; `weekStart` setting date-fns style.
- Tests: RNTL 14 is async (`await render`, `await fireEvent`); screens tested with mocked `expo-router` and an in-memory db (`createTestDb()`) injected through a `DbProvider` context (add `src/db/DbProvider.tsx`: `DbProvider` + `useDb()`, default `getDb()`); live hooks must read through `useDb()` so tests can inject.
- Verification per task: `npx tsc --noEmit`, `npx jest`. Phase end: iOS + Android `expo export`.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_014qGP2qavm772yGiGc1rSw8`.

### Task 1: Data plumbing for features

**Files:** `src/db/DbProvider.tsx`, `src/db/live.ts` (use `useDb()`), `src/features/goals/goalContexts.ts`, `src/features/tracking/useLogicalToday.ts`, `src/features/tracking/haptics.ts`, `src/features/tracking/todayModel.ts`, tests; `app/_layout.tsx` (wrap in `DbProvider`).

- [ ] `DbProvider`/`useDb`. Live hooks take db from context. Test hooks (sqlite-proxy) cannot use `useLiveQuery`; give each live hook a fallback: when the db is not the expo driver, run the query once and re-run on a `dbChanged` event emitted by repositories' write helpers (add a tiny emitter `src/db/changes.ts`, called by `withTransaction` and single writes). Keep it minimal.
- [ ] `loadGoalContexts(db, { includeArchived })` → `GoalContext[]` using repositories.
- [ ] `useLogicalToday()` → `{ today, now }`, updates at rollover via a timeout to `dayRolloverAt` and on AppState foreground.
- [ ] `todayModel.ts` (pure): `buildTodayRows(contexts, logs, date, today, weekStart)` → `{ pending: Row[], done: Row[] }`; Row: goalId, name, icon, color, trackingType, status, value, target, unit, slots (with per-slot done), weekProgress `{ done, target }` for timesPerWeek (shown while quota unmet), progressText key + params. Due goals only (plus timesPerWeek with quota unmet on that date's week). Sorted by goal sortOrder.
- [ ] Integration tests (testDb + domain): 01:30 with dayEndsAt 3 → logical date is previous day and a check-off from that time logs the previous date; a schedule edit (new version today) leaves `completion` for a past range identical.
- [ ] Commit "Add db provider, goal contexts and today model".

### Task 2: Goal form (create, edit, templates, sections, appearance)

**Files:** `app/goal/new.tsx`, `app/goal/[id].tsx`, `src/features/goals/GoalForm.tsx` + section components under `src/features/goals/form/`, `src/features/goals/templates.ts`, `src/features/goals/goalFormSchema.ts`, `src/features/goals/saveGoal.ts`, `src/ui/components/ColorPicker.tsx`, `src/ui/components/IconPicker.tsx`, strings, tests.

- [ ] Form via react-hook-form + zod (`goalFormSchema`): only name required; defaults: daily, check, target 1, open-ended, no reminders, default accent color, icon `flag`.
- [ ] Top: name (autofocus), template chips Water (count 8 glasses, daily, `water`), Workout (check, customDays Mon/Wed/Fri), Reading (duration 20 min daily), Meditation (duration 10 min daily) — template fills the form.
- [ ] Collapsible sections (`Collapse`) with one-line summaries: Schedule (all six types; customDays day toggles; everyNDays N; timesPerWeek N), Times per day (slots per weekday, multiple; label optional), Tracking (type, target, unit), Duration (open-ended | end date | target days), Reminders (weekday set + time + offset; per slot if slots), Appearance (curated palette from `goalPalette`, custom hue/lightness picker with an AA contrast pass/fail badge against both theme surfaces using `src/ui/color.ts`, icon picker from a curated Ionicons set in `src/ui/icons.ts`). Pickers for date/time: simple inline steppers/text inputs (no new dependency), validated `YYYY-MM-DD` / `HH:mm`.
- [ ] Sticky Save enabled when name non-empty. Edit mode: schedule edits create a new version effective logical today and show "Changes apply from today; past stats are kept"; non-schedule fields update the goal; reminders replaced; slot ids remapped for reminders (Phase 2 note).
- [ ] `saveGoal.ts` (create/update in one `withTransaction`).
- [ ] Tests: name-only create persists defaults; template fills fields; schedule edit inserts a new version and shows the note; AA badge fails for a light yellow on light surface; Save disabled when name empty.
- [ ] Commit "Add goal create and edit form".

### Task 3: Goals tab (list, reorder, duplicate, pause, archive)

**Files:** `app/(tabs)/goals.tsx`, `src/features/goals/GoalsList.tsx`, tests, strings.

- [ ] List of active goals (archived hidden, paused shown with a paused badge+icon) with Stagger entering / exiting layout animations; "New goal" button → `/goal/new`; row tap → `/goal/[id]`.
- [ ] Row actions (long-press menu or trailing IconButton → action sheet built from existing components): Edit, Duplicate, Pause/Resume, Archive (confirm). Pause/resume via repositories with logical today.
- [ ] Drag reorder with gesture-handler + Reanimated (long-press drag handle, `reorderGoals`), with accessible "Move up/Move down" actions as the non-gesture alternative.
- [ ] Empty state: "Create your first goal" with template chips.
- [ ] Tests: duplicate adds a row; pause shows the badge; archive removes; move up reorders.
- [ ] Commit "Add goals list with reorder, duplicate, pause and archive".

### Task 4: Today tab

**Files:** `app/(tabs)/today.tsx`, `src/features/tracking/` (`TodayScreen.tsx`, `DateStrip.tsx`, `GoalRow.tsx`, `SlotChips.tsx`, `UndoToast.tsx`, `LogSheet.tsx`, `ValueSheet.tsx`, `Confetti.tsx`, `useCheckOff.ts`), `src/features/tracking/banners.tsx`, strings, tests, `PROGRESS.md`.

- [ ] Header: logical date + 7-day strip (today and 6 previous), selected pill slides (`snappy`); future not shown.
- [ ] Banners: vacation banner when `activeVacation` (End vacation now → `endVacationNow`); backup banner when `showBackupBanner` (Back up now → placeholder navigating to `/settings` until Phase 11; snooze 3 days writes `backupBannerSnoozedUntil`). Both Collapse away.
- [ ] Rows (Pending then Done) per design §4.4: tap primary action (check toggle; count +1; duration +5; value opens ValueSheet), swipe right = done, swipe left = skipped, long-press = LogSheet (value + note ≤ 1000). Slot chips for multi-slot check goals. timesPerWeek "2 of 3 this week". Accessible actions mirror gestures.
- [ ] Check-off: AnimatedCheck 250 ms, success haptic, row dims to 0.6 and moves to Done via layout transition, UndoToast 4 s (restores the previous log state). Milestone (`milestoneReached`) → Skia confetti 900 ms (transform/opacity; skipped under reduce motion).
- [ ] Empty states: no goals → "Create your first goal" + templates; all done → "All done for today".
- [ ] Tests: tap check marks done and shows undo; undo restores; count +1 increments; swipe-equivalent accessibility action "Mark skipped" sets skipped; past date from strip logs that date; vacation banner appears with an active vacation; all-done state.
- [ ] PROGRESS.md: Phase 4 section with real output; device-pending: gestures feel, confetti, haptics.
- [ ] Commit "Add Today tab".
