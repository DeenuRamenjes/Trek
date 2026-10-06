import { fireEvent, screen } from '@testing-library/react-native';
import { DEFAULT_SETTINGS } from '../../../domain/settings';
import { strings } from '../../../strings/en';
import { renderWithTheme } from '../../../test/renderWithTheme';
import { useSettings } from '../../settings/settingsStore';
import { WidgetSettingsScreen } from '../WidgetSettingsScreen';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('../../../services/widgetBridge', () => ({ refreshWidgets: jest.fn(async () => undefined) }));
const mockItems = jest.fn();
jest.mock('../useWidgetPreview', () => ({
  useWidgetPreview: () => ({
    groups: [{ id: 'g1', name: 'Morning' }],
    snapshot: { date: '2026-10-05', done: 1, total: 2, items: mockItems() },
  }),
}));

const t = strings.widgetSettings;
beforeEach(() => {
  useSettings.setState({ settings: { ...DEFAULT_SETTINGS } });
  mockItems.mockReturnValue([{ goalId: 'a', name: 'Alpha', status: 'done', progress: 1 }]);
});

it('preview shows an empty state when nothing is due', async () => {
  mockItems.mockReturnValue([]);
  await renderWithTheme(<WidgetSettingsScreen />);
  expect(screen.getByText(t.empty)).toBeTruthy();
});

it('group picker updates widget.groupId', async () => {
  await renderWithTheme(<WidgetSettingsScreen />);
  await fireEvent.press(screen.getByLabelText(`${strings.stats.chooseGroup}: ${strings.stats.allGoals}`));
  await fireEvent.press(screen.getByLabelText('Morning'));
  expect(useSettings.getState().settings.widget.groupId).toBe('g1');
  await fireEvent.press(screen.getByLabelText(`${strings.stats.chooseGroup}: Morning`));
  await fireEvent.press(screen.getByLabelText(strings.stats.allGoals));
  expect(useSettings.getState().settings.widget.groupId).toBeUndefined();
});

it('hide names toggle updates settings and preview hides names', async () => {
  await renderWithTheme(<WidgetSettingsScreen />);
  expect(screen.getByText('Alpha')).toBeTruthy();
  await fireEvent(screen.getByLabelText(t.hideNamesLabel), 'valueChange', true);
  expect(useSettings.getState().settings.widget.hideGoalNames).toBe(true);
  expect(screen.queryByText('Alpha')).toBeNull();
  expect(screen.getByText('1/2')).toBeTruthy();
});
