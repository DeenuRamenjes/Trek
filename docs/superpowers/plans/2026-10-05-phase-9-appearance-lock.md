# Phase 9 (Appearance and App Lock) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Settings → Appearance (theme, accent tonal palette, week start, 12/24h, "My day ends at", haptics, reduce-motion override, theme cross-fade) and Settings → Security (app lock with `expo-local-authentication`, timeout, animated lock screen, `expo-blur` privacy overlay).

**Architecture:**
- `app/settings/appearance.tsx`, `app/settings/security.tsx`; Settings tab rows link to them.
- Theme cross-fade: on theme/accent change, `ThemeProvider` keeps a snapshot overlay of the previous background and fades it out (opacity, 250 ms) — implemented as an absolutely positioned `View` with the old background colour fading out over the new tree; instant under reduce motion.
- App lock: pure state machine `src/domain/appLock.ts` (`lockReducer(state, event)`; events: coldStart, background(at), foreground(at), authSuccess, authFailure, enable, disable; timeout `immediate|1m|5m|15m`) unit-tested; service `src/services/appLock.ts` wraps `expo-local-authentication` (`hasHardwareAsync`, `isEnrolledAsync`, `authenticateAsync({ disableDeviceFallback: false })`); `src/features/security/LockGate.tsx` in `app/_layout.tsx` renders the lock screen over content when locked, and `PrivacyOverlay` (BlurView + TrekMark) while AppState is inactive/background and `hideInAppSwitcher` is on.
- Normative: design doc `docs/superpowers/specs/2026-10-05-trek-design.md` §4.9; CLAUDE.md §5.10, §5.11.

**Tech Stack:** expo-local-authentication, expo-blur (approved; `EXPO_OFFLINE=1 npx expo install expo-local-authentication expo-blur`, clean install; add the local-authentication plugin with `faceIDPermission` string to `app.json`).

## Global Constraints

- Approved dependencies only. No schema change. Settings are persisted through the existing settings store (`update`).
- Strings in `src/strings/en.ts` ("My day ends at" label exactly; hours 0–4 shown as times like "Midnight", "1:00 AM"… per `timeFormat`); no emojis; tokens; 44 pt; labels.
- Accent picker: curated palette swatches plus the custom picker from Phase 4 (`ColorPicker`), showing the generated tonal palette preview (`buildColors`).
- Changing `dayEndsAt`, `weekStart` or reminder-relevant settings triggers a reconcile (Phase 8 lifecycle already subscribes to settings? verify; add if missing).
- App lock: off by default; enabling requires `isEnrolledAsync` true and a successful `authenticateAsync`, else explain (strings) and keep off. Lock on cold start and after background longer than the timeout. Lock screen per design §4.9 (logo scales in bouncy, "Trek is locked", Unlock button slides up; prompt opens automatically; failure shake + error haptic; success fade out 250 ms with content scale 0.98→1). The app never stores a PIN. All motion reduce-motion aware.
- Notification privacy while locked is already handled by the reconciler (Phase 8); add/keep a test that content omits notes and is generic while lock is on.
- Tests: RNTL 14 async; mock `expo-local-authentication` and `expo-blur` in jest setup.
- Verification per task: `npx tsc --noEmit`, `npx jest`; phase end: iOS + Android `expo export`.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_014qGP2qavm772yGiGc1rSw8`.

### Task 1: Appearance settings and theme cross-fade

**Files:** `app/settings/appearance.tsx`, `src/features/appearance/{AppearanceScreen.tsx,AccentPicker.tsx,dayEndsLabel.ts}`, `src/ui/ThemeProvider.tsx` (cross-fade), Settings tab rows, strings, tests.

- [ ] Controls: theme (system/light/dark SegmentedControl), accent (palette + custom + tonal preview), week start (Sunday/Monday/Saturday chips — store date-fns numbers 0/1/6), time format 12h/24h, "My day ends at" (0–4), haptics switch, reduce motion (system/on/off).
- [ ] Cross-fade per Architecture.
- [ ] Tests: each control updates the settings store; dayEndsLabel for 12h/24h; cross-fade overlay appears on theme change and not under reduce motion; reconcile triggered on dayEndsAt change (mocked).
- [ ] Commit "Add appearance settings".

### Task 2: App lock

**Files:** `src/domain/appLock.ts` (+ tests), `src/services/appLock.ts`, `src/features/security/{SecurityScreen.tsx,LockScreen.tsx,LockGate.tsx,PrivacyOverlay.tsx}`, `app/settings/security.tsx`, `app/_layout.tsx`, `app.json`, strings, tests, `PROGRESS.md`.

- [ ] Pure lock reducer with tests: disabled never locks; cold start locks when enabled; background then foreground within timeout stays unlocked, past timeout locks; immediate locks on any background; failure count increments and resets on success.
- [ ] Security screen: enable switch (enrolment check + auth), timeout options, hide-in-app-switcher switch; explanation text when no enrolled security.
- [ ] LockGate + LockScreen + PrivacyOverlay per Architecture/design.
- [ ] Tests: enabling fails without enrolment and stays off; enabling with successful auth turns on; LockGate shows lock screen on start when enabled and hides after successful unlock; privacy overlay shown on inactive AppState when enabled.
- [ ] PROGRESS.md Phase 9 with real output; device-pending: biometric flow, app-switcher overlay, lock animations.
- [ ] Commit "Add app lock".
