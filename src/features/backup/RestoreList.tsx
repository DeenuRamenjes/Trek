import { useEffect, useState } from 'react';
import { listAutoBackups } from '../../services/backup/autoBackup';
import { expoBackupFs } from '../../services/backup/files';
import { strings } from '../../strings/en';
import { AppText, Button, Card } from '../../ui/components';

const t = strings.backupScreen;

type Props = { onPick: (name: string) => void };

/** Lists auto-backups (date and size); picking one feeds the import preview flow. */
export function RestoreList({ onPick }: Props) {
  const [items, setItems] = useState<{ name: string; size: number; label: string }[] | null>(null);
  useEffect(() => {
    let alive = true;
    listAutoBackups(expoBackupFs).then(
      (list) => alive && setItems(list),
      () => alive && setItems([]),
    );
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Card>
      <AppText variant="headline">{t.restoreTitle}</AppText>
      {items && items.length === 0 ? <AppText tone="secondary">{t.restoreEmpty}</AppText> : null}
      {(items ?? []).map((item) => (
        <Button
          key={item.name}
          variant="secondary"
          icon="time-outline"
          label={t.restoreItem(item.label, String(Math.max(1, Math.round(item.size / 1024))))}
          accessibilityLabel={t.restoreItemLabel(item.label)}
          onPress={() => onPick(item.name)}
        />
      ))}
    </Card>
  );
}
