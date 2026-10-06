# Widget library compatibility (Phase 12, Task 1)

Date: 2026-10-06. Verdict: both libraries are supported. The STOP gate passes.

Installed with `EXPO_OFFLINE=1 npx expo install expo-widgets react-native-android-widget`, then `rm -rf node_modules && npm install`. Resolved versions: expo-widgets 57.0.22 (`~57.0.22`), react-native-android-widget 0.22.1 (`^0.22.1`). The existing `overrides` block in package.json is unchanged. The project runs expo ~57.0.26, react-native 0.86.3, New Architecture on.

## expo-widgets 57.0.22 (iOS)

- SDK 57 support: the package is versioned with the SDK (57.0.x) and installed through `expo install`. Its peers are `expo`, `react`, `react-native` (all `*`). The CHANGELOG lists 57.0.16 through 57.0.22 as "no user-facing changes".
- New Architecture: it is an Expo Modules package (`expo-module.config.json`, Swift `WidgetsModule`, `SharedObject` based `Widget` class) and has no legacy bridge code. SDK 57 requires the New Architecture. No separate flag exists.
- Dependency note: it depends on `@expo/ui ~57.0.21`, which npm installs as a transitive dependency. The widget layout is written with Expo UI components. `@expo/ui` is not listed in CLAUDE.md as a direct dependency. We do not import it directly beyond what widget layouts need. Treat it as an implied peer of the approved library. Flag it to the owner.
- Interactivity: `ios/Widgets/AppIntent.swift` defines `WidgetUserInteraction` (an AppIntent, iOS 16+). A button in the widget layout carries a `target`. On tap, the extension's JS runtime runs the layout's button handler (`evaluateWidgetButtonPress`) with the current props and the environment, and the returned props are merged into the timeline entry. The extension then reloads the timeline and emits `onExpoWidgetsUserInteraction` to the app (`addUserInteractionListener` in `src/Widgets.ts`) if the app process is alive.
- App Group data sharing: `WidgetsStorage` wraps `UserDefaults(suiteName:)`, with the suite taken from Info.plist key `ExpoWidgetsAppGroupIdentifier`. It stores `__expo_widgets_<name>_layout` and `__expo_widgets_<name>_timeline`. The app writes props with `new Widget(name, layout)` then `updateSnapshot(props)` / `updateTimeline(entries)` / `reload()`, and reads them back with `await widget.getTimeline()`. This matches the plan: the button handler appends an action to the props, and the app reads them via `getTimeline()` and imports them into `pending_actions`.
- Sizes: `supportedFamilies` in the plugin config accepts `systemSmall`, `systemMedium`, and others. We use small and medium.
- Plugin: `app.plugin.js` options are `groupIdentifier`, `bundleIdentifier`, `enablePushNotifications`, `frequentUpdates`, `enableAndroid`, `widgets[]`. The widget extension deployment target defaults to iOS 16.4.

## react-native-android-widget 0.22.1 (Android)

- SDK 57 support: peer `expo >=54.0.0`, `react *`, `react-native *`. Expo 57 satisfies this. It ships a config plugin (`app.plugin.js`).
- New Architecture: `android/build.gradle` applies the `com.facebook.react` plugin when `newArchEnabled=true`. `oss/HeadlessJsTaskWorker.java` obtains `ReactHost` from `ReactApplication.getReactHost()`, which is the bridgeless (New Architecture) host. Prebuild generated `newArchEnabled=true` in `gradle.properties`.
- Interactive actions: clicks produce `widgetAction: 'WIDGET_CLICK'` with `clickAction` and `clickActionData` delivered to the handler registered with `registerWidgetTaskHandler`. The handler runs headless (WorkManager `RNWidgetBackgroundTaskWorker`) without opening the app, and calls `renderWidget(...)` to re-render. `requestWidgetUpdate` is available to push updates from the app.
- Data sharing: there is no shared store. The headless task runs in the app's JS runtime and process, so it can open `trek.db` directly, as the plan intends.
- Sizes: the config plugin `Widget` type has `minWidth`, `minHeight`, `targetCellWidth`, `targetCellHeight`, `maxResizeWidth`, `maxResizeHeight`, `resizeMode` (`none | horizontal | vertical | horizontal|vertical`), `updatePeriodMillis`. 2x2 to 4x2 is configurable: 2x2 target cells with `resizeMode: horizontal|vertical` and `maxResizeHeight` limited to roughly 2 cells.
- Caveat: the library's own `android/gradle.properties` defaults (compileSdk 33, AGP 7.2.1 in its buildscript) are only fallbacks. The root project's `ext` values are used when present (`getExtOrDefault`). Real compile checking needs a device or Gradle build, which is not available here.

## Scratch prebuild

Run in a copy of the repo outside the project (node_modules symlinked), with both plugins configured, then deleted. Command: `EXPO_OFFLINE=1 CI=1 npx expo prebuild --no-install --clean --platform <ios|android>`.

- iOS: exit 0, "Finished prebuild". Generated `ios/ExpoWidgetsTarget` (Info.plist, entitlements, `TrekWidget.swift`, `index.swift`). The App Group `group.com.deenuramenjes.trek` appears in `ios/Trek/Trek.entitlements`, `ios/Trek/Info.plist` and the target's entitlements and Info.plist. Widget target deployment target is 16.4. One warning: no widget bundle identifier given, so the fallback `com.deenuramenjes.trek.ExpoWidgetsTarget` is used. Task 3 should set `bundleIdentifier` explicitly.
- Android: exit 0, "Finished prebuild". Generated `widget/TrekWidget.java` (extends `RNWidgetProvider`), a manifest receiver, and `res/xml/widgetprovider_trekwidget.xml` with minWidth/minHeight 110dp, targetCell 2x2, maxResize 320x160dp, resizeMode horizontal|vertical. `newArchEnabled=true`.

## Important finding: plugin options are required

`npx expo install` added both plugins to app.json as bare strings. With a bare `"react-native-android-widget"` entry, config loading (and thus any `expo` command) crashes: `TypeError: Cannot read properties of undefined (reading 'widgets')` in `app.plugin.js`. For that reason the plugin entries were NOT left in app.json in this commit. Task 3 adds both plugins with full options (App Group, iOS widget definitions, Android widget sizes) in one step.

## Not verified here

Native compilation (Xcode, Gradle), widget rendering, tap behaviour and killed-app behaviour need a device. They are recorded as device verification pending (Phase 13).
