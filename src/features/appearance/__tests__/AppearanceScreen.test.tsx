import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DEFAULT_SETTINGS } from '../../../domain/settings';
import { strings } from '../../../strings/en';
import { expectAllPressablesLabelled } from '../../../test/a11y';
import { ThemeProvider } from '../../../ui/ThemeProvider';
import { useSettings } from '../../settings/settingsStore';
import { AppearanceScreen } from '../AppearanceScreen';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));

const s = strings.settings;
const a = s.appearanceScreen;
const get = () => useSettings.getState().settings;

beforeEach(() => {
  useSettings.setState({ settings: DEFAULT_SETTINGS });
});

async function open() {
  await render(
    <ThemeProvider mode="light">
      <AppearanceScreen />
    </ThemeProvider>,
  );
}

it('every pressable has a role and a name', async () => {
  await open();
  expect(expectAllPressablesLabelled()).toBeGreaterThan(8);
});

it('theme control updates store', async () => {
  await open();
  await fireEvent.press(screen.getByLabelText(a.themeOptions.dark));
  expect(get().theme).toBe('dark');
});

it('accent palette swatch updates store', async () => {
  await open();
  await fireEvent.press(screen.getByLabelText(strings.goalForm.chooseColor(2)));
  expect(get().accentColor).toBe('#2F6FB0');
});

it('week start chips store 0/1/6', async () => {
  await open();
  await fireEvent.press(screen.getByLabelText(a.weekStartOptions.sunday));
  expect(get().weekStart).toBe(0);
  await fireEvent.press(screen.getByLabelText(a.weekStartOptions.saturday));
  expect(get().weekStart).toBe(6);
  await fireEvent.press(screen.getByLabelText(a.weekStartOptions.monday));
  expect(get().weekStart).toBe(1);
});

it('time format updates store and relabels day-end chips', async () => {
  await open();
  await fireEvent.press(screen.getByLabelText(a.timeFormatOptions.h12));
  expect(get().timeFormat).toBe('12h');
  expect(screen.getByText('3:00 AM')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText(a.timeFormatOptions.h24));
  expect(screen.getByText('03:00')).toBeTruthy();
});

it('day ends at updates store', async () => {
  await open();
  await fireEvent.press(screen.getByLabelText(a.dayEndsOption('03:00')));
  expect(get().dayEndsAt).toBe(3);
});

it('haptics switch updates store', async () => {
  await open();
  await fireEvent(screen.getByLabelText(a.hapticsLabel), 'valueChange', false);
  expect(get().haptics).toBe(false);
});

it('reduce motion override updates store', async () => {
  await open();
  await fireEvent.press(screen.getByLabelText(a.reduceMotionOptions.on));
  expect(get().reduceMotionOverride).toBe('on');
  await fireEvent.press(screen.getByLabelText(a.reduceMotionOptions.off));
  expect(get().reduceMotionOverride).toBe('off');
});
