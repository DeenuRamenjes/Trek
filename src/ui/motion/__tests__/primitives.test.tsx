import { act, fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { useSettings } from '../../../features/settings/settingsStore';
import { renderWithTheme, withTheme } from '../../../test/renderWithTheme';
import {
  AnimatedCheck,
  AnimatedNumber,
  Collapse,
  easeOutCubic,
  FadeIn,
  PressableScale,
  ScaleIn,
  Skeleton,
  SlideUp,
  Stagger,
} from '..';

type Style = { opacity?: number; transform?: Record<string, number>[] };

function styleOf(testID: string): Style {
  return getAnimatedStyle(screen.getByTestId(testID, { includeHiddenElements: true })) as unknown as Style;
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

function reduceMotion() {
  useSettings.getState().update({ reduceMotionOverride: 'on' });
}

beforeEach(() => {
  jest.useFakeTimers();
  useSettings.getState().reset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe.each([
  ['FadeIn', FadeIn],
  ['SlideUp', SlideUp],
  ['ScaleIn', ScaleIn],
] as const)('%s', (_name, Preset) => {
  it('starts hidden and ends visible', async () => {
    await renderWithTheme(<Preset testID="p" />);
    expect(styleOf('p').opacity).toBe(0);
    await advance(1000);
    expect(styleOf('p').opacity).toBeCloseTo(1, 2);
  });

  it('is visible at once under reduce motion', async () => {
    reduceMotion();
    await renderWithTheme(<Preset testID="p" />);
    expect(styleOf('p').opacity).toBe(1);
  });
});

describe('Stagger', () => {
  it('delays each child by 40 ms', async () => {
    await renderWithTheme(
      <Stagger>
        <Text testID="a">A</Text>
        <Text testID="b">B</Text>
      </Stagger>,
    );
    await advance(260);
    const first = getAnimatedStyle(screen.getByTestId('a').parent!) as unknown as Style;
    const second = getAnimatedStyle(screen.getByTestId('b').parent!) as unknown as Style;
    expect(first.opacity).toBe(1);
    expect(second.opacity).toBeLessThan(1);
    await advance(100);
    expect((getAnimatedStyle(screen.getByTestId('b').parent!) as unknown as Style).opacity).toBe(1);
  });

  it('shows every child at once under reduce motion', async () => {
    reduceMotion();
    await renderWithTheme(
      <Stagger>
        <Text testID="a">A</Text>
        <Text testID="b">B</Text>
      </Stagger>,
    );
    expect((getAnimatedStyle(screen.getByTestId('b').parent!) as unknown as Style).opacity).toBe(1);
  });
});

describe('PressableScale', () => {
  it('is a labelled button that shrinks while pressed', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <PressableScale accessibilityLabel="Open" onPress={onPress} testID="press">
        <Text testID="content">Open</Text>
      </PressableScale>,
    );
    const button = screen.getByRole('button', { name: 'Open' });
    await fireEvent(button, 'pressIn');
    await advance(500);
    const scale = (getAnimatedStyle(screen.getByTestId('content').parent!) as unknown as Style).transform![0].scale;
    expect(scale).toBeCloseTo(0.97, 2);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not scale under reduce motion', async () => {
    reduceMotion();
    await renderWithTheme(
      <PressableScale accessibilityLabel="Open">
        <Text testID="content">Open</Text>
      </PressableScale>,
    );
    await fireEvent(screen.getByRole('button', { name: 'Open' }), 'pressIn');
    await advance(500);
    expect((getAnimatedStyle(screen.getByTestId('content').parent!) as unknown as Style).transform![0].scale).toBe(1);
  });
});

describe('AnimatedNumber', () => {
  it('eases out', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 5);
    expect(easeOutCubic(2)).toBe(1);
  });

  it('counts up to the new value over 400 ms', async () => {
    const view = await renderWithTheme(<AnimatedNumber value={0} />);
    await view.rerender(withTheme(<AnimatedNumber value={100} />));
    expect(screen.queryByText('100')).toBeNull();
    await advance(450);
    expect(screen.getByText('100')).toBeTruthy();
  });

  it('shows the new value at once under reduce motion', async () => {
    reduceMotion();
    const view = await renderWithTheme(<AnimatedNumber value={0} />);
    await view.rerender(withTheme(<AnimatedNumber value={100} />));
    expect(screen.getByText('100')).toBeTruthy();
  });
});

describe('Skeleton', () => {
  it('pulses', async () => {
    await renderWithTheme(<Skeleton height={20} testID="s" />);
    await advance(800);
    expect(styleOf('s').opacity).toBeLessThan(1);
  });

  it('stays solid under reduce motion', async () => {
    reduceMotion();
    await renderWithTheme(<Skeleton height={20} testID="s" />);
    await advance(800);
    expect(styleOf('s').opacity).toBe(1);
  });
});

describe('Collapse', () => {
  it('renders children only when open', async () => {
    const view = await renderWithTheme(
      <Collapse open={false}>
        <Text>Details</Text>
      </Collapse>,
    );
    expect(screen.queryByText('Details')).toBeNull();
    await view.rerender(
      withTheme(
        <Collapse open>
          <Text>Details</Text>
        </Collapse>,
      ),
    );
    expect(screen.getByText('Details')).toBeTruthy();
  });

  type Props = { layout?: unknown; entering?: unknown; exiting?: unknown };
  function animatedProps(): Props[] {
    const out: Props[] = [];
    const walk = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (node === null || typeof node !== 'object') return;
      const { props, children } = node as { props?: Props; children?: unknown };
      if (props && ('layout' in props || 'entering' in props || 'exiting' in props)) out.push(props);
      walk(children);
    };
    walk(screen.toJSON());
    return out;
  }

  it('passes layout, entering and exiting animations in full motion', async () => {
    await renderWithTheme(
      <Collapse open>
        <Text>Details</Text>
      </Collapse>,
    );
    const props = animatedProps();
    expect(props.some((p) => p.layout !== undefined)).toBe(true);
    expect(props.some((p) => p.entering !== undefined)).toBe(true);
    expect(props.some((p) => p.exiting !== undefined)).toBe(true);
  });

  it('passes no layout, entering or exiting animation under reduce motion', async () => {
    reduceMotion();
    await renderWithTheme(
      <Collapse open>
        <Text>Details</Text>
      </Collapse>,
    );
    for (const p of animatedProps()) {
      expect(p.layout).toBeUndefined();
      expect(p.entering).toBeUndefined();
      expect(p.exiting).toBeUndefined();
    }
  });
});

describe('AnimatedCheck', () => {
  it('renders a decorative canvas of the requested size', async () => {
    await renderWithTheme(<AnimatedCheck checked color="#2E7D5B" size={32} testID="check" />);
    const canvas = screen.getByTestId('check');
    expect(canvas.props.accessible).toBe(false);
    expect(canvas.props.style).toEqual({ width: 32, height: 32 });
  });
});
