import { useEffect, useState } from 'react';
import { listAutoBackups, type RestoreItem } from '../../services/backup/autoBackup';
import { expoBackupFs } from '../../services/backup/files';
import { strings } from '../../strings/en';
import { AppText, Button, Card } from '../../ui/components';

const t = strings.backupScreen;

type Props = { onPick: (name: string) => void; refreshKey?: number; disabled?: boolean };

/** Lists auto-backups (date and size); picking one feeds the import preview flow. */
export function RestoreList({ onPick, refreshKey = 0, disabled = false }: Props) {
  const [items, setItems] = useState<RestoreItem[] | null>(null);
  useEffect(() => {
    let alive = true;
    listAutoBackups(expoBackupFs).then(
      (list) => alive && setItems(list),
      () => alive && setItems([]),
    );
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  return (
    <Card>
      <AppText variant="headline">{t.restoreTitle}</AppText>
      {items && items.length === 0 ? <AppText tone="secondary">{t.restoreEmpty}</AppText> : null}
      {(items ?? []).map((item) => (
        <Button
          key={item.name}
          variant="secondary"
          icon="time-outline"
          label={t.restoreItem(item.kind === 'preImport' ? t.preImportPrefix(item.label) : item.label, String(Math.max(1, Math.round(item.size / 1024))))}
          accessibilityLabel={t.restoreItemLabel(item.kind === 'preImport' ? t.preImportPrefix(item.label) : item.label)}
          disabled={disabled}
          onPress={() => onPick(item.name)}
        />
      ))}
    </Card>
  );
}
