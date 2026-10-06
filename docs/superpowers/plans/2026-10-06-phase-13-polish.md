# Phase 13 (Polish) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Error log, onboarding, empty states, accessibility and reduce-motion passes, performance work on the 3-year seed, open carry-overs, and a consolidated device verification checklist.

**Architecture:**
- Error log `src/services/errorLog.ts`: `logError(context, error)` appends a JSON line (timestamp, context, message, stack, app version) to `Paths.document/logs/error.log`; rotation when the file would exceed 500 KB (rename to `error.1.log`, keep one rotated file, total ≤ 500 KB budget each); a pure `rotatePlan(sizes, incoming)` helper unit-tested. Hooks: `ErrorUtils.setGlobalHandler` wrapper (chains the previous handler), unhandled promise rejections (`globalThis` `unhandledrejection` if available, else Hermes `HermesInternal`-safe no-op), React error boundary in `app/_layout.tsx` with a calm fallback screen, and calls in existing catch sites that currently swallow errors (Today context load, reconcile, processor, backup, widgets). Settings → About → "Export error log" shares the file with `expo-sharing`. Never sent automatically.
- Onboarding: `app/onboarding.tsx` 3 animated screens (Stagger/SlideUp, reduce-motion aware) shown on first run (`settings.onboardingDone` — store it in MMKV under a separate key `trek-onboarding` to avoid changing the settings schema shape; plain boolean); the last screen requests notification permission via `ensureNotificationPermission()` then routes to Today.
- Performance: rewrite `statsModel` to a single pass that buckets logs by goal and date once (Map), computes per-day statuses once per goal over the range, and derives completion, heatmap, weekly, trend, per-goal and best weekday from that; target: 3-year "All" range under 500 ms in jest on the seed (assert < 1500 ms in CI-safe test plus log the time); Today screen reloads contexts incrementally (only on goal/schedule changes, logs separately); Goals list uses FlatList.
- Accessibility pass: audit every screen for `accessibilityLabel`, role, 44 pt, status not by color alone, `allowFontScaling` respected (no fixed heights clipping text at 200%); a test helper `expectAllPressablesLabelled(tree)` used in screen tests.
- Reduce-motion pass: every animated component reads `useReduceMotion`; a test renders key screens with `reduceMotionOverride: 'on'` and asserts final states are immediate.
- Carry-overs from PROGRESS.md: history day editor as a gesture bottom sheet (Reanimated + gesture-handler, reduce-motion aware) replacing the fade modal; `GroupRow` unused prop; move buttons disabled at ends (add `disabled` to IconButton).
- Device checklist: `docs/DEVICE-CHECKLIST.md` consolidating every "device verification pending" item from PROGRESS.md with steps and expected results, grouped by platform. Device checks cannot run in this environment; they stay pending and are reported as such.

**Tech Stack:** existing only. No new dependencies.

## Global Constraints

- No new dependencies, no schema change, no native code.
- Strings in `src/strings/en.ts`; no emojis; tokens; 44 pt; labels; reduce motion.
- Verification per task: `npx tsc --noEmit`, `npx jest`; phase end iOS + Android `expo export`.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_014qGP2qavm772yGiGc1rSw8`.

### Task 1: Error log
- [ ] Implement per Architecture; tests: rotation keeps size ≤ 500 KB with one rotated file; global handler chains previous; boundary renders fallback and logs; Export error log row shares the file (mocked).
- [ ] Commit "Add rotating error log".

### Task 2: Onboarding and empty states
- [ ] Onboarding per Architecture; tests: shown on first run only; last screen requests permission then routes to Today; reduce motion renders instantly.
- [ ] Audit every list for a designed empty state (Today, Goals, Groups, Stats, History, Vacation, Restore list, Widget preview, Review); add missing ones with tests.
- [ ] Commit "Add onboarding and complete empty states".

### Task 3: Performance
- [ ] Single-pass stats model per Architecture with identical outputs (equality test old vs new on the seed for every range and mode before deleting the old path); timing test; Today incremental reload; Goals FlatList.
- [ ] Commit "Speed up stats and lists".

### Task 4: Accessibility, reduce motion, carry-overs, device checklist
- [ ] Passes and carry-overs per Architecture with tests.
- [ ] `docs/DEVICE-CHECKLIST.md`; PROGRESS.md Phase 13 with real outputs and the final status of every §9 "Done when" item (automated: pass with evidence; device: pending with checklist reference).
- [ ] Commit "Accessibility and reduce-motion pass, history sheet, device checklist".
