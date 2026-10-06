import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { TABLE_SPECS } from '../../services/backup/snapshot';
import { canApplyImport } from '../../services/backup/importGate';
import type { ImportMode } from '../../services/backup/importApply';
import type { ValidatedImport } from '../../services/backup/importValidate';
import { strings } from '../../strings/en';
import { AppText, Button, Card, SegmentedControl } from '../../ui/components';
import { useTheme } from '../../ui/ThemeProvider';
import { minTapTarget, spacing } from '../../ui/tokens';

const t = strings.backupScreen;
const MAX_ERRORS = 20;

type Props = {
  validated: ValidatedImport;
  busy?: boolean;
  onConfirm: (mode: ImportMode, confirmedSkipInvalid: boolean) => void;
  onCancel: () => void;
};

/** Counts per table, row-level errors, and a required confirmation to skip invalid rows. */
export function ImportPreview({ validated, busy = false, onConfirm, onCancel }: Props) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<ImportMode>('merge');
  const [skip, setSkip] = useState(false);
  const errors = validated.errors;
  const allowed = canApplyImport(validated, skip) && !busy;

  return (
    <Card>
      <AppText variant="headline" accessibilityRole="header">
        {t.previewTitle}
      </AppText>
      {TABLE_SPECS.map((spec) => {
        const c = validated.counts[spec.key];
        return (
          <AppText key={spec.key} tone="secondary">
            {t.previewCount(spec.sheet, c.valid, c.total)}
          </AppText>
        );
      })}
      {errors.length > 0 ? (
        <View accessibilityRole="alert" style={styles.errors}>
          <AppText variant="headline">{t.previewErrors(errors.length)}</AppText>
          {errors.slice(0, MAX_ERRORS).map((e, i) => (
            <AppText key={i} tone="secondary">
              {t.previewError(e.sheet, e.row, e.message)}
            </AppText>
          ))}
          {errors.length > MAX_ERRORS ? <AppText tone="secondary">{t.previewMoreErrors(errors.length - MAX_ERRORS)}</AppText> : null}
          <View style={styles.switchRow}>
            <AppText style={styles.flex}>{t.skipInvalid(errors.length)}</AppText>
            <Switch
              accessibilityLabel={t.skipInvalidLabel}
              value={skip}
              onValueChange={setSkip}
              trackColor={{ true: colors.accent, false: colors.border }}
            />
          </View>
        </View>
      ) : null}
      <SegmentedControl<ImportMode>
        accessibilityLabel={t.mode}
        selected={mode}
        onChange={setMode}
        segments={[
          { value: 'merge', label: t.merge },
          { value: 'replace', label: t.replace },
        ]}
      />
      <AppText tone="secondary">{mode === 'replace' ? t.replaceHelp : t.mergeHelp}</AppText>
      <Button label={t.runImport} accessibilityLabel={t.runImport} disabled={!allowed} onPress={() => onConfirm(mode, skip)} />
      <Button variant="secondary" label={t.cancel} accessibilityLabel={t.cancel} onPress={onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  errors: { gap: spacing.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: minTapTarget },
});
