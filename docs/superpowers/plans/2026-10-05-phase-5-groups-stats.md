# Phase 5 (Groups and Stats) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Groups (create, edit, reorder, color/icon, multi-select goals) and the Stats dashboard tab.

**Architecture:**
- Groups: `app/group/[id].tsx` (id `new` for create) with a form reusing Phase 4 form pieces (name, ColorPicker, IconPicker) and a goal multi-select; groups list lives on the Goals tab under a "Groups" section (reorder via Move up/down + drag like goals).
- Stats: `src/features/stats/` — a pure view-model builder `buildStatsModel(contexts, logs, { groupGoalIds, range, mode, today, weekStart })` over `src/domain/statsCalculator` + `streaks`; the screen renders cards. Computation runs after first paint (`InteractionManager.runAfterInteractions`) behind a Skeleton.
- Charts: completion ring and calendar heatmap on Skia (one canvas each); weekly bars, trend line and per-goal comparison with victory-native (CartesianChart/Bar/Line). All animate to their values via Reanimated and jump under reduce motion.
- Normative UX: design doc `docs/superpowers/specs/2026-10-05-trek-design.md` §4.5; CLAUDE.md §5.4, §5.5.

**Tech Stack:** victory-native (approved; `EXPO_OFFLINE=1 npx expo install victory-native`, then clean install; its peers Skia/Reanimated/gesture-handler already present), Skia, Reanimated 4.

## Global Constraints

- Approved dependencies only. No schema change. No framer-motion.
- Strings in `src/strings/en.ts`; no emojis; Ionicons; theme tokens only (chart colors from tokens/goal colors); 44 pt targets; `accessibilityLabel` on every control; every chart has an accessible text summary (e.g. "Completion 72 percent").
- Motion via `src/ui/motion`, reduce-motion aware; transform/opacity only (layout transitions excepted).
- Dropdown (groups + "All goals"): opacity + scale 0.96→1, 150 ms. Range SegmentedControl 7D/30D/90D/1Y/All with sliding indicator; weighted/strict toggle (default weighted, persisted only for the session in component state).
- `homeEmptyStateMode === 'requireGroup'` and no groups → empty state "Create a group with goals to see statistics" + CTA to `/group/new`; otherwise default "All goals" plus a soft "Create a group" card when no groups exist.
- Review entry cards link to `/review/week-<weekStartDate>` and `/review/month-<yyyy-MM>`. Phase 5 adds `app/review/[period].tsx` as a stub screen showing only the period title; Phase 7 fills it.
- Tests: RNTL 14 async; inject `createTestDb()` via `DbProvider`; mock expo-router; victory-native mocked in `jest.setup.app.js` (components → View) if it fails to load under jest.
- Verification per task: `npx tsc --noEmit`, `npx jest`; phase end: iOS + Android `expo export`.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_014qGP2qavm772yGiGc1rSw8`.

### Task 1: Groups

**Files:** `app/group/[id].tsx`, `src/features/groups/{GroupForm.tsx,GroupsSection.tsx,saveGroup.ts}`, Goals tab integration, strings, tests.

- [ ] Group form: name (required), color (palette + custom with AA badge, reuse), icon (reuse IconPicker), goal multi-select (active goals, checkbox rows with role checkbox). Save in one `withTransaction` (create/update group + `setGroupGoals`). Delete group with confirm (goals untouched).
- [ ] Goals tab: "Groups" section above goals: rows with icon, name, goal count; tap → edit; "New group" button; reorder (Move up/down + drag) via `reorderGroups`; designed empty state.
- [ ] Tests: create group with two goals; a goal in two groups; edit membership; reorder; delete keeps goals.
- [ ] Commit "Add groups".

### Task 2: Stats model and Stats tab shell

**Files:** `src/features/stats/{statsModel.ts,StatsScreen.tsx,GroupDropdown.tsx,RangeControl.tsx}`, `app/(tabs)/stats.tsx`, `app/review/[period].tsx` (stub), strings, tests.

- [ ] `statsModel.ts` (pure): `buildStatsModel` → `{ completion: {percent, done, partial, skipped, vacation, missed}, currentStreak, bestStreak (max over selected goals), heatmap: {date, ratio|null}[] , weekly: {weekStart, percent}[], trend: {date, percent}[] (7-day rolling), perGoal: {goalId, name, color, percent}[], bestWeekday }` for the selected goal set. Unit tests on the 3-year seed (`seedDemoData` + `createTestDb`) for shape and on small fixtures for values; group filter respected; weighted vs strict differ when partials exist.
- [ ] Screen: dropdown, range control, mode toggle, empty states per constraints, Skeleton while computing, cards placeholder list consumed by Task 3; review entry cards (this week, this month) linking to `/review/week-<weekStartDate>` and `/review/month-<yyyy-MM>`; stub review route.
- [ ] Tests: requireGroup empty state; allGoals soft card; dropdown switches group; range change updates completion text.
- [ ] Commit "Add stats model and Stats tab".

### Task 3: Charts

**Files:** `src/features/stats/charts/{CompletionRing.tsx,StreakCard.tsx,Heatmap.tsx,WeeklyBars.tsx,TrendLine.tsx,PerGoalBars.tsx,BestWeekday.tsx}`, `src/features/stats/StatsScreen.tsx` wiring, `jest.setup.app.js` (victory mock if needed), tests, `PROGRESS.md`.

- [ ] Ring: Skia arc animates 0→value (400 ms gentle), AnimatedNumber center; heatmap: one Skia canvas, cells colored by ratio with token scale, missed/vacation distinguishable by fill pattern not color only (+ legend); weekly bars + trend line + per-goal bars via victory-native with token colors; streak card AnimatedNumber; best weekday text card. Cards stagger in.
- [ ] Each chart exposes an accessibility summary label.
- [ ] Tests: each card renders its summary label for a fixture model; reduce motion renders final values immediately (ring/AnimatedNumber).
- [ ] PROGRESS.md Phase 5 with real output; device-pending: chart animation smoothness, Stats < 500 ms on 3-year seed (Phase 13).
- [ ] Commit "Add stats charts".
