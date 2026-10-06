# Trek Design

Design reference for Trek. Values here are implemented in `src/ui/tokens.ts` and `src/ui/motion/tokens.ts`; if they disagree, the code is wrong. Screen layouts are rendered with mock data at the dev-only route `/design-preview` (light and dark).

Principles: minimal and calm, generous spacing, one accent color, at most two font weights, rounded cards, status never shown by color alone, icons only (no emojis), every control labelled for accessibility, 44 pt minimum tap target.

## 1. Tokens

### 1.1 Spacing (8 pt grid)
| Token | Value | Use |
|---|---|---|
| `xs` | 4 | Icon-to-label gap only (the single half step) |
| `sm` | 8 | Gaps inside a component |
| `md` | 16 | Screen padding, card padding, gaps between cards |
| `lg` | 24 | Section separation |
| `xl` | 32 | Large separation |
| `xxl` | 48 | Hero spacing (splash, lock) |

### 1.2 Radii
`sm` 8 (bars, day cells) · `md` 12 (inputs, icon badges) · `lg` 16 (cards, banners) · `xl` 24 (marks) · `pill` 999 (buttons, chips, segmented controls).

### 1.3 Tap targets
Minimum 44 × 44 pt for every control (`minTapTarget`).

### 1.4 Typography
System font (SF Pro on iOS, Roboto on Android). Two weights only: regular `400` and semibold `600`. Font scaling is respected (no `allowFontScaling={false}`).

| Variant | Size / line height | Weight | Use |
|---|---|---|---|
| `display` | 34 / 40 | 600 | Screen titles, big numbers |
| `title` | 22 / 28 | 600 | Card numbers, streak values |
| `headline` | 17 / 24 | 600 | Goal names, card titles |
| `body` | 15 / 20 | 400 | Body copy |
| `label` | 13 / 16 | 600 | Buttons, chips, section labels |
| `caption` | 12 / 16 | 400 | Secondary details |

### 1.5 Color
All colors come from `buildColors(mode, accent)`. No hard-coded colors in components.

| Token | Light | Dark |
|---|---|---|
| `background` | #F7F7F5 | #111214 |
| `surface` | #FFFFFF | #1B1C1F |
| `surfaceMuted` | #EFEFEC | #25262A |
| `border` | #E2E2DE | #34363B |
| `textPrimary` | #1B1C1E | #F2F2F3 |
| `textSecondary` | #5C5F66 | #A3A6AD |
| `accent` | accent tone 40 | accent tone 80 |
| `onAccent` | black or white, whichever contrasts more | same rule |
| `accentMuted` | accent tone 95 | accent tone 20 |
| `overlay` | rgba(17, 18, 20, 0.4) | rgba(0, 0, 0, 0.6) |

- Default accent: `#2E7D5B` (Trek green). Any accent generates a tonal palette: tone T is the color with the accent's hue and saturation whose CIELAB L* equals T (tones 0, 10, 20 … 90, 95, 99, 100).
- Contrast rules (tested): text tokens ≥ 4.5:1 on `background`, `surface` and `surfaceMuted`; `onAccent` ≥ 4.5:1 on `accent`; accent, status and goal colors ≥ 3:1 on `background` and `surface`.

### 1.6 Status colors and icons
Status is always shown with an icon (Ionicons) plus color, and labelled in text or for accessibility.

| Status | Icon | Light | Dark |
|---|---|---|---|
| done | `checkmark-circle` | #2E7D5B | #5CC49A |
| partial | `contrast` (half fill) | #B26A00 | #F0A443 |
| skipped | `remove-circle-outline` | #6B6F76 | #9EA2A9 |
| vacation | `airplane` | #2F6FB0 | #7DB3F0 |
| missed | `close-circle-outline` | #C0392B | #F07A6E |
| pending | `ellipse-outline` | #6B6F76 | #9EA2A9 |
| notDue (not-due) | none (muted day number) | #6B6F76 | #9EA2A9 |

### 1.7 Goal palette and icons
- 10 curated colors, stored by their light hex; dark mode uses the paired dark hex:
  #2E7D5B/#5CC49A, #2F6FB0/#7DB3F0, #7A4FC2/#B596F2, #B23A7A/#F08CC0, #C0392B/#F07A6E, #B26A00/#F0A443, #8A6D00/#E0C35A, #1F7A8C/#5FC6D8, #4F5BD5/#9AA3F5, #5C6B73/#A9B6BD.
- Custom colors pass through unchanged in both modes, so the AA badge (3:1 non-text) checks the color against `surface` and `surfaceMuted` in both light and dark; the color is accepted only if all four checks pass. Implemented and tested in Phase 4 (the Phase 0 preview checks `surface` in the current mode only).
- 20 curated Ionicons goal icons: water, barbell, book, flower, walk, bicycle, bed, cafe, nutrition, heart, musical-notes, brush, code-slash, language, medkit, moon, sunny, fitness, footsteps, leaf.

## 2. Motion tokens
| Token | Value |
|---|---|
| Durations | `fast` 150 ms · `base` 250 ms · `slow` 400 ms |
| Springs | `gentle` (damping 20, stiffness 120) · `snappy` (18, 260) · `bouncy` (10, 180), mass 1 |
| Easing | `standard` (0.2, 0, 0, 1) · `enter` (0, 0, 0, 1) · `exit` (0.3, 0, 1, 1) |
| Stagger | 40 ms per item, capped at the 8th item |
| Splash | total 1200 ms; mark draw 500 ms; wordmark at 300 ms for 250 ms; cross-fade from 950 ms |

Rules: animate only transform and opacity (Reanimated layout transitions are the only exception); every animation collapses to its end state when reduce motion is on (system setting or `reduceMotionOverride`); target 60 fps on a mid-range Android device. Primitives arrive in Phase 1: FadeIn, SlideUp, ScaleIn, Stagger, PressableScale, AnimatedNumber, Skeleton, Collapse, AnimatedCheck.

## 3. Screens
Every screen: `background` color, 16 pt padding, 16 pt gaps between cards, safe areas respected. Static stand-ins in the preview mark where Phase 5 draws real Skia or victory-native charts.

### 3.1 Splash
- Native splash: app icon centered on the theme background, held until fonts, migrations and settings are ready.
- Animated splash (Phase 1): Skia trail mark (a path climbing to a peak) draws its stroke over 500 ms while scaling 0.92→1 (`snappy`); "Trek" wordmark (display) fades in and slides up 12 pt from 300 ms; the overlay cross-fades out over the mounted Today screen from 950 ms. Total 1.2 s. Not mounted at all under reduce motion.
- Preview shows the final frame: mark (112 pt, `xl` radius, accent fill), wordmark, tagline "One step a day".

### 3.2 Today (the app opens here)
Top to bottom:
1. Date caption (`caption`, secondary), "Today" (`display`).
2. Date strip: logical today plus the 6 previous days; each day is a 44 × 56 pt pill (weekday caption + day headline); the selected day is filled with `accent`. Future days are not shown.
3. Banners (only when active): vacation ("Vacation mode is on" · "End vacation now"), then backup overdue ("Last backup N days ago" · "Back up now" · "Snooze 3 days"). Banner: `accentMuted` background, `lg` radius, icon + message + action buttons.
4. "To do" section label, then pending goal cards; "Done" section label, then completed goal cards.
- Goal card: 40 pt goal icon badge, name (`headline`), status icon + status text + progress ("5 / 8 glasses", "2 of 3 this week"), and a 44 pt primary control (check or plus). Done goals show the done status icon instead of the control.
- Multi-slot check goals show slot chips (44 pt pills, time label, check icon when done).
- Gestures (Phase 4): tap = primary action; swipe right = done; swipe left = skipped; long-press = log sheet. Check-off: checkmark draw 250 ms, success haptic, row dims to 60% and moves to Done, undo toast 4 s, confetti on streak milestones 7/30/100.
- Empty states: "Create your first goal" with template chips; "All done for today".

### 3.3 Stats (dashboard tab)
1. Group dropdown button ("All goals" + chevron).
2. Range segmented control: 7D · 30D · 90D · 1Y · All.
3. Partial-days segmented control: Weighted · Strict.
4. Completion card: label + ring (120 pt) with percentage in the center.
5. Two tiles: current streak (flame icon) and best streak (trophy icon), values as "N days".
6. Cards: Activity heatmap (12 weeks × 7 days), Weekly bars (8 weeks, best bar in accent), Trend line, By goal (horizontal bars in goal colors with %), Best weekday (name + 7 bars).
7. Review entry buttons: Weekly review, Monthly review.
8. Soft "Create a group" card (muted) with a button, or the empty state "Create a group with goals to see statistics" when `homeEmptyStateMode=requireGroup` and no groups exist.
- Motion (Phase 5): cards stagger in; ring and bars animate to value (400 ms `gentle`); dropdown opens with opacity + scale 0.96→1 (150 ms); segmented indicator slides (`snappy`); skeleton while computing.

### 3.4 Create goal
1. "New goal" (`display`), name input (52 pt, `md` radius, border), autofocus.
2. Template chips: Water, Workout, Reading, Meditation.
3. Collapsible section cards, each with a 44 pt header (title + one-line summary + chevron): Schedule, Times per day, Tracking, Duration, Reminders, Appearance.
- Schedule (expanded in preview): type chips (Every day, Weekdays, Weekends, Custom days, Every N days, Times per week), weekday chips, note "Changes apply from today; past stats are kept".
- Appearance (expanded in preview): 10 color swatches (44 pt circles, selected ring), AA badge (icon + "Readable (AA)" or "Low contrast"), 20 icon choices (44 pt tiles).
4. "Save goal" button (sticky at the bottom in Phase 4), enabled once the name is non-empty.
- Motion (Phase 4): sections expand with Collapse (content fade + layout reflow).

### 3.5 History (goal calendar)
1. Goal name (`display`).
2. Three stat cards: current streak, best streak, this month %.
3. Month header: previous / month name / next (44 pt icon buttons).
4. Weekday header row (starts on `weekStart`), then a 7-column grid. Each day cell (≥ 44 pt wide, 64 pt tall, `sm` radius): day number, status icon, value badge for count, duration and value goals. Not-due days show only a muted number. timesPerWeek rows end with a quota pill ("2/3") in Phase 6.
5. Legend card: every status with its icon and label.
6. Day sheet (bottom sheet in Phase 6; a card in the preview): "Log for <date>", status, value stepper (−/+), note (max 1000 chars, counter "n/1000"), "Clear entry" and "Save". Future days are read-only.
- Motion (Phase 6): horizontal pan follows the finger; past 25% width or a fast flick it springs (`snappy`) to the next or previous month.

### 3.6 Review (week or month)
1. Period header: previous / "Week 40" (or month) / next.
2. Overall card: "Overall completion", big % (`display`), change chip with an up or down arrow icon ("Up 6% vs previous").
3. By-goal bars, best goal and "Needs attention" tiles, streaks gained and lost tiles, best weekday and best time tiles, totals (done · skipped · vacation).
4. "Insights": 2–3 cards with a sparkles icon and one sentence each.
- Motion (Phase 7): counters animate (AnimatedNumber, 400 ms); bars stagger in.

### 3.7 Settings
- "Settings" (`display`).
- Appearance card: Theme, Accent color, Week starts on, Time format, My day ends at, Haptics, Reduce motion (each a 44 pt row: title, current value, chevron).
- Card: Vacation, Backup and export, Security, Widget (icon rows).
- About card: Export error log.

### 3.8 Lock
- Centered: 88 pt mark (lock icon on `accentMuted`, `xl` radius), "Trek is locked" (`title`), "Unlock to see your goals." (secondary), "Unlock" button.
- Motion (Phase 9): mark scales in (`bouncy`), button slides up; failure shakes horizontally with an error haptic; success fades the lock out over 250 ms while content scales 0.98→1. The system prompt opens automatically.
- Privacy overlay (Phase 9): `expo-blur` BlurView with the mark while the app is inactive and `hideInAppSwitcher` is on.

### 3.9 Widget (Phase 12)
- Small: done/total ring, "3/5", "Today".
- Medium: ring plus up to 4 rows (icon, name, progress), each a tap target. With "Hide goal names" on, rows read "Goal 1" to "Goal 4".
