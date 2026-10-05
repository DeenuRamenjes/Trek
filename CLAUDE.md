# CLAUDE.md — Daily Goals (project spec, source of truth)

You are a senior React Native engineer who ships polished, offline-first Expo apps with refined motion design. Build "Daily Goals", a frontend-only mobile goal-tracking app for iOS and Android. NO backend, NO accounts, NO network calls, NO analytics. All data lives on-device.

Re-read this file at the start of every session. Keep `PROGRESS.md` updated (see "Working rules").

---

## 1. Hard constraints
- Stack: latest stable Expo SDK (57+), React Native New Architecture, TypeScript strict, Expo Router. Development builds only (not Expo Go).
- Approved dependencies ONLY:
  expo-sqlite, drizzle-orm, drizzle-kit, react-native-mmkv, zustand, zod, react-hook-form, date-fns, expo-localization,
  expo-notifications, expo-background-task, expo-file-system, expo-sharing, expo-document-picker,
  @office-kit/xlsx, jszip,
  react-native-reanimated (v4), moti, react-native-gesture-handler, @shopify/react-native-skia, victory-native, expo-haptics, expo-splash-screen,
  expo-local-authentication, expo-widgets (iOS), react-native-android-widget (Android),
  jest, @testing-library/react-native.
- NEVER install framer-motion. It is web-only. "Framer Motion-style" in this spec means Moti's `from`/`animate`/`exit`/`transition` API.
- STOP and ask before:
  - adding any other dependency;
  - changing the DB schema after Phase 2 (except via a new migration that I approve);
  - deleting files outside generated scaffolding;
  - writing native code outside the approved libraries.
- Only the goal name is required. Every optional field has a sensible default.
- Domain logic MUST be pure TypeScript with no React or Expo imports, and MUST be unit-tested. This covers scheduling, streaks, stats, vacation, reviews, reminder planning, backup policy and the action queue.
- The Excel export contains NO charts. Charts exist only inside the app.
- Deliver only what this spec asks for. Do not add features, screens or abstractions beyond it.

## 2. Architecture
```
app/                      Expo Router
  _layout.tsx             providers, splash handoff, app-lock gate
  (tabs)/today · stats · goals · settings
  goal/new · goal/[id] · goal/[id]/history
  group/[id] · review/[period] · vacation · settings/{appearance,backup,security,widget}
src/ui/                   tokens, ThemeProvider, components, motion/ (presets + Motion primitives)
src/features/             goals · groups · tracking · stats · history · vacation · reviews · reminders · appearance · security · backup · widgets
src/domain/               scheduleEngine · dayBoundary · streaks · statsCalculator · vacationRules · reviewBuilder · reminderPlanner · backupPolicy · actionQueue · zod schemas
src/db/                   Drizzle schema, migrations, repositories, live queries
src/services/             notificationsReconciler · actionQueueProcessor · widgetBridge · xlsxExporter · xlsxImporter · jsonBackup · csvExporter · autoBackup · appLock · errorLog
```

## 3. Data model
SQLite via Drizzle. UUID ids, versioned migrations, timestamps as ISO strings, dates as `YYYY-MM-DD` in the app's logical day (see 4.2).

- `goals`: id, name, icon, color, trackingType[check|count|duration|value], targetValue, unit, startDate, endDate?, targetDays?, pausedAt?, archivedAt?, sortOrder, createdAt, updatedAt
- `goal_schedule_versions`: id, goalId, effectiveFrom (date), scheduleType[daily|weekdays|weekends|customDays|everyNDays|timesPerWeek], scheduleDays (bitmask), everyNDays?, timesPerWeek?, createdAt
  - Editing a schedule INSERTS a new version effective from today. Past versions are never mutated.
- `goal_slots`: id, scheduleVersionId, weekday, time 'HH:mm', label?
- `reminders`: id, goalId, slotId?, weekday, time 'HH:mm', offsetMin, enabled
- `groups`: id, name, color, icon, sortOrder, createdAt, updatedAt
- `group_goals`: groupId, goalId (many-to-many)
- `logs`: id, goalId, date, slotId?, value, status[done|partial|skipped], note? (max 1000 chars), loggedAt, updatedAt
  - "missed" is NEVER stored (see 4.3).
- `vacations`: id, startDate, endDate, scope[all|selected], note?, createdAt, updatedAt
- `vacation_goals`: vacationId, goalId
- `pending_actions`: id, source[notification|widget], goalId, date, slotId?, action[done|increment|skip|snooze], value?, createdAt, processedAt?

Settings live in MMKV via Zustand:
- `theme`[system|light|dark], `accentColor`, `weekStart`, `timeFormat`[12h|24h], `haptics`, `reduceMotionOverride`[system|on|off]
- `dayEndsAt`: hour 0–4, default 0
- `quietHours`{start,end}
- `homeEmptyStateMode`[allGoals|requireGroup], default allGoals
- `backupReminderFrequency`[off|weekly|biweekly|monthly], default biweekly
- `backupFormat`[xlsx|json|both], default both
- `autoBackupEnabled`, default true
- `androidBackupFolderUri?`, `lastBackupAt?`, `backupBannerSnoozedUntil?`
- `appLock`{enabled (default false), timeout[immediate|1m|5m|15m], hideInAppSwitcher (default true)}
- `widget`{hideGoalNames (default false), groupId?}
- `reviewNotifications`{weekly (default true), monthly (default true)}
- `lastKnownTimeZone`

## 4. Domain rules (must be unit-tested)

### 4.1 Schedules
A day is "due" for a goal only if all of these hold:
- The date is on or after `startDate`, before the end (`endDate` or `startDate + targetDays`), and the goal is neither paused nor archived on that date.
- The schedule version effective on that date says the day is due.
- The goal is not covered by a vacation on that date.

Always score a day against the schedule version that was effective THAT day.

### 4.2 Logical day
A timestamp belongs to the logical date `localDate(timestamp − dayEndsAt hours)`. All check-ins, stats, reminders and widgets use this.

### 4.3 Status
A day's status is computed, never stored as "missed":
- **done**: the logged value reaches the target.
- **partial**: there is progress below the target.
- **skipped**: the user marked the day skipped.
- **vacation**: a vacation covers the day.
- **missed**: the day is due and fully in the past with no done, partial or skipped log.
- **pending**: today, not yet complete.
- **not-due**: otherwise.

### 4.4 Streaks
- **Daily-type schedules:** a streak counts consecutive due days that are done. Skipped, vacation and not-due days are neutral: they neither break nor extend the streak. A partial or missed day breaks it.
- **timesPerWeek goals:** a streak counts consecutive weeks (respecting `weekStart`) in which completed days reach the target. Vacation days reduce that week's target proportionally (round up). The current week is pending until it ends.

### 4.5 Stats
`completion % = done / (due − skipped − vacation)`. Partial counts as `value/target` in the "weighted" mode and as 0 in "strict" mode. Default to weighted, toggle on the Stats tab.

### 4.6 Time zones
Dates and reminders follow the device's current local time zone. On app foreground, compare it with `lastKnownTimeZone`. If it changed, re-run the reminder reconciler and refresh the widgets.

### 4.7 Action queue
Notification and widget actions are written to `pending_actions` first, then processed idempotently. They are applied on app start, on foreground, in the background task, and immediately when the app is running. Processing marks `processedAt`. The same action is never applied twice.

## 5. Features

### 5.1 Splash and motion system
- `expo-splash-screen` shows a static native splash (app icon on the theme background). It is held until fonts, DB migrations and settings are ready.
- Then hand off to an animated splash built with Moti and Reanimated (Skia allowed for the logo stroke):
  - logo draw-in or scale-up with spring;
  - app name fades and slides up;
  - total ≤ 1.2 s;
  - cross-fade into the first screen.
- The animated splash is skipped instantly when reduce motion is on.
- Motion MUST run everywhere through a shared `src/ui/motion` module:
  - Duration tokens: 150, 250, 400 ms. Spring presets: gentle, snappy, bouncy. Easing tokens.
  - Primitives: FadeIn, SlideUp, ScaleIn, Stagger, PressableScale, AnimatedNumber, Skeleton, Collapse, AnimatedCheck.
- Required animations:
  - screen transitions;
  - list items staggering in on mount and animating on exit (Moti `exit` / Reanimated layout animations);
  - check-off: checkmark draw, haptic, and a confetti burst on a streak milestone (7/30/100);
  - progress rings and charts animating to their values;
  - animated tab bar indicator;
  - collapsible form sections;
  - the dropdown on the Stats tab;
  - calendar month swipes;
  - number counters on the review screens;
  - the theme change cross-fade;
  - the app-lock screen.
- Every animation MUST collapse to instant when reduce motion is on (system setting or `reduceMotionOverride`).
- Animate only transform and opacity. Target 60 fps on a mid-range Android device.
- Moti compatibility: in Phase 1, verify that Moti works with the installed Reanimated 4. If it doesn't, STOP and propose implementing the same primitives with Reanimated 4 layout animations and CSS transitions behind the identical `src/ui/motion` API.

### 5.2 Goals
- Create, edit, duplicate, pause, archive and reorder (drag) goals.
- Collapsed optional sections:
  - Schedule (all types; edits create a new schedule version, with a note: "Changes apply from today; past stats are kept").
  - Times per day: different times per weekday, multiple slots.
  - Tracking type and target.
  - Duration: target days, end date, or open-ended.
  - Reminders.
  - Appearance: a curated palette valid in light and dark mode, a custom picker with a WCAG AA contrast check, and an icon or emoji.
- Templates: Water, Workout, Reading, Meditation.

### 5.3 Today tab
- A due-today checklist on the logical day.
- Tap or swipe to complete, increment counters, or mark skipped.
- Undo toast and haptics.
- A date strip for logging past days.
- A vacation banner when a vacation is active.
- The backup-overdue banner (5.12).

### 5.4 Groups
Create and reorder groups. Add goals by multi-select. Each group has a color and icon. A goal can belong to multiple groups.

### 5.5 Stats tab (home)
- A top dropdown listing the groups plus "All goals".
- If `homeEmptyStateMode=requireGroup` and no groups exist, show the empty state "Create a group with goals to see statistics" with a call-to-action button. Otherwise default to "All goals" with a soft "Create a group" card.
- Charts:
  - completion ring;
  - current and best streak;
  - calendar heatmap;
  - weekly bars;
  - trend line;
  - per-goal comparison;
  - best weekday.
- Range selector: 7D, 30D, 90D, 1Y, All. Plus the weighted/strict toggle.
- Entry points to the weekly and monthly reviews.

### 5.6 Goal history calendar
- `goal/[id]/history`: a month grid with swipe between months.
- Each day shows its status (4.3) by color AND icon or fill, plus a value badge for count, duration and value goals.
- Tapping a day opens a bottom sheet to set status, value or note, or to clear the entry. Future days are read-only.
- Header: current streak, best streak, this month's completion %.

### 5.7 Vacation mode
- Set a date range (start can be today or in the future) for all goals or selected goals, with an optional note.
- Vacation days are neutral for streaks and excluded from stats denominators (4.4, 4.5).
- Reminders for affected goals are suppressed during the range.
- Show an active banner on the Today tab with "End vacation now".
- Manage past and upcoming vacations in a list.

### 5.8 Weekly and monthly review
- `review/[period]`, where the period is a week or a month. Users can navigate to previous periods.
- Contents:
  - overall completion % with the change versus the previous period;
  - per-goal completion bars;
  - best and worst goals;
  - streaks gained and lost;
  - best weekday and time slot;
  - total done, skipped and vacation days.
- Add 2–3 plain-language insights generated deterministically by `reviewBuilder`. Example: "Reading improved 20% vs last week."
- Optional notifications: weekly on Sunday at 19:00 (or the last day of the week per `weekStart`), and monthly on the 1st at 09:00. Both deep-link to the review.

### 5.9 Reminders
- Use `expo-notifications` with repeating weekly calendar triggers, one per weekday + time.
- A reconciler computes the desired set via `reminderPlanner` from the DB. The planner accounts for schedule versions, vacations, pauses, quiet hours and `dayEndsAt`. The reconciler diffs the desired set against pending notifications and schedules or cancels only the difference.
- It MUST keep iOS pending notifications at 64 or fewer. Priority order: soonest goal reminders, then review reminders, then the backup reminder.
- When to run it: on app foreground, after any change to goals, reminders, vacations or settings, after import, after a time-zone change, and in `expo-background-task`.
- Notification actions:
  - "Mark done" and "Snooze 10 min".
  - Both are written to `pending_actions` (4.7).
  - "Mark done" does not open the app.
  - On iOS, a cold-start response is recovered via `getLastNotificationResponseAsync`.
- Android: one channel per goal, plus permission flows for POST_NOTIFICATIONS and exact alarms with a graceful fallback to inexact alarms.
- iOS: call `setNotificationHandler` before first render so notifications show while the app is in the foreground.

### 5.10 Appearance
- Light, dark or system theme. An accent color that generates a full tonal palette.
- Week start, 12/24h time, `dayEndsAt` (labeled "My day ends at"), haptics, and the reduce-motion override.
- All colors come from theme tokens. No hard-coded colors in components. Respect system font scaling.

### 5.11 App lock
Settings → Security. Off by default and enabled only if the user turns it on.
- **Enabling:** requires a successful `expo-local-authentication` check. Biometrics are used with the device passcode as fallback. If the device has no enrolled security, explain and keep the lock off.
- **Locking:** the app locks on cold start and after returning from background past the timeout.
- **Lock screen:** animated, with an "Unlock" button. On repeated failure, fall back to the device passcode. The app never stores its own PIN.
- **App switcher:** when `hideInAppSwitcher` is on, show a blurred privacy overlay while the app is inactive.
- **Notifications and widgets:** while the lock is on, notification bodies show only the goal name, never notes. The widget respects `widget.hideGoalNames`.

### 5.12 Export, import and backup
**Export** (Settings → Backup)
- Formats: Excel (.xlsx, default), JSON (lossless), and CSV (.zip, one file per table). Share via `expo-sharing`.
- Excel is written with `@office-kit/xlsx` and contains NO charts. Sheets:
  - **README:** what each sheet contains and how to re-import.
  - **Dashboard:** summary tables per goal and per group (completion %, done/partial/skipped/vacation/missed counts, current and best streak, last-30-day rate).
    - Use ONLY COUNTIFS, SUMIFS, AVERAGEIFS, IFERROR, IF, MAX, MIN. NEVER use FILTER, LET, XLOOKUP or dynamic arrays.
    - Every formula cell MUST carry its app-computed cached result.
    - Streak and missed cells hold app-computed values labeled "calculated by app".
    - Use data bars and color scales for emphasis.
  - **Raw tables:** Goals, ScheduleVersions, Slots, Reminders, Groups, GroupGoals, Logs, Vacations, VacationGoals.
    - Frozen header rows and stable IDs.
    - ID, date and time columns are formatted as TEXT.
    - Sheets are protected without a password.
  - **Settings** (excluding the app-lock state).
  - **_Meta:** schemaVersion, appVersion, exportedAt, format "daily-goals-xlsx".

**Import** (xlsx, JSON or CSV zip via `expo-document-picker`)
- Read ONLY the raw sheets plus _Meta.
- Match columns by HEADER NAME (case-insensitive, trimmed). Ignore blank rows and unknown columns.
- Coerce converted values: time decimals back to HH:mm, date serials back to YYYY-MM-DD, numeric-looking IDs back to text.
- Accept files re-saved from Excel, Google Sheets or Numbers.
- Reject files with a newer `schemaVersion`.
- Validate every row with the shared zod schemas.
- Show a preview: counts plus row-level errors (sheet and row). Invalid rows are skipped only after the user confirms.
- Offer Replace or Merge (match by id; the newer `updatedAt` wins).
- ALWAYS create a JSON backup first.
- Write in one transaction, then re-run the reminder reconciler and refresh the widgets.
- Excel and JSON MUST round-trip with zero data loss.

**Backup reminder**
- Frequency: Off, Weekly, Every 2 weeks, Monthly. Format: Excel, JSON or Both.
- When a backup is overdue: send a local notification (lowest priority) AND show a Today banner "Last backup N days ago · Back up now". The banner offers a one-tap backup and a 3-day snooze.
- Any successful export updates `lastBackupAt`.

**Silent auto-backup** (default ON)
- On the first app open each logical day, write a JSON backup to `documentDirectory/backups`. Keep the newest 7.
- Android: offer "Choose backup folder" via the StorageAccessFramework, write there too, and handle revoked access.
- iOS: set `UIFileSharingEnabled` and `LSSupportsOpeningDocumentsInPlace` so backups are visible in the Files app.
- "Restore from auto-backup" lists backups with date and size, and uses the import preview flow.

### 5.13 Home-screen widgets
- **iOS:** `expo-widgets`, in small and medium sizes.
- **Android:** `react-native-android-widget`, resizable from 2×2 up to 4×2.
  - At the start of the phase, verify SDK 57 and New Architecture support. If unsupported, STOP and report options.
- **Content:**
  - today's due goals for the selected group (default "All goals") with progress;
  - a "done/total" ring;
  - small: ring plus count; medium: up to 4 goals.
- **Interaction:** tapping a goal row marks it done, or increments it for count goals. Use interactive widgets where the platform supports them; otherwise deep-link into the app.
  - The widget writes to shared storage (an iOS App Group, Android SharedPreferences) as `pending_actions`. The app imports and processes these (4.7).
  - The app pushes a fresh widget snapshot after every log change, on the day rollover (`dayEndsAt`), and after import.
- **Settings → Widget:** choose the group, hide goal names, and show a preview.

### 5.14 Error log
Catch unhandled JS errors and failed operations. Append them to a rotating local log file (max 500 KB). Settings → About → "Export error log" shares it. Never send it anywhere automatically.

## 6. UI rules
- Minimal and calm: generous spacing, an 8pt grid, at most 2 font weights, rounded cards, one accent color.
- Tabs: Today · Stats · Goals · Settings.
- Minimum tap target 44pt. Every control has an `accessibilityLabel`. Status MUST NOT be shown by color alone.
- Every list has a designed empty state.
- A 3-screen animated first-run onboarding requests notification permission on the last screen.
- All user-facing strings live in one strings file, ready for translation.

## 7. Phases
Each phase is executed only when the user says "Run Phase N".
0. **Design:** create `DESIGN.md` covering tokens, typography, motion tokens, and screen-by-screen layouts for Today, Stats, Create Goal, History, Review, Settings, Lock and Splash. Build a dev-only `/design-preview` route that renders the key screens with mock data. STOP for approval.
1. **Scaffold:**
   - Expo project, dev-build config, ThemeProvider and tokens.
   - The `src/ui/motion` module, including the Moti and Reanimated 4 compatibility check.
   - Native splash plus the animated splash, and tab navigation with animated transitions.
2. **Data:** DB schema and migrations, repositories, and a dev seed script (3 years of logs, 12 goals, 3 groups, 2 vacations, schedule changes).
3. **Domain** (all of section 4 plus `reviewBuilder`, `reminderPlanner` and `backupPolicy`), with unit tests covering:
   - every schedule type and schedule versioning;
   - skipped, vacation and paused days;
   - `dayEndsAt` = 0 and 3;
   - DST changes and time-zone changes;
   - month and year boundaries;
   - timesPerWeek streaks;
   - action-queue idempotency.
4. Goals create/edit flow and the Today tab.
5. Groups and the Stats tab.
6. Goal history calendar and vacation mode.
7. Weekly and monthly review.
8. **Notifications:**
   - the reconciler, permissions and actions;
   - the action queue processor;
   - a test that pending notifications never exceed 64.
9. Appearance settings and app lock.
10. **Export proof of concept:** inside React Native, generate an xlsx with formulas plus cached values, TEXT columns and data bars, then share it. Verify it opens in Excel, Google Sheets and the iOS Files preview. If anything fails, STOP and report.
11. **Export, import and backup:**
    - full export, import, the backup reminder, auto-backup and restore;
    - round-trip tests for xlsx and JSON;
    - a converted-values import test (reordered columns, a blank row, decimal times);
    - a merge-conflict test.
12. **Widgets:** iOS and Android, with an end-to-end check that a widget tap leads to `pending_actions`, then a log, then a refreshed widget.
13. **Polish:**
    - an accessibility pass and a reduce-motion pass;
    - empty states and onboarding;
    - the error log;
    - a performance check with the 3-year seed: smooth lists, the Stats tab rendering in under 500 ms, and 60 fps animations on a mid-range Android device.

## 8. Working rules
- Execute ONE phase per request. Do not start the next phase.
- Keep `PROGRESS.md` updated: phase status, decisions made, deviations from this spec (with the reason), and open questions.
- At the end of each phase, report: `✅ Phase N: <what was done> · Tests: <commands run + results> · Next: <what Phase N+1 will do>`. Then STOP.
- Ground every progress claim in actual command output. Never claim a test passed without running it.
- Run `npx tsc --noEmit` and `npx jest` before reporting any phase complete.

## 9. Done when
- All unit tests pass and TypeScript compiles with 0 errors.
- The xlsx and JSON round-trips, the converted-values import test and the merge test pass.
- The exported xlsx shows correct values in Excel, Google Sheets and the iOS Files preview.
- Reminders fire correctly on a weekly custom schedule on both platforms. iOS pending notifications never exceed 64. Reminders are suppressed during a vacation.
- Editing a schedule leaves past stats unchanged.
- A check-in at 01:30 with `dayEndsAt`=3 counts for the previous day.
- "Mark done" from a notification and from a widget is saved exactly once, including from a killed app.
- The app lock works and hides content in the app switcher.
- The backup reminder fires when overdue, auto-backup keeps exactly 7 files, and restore works.
- The splash and all animations respect reduce motion, and the app works fully in airplane mode.