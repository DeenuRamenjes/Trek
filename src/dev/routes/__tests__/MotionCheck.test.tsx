import { fireEvent, screen } from '@testing-library/react-native';
import { useSettings } from '../../../features/settings/settingsStore';
import { strings } from '../../../strings/en';
import { renderWithTheme } from '../../../test/renderWithTheme';
import { MotionCheck } from '../MotionCheck';

const m = strings.motionCheck;

beforeEach(() => {
  useSettings.getState().reset();
});

describe('MotionCheck', () => {
  it('labels every primitive and control', async () => {
    await renderWithTheme(<MotionCheck />);
    expect(screen.getByText(m.title)).toBeTruthy();
    expect(screen.getByRole('button', { name: m.replay })).toBeTruthy();
    expect(screen.getByText(m.fade)).toBeTruthy();
    expect(screen.getByText(m.slide)).toBeTruthy();
    expect(screen.getByText(m.scale)).toBeTruthy();
    for (let n = 1; n <= 5; n += 1) expect(screen.getByText(m.staggerItem(n))).toBeTruthy();
    expect(screen.getByRole('button', { name: m.press })).toBeTruthy();
    expect(screen.getByRole('button', { name: m.changeNumber })).toBeTruthy();
    expect(screen.getByText(m.skeleton)).toBeTruthy();
    expect(screen.getByRole('button', { name: m.toggleCollapse })).toBeTruthy();
    expect(screen.getByRole('button', { name: m.toggleCheck })).toBeTruthy();
    expect(screen.getByText(m.mark)).toBeTruthy();
  });

  it('shows the reduce motion status line when off', async () => {
    useSettings.getState().update({ reduceMotionOverride: 'off' });
    await renderWithTheme(<MotionCheck />);
    expect(screen.getByText(m.reduceMotionOff)).toBeTruthy();
  });

  it('renders every demo under reduce motion', async () => {
    useSettings.getState().update({ reduceMotionOverride: 'on' });
    await renderWithTheme(<MotionCheck />);
    expect(screen.getByText(m.reduceMotionOn)).toBeTruthy();
    expect(screen.getByText(m.fade)).toBeTruthy();
    expect(screen.getByText(m.staggerItem(5))).toBeTruthy();
  });

  it('toggles the collapse content', async () => {
    useSettings.getState().update({ reduceMotionOverride: 'on' });
    await renderWithTheme(<MotionCheck />);
    expect(screen.queryByText(m.details)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: m.toggleCollapse }));
    expect(screen.getByText(m.details)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: m.toggleCollapse }));
    expect(screen.queryByText(m.details)).toBeNull();
  });

  it('toggles the number between 0 and 100', async () => {
    useSettings.getState().update({ reduceMotionOverride: 'on' });
    await renderWithTheme(<MotionCheck />);
    expect(screen.getByText('0')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: m.changeNumber }));
    expect(screen.getByText('100')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: m.changeNumber }));
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('toggles the checkmark', async () => {
    useSettings.getState().update({ reduceMotionOverride: 'on' });
    await renderWithTheme(<MotionCheck />);
    await fireEvent.press(screen.getByRole('button', { name: m.toggleCheck }));
    expect(screen.getByRole('button', { name: m.toggleCheck })).toBeTruthy();
  });

  it('replay remounts every demo and resets the toggles', async () => {
    useSettings.getState().update({ reduceMotionOverride: 'on' });
    await renderWithTheme(<MotionCheck />);
    await fireEvent.press(screen.getByRole('button', { name: m.toggleCollapse }));
    await fireEvent.press(screen.getByRole('button', { name: m.changeNumber }));
    expect(screen.getByText(m.details)).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: m.replay }));
    expect(screen.queryByText(m.details)).toBeNull();
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText(m.staggerItem(5))).toBeTruthy();
  });
});
