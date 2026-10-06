import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ErrorBoundary } from '../ErrorBoundary';
import { ThemeProvider } from '../ThemeProvider';
import { strings } from '../../strings/en';

const mockLog = jest.fn(async () => undefined);
jest.mock('../../services/errorLog', () => ({ logError: (...a: unknown[]) => mockLog(...(a as [])) }));

function Boom(): never {
  throw new Error('render failed');
}

it('renders the fallback and logs the error', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await render(
    <ThemeProvider>
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    </ThemeProvider>,
  );
  expect(screen.getByText(strings.errorLog.boundaryTitle)).toBeTruthy();
  expect(screen.getByLabelText(strings.errorLog.retry)).toBeTruthy();
  expect(mockLog).toHaveBeenCalledWith('react.boundary', expect.objectContaining({ message: 'render failed' }));
  spy.mockRestore();
});

it('renders children when nothing fails', async () => {
  await render(
    <ThemeProvider>
      <ErrorBoundary>
        <Text>ok</Text>
      </ErrorBoundary>
    </ThemeProvider>,
  );
  expect(screen.getByText('ok')).toBeTruthy();
});
