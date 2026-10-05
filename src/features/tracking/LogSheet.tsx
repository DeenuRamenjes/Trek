import { ReactNode, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { NOTE_MAX_LENGTH } from '../../domain/limits';
import { strings } from '../../strings/en';
import { AppText, Button, Chip } from '../../ui/components';
import { useTheme } from '../../ui/ThemeProvider';
import { minTapTarget, radii, spacing, typography } from '../../ui/tokens';
import type { TodayRow } from './todayModel';

const s = strings.today;

export function SheetFrame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel={s.closeSheet} style={[styles.scrim, { backgroundColor: colors.overlay }]} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
        <AppText variant="headline">{title}</AppText>
        {children}
      </View>
    </Modal>
  );
}

export function parseAmount(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null;
}

export function useInputStyle() {
  const { colors } = useTheme();
  return [styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surfaceMuted }];
}

type Props = {
  row: TodayRow;
  note: string | null;
  onSave: (value: number, note: string | null) => void;
  onClear: () => void;
  onClose: () => void;
};

/** Long-press sheet: value (done toggle for check goals) and a note of at most 1000 characters. */
export function LogSheet({ row, note, onSave, onClear, onClose }: Props) {
  const { colors } = useTheme();
  const inputStyle = useInputStyle();
  const isCheck = row.trackingType === 'check';
  const [value, setValue] = useState(String(row.value));
  const [checked, setChecked] = useState(row.status === 'done');
  const [text, setText] = useState(note ?? '');
  const amount = isCheck ? (checked ? 1 : 0) : parseAmount(value);
  const noteNeedsProgress = text.trim() !== '' && amount === 0;

  return (
    <SheetFrame title={s.logSheetTitle(row.name)} onClose={onClose}>
      {isCheck ? (
        <Chip label={s.doneToggle} selected={checked} onPress={() => setChecked((c) => !c)} />
      ) : (
        <TextInput
          accessibilityLabel={s.valueLabel}
          keyboardType="decimal-pad"
          value={value}
          onChangeText={setValue}
          placeholder={s.valueLabel}
          placeholderTextColor={colors.textSecondary}
          style={inputStyle}
        />
      )}
      <TextInput
        accessibilityLabel={s.noteLabel}
        multiline
        maxLength={NOTE_MAX_LENGTH}
        value={text}
        onChangeText={setText}
        placeholder={s.noteLabel}
        placeholderTextColor={colors.textSecondary}
        style={[inputStyle, styles.note]}
      />
      <AppText variant="caption" tone="secondary">
        {strings.history.noteCount(text.length)}
      </AppText>
      {noteNeedsProgress ? (
        <AppText variant="caption" tone="secondary">
          {s.noteNeedsProgress}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Button label={s.save} disabled={amount === null || noteNeedsProgress} onPress={() => amount !== null && onSave(amount, text.trim() === '' ? null : text)} />
        <Button label={s.clearEntry} variant="secondary" onPress={onClear} />
      </View>
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  scrim: StyleSheet.absoluteFill,
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
  },
  input: { minHeight: minTapTarget, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, ...typography.body },
  note: { minHeight: 96, textAlignVertical: 'top', paddingVertical: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
