import { screen } from '@testing-library/react-native';
import { strings } from '../../../strings/en';
import { renderWithTheme } from '../../../test/renderWithTheme';
import { RestoreList } from '../RestoreList';

const mockList = jest.fn();
jest.mock('../../../services/backup/autoBackup', () => ({ listAutoBackups: (...a: unknown[]) => mockList(...a) }));
jest.mock('../../../services/backup/files', () => ({ expoBackupFs: {} }));

const t = strings.backupScreen;

it('shows an empty state when there are no auto-backups', async () => {
  mockList.mockResolvedValue([]);
  await renderWithTheme(<RestoreList onPick={jest.fn()} />);
  expect(await screen.findByText(t.restoreEmpty)).toBeTruthy();
});

it('shows an empty state when listing fails', async () => {
  mockList.mockRejectedValue(new Error('fs'));
  await renderWithTheme(<RestoreList onPick={jest.fn()} />);
  expect(await screen.findByText(t.restoreEmpty)).toBeTruthy();
});
