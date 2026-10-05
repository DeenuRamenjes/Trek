import { screen } from '@testing-library/react-native';
import { strings } from '../../../strings/en';
import { expectAllButtonsLabelled } from '../../../test/a11y';
import { renderWithTheme } from '../../../test/renderWithTheme';
import { isPreviewKey, previewKeys, previewScreens } from '../registry';

const EMOJI = /\p{Extended_Pictographic}/u;

describe('design preview registry', () => {
  it('covers the eight key screens', () => {
    expect(previewKeys).toEqual(['splash', 'today', 'stats', 'createGoal', 'history', 'review', 'settings', 'lock']);
  });

  it('validates keys', () => {
    expect(isPreviewKey('today')).toBe(true);
    expect(isPreviewKey('nope')).toBe(false);
    expect(isPreviewKey(undefined)).toBe(false);
  });
});

describe.each(previewKeys)('%s preview', (key) => {
  const Component = previewScreens[key];

  it.each(['light', 'dark'] as const)('renders in %s mode with every button labelled and no emoji', async (mode) => {
    await renderWithTheme(<Component />, mode);
    expectAllButtonsLabelled();
    const text = screen.queryAllByText(/.+/).map((node) => String(node.props.children));
    for (const t of text) expect(t).not.toMatch(EMOJI);
  });
});

describe('preview content', () => {
  it('Today shows both banners and the sections', async () => {
    await renderWithTheme(<previewScreens.today />);
    expect(screen.getByText(strings.today.vacationBanner)).toBeTruthy();
    expect(screen.getByText(strings.today.backupBanner(9))).toBeTruthy();
    expect(screen.getByRole('button', { name: strings.today.endVacation })).toBeTruthy();
    expect(screen.getByText(strings.today.pendingSection)).toBeTruthy();
    expect(screen.getByText(strings.today.doneSection)).toBeTruthy();
  });

  it('Create goal shows the schedule note and save button', async () => {
    await renderWithTheme(<previewScreens.createGoal />);
    expect(screen.getByText(strings.goalForm.scheduleNote)).toBeTruthy();
    expect(screen.getByRole('button', { name: strings.goalForm.save })).toBeTruthy();
  });

  it('Stats shows every chart section', async () => {
    await renderWithTheme(<previewScreens.stats />);
    for (const title of [strings.stats.heatmap, strings.stats.weeklyBars, strings.stats.trend, strings.stats.perGoal, strings.stats.bestWeekday]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it('Lock shows the unlock button', async () => {
    await renderWithTheme(<previewScreens.lock />);
    expect(screen.getByRole('button', { name: strings.lock.unlock })).toBeTruthy();
  });
});
