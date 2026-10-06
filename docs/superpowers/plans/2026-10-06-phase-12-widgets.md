# Phase 12 (Widgets) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Home-screen widgets: iOS via `expo-widgets` (small, medium), Android via `react-native-android-widget` (resizable 2×2 to 4×2), showing today's due goals for the selected group with a done/total ring; tapping a row marks done / increments through `pending_actions`; the app pushes fresh snapshots; Settings → Widget.

**Architecture:**
- Snapshot: `buildWidgetSnapshot` (Phase 3, `src/domain/widgetSnapshot.ts`) → `src/services/widgetBridge.ts` `refreshWidgets()` replaces the Phase 8 no-op: loads contexts/logs for the logical today, builds the snapshot honouring `widget.groupId` and `widget.hideGoalNames`, and pushes it to each platform.
- iOS: `expo-widgets` widget definition (`widgets/` per the library's conventions) rendering small (ring + count) and medium (ring + up to 4 rows). Interactive row buttons append `{ id, goalId, slotId, date, action }` to the widget's props stored in the App Group `group.com.deenuramenjes.trek`; the app imports these into `pending_actions` (ids `w:<uuid generated at tap>`) on start/foreground/background task, then processes the queue.
- Android: `react-native-android-widget` widget component (`TrekWidget`) + `registerWidgetTaskHandler` task handler; on a row click the handler opens the db (`openDatabaseSync('trek.db')`) and inserts into `pending_actions` directly (id `w:<uuid>`), runs the processor, and re-renders. Resizable 2×2–4×2 in the plugin config.
- Settings → Widget (`app/settings/widget.tsx`): choose group (or All goals), hide goal names toggle, preview rendering the snapshot with app components.
- Push triggers: after every log change (`onActionsApplied` and db change subscription, debounced), on the logical-day rollover (`useLogicalToday`), after import, and on time-zone change (Phase 8 hook point).
- Normative: CLAUDE.md §5.13, §5.11 (hideGoalNames), §4.7; design doc `docs/superpowers/specs/2026-10-05-trek-design.md` §4.10, §5.2.

**Tech Stack:** expo-widgets, react-native-android-widget (approved).

## Global Constraints

- Approved dependencies only. Native code only through these libraries' supported APIs and config plugins (no hand-written Swift/Kotlin outside what the libraries generate or document as the widget definition format).
- STOP (CLAUDE.md §5.13): at the start, verify both libraries support Expo SDK 57 and the New Architecture. If either does not, STOP and report options.
- Strings in `src/strings/en.ts`; no emojis; colors from tokens (widgets receive resolved token colors in the snapshot); labels.
- Verification per task: `npx tsc --noEmit`, `npx jest`; `npx expo prebuild --no-install --clean` in a scratch copy must succeed for both platforms (config plugins valid), then iOS + Android `expo export`.
- Device checks (widget renders, tap → pending_actions → log → refreshed widget, killed-app tap) are device verification pending (Phase 13); the end-to-end path is covered by a jest test with the platform adapters mocked.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_014qGP2qavm772yGiGc1rSw8`.

### Task 1: Compatibility check (STOP gate)

- [ ] Install both (`EXPO_OFFLINE=1 npx expo install expo-widgets react-native-android-widget`, clean install). From their package metadata, READMEs/CHANGELOGs in `node_modules`, peer deps and config plugins, establish: supported Expo SDK range, New Architecture support, interactive widget support (iOS button intents; Android click actions in a headless task), how data is shared (App Group props on iOS), and widget size configuration.
- [ ] In a scratch copy of the repo (outside the repo, e.g. `/tmp/trek-prebuild`), add both plugins to `app.json` and run `npx expo prebuild --no-install --clean --platform ios` and `--platform android`; record results.
- [ ] Write findings to `docs/superpowers/notes/2026-10-06-widgets-compat.md` (normal prose). If anything is unsupported, STOP: do not continue to Task 2; report options. Otherwise commit the dependency install and notes: "Add widget libraries and compatibility notes".

### Task 2: Widget bridge, snapshot push and Settings → Widget

- [ ] `refreshWidgets()` per Architecture with adapters; iOS props import into `pending_actions`; triggers wired.
- [ ] Settings → Widget screen with group picker, hide-names toggle, preview.
- [ ] Tests: snapshot respects group and hideGoalNames; iOS props actions imported once (idempotent ids) then processed into a log; refresh pushed after log change and after rollover/import (mocked adapters); Settings screen updates settings.
- [ ] Commit "Add widget bridge and widget settings".

### Task 3: Platform widgets

- [ ] iOS widget definition (small/medium) and Android widget component + task handler per Architecture; app.json plugin config (App Group, Android sizes 2×2–4×2 resizable).
- [ ] End-to-end jest test with mocked platform adapters: Android task-handler click → `pending_actions` row → processor → log → refreshWidgets called with updated snapshot; iOS props action → same.
- [ ] Scratch prebuild for both platforms succeeds; iOS + Android export OK.
- [ ] PROGRESS.md Phase 12 with real output; device-pending: both widgets render and resize, tap marks done/increments exactly once incl. killed app, hide names, refresh on rollover.
- [ ] Commit "Add iOS and Android widgets".
