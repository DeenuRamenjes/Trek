# Trek — Design (brainstorm outcome)

- Date: 2026-10-05
- Status: awaiting "design approved"
- Source of truth: `CLAUDE.md`. This document does NOT restate CLAUDE.md. It records only (1) resolutions of gaps, ambiguities and contradictions found in CLAUDE.md, (2) UX and motion detail for the key screens, (3) designs for the risky areas, and (4) the explicit CLAUDE.md diffs that will be applied after approval.
- Anything not covered here follows CLAUDE.md as written.

---

## 1. Findings that triggered changes

| Finding | Evidence |
|---|---|
| Moti cannot be installed without framer-motion | `moti@0.30.0` (last published 2025-01-29) lists `framer-motion ^6.5.1` in `dependencies`; `build/core/index.js` re-exports `AnimatePresence` from `framer-motion` and `build/core/motify.js` imports `usePresence`. CLAUDE.md §1 forbids installing framer-motion. |
| Phase 0 needs a project | Phase 0 requires a `/design-preview` route and every plan must pass `npx tsc --noEmit` and `npx jest`, but the Expo project is only created in Phase 1. |
| Approved libraries need unlisted peers | e.g. `react-native-reanimated@4.7.1` peers `react-native-worklets 0.13.x`; `react-native-mmkv@4.3.2` peers `react-native-nitro-modules`; `expo-router` peers `react-native-screens`, `react-native-safe-area-context`, `expo-linking`, `expo-constants`; `@testing-library/react-native@14` peers `test-renderer`. |
| Pause history is lost | `goals.pausedAt` is a single field; resuming erases the paused range, which would turn paused days into "missed" and change past stats. |
| Slots, timesPerWeek, value goals are under-specified | §4.3/§4.5 are per-day and do not define slot aggregation, which days are due for a weekly quota, or the direction of a value target. |
| Weekly triggers cannot express several rules | everyNDays does not align to weekdays; a weekly trigger cannot skip only vacation/pause/end weeks; a weekly quota cannot stop reminders once met. |
| "Stats tab (home)" vs tab order | §5.5 calls Stats "home"; §6 lists Today first. |
| `@office-kit/xlsx` runtime | v0.23.4 is ESM-only (`"type": "module"`, `import`-only exports), pure JS (fflate, saxes, fast-xml-parser), uses `TextDecoder`. Supports formulas, conditional formatting, protection, number formats, freeze panes. |
| `expo-widgets` interaction model | v57.0.22: a widget button runs an `AppIntent` in the extension that evaluates the widget's JS handler, merges returned props into the App Group `UserDefaults` timeline, and emits `onExpoWidgetsUserInteraction` to a running app. No dedicated shared key-value API is exposed. |
| Execution environment | The cloud container has no iOS or Android simulator. |

## 2. Decisions (user answers)

| # | Topic | Decision |
|---|---|---|
| Q1 | Moti vs framer-motion | Drop Moti. Build `src/ui/motion` on Reanimated 4 only, keeping the `from`/`animate`/`exit`/`transition` prop style. |
| Q2 | Phase 0 | Phase 0 creates a minimal Expo SDK 57 scaffold (TS strict, Expo Router, jest), static tokens, `DESIGN.md` and `/design-preview` with mock data (no motion). Phase 1 completes the scaffold. |
| Q3 | Device-only checks | Automated checks gate each phase. Device-only items are deferred to Phase 13 in one batch and recorded as "device verification pending"; they are never claimed as passed. |
| Q4 | Implied dependencies | Approve the whole list in D2. |
| Q5 | Pause history | New `goal_pauses` table. |
| Q6 | Slots | Check goals: per-slot; other types: per-day target, slots are reminder/log times only. |
| Q7 | timesPerWeek | The week is the unit. |
| Q8 | Value goals / one-tap | All targets mean "at least". One-tap "done" sets value = target for every type. |
| Q9 | Reminder triggers | Hybrid weekly + dated triggers. |
| Q10 | Launch screen | App opens on Today. |
| — | App name | The app is called **Trek** (user instruction). |
| — | Icons | No emojis anywhere; icons only (user instruction). |
| — | Identifiers | Bundle id `com.deenuramenjes.trek`, App Group `group.com.deenuramenjes.trek`, URL scheme `trek`. |

## 3. Domain rule clarifications

All in pure TypeScript under `src/domain` (date-fns only), written test-first.

### 3.1 Due-ness (§4.1)
A goal is due on date `d` when all hold:
- `startDate <= d`, and `d <= endDate` (inclusive) when `endDate` is set, and `d < startDate + targetDays` when `targetDays` is set (i.e. exactly `targetDays` days starting at `startDate`).
- No `goal_pauses` row covers `d` (`startDate <= d` and (`endDate` is null or `d <= endDate`)).
- `archivedAt` is null or `d` is before the logical date of `archivedAt`.
- The schedule version effective on `d` says `d` is due.
- No vacation covers the goal on `d`.

Schedule version resolution: the version with the latest `effectiveFrom <= d`; ties broken by latest `createdAt`. Editing a schedule inserts a version with `effectiveFrom` = logical today; past versions are never mutated. The first version's `effectiveFrom` is the goal's `startDate`.

Schedule types:
- `daily`: every day. `weekdays`: Mon–Fri. `weekends`: Sat–Sun. `customDays`: `scheduleDays` bitmask (bit 0 = Monday … bit 6 = Sunday, ISO order; independent of `weekStart`).
- `everyNDays`: due when `differenceInCalendarDays(d, version.effectiveFrom) % everyNDays === 0`.
- `timesPerWeek`: every day is eligible; see 3.4.

Pause / resume: pausing inserts an open `goal_pauses` row starting at logical today and sets `goals.pausedAt`. Resuming sets that row's `endDate` to logical yesterday (or deletes the row if it started today) and clears `goals.pausedAt`. Unarchive is not in scope.

### 3.2 Logical day (§4.2)
`logicalDate(ts, dayEndsAt) = format(subHours(ts, dayEndsAt), 'yyyy-MM-dd')` in the device's current time zone. Changing `dayEndsAt` or the time zone never rewrites stored dates.

### 3.3 Day status (§4.3), evaluated in this order
1. **vacation** — a vacation covers the goal on the date. Existing logs are kept and shown with a badge but are not counted.
2. **not-due** — the goal is not due for any other reason (3.1). Existing logs are shown as "extra" and not counted.
3. **skipped** — a log with status `skipped` exists for the date.
4. **done** / **partial** —
   - Check goals with slots: done when every slot of the effective version has a done log; partial when at least one but not all.
   - Check goals without slots: done when a done log exists.
   - Count, duration, value: the day's value is the sum of the day's logs; done when value >= target ("at least"); partial when 0 < value < target.
5. **pending** — the date is the logical today.
6. **missed** — the date is in the past.
7. Future dates are **not-due**. The UI may draw a faint "scheduled" dot on future due days; that is display only.

Logs are unique per (goalId, date, slotId), with a null slotId treated as one value. Increments update that row.

### 3.4 timesPerWeek goals
- Weeks follow `weekStart`.
- Eligible days of a week = days that pass every rule in 3.1 except vacation.
- Adjusted target = `ceil(target × (eligibleDays − vacationDays) / eligibleDays)`. A target of 0 (or 0 eligible days) makes the week neutral.
- Days with no log are neutral (never "missed").
- When the week has ended: credited = min(done days, adjusted target); missed = adjusted target − credited.
- The current week is pending until it ends.
- The goal stays on Today until the week's quota is met.

### 3.5 Streaks (§4.4)
- Daily-type schedules: count consecutive due days that are done. Skipped, vacation and not-due days are neutral. Partial or missed breaks the streak. Today being pending never breaks the current streak.
- timesPerWeek: consecutive weeks where credited >= adjusted target; neutral weeks are skipped over; the current week is pending.
- Best streak = longest run over the whole history.
- A milestone fires when a check-off moves the current streak onto exactly 7, 30 or 100.

### 3.6 Stats (§4.5)
- Completion % = Σ credit / Σ (due − skipped − vacation).
- Credit for a done day = 1. For a partial day: weighted = `min(value / target, 1)`, strict = 0. Check goals with slots use `doneSlots / slots` as the partial ratio.
- timesPerWeek goals contribute one unit per ended week (credit = credited / adjusted target); the current week is excluded.
- Ranges 7D, 30D, 90D, 1Y end at the logical today; "All" starts at the earliest goal `startDate`.

### 3.7 Reviews
- A period is a week (per `weekStart`) or a calendar month.
- "Best time slot" uses the slot label when the goal has slots, otherwise a time-of-day bucket from `loggedAt`: morning 05–12, afternoon 12–17, evening 17–22, night 22–05.
- Insights: a fixed set of deterministic rule templates (improved / declined vs previous period, best streak gained, most skipped weekday, perfect week/month), ranked by magnitude of change; show the top 2–3. Example: "Reading improved 20% vs last week."

### 3.8 Reminder planner
- Inputs: goals, versions, slots, reminders, vacations, pauses, logs (current week, for timesPerWeek), settings (`dayEndsAt`, `quietHours`, `weekStart`, review toggles, backup policy state), `now`, time zone.
- Horizon: 14 days.
- For each reminder (weekday + time + offset): compute its occurrences in the horizon, mapping times earlier than `dayEndsAt` onto the previous logical day.
  - If every occurrence is due and none is suppressed → one `{ kind: 'weekly', weekday, hour, minute }`.
  - Otherwise → one `{ kind: 'date', at }` per due, non-suppressed occurrence.
- Suppressed: inside quiet hours, covered by a vacation or pause, after the end, or (timesPerWeek) the week's quota already met.
- Each entry has a deterministic id, a content key and a priority. Sort by priority class (goal reminders, then review, then backup), then by next fire time. Cap the result at 64.
- While app lock is on, the content is the goal name only, never notes.

### 3.9 Backup policy
- Overdue when `now − lastBackupAt` > frequency (weekly 7, biweekly 14, monthly 30 days). With no `lastBackupAt`, count from the earliest goal `createdAt`; with no goals, never overdue.
- The banner is hidden while `now < backupBannerSnoozedUntil` (snooze = 3 days).
- Auto-backup: on the first open of each logical day, write `trek-backup-<yyyyMMdd-HHmmss>.json`; keep the newest 7 by the timestamp in the file name.

### 3.10 Other inputs
- Today's date strip shows the logical today and the 6 previous days. Future dates are read-only everywhere.

## 4. UX and motion

### 4.1 Motion tokens and rules
- Durations: `fast` 150, `base` 250, `slow` 400 ms.
- Springs: `gentle` (damping 20, stiffness 120), `snappy` (damping 18, stiffness 260), `bouncy` (damping 10, stiffness 180).
- Easing: `standard` cubic(0.2, 0, 0, 1), `enter` cubic(0, 0, 0, 1), `exit` cubic(0.3, 0, 1, 1).
- Stagger: 40 ms per item, capped at 8 items.
- Only transform and opacity are animated, except Reanimated layout transitions (entering, exiting, list reflow, Collapse).
- Reduce motion: `ReducedMotionConfig` is driven by the system setting and `reduceMotionOverride`; every primitive also reads `useMotionPreference()` and jumps to its end state.

### 4.2 Icons
- No emojis anywhere: UI, goal icons, widgets, notifications, exports, strings.
- Goal icons come from a curated list of `@expo/vector-icons` glyph names stored as `goals.icon` / `groups.icon`.
- Status glyphs (history, Today, widget) are icons, so status is never shown by color alone.

### 4.3 Splash
- The native splash (app icon on the theme background) is held until migrations, settings and the icon font are ready.
- Overlay sequence: 0–500 ms the Skia Trek mark (a trail line climbing to a peak) draws its stroke while scaling 0.92→1 with `snappy`; 300–550 ms the "Trek" wordmark fades in and slides up 12 pt; hold; 950–1200 ms the overlay cross-fades out over the already-mounted Today screen. Total 1.2 s.
- With reduce motion on, the overlay never mounts.

### 4.4 Today (the app opens here)
- Header: the logical date, then a 7-day date strip with a selected pill that slides with `snappy`.
- Banners: vacation (with "End vacation now"), then backup overdue ("Last backup N days ago · Back up now", plus snooze). They slide down and collapse away.
- Rows: a Pending section, then a Done section. Each row: icon, name, progress text, primary control.
- Gestures:
  - Tap = primary action: check toggles done; count +1; duration +5 min; value opens a number sheet.
  - Swipe right = done (sets value to target).
  - Swipe left = skipped.
  - Long-press = log sheet (value and note).
- Multi-slot check goals show slot chips (e.g. `08:00` with a check icon, `14:00`, `21:00`), each tappable. timesPerWeek goals show "2 of 3 this week".
- Check-off: the checkmark draws in 250 ms with a success haptic; the row dims to 60% opacity and moves to Done with a layout transition; an undo toast shows for 4 s. A streak milestone adds a Skia confetti burst (900 ms, transform and opacity only).
- Empty states: no goals → "Create your first goal" with template chips. All done → "All done for today".

### 4.5 Stats (dashboard tab)
- Top dropdown (groups plus "All goals"): opacity plus scale 0.96→1, 150 ms.
- Range segmented control (7D, 30D, 90D, 1Y, All) with a sliding indicator; weighted/strict toggle.
- Cards stagger in: completion ring (Skia arc, 400 ms `gentle`), current and best streak (AnimatedNumber), calendar heatmap (one Skia canvas), weekly bars and trend line (victory-native), per-goal comparison, best weekday, weekly and monthly review entry cards.
- A skeleton shows while stats compute.
- Empty state per `homeEmptyStateMode`; otherwise the soft "Create a group" card.

### 4.6 Create / edit goal
- Name field (autofocus) and template chips (Water, Workout, Reading, Meditation) at the top.
- Collapsible sections, each with a one-line summary of its value (e.g. "Schedule · Every day"); Collapse fades content and reflows with a layout transition.
- Sticky Save button, enabled once the name is non-empty. Schedule edits show "Changes apply from today; past stats are kept".
- Appearance: palette swatches valid in light and dark, a custom hue/lightness picker (Skia plus gesture handler) with an AA pass/fail badge, and an icon picker (no emoji).

### 4.7 History calendar
- Header: current streak, best streak, this month's completion %.
- 7-column month grid. A pan gesture tracks the finger; past 25% of the width or a fast flick it springs to the next or previous month, otherwise it springs back.
- Cell glyphs: done = filled circle with check; partial = half-filled ring; skipped = dash; vacation = sun icon; missed = hollow ring with a cross icon; pending = dotted ring; not-due = muted day number. Count, duration and value goals show a value badge. timesPerWeek rows end with a "2/3" quota pill.
- Tapping a past or current day opens a bottom sheet (Reanimated plus gesture handler): status, value stepper, note with a 1000-character counter, Clear. Future days are read-only.

### 4.8 Review
- Header with period navigation: `‹ Week 40 ›` or `‹ October ›`.
- Large completion % counter (AnimatedNumber, 400 ms) with an up/down arrow-icon change chip vs the previous period.
- Staggered per-goal bars, best and worst goals, streaks gained and lost, best weekday and slot, done/skipped/vacation totals, 2–3 insight cards.

### 4.9 Lock
- Themed full screen: the logo scales in (`bouncy`), "Trek is locked", and the Unlock button slides up.
- The system authentication prompt opens automatically when the screen appears.
- Failure: horizontal shake (spring) and an error haptic; repeated failure falls back to the device passcode.
- Success: the lock fades out over 250 ms while content scales 0.98→1.
- Privacy overlay: `expo-blur` BlurView with the logo, shown while the app is inactive or backgrounded and `hideInAppSwitcher` is on.

### 4.10 Widget
- Small: a done/total ring, "3/5" and "Today".
- Medium: the ring plus up to 4 rows (icon, name, progress); each row is a tap target.
- With `hideGoalNames` on, rows show icon and progress only, labelled "Goal 1" to "Goal 4".
- The Settings → Widget preview reuses the same layout description.

## 5. Risky areas

### 5.1 Motion on Reanimated 4
- `src/ui/motion` is the only module that imports Reanimated's entering, exiting and layout-transition APIs.
- Gesture-driven code (swipe rows, month pan, bottom sheet, drag reorder) may use `useSharedValue` / `useAnimatedStyle` directly but must take durations and springs from the motion tokens.
- `<Motion from animate exit transition>`: `from` + `animate` become a custom entering animation; `exit` becomes an exiting animation; later changes to `animate` run through `withTiming` / `withSpring`. Only transform and opacity keys are accepted (enforced by types).
- Primitives: FadeIn, SlideUp, ScaleIn, Stagger, PressableScale, AnimatedNumber, Skeleton, Collapse, AnimatedCheck.
- Tests: Reanimated's jest mock; one render test per primitive covering the reduce-motion path (end state applied immediately).
- Phase 1 adds a dev-only `/motion-check` screen exercising every primitive, used by the Phase 13 device batch.

### 5.2 Widget data sharing
- Pure domain module `widgetSnapshot` builds `WidgetSnapshotV1 { date, groupId, ring: { done, total }, rows: [{ goalId, icon, label, progress, kind }] (max 4) }`.
- iOS (`expo-widgets`): the app calls `updateSnapshot(props)`. A row button's JS handler (running in the extension) appends `{ id: "w:<goalId>:<date>:<tapMs>", goalId, date, action }` to `props.pendingWidgetActions` and optimistically updates the ring. The App Group timeline persists this even when the app is killed. The app reads `getTimeline()` on start and on foreground and listens to `addUserInteractionListener` while running; it upserts the entries into `pending_actions`, processes them, then pushes a fresh snapshot with an empty list.
- Android (`react-native-android-widget`): the `widgetTaskHandler` click handler runs in the app process; it inserts into `pending_actions`, runs the processor and re-renders the widget.
- Fallback on both platforms: deep link `trek://today?goal=<id>`.
- Snapshot pushes: after every log change, at day rollover (`dayEndsAt`), after import, after a time-zone change.
- At the start of Phase 12: verify SDK 57 and New Architecture support, and that the iOS handler can read the clock. If not, STOP and report options.

### 5.3 Action queue
- Ids are deterministic idempotency keys:
  - notification: `n:<requestId>:<deliveredAtMs>:<actionId>` (delivery time keeps weekly repeats distinct);
  - widget: created at tap time (5.2).
- Insert uses `ON CONFLICT DO NOTHING`.
- Processing: one transaction applies the log (`done` = set value to target; `increment` = +1 for count, +5 min for duration; `skip` = skipped) and sets `processedAt`. Rows with `processedAt` set are never re-applied. Actions for deleted or archived goals are marked processed and ignored.
- Snooze: a one-shot notification 10 minutes later with id `s:<actionId>`, so repeated processing schedules it once.
- Entry points: foreground response listener; `TaskManager.defineTask` + `Notifications.registerTaskAsync` registered at module scope (background and killed app); `getLastNotificationResponseAsync` on cold start; processor run on start, on foreground and in `expo-background-task`.
- Pure reducer tests: duplicates, replay after a crash mid-batch, two increments with distinct ids, snooze after done, deleted or archived goal.

### 5.4 xlsx in React Native
- Phase 10 proof of concept: confirm Metro resolves `@office-kit/xlsx`'s `exports`; if Hermes lacks `TextDecoder`, add a small in-repo UTF-8 decoder (no new dependency); write bytes with the `expo-file-system` `File` API; share with `expo-sharing`.
- The exporter and importer are shared code; jest runs the xlsx and JSON round-trips in Node.
- Automated checks re-read the generated file and assert: formula cells carry cached values; ID, date and time columns use the `@` (TEXT) number format; a dataBar conditional format and a color scale exist; header rows are frozen; raw sheets are protected without a password; `_Meta.format` is `"trek-xlsx"`.
- Opening the file in Excel, Google Sheets and the iOS Files preview is a device check (D13).
- `jszip` builds and reads the CSV zip.

### 5.5 Reminders
- Pure `reminderPlanner` (3.8) plus a thin `notificationsReconciler` that diffs desired vs scheduled by id and only schedules or cancels the difference.
- Tests include 12 goals × 3 slots × 7 days and assert the planner output never exceeds 64.

## 6. Testing and verification
- Jest projects:
  - `domain`: Node environment, `TZ` pinned per suite; DST suites use `America/New_York` and `Europe/London`.
  - `app`: `jest-expo` preset with `@testing-library/react-native`.
- Every phase is gated on `npx tsc --noEmit` and `npx jest`; the real output is recorded in PROGRESS.md.
- Device-only "Done when" items are listed in PROGRESS.md as "device verification pending" and executed in Phase 13.

## 7. CLAUDE.md diffs (apply only after "design approved")

**D1 — Name (title and §intro)**
- `# CLAUDE.md — Daily Goals (project spec, source of truth)` → `# CLAUDE.md — Trek (project spec, source of truth)`
- `Build "Daily Goals", a frontend-only…` → `Build "Trek", a frontend-only…`

**D2 — §1 approved dependencies**
- Remove `moti`.
- Add a line: `Implied peers and tooling (approved): react-native-worklets, react-native-nitro-modules, react-native-screens, react-native-safe-area-context, expo-linking, expo-constants, expo-task-manager, expo-dev-client, test-renderer, typescript, @types/react, @types/jest, jest-expo, babel-plugin-inline-import, expo-crypto, expo-system-ui, expo-status-bar, expo-font, @expo/vector-icons, expo-blur.`

**D3 — §1 framer-motion rule**
- `"Framer Motion-style" in this spec means Moti's from/animate/exit/transition API.` → `"Framer Motion-style" in this spec means the from/animate/exit/transition props of the src/ui/motion primitives, implemented on Reanimated 4. Moti is not used because it depends on framer-motion.`

**D4 — §5.1 motion**
- `Then hand off to an animated splash built with Moti and Reanimated` → `Then hand off to an animated splash built with src/ui/motion (Reanimated 4)`
- `(Moti exit / Reanimated layout animations)` → `(Reanimated entering/exiting layout animations)`
- `Animate only transform and opacity.` → `Animate only transform and opacity; Reanimated layout transitions (entering, exiting, list reflow, Collapse) are the only exception.`
- Replace the "Moti compatibility" bullet with: `Reanimated 4 check: in Phase 1, verify Reanimated 4 layout animations, CSS transitions and reduce motion on the New Architecture via a dev-only /motion-check screen.`

**D5 — §3 data model**
- Add `goal_pauses`: `id, goalId, startDate, endDate? (null = still paused), createdAt, updatedAt`. Note: `goals.pausedAt` marks a goal as currently paused; history lives in `goal_pauses`.
- Under `logs`: `Unique per (goalId, date, slotId); a null slotId counts as one value.`
- Under `pending_actions`: `id is a deterministic idempotency key (see 4.7), not a UUID.`

**D6 — §4.1 schedules**
- `before the end (endDate or startDate + targetDays)` → `on or before endDate (inclusive), or within the targetDays days starting at startDate`
- `and the goal is neither paused nor archived on that date` → `no goal_pauses range covers the date, and the goal is not archived on that date`
- Add: `everyNDays counts from the effective version's effectiveFrom.`

**D7 — §4.3 status and §4.5 stats**
- Add to §4.3: `Check goals with slots are done when every slot is done and partial when some are. Count, duration and value goals have a per-day target; the day's value is the sum of its logs. Every target means "at least".`
- Add to §4.3: `timesPerWeek goals are scored per week: unlogged days are neutral; after the week ends, missed = adjusted target − credited days.`
- Add to §4.5: `timesPerWeek goals contribute one unit per ended week.`

**D8 — §5.5**
- `### 5.5 Stats tab (home)` → `### 5.5 Stats tab (dashboard)`; add `The app opens on the Today tab.`

**D9 — §5.9 reminders**
- `Use expo-notifications with repeating weekly calendar triggers, one per weekday + time.` → `Use expo-notifications. The planner looks 14 days ahead: a reminder whose every occurrence in that window is due becomes one repeating weekly calendar trigger (weekday + time); otherwise each due occurrence becomes a one-shot date trigger (everyNDays, vacations, pauses, end dates, timesPerWeek after the quota is met). Reminders inside quiet hours are suppressed.`

**D10 — §5.12 export**
- Raw tables list: add `GoalPauses`.
- `_Meta: … format "daily-goals-xlsx"` → `format "trek-xlsx"`.

**D11 — §5.13 widgets**
- `The widget writes to shared storage (an iOS App Group, Android SharedPreferences) as pending_actions.` → `iOS: the widget's button handler appends the action to the widget's props stored in the App Group; the app imports them into pending_actions. Android: the widget task handler inserts into pending_actions directly. The app processes them (4.7).`

**D12 — §7 phases**
- Phase 0: add `Create the minimal Expo SDK 57 project (TypeScript strict, Expo Router, jest) needed to host /design-preview.`
- Phase 1: `Expo project, dev-build config, ThemeProvider and tokens.` → `Dev-build config, ThemeProvider and tokens.`; `including the Moti and Reanimated 4 compatibility check` → `including the Reanimated 4 check (/motion-check)`.
- Phase 2: `DB schema and migrations` → `DB schema (including goal_pauses) and migrations`.

**D13 — §8 working rules**
- Add: `Automated checks (npx tsc --noEmit, npx jest, build/export checks) gate each phase. Device-only checks are recorded in PROGRESS.md as "device verification pending" and executed together in Phase 13; they are never reported as passed before then. Phase 10's STOP applies to the automated re-read checks.`

**D14 — §2 architecture**
- Add: `Identifiers: bundle id com.deenuramenjes.trek, App Group group.com.deenuramenjes.trek, URL scheme trek.`

**D15 — no emojis**
- §5.2 `and an icon or emoji.` → `and an icon from a curated @expo/vector-icons set.`
- §6 add: `No emojis anywhere in the app, widgets, notifications or exports; use icons only.`
