import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ValidatedImport } from '../../../services/backup/importValidate';
import { TABLE_SPECS, type TableKey } from '../../../services/backup/snapshot';
import { strings } from '../../../strings/en';
import { ThemeProvider } from '../../../ui/ThemeProvider';
import { ImportPreview } from '../ImportPreview';

const t = strings.backupScreen;

function validated(errors: ValidatedImport['errors']): ValidatedImport {
  const counts = Object.fromEntries(TABLE_SPECS.map((s) => [s.key, { total: 3, valid: 2 }])) as Record<TableKey, { total: number; valid: number }>;
  return { meta: { format: 'trek-json', schemaVersion: 1, appVersion: '1', exportedAt: '' }, tables: {} as never, settings: {} as never, errors, counts };
}

const wrap = (n: React.ReactNode) => <ThemeProvider mode="light">{n}</ThemeProvider>;

it('shows counts and errors, and disables Import until skipping is confirmed', async () => {
  const onConfirm = jest.fn();
  await render(wrap(<ImportPreview validated={validated([{ sheet: 'Logs', row: 7, message: 'bad date' }])} onConfirm={onConfirm} onCancel={jest.fn()} />));
  expect(screen.getByText(t.previewCount('Goals', 2, 3))).toBeTruthy();
  expect(screen.getByText(t.previewError('Logs', 7, 'bad date'))).toBeTruthy();

  await fireEvent.press(screen.getByLabelText(t.runImport));
  expect(onConfirm).not.toHaveBeenCalled();

  await fireEvent(screen.getByLabelText(t.skipInvalidLabel), 'valueChange', true);
  await fireEvent.press(screen.getByLabelText(t.runImport));
  expect(onConfirm).toHaveBeenCalledWith('merge', true);
});

it('imports directly when there are no errors', async () => {
  const onConfirm = jest.fn();
  await render(wrap(<ImportPreview validated={validated([])} onConfirm={onConfirm} onCancel={jest.fn()} />));
  await fireEvent.press(screen.getByLabelText(strings.backupScreen.replace));
  await fireEvent.press(screen.getByLabelText(t.runImport));
  expect(onConfirm).toHaveBeenCalledWith('replace', false);
});
