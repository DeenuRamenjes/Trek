# Phase 1 (Scaffold) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Dev-build config, a settings store, the Reanimated 4 motion module with a `/motion-check` screen, the native and animated splash, and four animated tabs that open on Today.

**Architecture:**
- Settings: zod schema in `src/domain/settings.ts` (pure); zustand store persisted in MMKV in `src/features/settings/settingsStore.ts`.
- Motion: `src/ui/motion` on Reanimated 4 only (Moti dropped, D3/D4).
- Splash: `expo-splash-screen` holds the native splash until fonts are loaded, then `AnimatedSplash` plays over the mounted tabs.
- Tabs: Expo Router `(tabs)` group with a custom animated `TabBar`.

**Tech Stack:** react-native-reanimated 4.5.1, react-native-worklets 0.10.1, react-native-gesture-handler 2.32, @shopify/react-native-skia 2.6.2, react-native-mmkv 4 (+ react-native-nitro-modules), zustand 5, zod 4, expo-splash-screen, expo-dev-client, expo-system-ui. All are approved in CLAUDE.md §1.

## Global Constraints

- Phase 0 constraints still apply (approved dependencies only; `EXPO_OFFLINE=1 npx expo install`; clean install after dependency changes; RNTL 14 is async; no emojis; strings in `src/strings/en.ts`; colours from tokens; 44 pt targets; labels on every control).
- Animate only transform and opacity. Reanimated layout transitions are the only exception.
- Every animation jumps to its end state when reduce motion is on (system setting, or `reduceMotionOverride`).
- Jest:
  - `jest.setup.js` (both projects) mocks `react-native-mmkv` with its own `createMockMMKV`, and mocks `react-native-worklets` with its own `src/mock`.
  - `jest.setup.app.js` loads the gesture-handler jest setup and a lightweight Skia mock.
  - `jest.setup.after.js` calls Reanimated `setUpTests()`.
  - Animation tests use `jest.useFakeTimers()` with `jest.advanceTimersByTime` and Reanimated's `getAnimatedStyle`.
- Verification for every task: `npx tsc --noEmit` and `npx jest`. The phase ends with `EXPO_OFFLINE=1 CI=1 npx expo export --platform ios|android`.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_014qGP2qavm772yGiGc1rSw8`.

## File Structure

```
src/domain/settings.ts                 settings zod schema, DEFAULT_SETTINGS, parseSettings (field-by-field fallback)
src/features/settings/settingsStore.ts createSettingsStore(storage), loadSettings, useSettings (MMKV id trek-settings)
src/ui/motion/                         preference (resolveReduceMotion, useReduceMotion), MotionConfig, animate, Motion,
                                       presets (FadeIn, SlideUp, ScaleIn), Stagger, PressableScale, AnimatedNumber,
                                       Skeleton, Collapse, AnimatedCheck, index
src/ui/components/TrekMark.tsx         Skia trail mark (path M18 78 L40 52 L52 62 L82 22, 100-unit box)
src/ui/splash/AnimatedSplash.tsx       1.2 s splash overlay; calls onFinish; null under reduce motion
src/ui/ThemedSystemBars.tsx            status bar style + native root background follow theme
src/ui/navigation/TabBar.tsx           custom tab bar with animated indicator            (Task 2)
app/_layout.tsx                        providers, native splash hold, AnimatedSplash, themed Stack   (Task 3)
app/(tabs)/_layout.tsx, today, stats, goals, settings                                        (Task 2)
app/motion-check.tsx + src/dev/routes/MotionCheck.tsx                                        (Task 4)
assets/*.png (Trek mark icon, splash, adaptive icon)                                         (Task 3)
jest.setup.js, jest.setup.app.js, jest.setup.after.js, jest.config.js
```

### Task 1: Foundations (settings, motion module, splash components, Phase 0 carry-forward)

Written by the controller in a scratch dry run and verified there (tsc 0, jest 154 passed), then copied into the repo. The task review checks it like any other task.

- [ ] Install `react-native-reanimated react-native-worklets react-native-gesture-handler @shopify/react-native-skia react-native-mmkv react-native-nitro-modules zustand zod expo-splash-screen expo-dev-client expo-system-ui`, then clean-install.
- [ ] Settings schema and store, with tests: defaults match §3, per-field fallback, nested defaults, sync hydration, persistence, reset.
- [ ] Motion module, with tests:
  - `Motion` animates `from`→`animate` in 250 ms and jumps straight to `animate` under reduce motion;
  - presets, Stagger (40 ms steps), PressableScale, AnimatedNumber, Skeleton (each has a reduce-motion case);
  - Collapse, AnimatedCheck.
- [ ] `TrekMark`, `AnimatedSplash`, `ThemedSystemBars`. Strings: `navigation`, `devTools` and `motionCheck` added; `home` removed; `app/index.tsx` redirects to `/today`.
- [ ] Phase 0 carry-forward:
  - `staggerDelay` guards NaN and fractional indexes; `splashTiming.crossFadeMs` added; spring, easing and splash-coupling tests added;
  - `Card` accepts `StyleProp`; the barrel exports the prop types; Banner keys by index;
  - `Screen` gains an `edges` prop; `buildColors` copies the status colours;
  - vacation status glyph is `airplane` (resolves the `sunny` double meaning);
  - ThemeProvider system-fallback and accent tests.
- [ ] Commit "Add settings store, Reanimated motion module and splash components".

### Task 2: Tabs with an animated tab bar

**Files:** `src/ui/navigation/TabBar.tsx`, `src/ui/navigation/__tests__/TabBar.test.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/today.tsx`, `stats.tsx`, `goals.tsx`, `settings.tsx`.

- [ ] Write a failing test for `TabBar`, using minimal structural props (no import from `@react-navigation/*`):
  - `state: { index: number; routes: { key: string; name: string; params?: object }[] }`
  - `navigation: { emit(e: { type: 'tabPress'; target: string; canPreventDefault: true }): { defaultPrevented: boolean }; navigate(name: string, params?: object): void }`

  Tests:
  - renders 4 tabs (Today, Stats, Goals, Settings, from `strings.tabs`), each with `accessibilityRole="tab"`, its label, and `accessibilityState.selected` on the focused tab;
  - pressing an unfocused tab emits `tabPress` and navigates;
  - pressing the focused tab does not navigate;
  - every tab is at least 44 pt tall;
  - the indicator's animated `translateX` reaches `index * tabWidth` after a `layout` event plus timer advance, and is set at once under reduce motion.
- [ ] Implement `TabBar`:
  - container: `accessibilityRole="tablist"`, label `strings.navigation.tabBar`, `surface` background, top border, bottom safe-area padding;
  - icons from `uiIcons` (today, stats, goals, settings);
  - label: `caption` variant; accent colour when focused, `textSecondary` otherwise;
  - indicator: an `accentMuted` pill behind the focused item; `translateX` uses `withSpring(springs.snappy)`, and is set directly under reduce motion.
- [ ] `app/(tabs)/_layout.tsx`:
  - Expo Router `Tabs` with `tabBar={(props) => <TabBar {...props} />}`;
  - `screenOptions={{ headerShown: false, animation: reduce ? 'none' : 'fade' }}`;
  - screens in order today, stats, goals, settings.
- [ ] Tab screens use `Screen edges={['top','left','right']}` and a `display` title from `strings.tabs.*`.
  - Today also shows the designed empty state: a Card with `strings.today.emptyTitle` and `emptyBody`.
  - Settings shows, only when `__DEV__`, a "Developer" card with buttons that push `/design-preview` and `/motion-check` (labels from `strings.devTools`).
- [ ] tsc + jest, then commit "Add tabs with an animated tab bar".

### Task 3: Root layout, native splash and app assets

**Files:** `app/_layout.tsx`, `app.json`, `assets/icon.png`, `assets/splash-icon.png`, `assets/splash-icon-dark.png`, `assets/android-icon-foreground.png`, `assets/android-icon-background.png`, `assets/android-icon-monochrome.png`, `src/ui/splash/__tests__/AnimatedSplash.test.tsx`.

- [ ] Failing tests for `AnimatedSplash`, with fake timers:
  - `onFinish` is not called at 1199 ms and is called at 1200 ms;
  - the overlay (`testID="animated-splash"`, query with `includeHiddenElements`) is present at the start;
  - with `reduceMotionOverride: 'on'`, `onFinish` is called immediately and no overlay renders.
- [ ] `app/_layout.tsx`:
  - `SplashScreen.preventAutoHideAsync()` at module scope;
  - `useFonts(Ionicons.font)`; when loaded, `SplashScreen.hideAsync()`. Phase 2 adds migrations to this readiness check;
  - render `GestureHandlerRootView` › `SafeAreaProvider` › `ThemeProvider` (mode from `settings.theme`, undefined when `'system'`; accent from `settings.accentColor`) › `MotionConfig`, `ThemedSystemBars`, a `Stack` with `headerShown: false` and `animation: reduce ? 'none' : 'default'`;
  - `AnimatedSplash` until it calls `onFinish`.
- [ ] Assets: generate PNGs of the Trek mark with a pure-Python PNG writer (scratch script, not committed). Distance-to-polyline coverage, stroke 9/100, round caps.
  - `icon.png`: 1024², `#2E7D5B` background, white mark scaled to 70%.
  - `splash-icon.png`: 1024², transparent background, `#2E7D5B` mark.
  - `splash-icon-dark.png`: the same with the dark accent, `buildColors('dark').accent`.
  - Android foreground: white mark in the central 60% on transparent.
  - Android background: solid `#2E7D5B`.
  - Android monochrome: white mark in the central 60%.
- [ ] `app.json`:
  - `expo-splash-screen` plugin config: image `./assets/splash-icon.png`, `imageWidth` 160, `backgroundColor` `#F7F7F5`, dark image `./assets/splash-icon-dark.png` with `backgroundColor` `#111214`;
  - Android `adaptiveIcon.backgroundColor` `#2E7D5B`.
- [ ] tsc + jest + `expo export` for iOS and Android, then commit "Add root layout with native and animated splash and Trek app assets".

### Task 4: `/motion-check` screen, preview back button, docs

**Files:** `app/motion-check.tsx`, `src/dev/routes/MotionCheck.tsx`, `src/dev/routes/__tests__/MotionCheck.test.tsx`, `src/dev/routes/DesignPreviewScreen.tsx`, `DESIGN.md`, `PROGRESS.md`.

- [ ] `MotionCheck`, rendering every primitive with labels from `strings.motionCheck`:
  - a reduce-motion status line;
  - a Replay button that remounts the demos;
  - FadeIn / SlideUp / ScaleIn cards;
  - Stagger of 5 items;
  - PressableScale;
  - AnimatedNumber toggling 0 ↔ 100;
  - Skeleton;
  - Collapse with a toggle;
  - AnimatedCheck with a toggle;
  - a static TrekMark.

  `app/motion-check.tsx` redirects to `/` unless `__DEV__`. Test: every button labelled; toggles work; renders under reduce motion.
- [ ] `DesignPreviewScreen` gains a back `IconButton` (`strings.navigation.back`) calling `router.back()`. Test with mocked expo-router.
- [ ] DESIGN.md: vacation glyph `airplane`. PROGRESS.md:
  - Phase 1 status, real verification output and decisions (Moti replaced, jest mocks, theme cross-fade moved to Phase 9 where theme switching UI exists);
  - remove the Phase 1 carry-forward items that are done;
  - move the SegmentedControl role item to Phase 5;
  - add device-pending items: `/motion-check` at 60 fps, splash feel, tab indicator.
- [ ] Commit "Add motion check screen and update progress for Phase 1".
