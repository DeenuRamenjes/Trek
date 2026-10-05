# Trek Progress

## Status
| Phase | Status |
|---|---|
| 0 Design | Complete — awaiting design approval (CLAUDE.md §7.0) |
| 1 Scaffold, motion, tabs, splash | Complete |
| 2–13 | Not started |

## Phase 0 verification (run on 2026-10-05)
- `npx tsc --noEmit`: exit 0, no output.
- `npx jest`: `Test Suites: 8 passed, 8 total`; `Tests: 110 passed, 110 total`.
- `npx expo export --platform ios`: `› ios bundles (1):` and `Exported: dist`.
- `npx expo export --platform android`: `› android bundles (1):` and `Exported: dist`.

## Phase 1 verification (run on 2026-10-05)
- `npx tsc --noEmit`: exit 0, no output.
- `npx jest`: `Test Suites: 17 passed, 17 total`; `Tests: 182 passed, 182 total`.
- `EXPO_OFFLINE=1 CI=1 npx expo export --platform ios`: `› ios bundles (1):` and `Exported: dist`.
- `EXPO_OFFLINE=1 CI=1 npx expo export --platform android`: `› android bundles (1):` and `Exported: dist`.
- `dist` was removed after each export run.

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
- The root layout treats a font load error as ready, so the native splash never hangs.

## Deviations from CLAUDE.md
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
- Phase 6: history day cells are about 42.9 pt wide on a 360 dp screen (below 44 pt); day accessibility labels should be formatted with date-fns (for example "5 October 2026, Done").
- Phase 7: move review sentence assembly ("Reading 100%", the totals line) into string templates.
- Phase 9: settings option labels currently in mock data move into the strings file.
- Phase 13:
  - Re-export `icon.png` as RGB (no alpha) and make the Android adaptive-icon layer sizes consistent.
  - Keep dev preview code out of release bundles (the Android release export currently contains preview mock data, although the routes redirect at runtime).
  - Unit-test the `__DEV__ === false` redirect and the light/dark routing of the preview routes.
  - Extend the emoji scan to accessibility labels and placeholders.
  - Optional color tests: a positive large-text AA case, tone 99 and `toneOf` at 0 and 100, and a mid-grey `readableOn` case.

## Device verification pending (run in Phase 13)
- `/design-preview` on an iOS and an Android development build, light and dark, with large system font size.
- `/motion-check` on an iOS and an Android development build at 60 fps, with reduce motion on and off.
- Splash feel, and the handoff from the native splash to the animated splash.
- Tab indicator alignment under each tab, including with large system font size.
- App icon look on both platforms.
