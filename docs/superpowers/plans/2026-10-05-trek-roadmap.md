# Trek Master Roadmap

> **For agentic workers:** This is the roadmap, not an executable plan. Each phase gets its own detailed plan (`docs/superpowers/plans/YYYY-MM-DD-phase-N-<name>.md`), written just before that phase runs so it reflects the code that exists. Execute detailed plans with superpowers:subagent-driven-development (or superpowers:executing-plans).

**Goal:** Ship Trek, the offline-first Expo goal tracker specified in `CLAUDE.md`, in the 14 phases of CLAUDE.md §7.

**Architecture:** Expo SDK 57 + Expo Router app. Pure TypeScript domain logic in `src/domain` (unit-tested, no React or Expo imports). SQLite via Drizzle in `src/db`. Native integrations isolated in `src/services`. UI built from shared tokens and motion primitives in `src/ui`.

**Tech Stack:** Only the approved dependencies in CLAUDE.md §1 (including the "implied peers and tooling" line).

**Sources:** `CLAUDE.md` (spec, with approved diffs D1–D15 applied) and `docs/superpowers/specs/2026-10-05-trek-design.md` (design decisions).

## Global Constraints

- Stack: Expo SDK 57 (`expo ~57.0.26`), React Native 0.86 (New Architecture), React 19.2, TypeScript 6 strict, Expo Router. Development builds only.
- Dependencies: only CLAUDE.md §1's approved list. STOP and ask before adding anything else. Never install framer-motion. Moti is not used.
- Install packages with `EXPO_OFFLINE=1 npx expo install <pkg>`. This container's proxy blocks the Expo API and reactnative.directory. After changing dependencies, do a clean install: `rm -rf node_modules package-lock.json && npm install`. Incremental installs can leave Expo packages wrongly nested.
- `package.json` keeps `"overrides": { "react-dom": "19.2.3" }`. expo-router pulls in react-dom transitively, and npm would otherwise pick a react-dom that needs a newer react.
- No DB schema change after Phase 2 without explicit approval. No native code outside approved libraries. No file deletion outside generated scaffolding.
- Domain logic is pure TypeScript with no React or Expo imports and is written test-first.
- All user-facing strings live in `src/strings/en.ts`. No emojis anywhere; icons only (`@expo/vector-icons` Ionicons).
- All colors come from theme tokens (`src/ui/tokens.ts`). Animate only transform and opacity; Reanimated layout transitions are the only exception. Every animation collapses to instant under reduce motion.
- Every phase gate: `npx tsc --noEmit` (0 errors) and `npx jest` (all pass), with the real output pasted into `PROGRESS.md`. Device-only checks are listed as "device verification pending" and run in Phase 13.
- Testing setup: RNTL 14's `render` and `fireEvent` are async, so always `await` them. Expo Router's `renderRouter` helper does not work with RNTL 14; test route components directly with a mocked `expo-router`. TypeScript 6 only loads the `@types` packages listed in `tsconfig.json`'s `types`.
- Identifiers: bundle id `com.deenuramenjes.trek`, App Group `group.com.deenuramenjes.trek`, URL scheme `trek`.

---

## Milestones and phase map

| Milestone | Phases | Outcome |
|---|---|---|
| M0 Foundations | 0, 1 | Design system, preview, app shell, motion system |
| M1 Data and domain | 2, 3 | Schema, repositories, seed; every domain rule unit-tested |
| M2 Core loop | 4, 5, 6, 7 | Goals, Today, Groups, Stats, History, Vacation, Reviews |
| M3 Platform services | 8, 9 | Notifications and action queue; Appearance and App lock |
| M4 Data portability | 10, 11 | xlsx proof of concept; full export, import, backup |
| M5 Widgets | 12 | iOS and Android widgets with action round trip |
| M6 Release quality | 13 | Accessibility, reduce motion, empty states, onboarding, error log, performance, device batch |

```
P0 ─► P1 ─► P2 ─► P3 ─┬─► P4 ─► P5 ─► P6 ─► P7
                      │     │                 │
                      │     └──────► P8 ◄─────┘   (P8 needs P4 logging + P6 vacations + P7 review links)
                      │              │
                      │              ├─► P9
                      │              └─► P12 (needs P8 action-queue processor)
                      └─► P10 ─► P11 (needs P2 schema, P3 backupPolicy; P11 needs P8 reconciler re-run)
P13 needs all phases.
```

---

## Phase 0: Design (M0)

- **Spec:** §7.0 (with D12), §6, §5.1 tokens, design doc §4.
- **Depends on:** nothing.
- **Deliverables:**
  - Minimal Expo SDK 57 project (TS strict, Expo Router, jest projects `node` and `app`).
  - Pure colour math (WCAG contrast, tonal palette).
  - Design tokens (spacing, radii, typography, colours, status and goal palettes), motion tokens.
  - Strings file, icon sets, a basic ThemeProvider and base components.
  - `DESIGN.md`.
  - A dev-only `/design-preview` route rendering Splash, Today, Stats, Create Goal, History, Review, Settings and Lock with mock data in light and dark.
  - `PROGRESS.md`.
- **Automated gate:**
  - tsc 0 errors;
  - jest passes, covering colour math, token AA contrast, motion tokens, strings (exact spec copy, no emoji), icons, components and previews (every button labelled);
  - `expo export` for iOS and Android succeeds.
- **Done-when items advanced:** 1 (tests and tsc).
- **STOP:** for approval of the design (spec §7.0).

## Phase 1: Scaffold (M0)

- **Spec:** §7.1 (with D12), §5.1, §2, design doc §4.1, §4.3, §5.1.
- **Depends on:** P0.
- **Deliverables:**
  - Dev-build config (`expo-dev-client`, `expo-system-ui`, `expo-splash-screen`).
  - ThemeProvider driven by settings (MMKV + Zustand settings store for appearance keys), with a theme cross-fade (Skia snapshot).
  - `src/ui/motion` on Reanimated 4: `Motion` (`from`/`animate`/`exit`/`transition`), FadeIn, SlideUp, ScaleIn, Stagger, PressableScale, AnimatedNumber, Skeleton, Collapse, AnimatedCheck, and `useMotionPreference`.
  - Dev `/motion-check` screen.
  - Native splash held for readiness, then the animated splash (Skia trail mark, ≤1.2 s, skipped under reduce motion).
  - Tabs Today · Stats · Goals · Settings with an animated indicator and screen transitions. The app opens on Today.
- **Automated gate:**
  - tsc and jest pass;
  - render tests prove every primitive jumps to its end state under reduce motion;
  - a splash sequencing test (timing totals ≤1.2 s; reduce motion skips it);
  - `expo export` for both platforms.
- **Done-when items advanced:** 10 (reduce motion: automated part).
- **Device pending:** `/motion-check` at 60 fps; splash feel; theme cross-fade.
- **STOP if:** Reanimated 4 layout animations or CSS transitions misbehave on the New Architecture in tests or bundling.

## Phase 2: Data (M1)

- **Spec:** §3 (with D5), §7.2.
- **Depends on:** P1 (settings store pattern).
- **Deliverables:**
  - Drizzle schema for every table, including `goal_pauses`. Unique log index on (goalId, date, coalesce(slotId, '')).
  - Versioned migrations bundled with `babel-plugin-inline-import`, run at startup before the splash is released.
  - Repositories and live queries; UUIDs via `expo-crypto`.
  - zod row schemas shared with import.
  - Dev seed: 3 years of logs, 12 goals, 3 groups, 2 vacations, schedule changes.
- **Automated gate:**
  - tsc and jest pass;
  - repository tests (SQLite in jest via the Drizzle `expo-sqlite` driver mock, or pure SQL-shape tests where the native driver is unavailable);
  - migration snapshot test;
  - zod schema tests.
- **After this phase:** the schema is frozen. Changes need a new migration and approval.

## Phase 3: Domain (M1)

- **Spec:** §4 (with D6, D7), §7.3, design doc §3.
- **Depends on:** P2 (types and zod schemas only; the domain never imports the DB).
- **Deliverables:** pure modules `dayBoundary`, `scheduleEngine`, `streaks`, `statsCalculator`, `vacationRules`, `reviewBuilder`, `reminderPlanner`, `backupPolicy`, `actionQueue` and `widgetSnapshot`.
- **Automated gate:** TDD tests covering:
  - every schedule type and versioning;
  - skipped, vacation and paused days;
  - `dayEndsAt` 0 and 3;
  - DST in America/New_York and Europe/London, and time-zone changes;
  - month and year boundaries;
  - timesPerWeek streaks and quotas;
  - slot aggregation; value "at least";
  - planner ≤64 with the hybrid trigger rules;
  - backup overdue and keep-7;
  - action-queue idempotency.
- **Done-when items advanced:** 5 (schedule edit keeps past stats), 6 (01:30 with `dayEndsAt` 3), 7 (idempotency core), 9 (keep exactly 7 policy), 4 (≤64 planner).

## Phase 4: Goals and Today (M2)

- **Spec:** §5.2, §5.3, design doc §4.4, §4.6.
- **Depends on:** P3.
- **Deliverables:**
  - Goal create, edit, duplicate, pause (writes `goal_pauses`), archive and drag-reorder.
  - Collapsible form sections, templates, palette with the AA check, icon picker.
  - Today checklist: tap, swipe and long-press; slot chips; undo toast; haptics; date strip; check-off animation and milestone confetti.
  - Vacation and backup banners wired to placeholders that P6 and P11 complete. They render only when the domain says so.
- **Automated gate:** tsc and jest; integration tests (repository + domain) proving that a schedule edit leaves past stats unchanged and that 01:30 with `dayEndsAt` 3 logs to the previous date.

## Phase 5: Groups and Stats (M2)

- **Spec:** §5.4, §5.5 (with D8), design doc §4.5.
- **Depends on:** P4.
- **Deliverables:**
  - Groups CRUD, reorder and multi-select membership.
  - Stats tab: group dropdown, `homeEmptyStateMode`, ranges, weighted/strict, and charts (Skia ring, heatmap; victory-native bars, trend, comparison, best weekday), plus review entry points.
- **Automated gate:** tsc and jest; a stats view-model test against the seed computing in under 500 ms in jest (device timing is checked in P13).

## Phase 6: History and Vacation (M2)

- **Spec:** §5.6, §5.7, design doc §4.7.
- **Depends on:** P5.
- **Deliverables:**
  - Month grid with swipe, status icons and fills, value badges and quota pills.
  - Bottom-sheet editor; future days read-only.
  - Vacation create, list and end-now, plus the Today banner.
- **Automated gate:** tsc and jest; vacations neutral in streaks and stats (integration).

## Phase 7: Reviews (M2)

- **Spec:** §5.8, design doc §3.7, §4.8.
- **Depends on:** P6.
- **Deliverables:** `review/[period]` for week and month, with navigation, counters, bars, best and worst goals, streaks, weekday and slot, totals and insights. Review notification scheduling is deferred to P8; this phase provides the deep-link targets.
- **Automated gate:** tsc and jest; reviewBuilder integration with seed data.

## Phase 8: Notifications and action queue (M3)

- **Spec:** §5.9 (with D9), §4.6, §4.7, design doc §3.8, §5.3, §5.5.
- **Depends on:** P4, P6, P7.
- **Deliverables:**
  - `notificationsReconciler`: diff by id; hybrid weekly and date triggers; quiet hours; ≤64.
  - Permission flows: POST_NOTIFICATIONS and exact alarms with inexact fallback; Android channel per goal.
  - Actions "Mark done" and "Snooze 10 min".
  - `pending_actions` writers: foreground listener, `TaskManager.defineTask` + `registerTaskAsync`, and cold start via `getLastNotificationResponseAsync`.
  - `actionQueueProcessor`.
  - `expo-background-task`; time-zone change handling; review and backup reminders; `setNotificationHandler` before first render.
- **Automated gate:** tsc and jest; a reconciler test proving pending stays ≤64; processor idempotency with replay; deep-link mapping tests.
- **Done-when items advanced:** 4, 7 (automated parts).
- **Device pending:** reminders firing on a weekly custom schedule on both platforms; suppression during vacation; "Mark done" from a killed app.

## Phase 9: Appearance and App lock (M3)

- **Spec:** §5.10, §5.11, design doc §4.9.
- **Depends on:** P8 (notification privacy while locked).
- **Deliverables:**
  - Settings → Appearance: theme, accent tonal palette, week start, 12/24h, "My day ends at", haptics, reduce-motion override.
  - Settings → Security: enable via `expo-local-authentication`, timeout, lock on cold start and after background, animated lock screen, `expo-blur` privacy overlay, notification bodies limited to the goal name.
- **Automated gate:** tsc and jest; a lock state-machine test (pure); a test that the reconciler output content omits notes while the lock is on.
- **Device pending:** biometric flow; app switcher overlay.

## Phase 10: Export proof of concept (M4)

- **Spec:** §7.10 (with D13), §5.12, design doc §5.4.
- **Depends on:** P2, P3.
- **Deliverables:** inside React Native, `@office-kit/xlsx` writes formulas with cached values, TEXT columns, data bars and a colour scale, frozen headers and protected sheets; the file is saved with the `expo-file-system` `File` API and shared via `expo-sharing`. A `TextDecoder` fallback is added in-repo only if Hermes lacks one.
- **Automated gate:** tsc and jest; a re-read test asserting cached values, the `@` number format, dataBar and colour-scale conditional formats, frozen panes, protection and `_Meta.format = "trek-xlsx"`; `expo export` bundles `@office-kit/xlsx` for both platforms.
- **STOP if:** any automated check fails.
- **Device pending:** the file opens correctly in Excel, Google Sheets and the iOS Files preview.

## Phase 11: Export, import and backup (M4)

- **Spec:** §5.12 (with D10), design doc §3.9.
- **Depends on:** P8 (reconciler re-run), P10.
- **Deliverables:**
  - Full xlsx (README, Dashboard with the allowed formulas only, raw sheets including GoalPauses, Settings, `_Meta`), JSON and CSV zip (`jszip`) export.
  - Import with header matching, value coercion, schemaVersion guard, zod validation, preview with row errors, Replace or Merge, a JSON backup before writing, a single transaction, then reconcile and widget refresh.
  - Backup reminder and banner; daily auto-backup keeping 7; Android SAF folder; iOS Files visibility; restore list.
- **Automated gate:** tsc and jest including:
  - xlsx and JSON round-trip with zero loss;
  - a converted-values import test (reordered columns, a blank row, decimal times);
  - a merge-conflict test;
  - auto-backup keeps exactly 7.
- **Done-when items advanced:** 2, 9.

## Phase 12: Widgets (M5)

- **Spec:** §5.13 (with D11), design doc §4.10, §5.2.
- **Depends on:** P8 (action-queue processor), P11 (import refresh hook).
- **Deliverables:**
  - The phase starts by verifying SDK 57 and New Architecture support in `react-native-android-widget`, and that `expo-widgets` handlers can read the clock. If either fails, STOP and report options.
  - iOS small and medium widgets; Android 2×2 to 4×2.
  - Snapshot push on log change, rollover, import and time-zone change.
  - Tap → `pending_actions` → processed log → refreshed widget; deep-link fallback.
  - Settings → Widget (group, hide names, preview).
- **Automated gate:** tsc and jest; an end-to-end jest test with a mocked widget bridge (tap → pending action → log → new snapshot).
- **Done-when items advanced:** 7 (widget path).
- **Device pending:** real widgets on both platforms, including from a killed app.

## Phase 13: Polish and device batch (M6)

- **Spec:** §7.13, §6, §5.14, §9.
- **Depends on:** all.
- **Deliverables:**
  - Accessibility pass (labels, 44 pt, status not by colour alone, font scaling) and reduce-motion pass.
  - Empty states; 3-screen animated onboarding requesting notifications on the last screen.
  - Error log (rotating, 500 KB, export).
  - Performance with the 3-year seed (smooth lists, Stats under 500 ms, 60 fps).
  - Run every "device verification pending" item and record the results.
- **Automated gate:** tsc and jest; an error-log rotation test; an onboarding flow test.
- **Done-when items advanced:** all §9 items, including device-verified ones.

---

## "Done when" (§9) traceability

| §9 item | Automated in | Device check |
|---|---|---|
| Unit tests pass, tsc 0 errors | every phase | — |
| xlsx and JSON round-trips, converted-values import, merge test | P11 | — |
| xlsx correct in Excel, Google Sheets, iOS Files | P10 (re-read checks) | P13 |
| Reminders on a weekly custom schedule; iOS ≤64; suppressed during vacation | P3 planner, P8 reconciler | P13 |
| Editing a schedule leaves past stats unchanged | P3, P4 | — |
| 01:30 check-in with `dayEndsAt` = 3 counts for the previous day | P3, P4 | — |
| "Mark done" from notification and widget saved exactly once, including from a killed app | P3, P8, P12 | P13 |
| App lock works and hides content in the app switcher | P9 (state machine) | P13 |
| Backup reminder when overdue; auto-backup keeps exactly 7; restore works | P3, P11 | P13 (notification firing) |
| Splash and animations respect reduce motion; works fully in airplane mode | P1, P13 | P13 |
