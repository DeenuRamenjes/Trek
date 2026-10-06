# Phase 3 (Domain) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Every rule in CLAUDE.md §4 plus `reviewBuilder`, `reminderPlanner`, `backupPolicy`, `actionQueue` and `widgetSnapshot`, as pure TypeScript under `src/domain`, written test-first.

**Architecture:** Pure functions over plain row types (`$inferSelect` types re-exported from `src/domain/types.ts`; type-only imports from `src/db/schema` are allowed, runtime imports are not). Dates are `YYYY-MM-DD` strings; date math uses `date-fns` on dates parsed at local midnight. The normative rules are in the design doc `docs/superpowers/specs/2026-10-05-trek-design.md` §3.1–3.9: implementers read the section named in their task and follow it exactly.

**Tech Stack:** date-fns (approved; install with `EXPO_OFFLINE=1 npx expo install date-fns`, then clean install), TypeScript 6, jest (node project, `*.test.ts`).

## Global Constraints

- No React, React Native, Expo or `src/db` runtime imports in `src/domain`. Only `date-fns` and `zod` at runtime. A test (`src/domain/__tests__/purity.test.ts`) greps every `src/domain/**/*.ts` (excluding tests) and fails on `from 'react`, `from 'expo`, `from 'react-native`, or a non-`import type` import of `../db`.
- Weekday numbering everywhere (slots, reminders, `scheduleDays` bits, domain): ISO, 0 = Monday … 6 = Sunday, independent of `weekStart`. `weekStart` setting values are those already in `src/domain/settings.ts`.
- Date strings are `YYYY-MM-DD`; times `HH:mm`; timestamps ISO. Never use `new Date('YYYY-MM-DD')` (UTC parse); use a shared `parseDate`/`formatDate` in `src/domain/dates.ts`.
- Every target means "at least". "missed" is computed, never stored.
- DST and time-zone tests live in `*.tz.test.ts` and run in a separate jest project `node-tz` whose `globalSetup` sets `process.env.TZ = 'America/New_York'` (workers inherit it). Verify inside a test that `new Date(2026, 2, 8, 12).getTimezoneOffset()` differs from January's.
- Verification per task: `npx tsc --noEmit` and `npx jest`.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_014qGP2qavm772yGiGc1rSw8`.

### Task 1: Dates, logical day, weekday convention, schedule engine

**Files:** `package.json` (date-fns), `src/domain/types.ts`, `src/domain/dates.ts`, `src/domain/dayBoundary.ts`, `src/domain/scheduleEngine.ts`, `src/domain/vacationRules.ts`, tests, `jest.config.js` (`node-tz` project + `globalSetup`), `src/db/seed.ts` and `src/db/schema.ts` comment and the Phase 2 plan line on bit order (align to ISO: bit 0 = Monday), `src/domain/__tests__/purity.test.ts`.

- [ ] `dates.ts`: `parseDate`, `formatDate`, `addDaysTo(date, n)`, `diffDays(a, b)`, `isoWeekday(date)` (0 = Mon), `weekStartOf(date, weekStart)`, `eachDate(from, to)`.
- [ ] `dayBoundary.ts` (design §3.2): `logicalDate(ts: Date, dayEndsAt: number): string`, `logicalToday(now, dayEndsAt)`, `dayRolloverAt(date, dayEndsAt): Date`. Tests: dayEndsAt 0 and 3; 01:30 with 3 → previous day; 03:00 with 3 → same day; month and year boundaries (Jan 1 02:00 with 3 → Dec 31); DST spring-forward and fall-back in `America/New_York` (`*.tz.test.ts`).
- [ ] `vacationRules.ts`: `vacationCovers(vacations, goalId, date)` (scope all, or selected with the goal in `goalIds`); `activeVacation(vacations, today)`.
- [ ] `scheduleEngine.ts` (design §3.1): `effectiveVersion(versions, date)` (latest effectiveFrom ≤ date, tie → latest createdAt); `isScheduledOn(version, date)` per type; `isInActiveRange(goal, pauses, date, dayEndsAt)` (start, inclusive end, targetDays, pauses, archivedAt logical date); `isDue(ctx, date)` combining all incl. vacation; `eligibleWithoutVacation(ctx, date)`. Tests: every schedule type; customDays bitmask; everyNDays anchored to the effective version's effectiveFrom across a version change; version tie-break; endDate inclusive; targetDays; open and closed pauses; archived; vacation all/selected.
- [ ] Commit "Add date helpers, logical day and schedule engine".

### Task 2: Day status, timesPerWeek scoring, streaks

**Files:** `src/domain/dayStatus.ts`, `src/domain/weekScoring.ts`, `src/domain/streaks.ts`, tests.

- [ ] `dayStatus.ts` (design §3.3): `dayStatus(ctx, logs, date, today): DayStatus` with `DayStatus = 'done'|'partial'|'skipped'|'vacation'|'missed'|'pending'|'not-due'` in the design's evaluation order; also returns `value` and `ratio` (doneSlots/slots or value/target, capped 1). Slots resolved from the effective version for the date's weekday.
- [ ] `weekScoring.ts` (§3.4): `scoreWeek(ctx, logs, weekStartDate, today, weekStart)` → `{ eligibleDays, vacationDays, adjustedTarget, doneDays, credited, missed, ended, neutral }`; `quotaMet(...)` for Today/reminders.
- [ ] `streaks.ts` (§3.5): `currentStreak`, `bestStreak` for daily-type and timesPerWeek (dispatch on effective version type per day/week; a version change between types counts each segment by its own rule in order), `milestoneReached(before, after)` → 7|30|100|null.
- [ ] Tests: done/partial/skipped/vacation/missed/pending/not-due; logs on not-due and vacation days ignored; slots all/some; count sums multiple slot logs; "at least" (value > target is done); timesPerWeek adjusted target with vacations (round up), zero eligible → neutral, current week pending; streak neutral days, partial breaks, today pending keeps streak, schedule version change keeps past scoring; milestones.
- [ ] Commit "Add day status, weekly scoring and streaks".

### Task 3: Stats and review builder

**Files:** `src/domain/statsCalculator.ts`, `src/domain/reviewBuilder.ts`, tests.

- [ ] `statsCalculator.ts` (§3.6): `rangeBounds(range, today, earliestStart)` for `'7D'|'30D'|'90D'|'1Y'|'All'`; `completion(goals ctx[], logs, from, to, today, mode: 'weighted'|'strict')` → `{ credit, denominator, percent, done, partial, skipped, vacation, missed }`; `dailySeries` (for heatmap and trend), `weeklyBars(weekStart)`, `perGoal`, `bestWeekday`. Editing a schedule leaves past stats unchanged (test: add a version today, past range result identical).
- [ ] `reviewBuilder.ts` (§3.7, CLAUDE.md §5.8): `periodBounds(period: { kind: 'week'|'month', anchor: string }, weekStart)`, `previousPeriod`, `buildReview(...)` → overall %, delta vs previous, per-goal %, best/worst goal, streaks gained/lost, best weekday, best time slot (slot label or loggedAt bucket), totals done/skipped/vacation, `insights` (2–3, deterministic, ranked by magnitude; templates as data ids + params, rendered to text by a `formatInsight` that takes the strings table, so the domain stays string-free).
- [ ] Tests: weighted vs strict; timesPerWeek one unit per ended week; ranges; review month boundary and year boundary (Dec → Jan); insight ranking deterministic; "Reading improved 20% vs last week" example reproduced.
- [ ] Commit "Add stats calculator and review builder".

### Task 4: Reminder planner, backup policy, action queue, widget snapshot

**Files:** `src/domain/reminderPlanner.ts`, `src/domain/backupPolicy.ts`, `src/domain/actionQueue.ts`, `src/domain/widgetSnapshot.ts`, tests, `PROGRESS.md`.

- [ ] `reminderPlanner.ts` (§3.8, CLAUDE.md §5.9): `planReminders(input)` → sorted, capped (64) list of `{ id, kind: 'weekly', weekday, hour, minute } | { id, kind: 'date', at: string }` each with `goalId?`, `category: 'goal'|'review'|'backup'`, `title`/`body` keys, priority. Quiet hours (wrapping midnight), vacations, pauses, end dates, timesPerWeek quota met, `dayEndsAt` mapping, offsetMin, review reminders (weekly: last day of week at 19:00 per weekStart; monthly: 1st at 09:00) when enabled, backup reminder when overdue. Content: goal name only when app lock enabled.
- [ ] `backupPolicy.ts` (§3.9): `isBackupOverdue`, `showBackupBanner`, `snoozeUntil(now)`, `autoBackupFileName(now)`, `shouldAutoBackup(lastAutoDate, today)`, `filesToPrune(names)` (keep newest 7).
- [ ] `actionQueue.ts` (§4.7): `actionKey({ source, goalId, date, slotId, action, nonce })` deterministic; `applyAction(state, action)` pure reducer producing the log upsert (done → target value / status done; increment → +1 capped none, status from target; skip; snooze → no log, a reschedule request); `processQueue(pending, existingProcessedIds)` returns ops once per id. Tests: idempotency (same action twice → one op), ordering by createdAt, increment from widget twice with different nonces → +2.
- [ ] `widgetSnapshot.ts`: `buildWidgetSnapshot({ goals ctx, logs, today, groupId, hideGoalNames })` → `{ date, done, total, items: { goalId, name|null, status, progress }[] }` (max 4 items).
- [ ] Tests incl. a property-style loop: for 200 random seeds, planned notifications ≤ 64; vacation suppression; DST week in `*.tz.test.ts`.
- [ ] PROGRESS.md: Phase 3 status with real output; decision on ISO weekday convention.
- [ ] Commit "Add reminder planner, backup policy, action queue and widget snapshot".
