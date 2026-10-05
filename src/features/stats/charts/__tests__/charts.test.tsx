import { screen } from '@testing-library/react-native';
import { strings } from '../../../../strings/en';
import { renderWithTheme } from '../../../../test/renderWithTheme';
import { useSettings } from '../../../settings/settingsStore';
import type { StatsModel } from '../../statsModel';
import { BestWeekday, CompletionRing, Heatmap, PerGoalBars, StreakCard, TrendLine, WeeklyBars } from '..';

const t = strings.stats;

const model: StatsModel = {
  range: { from: '2026-09-01', to: '2026-09-07' },
  completion: { percent: 72.4, done: 5, partial: 1, skipped: 1, vacation: 0, missed: 2 },
  currentStreak: 4,
  bestStreak: 9,
  heatmap: [
    { date: '2026-09-01', ratio: 1 },
    { date: '2026-09-02', ratio: 0 },
    { date: '2026-09-03', ratio: null },
    { date: '2026-09-04', ratio: 0.5 },
  ],
  weekly: [
    { weekStart: '2026-08-31', percent: 60 },
    { weekStart: '2026-09-07', percent: 80 },
  ],
  trend: [
    { date: '2026-09-01', percent: 50 },
    { date: '2026-09-02', percent: 70 },
  ],
  perGoal: [{ goalId: 'a', name: 'Reading', color: '#2E7D5B', percent: 90 }],
  bestWeekday: 2,
};

describe('stats charts', () => {
  beforeEach(() => useSettings.getState().reset());

  it('each card exposes its summary label', async () => {
    await renderWithTheme(
      <>
        <CompletionRing model={model} />
        <StreakCard model={model} />
        <Heatmap model={model} />
        <WeeklyBars model={model} />
        <TrendLine model={model} />
        <PerGoalBars model={model} />
        <BestWeekday model={model} />
      </>,
    );
    const c = model.completion;
    expect(screen.getByLabelText(`${t.completionSummary(72)}. ${t.countsSummary(c.done, c.partial, c.skipped, c.vacation, c.missed)}`)).toBeTruthy();
    expect(screen.getByLabelText(`${t.currentStreak}: ${t.days(4)}. ${t.bestStreak}: ${t.days(9)}`)).toBeTruthy();
    expect(screen.getByLabelText(`${t.heatmap}. ${t.heatmapSummary(4, 3, 1, 1)}`)).toBeTruthy();
    expect(screen.getByLabelText(`${t.weeklyBars}. ${t.weeklySummary(2, 80, 70)}`)).toBeTruthy();
    expect(screen.getByLabelText(`${t.trend}. ${t.trendSummary(50, 70)}`)).toBeTruthy();
    expect(screen.getByLabelText(`${t.perGoal}. ${t.perGoalItem('Reading', 90)}`)).toBeTruthy();
    expect(screen.getByLabelText(`${t.bestWeekday}: ${strings.insights.weekdays[2]}`)).toBeTruthy();
  });

  it('reduce motion shows final values immediately', async () => {
    useSettings.getState().update({ reduceMotionOverride: 'on' });
    await renderWithTheme(
      <>
        <CompletionRing model={model} />
        <StreakCard model={model} />
      </>,
    );
    expect(screen.getByText('72%')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
  });

  it('empty model shows no-data text', async () => {
    const empty: StatsModel = { ...model, weekly: [], trend: [], perGoal: [], bestWeekday: null, heatmap: [] };
    await renderWithTheme(
      <>
        <WeeklyBars model={empty} />
        <BestWeekday model={empty} />
      </>,
    );
    expect(screen.getAllByText(t.noChartData).length).toBe(2);
  });
});
