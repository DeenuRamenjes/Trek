# Phase 8 (Notifications and Action Queue) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Local reminders end to end: reconciler over `reminderPlanner`, permissions, Android channels, notification actions written to `pending_actions`, the action-queue processor, background task, time-zone handling, review and backup reminders.

**Architecture:**
- `src/services/notifications/` holds thin, mockable adapters over `expo-notifications`, `expo-task-manager` and `expo-background-task`. All decision logic lives in pure domain code (`src/domain/reminderPlanner.ts`, `src/domain/actionQueue.ts`) or in small pure helpers inside services that are unit-tested with the adapters mocked.
- `notificationsReconciler.ts`: `reconcile(deps)` loads inputs from the db + settings, calls `planReminders`, renders title/body from `src/strings/en.ts` (goal name only; never notes; while `appLock.enabled` the body is generic), lists scheduled notifications, cancels ids not desired and schedules desired ids missing or whose content key changed. Desired ids are deterministic from the planner.
- `actionQueueProcessor.ts`: `processPendingActions(db, now)` reads unprocessed rows ordered by createdAt, applies each with `applyAction` in one `withTransaction` per action (log upsert + `markProcessed`), skips deleted/archived goals (marks processed), and for `snooze` schedules a one-shot 10 minutes later with id `s:<actionId>`.
- Entry points (`src/services/notifications/setup.ts`, imported at module scope from `app/_layout.tsx`): `setNotificationHandler` (show while foreground), category `goal-reminder` with actions `mark-done` (no app open) and `snooze` (no app open), `TaskManager.defineTask` + `Notifications.registerTaskAsync` for background responses, foreground response listener, cold start via `getLastNotificationResponseAsync`; each writes `pending_actions` with id `n:<requestId>:<deliveredAtMs>:<actionId>` then triggers the processor. Background task (`expo-background-task`) runs processor + reconciler.
- App lifecycle hook `useNotificationsLifecycle()`: on start and foreground run processor then reconciler; compare `Intl.DateTimeFormat().resolvedOptions().timeZone` with `settings.lastKnownTimeZone` and update it (reconcile on change); reconcile after data changes (debounced subscription to `onDbChanged`) and relevant settings changes.
- Normative: design doc `docs/superpowers/specs/2026-10-05-trek-design.md` §3.8, §5.3, §5.5; CLAUDE.md §4.6, §4.7, §5.9, §5.8 (review reminders), §5.12 (backup reminder).

**Tech Stack:** expo-notifications, expo-task-manager, expo-background-task (approved; `EXPO_OFFLINE=1 npx expo install expo-notifications expo-task-manager expo-background-task`, then clean install; add config plugins to `app.json` as their docs require).

## Global Constraints

- Approved dependencies only; no native code outside them; no schema change.
- Weekday conversion: planner weekday is ISO 0 = Monday; expo-notifications weekly triggers use 1 = Sunday … 7 = Saturday. One tested helper `toExpoWeekday`.
- iOS pending notifications never exceed 64: the reconciler schedules at most the planner's capped list plus snoozes; test with 12 goals × 3 slots × 7 days.
- Android: one channel per goal (`goal-<goalId>`, name = goal name), plus `reviews` and `backup` channels; channels for deleted goals removed on reconcile. POST_NOTIFICATIONS permission requested via `requestPermissionsAsync`; exact alarms: if unavailable, fall back silently to inexact (expo default) and record `exactAlarms: false` for display in Settings later — no native code.
- Permission request UI is part of onboarding (Phase 13); this phase exposes `ensureNotificationPermission()` and a Settings row "Notifications" showing status with a button to request / open settings.
- Notification text from `src/strings/en.ts`; no emojis; never include notes.
- Deep links: review reminders open `trek://review/week-<date>` / `month-<yyyy-MM>`; goal reminders open Today; backup opens `/settings`. Map in one pure `notificationUrl(data)` with tests.
- Tests: mock adapters with jest; processor and reconciler tested against `createTestDb()`.
- Verification per task: `npx tsc --noEmit`, `npx jest`; phase end iOS + Android `expo export`.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_014qGP2qavm772yGiGc1rSw8`.

### Task 1: Action queue processor and notification response handling

**Files:** `package.json`, `app.json`, `src/services/notifications/{adapter.ts,responses.ts,setup.ts}`, `src/services/actionQueueProcessor.ts`, tests.

- [ ] Install deps; adapter wraps the expo APIs used (schedule, cancel, list scheduled, set category, set handler, channels, permissions, last response, add listeners, register task).
- [ ] `responses.ts`: `actionFromResponse(response) → PendingActionInsert | null` (id format above; `mark-done` → done; `snooze` → snooze; default tap → null) and `recordResponse(db, response)` (enqueue with conflict-do-nothing, then process).
- [ ] Processor per Architecture. Tests: idempotent replay (same id twice → one log change); crash mid-batch (first applied, second still pending, rerun applies only second); two increments with distinct ids → +2; snooze schedules `s:<id>` once even if processed twice; deleted/archived goal → marked processed, no log.
- [ ] `setup.ts` registers handler, category, background response task at module scope; import it at the top of `app/_layout.tsx`.
- [ ] Commit "Add action queue processor and notification responses".

### Task 2: Reconciler, channels, review and backup reminders

**Files:** `src/services/notifications/{reconciler.ts,content.ts,weekday.ts,url.ts,channels.ts}`, strings, tests.

- [ ] `reconcile(deps)` per Architecture with content rendering (`content.ts`) and the weekday helper; Android channels sync; deep-link `url.ts`.
- [ ] Tests: diff only schedules/cancels the difference (second run with no change → 0 calls); content change reschedules that id; ≤ 64 with 12 goals × 3 slots × 7 days reminders; vacation range suppresses occurrences; review reminders present per settings toggles; backup reminder when overdue; app lock on → generic body; weekday mapping all 7 days.
- [ ] Commit "Add notifications reconciler".

### Task 3: Lifecycle, background task, time zones, permissions UI

**Files:** `src/services/notifications/{lifecycle.ts,backgroundTask.ts,permissions.ts}`, `app/_layout.tsx`, Settings row, `src/services/notifications/useNotificationsLifecycle.ts`, tests, `PROGRESS.md`.

- [ ] Background task (`expo-background-task`, minimum interval 15 min) runs processor then reconciler; registered at module scope.
- [ ] Lifecycle hook per Architecture incl. time-zone change (updates `lastKnownTimeZone`, reconciles; widget refresh hook point left for Phase 12 as a no-op function `refreshWidgets()` in `src/services/widgetBridge.ts`).
- [ ] Permissions: `ensureNotificationPermission()`; Settings "Notifications" row with status text and action.
- [ ] Tests: foreground triggers process + reconcile; time-zone change updates setting and reconciles; db change triggers debounced reconcile; permission row states.
- [ ] PROGRESS.md Phase 8 section with real output; device-pending: weekly custom schedule fires on both platforms; vacation suppression; Mark done from killed app saved once; exact alarm fallback.
- [ ] Commit "Add notification lifecycle, background task and permissions".
