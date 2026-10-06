import { fireEvent, screen } from '@testing-library/react-native';
import { DbProvider } from '../../../db/DbProvider';
import type { TrekDb } from '../../../db/client';
import { seedDemoData } from '../../../db/seed';
import { logicalToday } from '../../../domain/dayBoundary';
import { previousPeriod } from '../../../domain/reviewBuilder';
import { strings } from '../../../strings/en';
import { expectAllPressablesLabelled } from '../../../test/a11y';
import { renderWithTheme } from '../../../test/renderWithTheme';
import { createTestDb } from '../../../test/testDb';
import { useSettings } from '../../settings/settingsStore';
import { formatPeriodParam, parsePeriodParam, periodLabel } from '../periodParam';
import { ReviewScreen } from '../ReviewScreen';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockSetParams = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace, setParams: mockSetParams }) }));

const r = strings.review;
const today = logicalToday(new Date(), 0);
let seeded: TrekDb;

beforeAll(async () => {
  seeded = createTestDb().db as unknown as TrekDb;
  await seedDemoData(seeded, { today });
}, 60000);

beforeEach(() => {
  useSettings.getState().reset();
  useSettings.getState().update({ reduceMotionOverride: 'on' });
  mockBack.mockClear();
  mockPush.mockClear();
  mockReplace.mockClear();
  mockSetParams.mockClear();
});

async function show(db: TrekDb, param: string | undefined) {
  await renderWithTheme(
    <DbProvider db={db}>
      <ReviewScreen param={param} />
    </DbProvider>,
  );
}

describe.each(['week', 'month'] as const)('ReviewScreen %s (seed data)', (kind) => {
  const weekStart = useSettings.getState().settings.weekStart;
  const period = parsePeriodParam(formatPeriodParam({ kind, anchor: today }, weekStart))!;

  it('renders percent, insights and previous-period navigation', async () => {
    await show(seeded, formatPeriodParam(period, weekStart));
    await screen.findByLabelText(/^Overall completion \d+ percent$/, undefined, { timeout: 10000 });
    expect(screen.getAllByTestId('review-insight').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(periodLabel(period, weekStart))).toBeTruthy();
    expect(screen.getByText(r.perGoal)).toBeTruthy();
    // Current period has no later period: next is disabled.
    expect(screen.getByLabelText(r.nextPeriod).props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByLabelText(r.previousPeriod));
    const prevPeriod = previousPeriod(period, weekStart);
    const prevLabel = periodLabel(prevPeriod, weekStart);
    expect(prevLabel).not.toBe(periodLabel(period, weekStart));
    await screen.findByText(prevLabel);
    expect(screen.getByLabelText(r.nextPeriod).props.accessibilityState.disabled).toBe(false);
    await screen.findByLabelText(/^Overall completion \d+ percent$/);
    // URL param updated to match viewed period
    expect(mockSetParams).toHaveBeenCalledWith({ period: formatPeriodParam(prevPeriod, weekStart) });
  }, 30000);
});

describe('ReviewScreen states', () => {
  it('every pressable has a role and a name on a seeded review', async () => {
    await show(seeded, `week-${today}`);
    await screen.findByLabelText(/^Overall completion \d+ percent$/, undefined, { timeout: 10000 });
    expect(expectAllPressablesLabelled()).toBeGreaterThan(1);
  }, 30000);

  it('invalid param shows the not-found state with a way back', async () => {
    await show(createTestDb().db as unknown as TrekDb, 'week-nope');
    await screen.findByText(r.notFoundTitle);
    await fireEvent.press(screen.getByLabelText(r.backToStats));
    expect(mockReplace).toHaveBeenCalledWith('/stats');
  });

  it('no goals shows the empty state', async () => {
    await show(createTestDb().db as unknown as TrekDb, `week-${today}`);
    await screen.findByText(r.emptyTitle);
    await fireEvent.press(screen.getByLabelText(r.createGoal));
    expect(mockPush).toHaveBeenCalledWith('/goal/new');
  });
});
