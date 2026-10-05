# Trek Progress

## Status
| Phase | Status |
|---|---|
| 0 Design | Complete — awaiting design approval (CLAUDE.md §7.0) |
| 1–13 | Not started |

## Phase 0 verification (run on 2026-10-05)
- `npx tsc --noEmit`: exit 0, no output.
- `npx jest`: `Test Suites: 8 passed, 8 total`; `Tests: 110 passed, 110 total`.
- `npx expo export --platform ios`: `› ios bundles (1):` and `Exported: dist`.
- `npx expo export --platform android`: `› android bundles (1):` and `Exported: dist`.

## Decisions
- Design decisions and CLAUDE.md diffs D1–D15: `docs/superpowers/specs/2026-10-05-trek-design.md`.
- Moti is not used (it depends on framer-motion); motion primitives will be built on Reanimated 4 in Phase 1.
- `package.json` pins `react-dom` to 19.2.3 via `overrides`: expo-router pulls react-dom in transitively, and npm otherwise resolves 19.3.0, which needs react 19.3.
- Install commands use `EXPO_OFFLINE=1`; this environment's proxy blocks the Expo API and reactnative.directory.
- jest uses two projects (`node` for `*.test.ts`, `app` for `*.test.tsx`), both preset `jest-expo`. `jest-expo/node` and `jest-expo/ios` fail to transform in this setup.
- Route tests render route components with a mocked `expo-router`, because `renderRouter` is incompatible with RNTL 14's async render.
- Design-preview charts are static View-based stand-ins; real Skia and victory-native charts arrive in Phase 5.
- Day counts pluralize: `strings.stats.days(1)` is '1 day' and `strings.today.backupBanner(1)` is 'Last backup 1 day ago' (owner-approved; the spec's 'Last backup N days ago' is treated as a template).
- `Screen` uses `flexGrow: 1` (not `flex: 1`) for centered scrolling content so large system fonts can scroll instead of clipping.
- `isPreviewKey` uses an own-property check so prototype keys such as `constructor` are rejected.
- `StatusGlyph` stays decorative for screen readers; every caller pairs it with visible text or a labelled control (owner ruling).

## Deviations from CLAUDE.md
- None beyond the approved diffs D1–D15. Plan amendments approved during execution are listed under Decisions.

## Open questions
- Deferred review notes (minor) for later phases: chart stand-ins expose no data to screen readers (Phase 5 charts must); selected chips and the date strip use fill colour plus accessibility state only; settings option labels in mock data move to the strings file when Settings becomes real (Phase 9); the `__DEV__ === false` redirect of the preview routes is not unit-tested.

## Device verification pending (run in Phase 13)
- `/design-preview` on an iOS and an Android development build, light and dark, with large system font size.
