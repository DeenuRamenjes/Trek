import { StyleSheet } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { strings } from '../../../strings/en';
import { renderWithTheme } from '../../../test/renderWithTheme';
import { DesignPreviewIndex } from '../DesignPreviewIndex';
import { DesignPreviewScreen } from '../DesignPreviewScreen';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: () => mockBack() },
  Redirect: ({ href }: { href: string }) => {
    const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
    return <MockText>{`redirect:${href}`}</MockText>;
  },
}));

const p = strings.designPreview;

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
});

describe('DesignPreviewIndex', () => {
  it('lists all eight screens', async () => {
    await renderWithTheme(<DesignPreviewIndex />);
    for (const name of Object.values(p.screens)) {
      expect(screen.getByRole('button', { name: p.openScreen(name) })).toBeTruthy();
    }
  });

  it('pushes the chosen screen with the chosen mode', async () => {
    await renderWithTheme(<DesignPreviewIndex />);
    await fireEvent.press(screen.getByRole('button', { name: p.dark }));
    await fireEvent.press(screen.getByRole('button', { name: p.openScreen(p.screens.lock) }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/design-preview/[screen]', params: { screen: 'lock', mode: 'dark' } });
  });
});

describe('DesignPreviewScreen', () => {
  it('renders the requested screen', async () => {
    await renderWithTheme(<DesignPreviewScreen screen="lock" mode="dark" />);
    expect(screen.getByText(strings.lock.title)).toBeTruthy();
  });

  it('goes back from the back button', async () => {
    await renderWithTheme(<DesignPreviewScreen screen="lock" mode="light" />);
    await fireEvent.press(screen.getByRole('button', { name: strings.navigation.back }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('pads the back row by the top safe-area inset', async () => {
    await renderWithTheme(<DesignPreviewScreen screen="lock" mode="light" />);
    const row = screen.getByRole('button', { name: strings.navigation.back }).parent;
    expect(StyleSheet.flatten(row?.props.style).paddingTop).toBe(47);
  });

  it('redirects unknown keys to the list', async () => {
    await renderWithTheme(<DesignPreviewScreen screen="nope" mode={undefined} />);
    expect(screen.getByText('redirect:/design-preview')).toBeTruthy();
    expect(screen.queryByText(strings.lock.title)).toBeNull();
  });
});
