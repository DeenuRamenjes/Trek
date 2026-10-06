# Phase 7 (Reviews) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The `review/[period]` screen for weeks and months, plus the Phase 3 review carry-overs.

**Architecture:** `app/review/[period].tsx` (replace the Phase 5 stub) parses `week-<YYYY-MM-DD>` or `month-<YYYY-MM>` into a `Period` and renders `src/features/reviews/ReviewScreen.tsx`, which loads goal contexts and logs, calls `buildReview` (`src/domain/reviewBuilder.ts`) and renders the cards. Normative UX: design doc `docs/superpowers/specs/2026-10-05-trek-design.md` §3.7, §4.8; CLAUDE.md §5.8. Review notifications are Phase 8; this phase provides the deep-link targets.

**Tech Stack:** existing (Reanimated 4, Skia, victory-native, src/ui/motion). No new dependencies.

## Global Constraints

- No new dependencies, no schema change. Strings in `src/strings/en.ts` (insight templates via `formatInsight`); no emojis; Ionicons; tokens; 44 pt; labels on every control; change chip shows an arrow icon plus text, not color alone.
- Motion: AnimatedNumber 400 ms for the completion counter; per-goal bars stagger in; all reduce-motion aware.
- Route param format: `week-YYYY-MM-DD` (any date in the week) and `month-YYYY-MM`; invalid params render a designed "Review not found" state with a link back. Navigation ‹ › moves to previous/next period; next is disabled when it would start after the logical today.
- Verification: `npx tsc --noEmit`, `npx jest`, iOS + Android `expo export`.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_014qGP2qavm772yGiGc1rSw8`.

### Task 1: Review screen and review-builder carry-overs

**Files:** `app/review/[period].tsx`, `src/features/reviews/{periodParam.ts,ReviewScreen.tsx,ReviewCards.tsx}`, `src/domain/reviewBuilder.ts` (+ tests), `src/strings/en.ts`, tests, `PROGRESS.md`.

- [ ] `periodParam.ts`: `parsePeriodParam(s) → Period | null`, `formatPeriodParam(p, weekStart)`, header label (`Week 40`, `October 2026`) with tests incl. year boundary (week of Dec 29 2025).
- [ ] Review builder carry-overs (Phase 3 final review): always produce at least 2 insights when the period has any scored day (add a deterministic filler rule, e.g. "most consistent goal" / "total done days"); `timeBucket` uses the logged time shifted by `dayEndsAt` consistently with the logical day; keep timesPerWeek vacation counts in days only in the totals (do not mix units); add tests for vacation-adjusted timesPerWeek, streak gained insight, slot partial ratio.
- [ ] Screen per design §4.8: header with ‹ › navigation; large completion % (AnimatedNumber) with change chip vs previous period (arrow-up/arrow-down icon + "+12 pts"/"−5 pts", "No previous data" when null); per-goal bars (staggered); best and worst goals; streaks gained and lost; best weekday and best time slot; totals done/skipped/vacation; 2–3 insight cards. Empty state when no goals.
- [ ] Integration test with `seedDemoData` on `createTestDb()`: the week and month reviews for the seed's today render percent, ≥ 2 insights, and navigation to previous period changes the header.
- [ ] Stats tab review cards now land on this screen (check links match the param format).
- [ ] PROGRESS.md Phase 7 section with real output; device-pending: counter animation.
- [ ] Commit "Add weekly and monthly review screen".
