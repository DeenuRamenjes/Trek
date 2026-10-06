# Trek device verification checklist

Every check here needs a real device or simulator with a development build. None of it can run in CI or in this
environment, so every item is **pending** until someone ticks it. Items come from the "device verification pending"
sections of `PROGRESS.md` and from the CLAUDE.md section 9 "Done when" list.

Setup for all checks:
- Build a development build for each platform (`npx expo run:ios`, `npx expo run:android`), not Expo Go.
- In Settings (dev build) use "Seed demo data" to load the 3-year data set where a step says "seeded".
- Repeat visual checks in light and dark, with system font size at default and at the largest setting, and with reduce
  motion on and off (iOS: Settings, Accessibility, Motion; Android: Settings, Accessibility, Remove animations).

Legend: each line is `[ ] check - steps - expected`.

## Both platforms

### Foundation and visuals (Phases 0 and 1)
- [ ] `/design-preview` - open the route in a dev build, light and dark, largest system font - screens render with no clipped text or overlapping controls; tap targets are comfortable.
- [ ] `/motion-check` - open the route; run each demo with reduce motion off, then on - animations run at 60 fps; with reduce motion on every demo jumps to its final state at once.
- [ ] Splash handoff - cold start the app - native splash (icon on theme background) hands off to the animated splash with no white flash, total at most 1.2 s, cross-fades into Today. With reduce motion on the animated splash is skipped.
- [ ] Tab indicator - tap each tab, also with largest font - indicator slides under the tapped tab and sits centred on the icon and label.
- [ ] App icon - view the installed icon on the home screen - icon looks correct on iOS and on Android (adaptive, round and square masks).

### Data (Phase 2)
- [ ] Migrations - first launch on a clean install, then install a newer build over an older one - the app opens with no error and keeps the data.
- [ ] `withTransaction` - seed demo data, then edit goals and logs rapidly from two screens - no "database is locked", no partial writes.
- [ ] Live queries - log a check-in on Today, switch to Stats and Goals - views update without a manual refresh.
- [ ] Seed - run the seed with the 3-year data set - completes without a freeze, all tabs usable afterwards.

### Goals and Today (Phase 4)
- [ ] Swipe gestures - swipe a Today row right, then left; long-press a row - right marks done, left marks skipped, long press opens the log sheet; the gesture follows the finger and springs back when cancelled.
- [ ] Goals drag reorder - long-press the handle on a goal row and a group row, drag, release - the order changes and persists; at 200 percent font the drop position still matches the finger.
- [ ] Confetti - reach a 7, 30 and 100 day streak (seeded goal, then check off) - confetti bursts once at each milestone; absent with reduce motion on.
- [ ] Haptics - check off a goal with haptics on, then off in Settings - a tap is felt only when on.
- [ ] Day rollover - set "My day ends at" to a time near now, wait for the boundary with the app open - Today switches to the new logical day without a restart.

### Stats and history (Phases 5 and 6)
- [ ] Chart animation - open Stats, change range and group - ring, bars and trend animate smoothly at 60 fps; instant with reduce motion on.
- [ ] Stats render time - seeded 3-year data, All range, mid-range Android (for example a Pixel 6a class device or older), release or profile build - the Stats tab content appears in under 500 ms after the tab is shown (CLAUDE.md section 7, Phase 13). Record the measured time. Jest on the dev machine measures about 225 to 260 ms for the model alone.
- [ ] History month swipe - on a goal's history, swipe between months slowly and with a flick - the grid follows the finger, snaps on commit, springs back on a short drag; instant with reduce motion on.
- [ ] History day sheet - tap a past day, drag the sheet handle down slowly, then flick, then tap the scrim - sheet follows the finger; past 120 dp or a flick dismisses; a short drag springs back; the keyboard does not cover the note field; with reduce motion on it appears and disappears at once.

### Reviews (Phase 7)
- [ ] Review counters - open a weekly and a monthly review - completion counter counts up over about 400 ms and per-goal bars stagger in; both are instant with reduce motion on.

### Notifications (Phase 8)
- [ ] Weekly custom schedule - create a goal with a reminder on two chosen weekdays, advance to the time - the reminder fires on those days only.
- [ ] Vacation suppression - add a vacation covering tomorrow - no reminder fires for affected goals during the range.
- [ ] Mark done from a killed app - kill the app, tap "Mark done" on a notification - the log is saved exactly once; open the app and confirm one log, not two.
- [ ] Snooze - tap "Snooze 10 min" - a new notification arrives about ten minutes later, once.
- [ ] Background task - background the app for over 15 minutes - reminders stay correct after a data change made earlier (the task runs the processor and reconciler).
- [ ] Notification response from killed state - tap the notification body from a killed app - the app opens on the right screen.
- [ ] Lock on and notifications - turn the app lock on - notification bodies show only the goal name, never notes.

### Appearance and security (Phase 9)
- [ ] Biometric flow - enable the lock, background past the timeout, return - Face ID or fingerprint prompt appears; three failures offer the device passcode; success unlocks. A device without enrolled security explains and keeps the lock off.
- [ ] App switcher privacy - with "hide in app switcher" on, open the app switcher - Trek shows a blurred overlay, not content.
- [ ] Lock animations - lock and unlock - logo bounce, button slide, shake on failure, fade-out; all instant with reduce motion on.
- [ ] Theme cross-fade - switch theme in Settings, Appearance - a short cross-fade, none with reduce motion on.

### Export, import and backup (Phases 10 and 11)
- [ ] Share sheets - export xlsx, JSON and CSV zip from Settings, Backup - the system share sheet opens for each and the file saves or sends.
- [ ] Spreadsheet apps - open the exported xlsx in Excel, Google Sheets and Numbers - Dashboard values match the cached values, TEXT columns keep ids, dates and times as text, data bars and color scales show, no repair prompt, no charts.
- [ ] Import from pickers - import xlsx, JSON and CSV zip with the document picker, including a file re-saved from Excel, Google Sheets and Numbers - preview shows counts and row errors; confirm imports; reminders and widgets refresh after.
- [ ] Restore from auto-backup - Settings, Backup, restore list - lists backups with date and size; restoring goes through the preview flow.
- [ ] Hermes xlsx loading - export xlsx in a release build - succeeds (the TextDecoder latin1 patch works on Hermes).

### Widgets (Phase 12)
- [ ] Render and resize - add the widget, resize it, light and dark - small shows ring and count, medium shows up to four goals.
- [ ] Tap once - tap a goal row (and a count goal) - marks done or increments exactly once, also when the app was killed.
- [ ] Hide goal names - turn it on in Settings, Widget - the widget shows the placeholder instead of names.
- [ ] Day rollover - leave the widget across the logical day boundary - it shows the new day without opening the app.

### Accessibility and onboarding (Phase 13)
- [ ] Screen reader pass - VoiceOver (iOS) and TalkBack (Android) through onboarding, Today, Stats, Goals, History (open a day sheet), Vacation, Review, Backup, Security, Appearance, Widget settings - every control is announced with a name and a role; statuses are announced in words; the history day sheet can be closed with the Close button.
- [ ] Font scaling - set the largest system font - no text is clipped on any screen; goal and group rows grow instead of cutting text; Save and primary buttons stay reachable.
- [ ] Reduce motion - turn on system reduce motion, and separately the in-app override - every screen change, list entry, sheet, chart and splash jumps to its final state.
- [ ] Onboarding - fresh install - three animated pages; permission prompt appears only on the last page; skipping the prompt still enters the app.
- [ ] Error log - Settings, About, Export error log - shares the file when one exists, otherwise says nothing is logged; nothing is sent automatically.

## iOS only
- [ ] Widgets - `expo-widgets` small and medium render in light and dark; the Expo UI `Button` `onPress` fires the widget handler and the app imports the appended action into `pending_actions` on next foreground.
- [ ] Pending notifications cap - with many reminders, in a debug session log `getAllScheduledNotificationsAsync` - count never exceeds 64.
- [ ] Cold-start notification response - kill the app, tap "Mark done" - recovered through `getLastNotificationResponseAsync` and applied once.
- [ ] Foreground presentation - keep the app open when a reminder is due - the notification still shows (handler set before first render).
- [ ] Files app - open Files, On My iPhone, Trek - the `backups` folder and its JSON files are visible (UIFileSharingEnabled, LSSupportsOpeningDocumentsInPlace).
- [ ] Files preview - preview the exported xlsx in Quick Look - values show correctly.
- [ ] Face ID - first enable shows the Face ID usage text; passcode fallback works.

## Android only
- [ ] Widgets - 2x2 up to 4x2 resize; small layout below about 250 dp wide, medium above; `requestWidgetUpdate` from the headless task refreshes the widget after a tap with the app killed.
- [ ] Notification permission - on Android 13 and later the POST_NOTIFICATIONS prompt appears; denying it leaves the app usable and the settings row explains.
- [ ] Exact alarms - revoke "Alarms and reminders" - reminders fall back to inexact timing and still fire.
- [ ] Channels - Android notification settings show one channel per goal plus reviews and backup.
- [ ] Storage Access Framework - Settings, Backup, "Choose backup folder" - backups are copied to the chosen folder; revoke access and relaunch - the app clears the folder and shows the revoked message.
- [ ] Back button - with the history day sheet open, press back - the sheet closes.
- [ ] Performance - on a mid-range device scroll the 3-year Goals list and the Today list, swipe history months, run the splash - 60 fps, no dropped-frame stutter.

## CLAUDE.md section 9 "Done when" device items
- [ ] Exported xlsx shows correct values in Excel, Google Sheets and the iOS Files preview - see "Spreadsheet apps" and "Files preview".
- [ ] Reminders fire correctly on a weekly custom schedule on both platforms - see "Weekly custom schedule".
- [ ] iOS pending notifications never exceed 64 - see iOS "Pending notifications cap".
- [ ] Reminders suppressed during a vacation - see "Vacation suppression".
- [ ] "Mark done" from a notification and from a widget is saved exactly once, including from a killed app - see "Mark done from a killed app" and Widgets "Tap once".
- [ ] The app lock works and hides content in the app switcher - see "Biometric flow" and "App switcher privacy".
- [ ] The backup reminder fires when overdue - set backup frequency to weekly, set the device date forward eight days (or wait), open and background the app - a low-priority notification arrives and Today shows "Last backup N days ago · Back up now" with one-tap backup and 3-day snooze.
- [ ] Auto-backup keeps exactly 7 files - open the app on eight different days (change the device date) - `documentDirectory/backups` holds the newest 7.
- [ ] Splash and all animations respect reduce motion, and the app works fully in airplane mode - enable airplane mode, then walk every tab, create, edit and log goals, export, and restore - nothing waits on or reports a network.
- [ ] Stats under 500 ms with 3-year seed on a mid-range Android - see "Stats render time".
