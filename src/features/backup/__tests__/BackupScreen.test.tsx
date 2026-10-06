import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DEFAULT_SETTINGS } from '../../../domain/settings';
import { strings } from '../../../strings/en';
import { ThemeProvider } from '../../../ui/ThemeProvider';
import { useSettings } from '../../settings/settingsStore';
import { BackupScreen } from '../BackupScreen';
import { RestoreList } from '../RestoreList';

const mockExport = jest.fn(async (_k: string[]) => ['x']);
const mockList = jest.fn(async () => [
  { name: 'trek-backup-20261003-090000.json', size: 4096 },
  { name: 'trek-preimport-20261002-100000.json', size: 2048 },
]);

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('../../../services/backup/backupFlow', () => ({ previewImport: jest.fn() }));
jest.mock('../../../services/backup/files', () => ({
  exportKinds: (k: string[]) => mockExport(k),
  pickImportFile: jest.fn(async () => null),
  readAutoBackup: jest.fn(),
  applyValidatedImport: jest.fn(),
  chooseBackupFolder: jest.fn(),
  safFolderAccessible: jest.fn(async () => true),
  expoBackupFs: { listLocal: () => mockList() },
}));

const t = strings.backupScreen;
const wrap = (n: React.ReactNode) => <ThemeProvider mode="light">{n}</ThemeProvider>;

beforeEach(() => {
  jest.clearAllMocks();
  useSettings.setState({ settings: DEFAULT_SETTINGS });
});

it('format buttons call export', async () => {
  await render(wrap(<BackupScreen />));
  await fireEvent.press(screen.getByLabelText(t.exportXlsx));
  await waitFor(() => expect(mockExport).toHaveBeenCalledWith(['xlsx']));
  await fireEvent.press(screen.getByLabelText(t.exportJson));
  await waitFor(() => expect(mockExport).toHaveBeenCalledWith(['json']));
  await fireEvent.press(screen.getByLabelText(t.exportCsv));
  await waitFor(() => expect(mockExport).toHaveBeenCalledWith(['csv']));
});

it('auto-backup toggle updates settings', async () => {
  await render(wrap(<BackupScreen />));
  await fireEvent(screen.getByLabelText(t.autoLabel), 'valueChange', false);
  expect(useSettings.getState().settings.autoBackupEnabled).toBe(false);
});

it('restore list shows date and size, labels safety backups, and picks', async () => {
  const onPick = jest.fn();
  await render(wrap(<RestoreList onPick={onPick} />));
  expect(await screen.findByText(t.restoreItem('3 Oct 2026, 09:00', '4'))).toBeTruthy();
  expect(screen.getByText(t.restoreItem(t.preImportPrefix('2 Oct 2026, 10:00'), '2'))).toBeTruthy();
  await fireEvent.press(screen.getByLabelText(t.restoreItemLabel('3 Oct 2026, 09:00')));
  expect(onPick).toHaveBeenCalledWith('trek-backup-20261003-090000.json');
});
