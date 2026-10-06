import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';
import { takeSafRevokedNotice } from '../../services/backup/autoBackup';
import type { ExportFormat } from '../../services/backup/backupFlow';
import { previewImport } from '../../services/backup/backupFlow';
import {
  applyValidatedImport,
  chooseBackupFolder,
  exportKinds,
  pickImportFile,
  readAutoBackup,
  safFolderAccessible,
} from '../../services/backup/files';
import type { ImportMode } from '../../services/backup/importApply';
import type { ValidatedImport } from '../../services/backup/importValidate';
import { strings } from '../../strings/en';
import { AppText, Button, Card, IconButton, Screen, SegmentedControl } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { useTheme } from '../../ui/ThemeProvider';
import { minTapTarget, spacing } from '../../ui/tokens';
import { useSettings } from '../settings/settingsStore';
import { ImportPreview } from './ImportPreview';
import { RestoreList } from './RestoreList';

const t = strings.backupScreen;

type Notice = { kind: 'info' | 'error'; text: string } | null;

export function BackupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const [notice, setNotice] = useState<Notice>(null);
  const [preview, setPreview] = useState<ValidatedImport | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoreKey, setRestoreKey] = useState(0);
  const folder = settings.androidBackupFolderUri;

  // A revoked SAF grant is cleared by the daily backup or detected here.
  useEffect(() => {
    let alive = true;
    void (async () => {
      let revoked = takeSafRevokedNotice();
      if (!revoked && folder && !(await safFolderAccessible(folder))) {
        update({ androidBackupFolderUri: undefined });
        revoked = true;
      }
      if (alive && revoked) setNotice({ kind: 'error', text: t.folderRevoked });
    })();
    return () => {
      alive = false;
    };
  }, [folder, update]);

  async function doExport(kind: ExportFormat) {
    setBusy(true);
    try {
      await exportKinds([kind]);
      setRestoreKey((k) => k + 1);
      setNotice({ kind: 'info', text: t.exportDone });
    } catch {
      setNotice({ kind: 'error', text: t.exportFailed });
    } finally {
      setBusy(false);
    }
  }

  async function openPreview(load: () => Promise<Uint8Array | string | null>) {
    if (busy) return;
    setNotice(null);
    try {
      const input = await load();
      if (input === null) return;
      setPreview(await previewImport(input));
    } catch (e) {
      setNotice({ kind: 'error', text: t.importUnreadable(e instanceof Error ? e.message : '') });
    }
  }

  async function confirmImport(mode: ImportMode, skip: boolean) {
    if (!preview) return;
    setBusy(true);
    try {
      await applyValidatedImport(preview, mode, skip);
      setPreview(null);
      setRestoreKey((k) => k + 1);
      setNotice({ kind: 'info', text: t.importDone });
    } catch {
      setNotice({ kind: 'error', text: t.importFailed });
    } finally {
      setBusy(false);
    }
  }

  async function pickFolder() {
    const uri = await chooseBackupFolder();
    if (uri) {
      update({ androidBackupFolderUri: uri });
      setNotice({ kind: 'info', text: t.folderSet });
    }
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon={uiIcons.back} accessibilityLabel={strings.navigation.back} onPress={() => router.back()} />
        <AppText variant="title" accessibilityRole="header" style={styles.flex}>
          {t.title}
        </AppText>
      </View>

      {notice ? (
        <AppText accessibilityRole="alert" tone={notice.kind === 'error' ? 'primary' : 'secondary'}>
          {notice.text}
        </AppText>
      ) : null}

      {preview ? (
        <ImportPreview validated={preview} busy={busy} onConfirm={(m, s) => void confirmImport(m, s)} onCancel={() => setPreview(null)} />
      ) : null}

      <Card>
        <AppText variant="headline">{t.exportTitle}</AppText>
        <AppText tone="secondary">{t.exportHelp}</AppText>
        <Button label={t.exportXlsx} icon="share-outline" disabled={busy} onPress={() => void doExport('xlsx')} />
        <Button variant="secondary" label={t.exportJson} icon="share-outline" disabled={busy} onPress={() => void doExport('json')} />
        <Button variant="secondary" label={t.exportCsv} icon="share-outline" disabled={busy} onPress={() => void doExport('csv')} />
      </Card>

      <Card>
        <AppText variant="headline">{t.reminderTitle}</AppText>
        <SegmentedControl
          accessibilityLabel={t.reminderTitle}
          selected={settings.backupReminderFrequency}
          onChange={(backupReminderFrequency) => update({ backupReminderFrequency })}
          segments={[
            { value: 'off', label: t.reminderOptions.off },
            { value: 'weekly', label: t.reminderOptions.weekly },
            { value: 'biweekly', label: t.reminderOptions.biweekly },
            { value: 'monthly', label: t.reminderOptions.monthly },
          ]}
        />
        <AppText variant="headline">{t.formatTitle}</AppText>
        <SegmentedControl
          accessibilityLabel={t.formatTitle}
          selected={settings.backupFormat}
          onChange={(backupFormat) => update({ backupFormat })}
          segments={[
            { value: 'xlsx', label: t.formatOptions.xlsx },
            { value: 'json', label: t.formatOptions.json },
            { value: 'both', label: t.formatOptions.both },
          ]}
        />
      </Card>

      <Card>
        <AppText variant="headline">{t.autoTitle}</AppText>
        <View style={styles.switchRow}>
          <AppText style={styles.flex}>{t.autoLabel}</AppText>
          <Switch
            accessibilityLabel={t.autoLabel}
            value={settings.autoBackupEnabled}
            onValueChange={(autoBackupEnabled) => update({ autoBackupEnabled })}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>
        <AppText tone="secondary">{t.autoHelp}</AppText>
        {Platform.OS === 'android' ? (
          <>
            <Button variant="secondary" icon="folder-open-outline" label={t.chooseFolder} onPress={() => void pickFolder()} />
            {folder ? <AppText tone="secondary">{t.folderSet}</AppText> : null}
          </>
        ) : null}
      </Card>

      <RestoreList refreshKey={restoreKey} disabled={busy} onPick={(name) => void openPreview(() => readAutoBackup(name))} />

      <Card>
        <AppText variant="headline">{t.importTitle}</AppText>
        <AppText tone="secondary">{t.importHelp}</AppText>
        <Button label={t.importButton} icon="download-outline" disabled={busy} onPress={() => void openPreview(pickImportFile)} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: minTapTarget },
});
