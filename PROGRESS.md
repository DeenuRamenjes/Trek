# Trek Progress

## Status
| Phase | Status |
|---|---|
| 0 Design | Complete — awaiting design approval (CLAUDE.md §7.0) |
| 1 Scaffold, motion, tabs, splash | Complete |
| 2 Data | Complete (device verification pending) |
| 3 Domain | Complete |
| 4 Goals and Today | Complete (device verification pending) |
| 5–13 | Not started |

## Phase 0 verification (run on 2026-10-05)
- `npx tsc --noEmit`: exit 0, no output.
- `npx jest`: `Test Suites: 8 passed, 8 total`; `Tests: 110 passed, 110 total`.
- `npx expo export --platform ios`: `› ios bundles (1):` and `Exported: dist`.
- `npx expo export --platform android`: `› android bundles (1):` and `Exported: dist`.

## Phase 1 verification (run on 2026-10-05)
- `npx tsc --noEmit`: exit 0, no output.
- `npx jest`: `Test Suites: 18 passed, 18 total`; `Tests: 189 passed, 189 total`.
- `EXPO_OFFLINE=1 CI=1 npx expo export --platform ios`: `› ios bundles (1):` and `Exported: dist`.
- `EXPO_OFFLINE=1 CI=1 npx expo export --platform android`: `› android bundles (1):` and `Exported: dist`.
- `dist` was removed after each export run.

## Phase 2 verification (run on 2026-10-05)
- `npx tsc --noEmit`: exit 0, no output.
- `npx jest`: `Test Suites: 23 passed, 23 total`; `Tests: 258 passed, 258 total`; `Snapshots: 1 passed, 1 total`.
- `EXPO_OFFLINE=1 CI=1 npx expo export --platform ios --output-dir dist`: `› ios bundles (1):` and `Exported: dist`, exit 0.
- `EXPO_OFFLINE=1 CI=1 npx expo export --platform android --output-dir dist`: `› android bundles (1):` and `Exported: dist`, exit 0.
- `dist` was removed after each export run.

## Phase 2 decisions
- Tests run migrations and repositories on a `node:sqlite` in-memory database behind a drizzle `sqlite-proxy` driver (`src/test/testDb.ts`); the app uses the expo-sqlite sync driver.
- `withTransaction` (`src/db/transaction.ts`) replaces drizzle's `db.transaction`, which commits early on the sync driver with async callbacks. Calls on the same db are serialized through a per-db promise chain, so concurrent callers never nest BEGIN. It is not re-entrant; no repository nests it, and `seedDemoData` uses direct inserts inside one call.
- The `logs` unique index on `(goal_id, date, coalesce(slot_id, ''))` lives in custom migration 0001, not in `schema.ts`, because drizzle-kit cannot express it.
- The schema is frozen after Phase 2; further changes need an approved new migration.
- `seedDemoData(db, { today, random })` is deterministic (mulberry32 seed 42, ids derived from the PRNG). Dev-only "Seed demo data" button on the Settings developer card.
- `goals.targetValue`, `logs.value` and `pending_actions.value` are `real`, so value goals and fractional durations keep decimals. No DB had shipped, so `0000_init` and its snapshots were amended in place (custom 0001 and the journal are unchanged); `drizzle-kit generate` reports no pending changes.
- Tables without `updatedAt` (slots, schedule versions, reminders, group_goals, vacation_goals) follow their parent's `updatedAt` in the Phase 11 merge: the parent's winner decides which child rows are kept.
- `slotId` (logs, reminders) has no FK on purpose; the domain tolerates dangling slotIds.
- A same-day `addScheduleVersion` replace drops the old version's slots, so Phase 4 must remap reminder slotIds when it saves.
- `useLiveGoals` includes archived goals; the feature layer filters (unlike `listGoals`).
- `endVacationNow` sets endDate = today - 1; confirm that UX in Phase 6.
- Live hooks (`src/db/live.ts`) are thin `useLiveQuery` wrappers, checked by tsc only.

## Phase 3 verification (run on 2026-10-05)
- `npx tsc --noEmit`: exit 0, no output.
- `npx jest`: `Test Suites: 41 passed, 41 total`; `Tests: 455 passed, 455 total`; `Snapshots: 1 passed, 1 total`.

## Phase 3 decisions
- Weekday convention: ISO everywhere in the domain, 0 = Monday ... 6 = Sunday, bit 0 of `scheduleDays` = Monday; the `weekStart` setting stays date-fns style (0 = Sunday, default 1). The notifications service converts planner weekdays to the platform's numbering.
- Vacation status is returned only when the day is otherwise due; otherwise the day is `not-due`.
- Unlogged past `timesPerWeek` days are neutral (never `missed`); the week is scored as a unit.
- Weekly adjusted target = min(ceil(target * (eligible - vacation) / eligible), eligible - vacation), so it never exceeds the available days.
- Insight magnitudes (review builder): percentage points for improved/declined (minimum 5), streak days for streak insights, 5 per skip for skip patterns (at least 2 skips on a weekday), 15 for a perfect finished period; top 3 kept.
- Reminder planner: output has no user-facing text (`contentKey`, `goalName` only; notes are never included). A reminder's fire instant is local `weekday + time + offsetMin`; its logical date is `logicalDate(fire, dayEndsAt)`, which maps times before `dayEndsAt` to the previous logical day. Quiet hours apply to every category. Monthly review is planned as the next two 1sts (date triggers); backup reminder as one date trigger at the next 10:00 when overdue. IDs: `goal:<reminderId>:weekly|<iso>`, `review:weekly`, `review:monthly:<iso>`, `backup:<iso>`.
- Action queue ids are `source|goalId|date|slotId-or--|action|nonce`; `processQueue` drops processed rows, known processed ids and repeated ids, ordered by `createdAt`.
- Widget snapshot lists goals due today with status done/partial/pending (skipped, vacation and not-due goals are left out); the group is passed as `groupGoalIds`.

## Phase 3 carried forward
- Phase 13: stats performance check with the 3-year seed (goals x logs); `completion`/`dailySeries` scan logs per goal-day.
- Phase 8: the reconciler converts ISO weekday to the expo-notifications weekday (1 = Sunday) and renders strings from `contentKey`.

## Phase 4 verification (run on 2026-10-05)
- `npx tsc --noEmit`: exit 0, no output.
- `npx jest`: `Test Suites: 50 passed, 50 total`; `Tests: 504 passed, 504 total`; `Snapshots: 1 passed, 1 total`.
- `EXPO_OFFLINE=1 CI=1 npx expo export --platform ios --output-dir dist; rm -rf dist`: exit 0, `Exported: dist`.
- Same command with `--platform android`: `Exported: dist`.

## Phase 4 decisions
- Color picker uses steppers plus a hex field, not a Skia drag picker.
- Date and time fields are validated text fields (`YYYY-MM-DD`, `HH:mm`); no new dependency.
- The AA badge uses the 3:1 non-text threshold.
- `reminders.offsetMin` is stored as negative minutes-before.
- Today: undo restores the exact previous log (deleted if none existed, else prior value, status and note). Tapping a finished row clears its logs (also undoable). A slotted check row marks or clears every slot; slot chips act on one slot.
- Today: "Back up now" navigates to `/settings` until Phase 11. Snooze writes `backupBannerSnoozedUntil` (3 days, from `BACKUP_SNOOZE_DAYS`); the note limit comes from `NOTE_MAX_LENGTH` (`src/domain/limits.ts`).
- Log sheet: Save is disabled with a hint when a note has no progress (value 0); a value of 0 without a note clears the entry. Phase 6 history sheet must allow a note with value 0 or skipped status.
- Today loads goal contexts with `loadGoalContexts` and reloads on every `dbChanged`.

## Phase 7 verification (run on 2026-10-05)
- `npx tsc --noEmit`: exit 0, no output.
- `npx jest`: `Test Suites: 62 passed, 62 total`; `Tests: 581 passed, 581 total`; `Snapshots: 1 passed, 1 total`.
- `EXPO_OFFLINE=1 CI=1 npx expo export --platform ios --output-dir dist; rm -rf dist`: Exported.
- `EXPO_OFFLINE=1 CI=1 npx expo export --platform android --output-dir dist; rm -rf dist`: Exported.

## Phase 7 decisions
- Route params: `week-YYYY-MM-DD` and `month-YYYY-MM` (`src/features/reviews/periodParam.ts`); invalid params show a "Review not found" state. Header navigation keeps period in local state; next is disabled when the next period starts after the logical today.
- `timeBucket(loggedAt)` uses the local clock hour (design 3.7); `dayEndsAt` only decides the logical date.
- Filler insights (`mostConsistentGoal`, `totalDone`, `dueDays`, magnitude 0) are added only when fewer than 2 real insights exist and the period has a scored day.
- timesPerWeek vacation totals were already in days (week units only for done/missed); a test now locks this.
- `IconButton` gained an optional `disabled` prop.

## Phase 7 device verification pending (run in Phase 13)
- Review completion counter animation (400 ms) and per-goal bar stagger on iOS and Android, with reduce motion on and off.

## Phase 6 verification (run on 2026-10-05)
- `npx tsc --noEmit`: exit 0, no output.
- `npx jest`: `Test Suites: 60 passed, 60 total`; `Tests: 558 passed, 558 total`; `Snapshots: 1 passed, 1 total`.
- `EXPO_OFFLINE=1 CI=1 npx expo export --platform ios --output-dir dist; rm -rf dist`: Exported.
- `EXPO_OFFLINE=1 CI=1 npx expo export --platform android --output-dir dist; rm -rf dist`: Exported.

## Phase 6 decisions
- The history day editor uses the existing modal sheet.
- Goals with slots are edited through slot chips in the history sheet.
- History notes are allowed together with skipped and partial status.
- Vacation: `/vacation` is a list/form screen reached from a Settings row. New vacations must start today or later; editing keeps the original start. Active vacations can be edited or ended (end date = yesterday, or deleted if not yet started); past ones are view/delete only. Delete asks for confirmation inline.

## Phase 6 device verification pending (run in Phase 13)
- History month swipe feel (pan, snap, spring back).
- History day editor sheet gesture.

## Phase 5 verification (run on 2026-10-05)
- `npx tsc --noEmit`: 0 errors.
- `npx jest`: 55 suites, 528 tests pass (after Polish stats charts).
- `EXPO_OFFLINE=1 CI=1 npx expo export --platform ios --output-dir dist; rm -rf dist`: Exported.
- `EXPO_OFFLINE=1 CI=1 npx expo export --platform android --output-dir dist; rm -rf dist`: Exported.

## Phase 5 decisions
- currentStreak = max over the selected goals (same for bestStreak).
- Group membership comes from `group_goals`; "All goals" uses every goal context.
- Polish: weekly bars, trend and per-goal bars grow in via transform (GrowIn, instant under reduce motion); heatmap offset follows weekStart; trend gaps are null; streak unit comes from the goal holding the max (weeks for timesPerWeek); dropdown has an exit animation; chart sizes are tokens. Android export OK.
- Ring: Skia arc with gentle spring and AnimatedNumber. Heatmap: one Skia canvas; ratio 0 drawn crossed (not color alone), null drawn muted; legend shown. The model has no vacation flag per day, so vacation days appear as not scored.
- Weekly bars and trend use victory-native (no axes, so no font file needed). Per-goal bars are plain Views with the goal name as Text. Charts have no own draw-in animation; the cards stagger in.
- Jest mocks victory-native and extends the Skia mock in `jest.setup.app.js`.
- Card accepts accessible, accessibilityLabel and testID.

## Phase 5 device verification pending (run in Phase 13)
- Chart animation smoothness.
- Stats render under 500 ms: jest shows about 3 s for the 3-year All range; Phase 13 optimization required.

## Phase 4 device verification pending (run in Phase 13)
- Swipe gestures feel (right = done, left = skipped) and long-press.
- Goals drag reorder.
- Confetti burst on streak milestones 7/30/100.
- Haptics on check-off.
- Day rollover refresh of the Today tab.

## Phase 2 device verification pending (run in Phase 13)
- Migrations applying on a real iOS and Android development build (first launch and upgrade).
- `withTransaction` (BEGIN/COMMIT) on the expo-sqlite sync driver, including concurrent callers.
- Live query hooks re-rendering after writes; the seed button on a device with the 3-year data set.

## Decisions
- Design decisions and CLAUDE.md diffs D1–D15: `docs/superpowers/specs/2026-10-05-trek-design.md`.
- Moti is not used (it depends on framer-motion); Phase 1 replaced it with Reanimated-only motion primitives built on Reanimated 4.
- `package.json` pins `react-dom` to 19.2.3 via `overrides`: expo-router pulls react-dom in transitively, and npm otherwise resolves 19.3.0, which needs react ^19.3.0.
- Install commands use `EXPO_OFFLINE=1`; this environment's proxy blocks the Expo API and reactnative.directory.
- jest uses two projects (`node` for `*.test.ts`, `app` for `*.test.tsx`), both preset `jest-expo`. `jest-expo/node` and `jest-expo/ios` fail to transform in this setup.
- Route tests render route components with a mocked `expo-router`, because `renderRouter` is incompatible with RNTL 14's async render.
- Design-preview charts are static View-based stand-ins; real Skia and victory-native charts arrive in Phase 5.
- Day counts pluralize: `strings.stats.days(1)` is '1 day' and `strings.today.backupBanner(1)` is 'Last backup 1 day ago' (owner-approved; the spec's 'Last backup N days ago' is treated as a template).
- `Screen` uses `flexGrow: 1` (not `flex: 1`) for centered scrolling content so large system fonts can scroll instead of clipping.
- `isPreviewKey` uses an own-property check so prototype keys such as `constructor` are rejected.
- `StatusGlyph` stays decorative for screen readers; every caller pairs it with visible text or a labelled control (owner ruling).
- Jest mocks added in Phase 1: `react-native-mmkv` uses its own `createMockMMKV`; `react-native-worklets` uses its `src/mock`; Skia is replaced by a lightweight mock (canvases render as Views, drawing nodes render nothing); gesture-handler loads its `jestSetup`.
- Settings parsing falls back per field, including nested objects, so one bad stored value no longer discards the rest. `update()` applies only the valid fields of a patch.
- The theme cross-fade moved to Phase 9, where the theme switching UI exists.
- The vacation status glyph is `airplane` (DESIGN.md §1.6 updated), which also resolves the old `sunny` ambiguity for the status glyph.
- App icon assets are generated from the Trek mark.
- The root layout treats a font load error as ready, so the native splash never hangs. Readiness now lives in `src/features/startup/useAppReady.ts`, which combines a list of readiness sources; Phase 2 adds migrations as one more source. A source error shows a designed startup error screen.
- Reanimated layout transitions (Collapse, list reflow) are allowed by CLAUDE.md §5.1 (approved diff D4).

## Deviations from CLAUDE.md
- Phase 6: the history day editor is a fade modal, not a gesture bottom sheet (accepted in the final review; revisit in Phase 13 polish).
- None beyond the approved diffs D1–D15. Plan amendments approved during execution are listed under Decisions.

## Open questions
- None.

## Carried forward (from Phase 0 reviews)
These review notes were deferred to the phase that builds on the affected code. Each later phase plan must pick up its items.
- Phase 3: the design doc names the Node jest project `domain` with the time zone pinned per suite; the current project is named `node`. Add the time-zone mechanism (per-suite `process.env.TZ` or a dedicated DST project) at the start of Phase 3.
- Phase 4:
  - Implement and test the custom-color AA rule from DESIGN.md §1.7 (surface and surfaceMuted, both modes), and add tests that a custom accent keeps AA contrast.
  - "Snooze 3 days" and the "/1000" note counter should take their numbers from constants.
  - Duration goals need their own primary-action label (for example "Add 5 minutes to Meditation") instead of "Mark … done".
  - Align naming (`today.increment` vs `history.increaseValue`), replace the "Readable (AA)" wording with plainer copy, and keep the Create Goal schedule summary in sync with the selected type.
  - Move sentence assembly (status plus progress on Today rows) into string templates.
- Phase 5:
  - `SegmentedControl` uses `tablist` with `button` children; switch to `radiogroup`/`radio` (or `tab`) when the animated indicator is added.
  - Charts must expose their values to screen readers; selected chips and the date strip must not rely on fill color alone.
- Phase 5: `AnimatedNumber` `fromRef` should track the last shown value.
- Phase 6: history day cells are about 42.9 pt wide on a 360 dp screen (below 44 pt); day accessibility labels should be formatted with date-fns (for example "5 October 2026, Done").
- Phase 7: move review sentence assembly ("Reading 100%", the totals line) into string templates. Done in Phase 7 (`review.goalValue`, `review.totalsLine`).
- Phase 9: settings option labels currently in mock data move into the strings file.
- Phase 13:
  - TabBar: move icon size, gap and pill height to tokens, and check the indicator's vertical alignment.
  - Re-export `icon.png` as RGB (no alpha) and make the Android adaptive-icon layer sizes consistent.
  - Keep dev preview code out of release bundles (the Android release export currently contains preview mock data, although the routes redirect at runtime).
  - Unit-test the `__DEV__ === false` redirect and the light/dark routing of the preview routes.
  - Extend the emoji scan to accessibility labels and placeholders.
  - Optional color tests: a positive large-text AA case, tone 99 and `toneOf` at 0 and 100, and a mid-grey `readableOn` case.

## Phase 9 verification (run on 2026-10-05)
- `npx tsc --noEmit`: exit 0, no errors.
- `npx jest`: Test Suites: 75 passed, 75 total; Tests: 665 passed, 665 total.
- `EXPO_OFFLINE=1 CI=1 npx expo export --platform ios --output-dir dist; rm -rf dist`: Exported: dist.
- `EXPO_OFFLINE=1 CI=1 npx expo export --platform android --output-dir dist; rm -rf dist`: Exported: dist.

## Phase 9 decisions
- Theme cross-fade runs only when the resolved background color changes (a snapshot overlay fades out over 250 ms); it is skipped under reduce motion.
- Lock logic is a pure reducer (`src/domain/appLock.ts`): cold start locks when enabled; background then foreground locks when elapsed >= timeout, or when the clock moved backwards; failures count up and reset on success; disabling clears state.
- Only the `background` AppState locks (iOS `inactive` happens during the Face ID prompt and would loop). The privacy overlay covers both `inactive` and `background`.
- The first prompt uses biometrics without passcode fallback; after 3 failures the passcode is offered (`disableDeviceFallback: false`). A cancelled prompt is not counted as a failure.
- Enabling requires `hasHardwareAsync` and `isEnrolledAsync` and a successful authentication; otherwise a notice explains and the lock stays off. No PIN is stored.
- `LockGate` wraps the navigator inside `DbProvider`; the animated splash and `PrivacyOverlay` sit above it, so the splash is the only thing not covered by the lock.
- `expo-blur` ships no config plugin, so only `expo-local-authentication` (with `faceIDPermission`) is in `app.json`.
- The Phase 8 reconciler test for lock-on notification content (generic body, no notes) already existed and was kept.

## Phase 9 device verification pending (run in Phase 13)
- Biometric flow (Face ID, fingerprint, passcode fallback after 3 failures) on iOS and Android.
- App switcher privacy overlay on iOS and Android.
- Lock animations (logo bounce, button slide, failure shake, fade-out with content scale) and reduce-motion behavior.
- Theme cross-fade look.

## Phase 8 verification (run on 2026-10-05)
- `npx tsc --noEmit`: exit 0, no errors.
- `npx jest`: Test Suites: 69 passed, 69 total; Tests: 622 passed, 622 total (after final-review fixes).
- `EXPO_OFFLINE=1 CI=1 npx expo export --platform ios --output-dir dist; rm -rf dist`: Exported: dist.
- `EXPO_OFFLINE=1 CI=1 npx expo export --platform android --output-dir dist; rm -rf dist`: Exported: dist.

## Phase 8 decisions
- Snoozes (`s:` ids) count against the 64 cap (planner cap = 64 - snoozes) and are never cancelled by the reconciler.
- Weekday mapping: planner ISO 0 = Monday to expo 1 = Sunday via `toExpoWeekday`.
- One Android channel per goal (`goal-<id>`), plus `reviews` and `backup`.
- Exact-alarm fallback = expo's inexact default; no native code.
- Lifecycle logic is pure (`lifecycle.ts`, injected deps); `useNotificationsLifecycle` is a thin hook (foreground, db changes, relevant settings changes, time zone).
- `refreshWidgets()` in `src/services/widgetBridge.ts` is a no-op hook point for Phase 12.
- Final-review fixes: reminders carry slotId and (one-shot only) logical date into notification data; processing is serialized and re-checks processedAt inside the transaction; default taps route via `trek://` url; reconcile is serialized and coalesced; applied actions trigger reconcile and `refreshWidgets()`.
- Snooze scheduling is not transactional (schedule, then markProcessed). A crash in between leaves the row pending; the rerun reschedules the same `s:<id>`, so it is idempotent by id.
- The 64 cap is enforced at reconcile time; snoozes created between reconciles are covered because applying an action triggers a reconcile.
- Background task `trek-background-maintenance`, 15 min minimum, runs processor then reconciler.

## Phase 8 device verification pending (run in Phase 13)
- Weekly custom schedule reminder fires on iOS and Android.
- Vacation suppresses reminders.
- "Mark done" from a killed app is saved exactly once.
- Background task runs and reconciles.
- Killed-app notification response payload (response task) on iOS and Android.
- Exact alarm fallback to inexact on Android.

## Device verification pending (run in Phase 13)
- `/design-preview` on an iOS and an Android development build, light and dark, with large system font size.
- `/motion-check` on an iOS and an Android development build at 60 fps, with reduce motion on and off.
- Splash feel, and the handoff from the native splash to the animated splash.
- Tab indicator alignment under each tab, including with large system font size.
- App icon look on both platforms.

### Phase 3 final review notes
- `applyAction` "done" keeps a value already above the target (fixed after the final review).
- Weekly reminder triggers keep repeating beyond the 14-day planning window; correctness relies on the reconciler re-running (foreground, background task, data changes). Phase 8.
- Carried to Phase 7: insights can number fewer than 2; timesPerWeek vacation units mix days and weeks; `timeBucket` ignores `dayEndsAt`; missing review tests (vacation-adjusted timesPerWeek, streak gained, slot partial ratio).
- Carried to Phase 13: stats `goalUnits` cost is goals x logs; check against the 3-year seed.
