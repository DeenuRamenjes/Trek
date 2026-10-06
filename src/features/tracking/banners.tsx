import { useRouter } from 'expo-router';
import { Banner, type BannerAction } from '../../ui/components';
import { Collapse } from '../../ui/motion';
import { uiIcons } from '../../ui/icons';
import { strings } from '../../strings/en';

type VacationProps = { active: boolean; onEnd: () => void };

/** Vacation banner (design 4.4); collapses away when no vacation is active. */
export function VacationBanner({ active, onEnd }: VacationProps) {
  return (
    <Collapse open={active}>
      {active ? <Banner icon={uiIcons.vacation} message={strings.today.vacationBanner} actions={[{ label: strings.today.endVacation, onPress: onEnd }]} /> : null}
    </Collapse>
  );
}

type BackupProps = { days: number | null; show: boolean; onBackUp: () => void; onSnooze: () => void };

/** Backup-overdue banner. */
export function BackupBanner({ days, show, onBackUp, onSnooze }: BackupProps) {
  const actions: BannerAction[] = [
    { label: strings.today.backUpNow, onPress: onBackUp },
    { label: strings.today.snoozeBackup, onPress: onSnooze },
  ];
  return (
    <Collapse open={show}>
      {show ? <Banner icon={uiIcons.backup} message={strings.today.backupBanner(days ?? 0)} actions={actions} /> : null}
    </Collapse>
  );
}

/** Runs the default-format export; opens the Backup screen if the export fails. */
export function useBackUpNow(): () => void {
  const router = useRouter();
  return () => {
    void import('../../services/backup/files').then((m) => m.exportDefault()).catch(() => router.push('/settings/backup'));
  };
}
