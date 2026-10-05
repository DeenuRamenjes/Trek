import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { strings } from '../../strings/en';
import { AppText, Button, Icon } from '../../ui/components';
import type { IconName } from '../../ui/icons';
import { useTheme } from '../../ui/ThemeProvider';
import { minTapTarget, radii, spacing } from '../../ui/tokens';

export type GoalAction = 'edit' | 'duplicate' | 'pauseToggle' | 'archive' | 'moveUp' | 'moveDown';

type Props = {
  name: string;
  paused: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onAction: (action: GoalAction) => void;
  onClose: () => void;
};

const s = strings.goals;

/** Bottom sheet of row actions. Archive asks for confirmation inside the sheet. */
export function GoalActionSheet({ name, paused, canMoveUp, canMoveDown, onAction, onClose }: Props) {
  const { colors } = useTheme();
  const [confirming, setConfirming] = useState(false);

  const items: { key: GoalAction; label: string; icon: IconName; hidden?: boolean }[] = [
    { key: 'edit', label: s.edit, icon: 'create-outline' },
    { key: 'duplicate', label: s.duplicate, icon: 'copy-outline' },
    { key: 'pauseToggle', label: paused ? s.resume : s.pause, icon: paused ? 'play-outline' : 'pause-outline' },
    { key: 'moveUp', label: s.moveUp, icon: 'arrow-up', hidden: !canMoveUp },
    { key: 'moveDown', label: s.moveDown, icon: 'arrow-down', hidden: !canMoveDown },
    { key: 'archive', label: s.archive, icon: 'archive-outline' },
  ];

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel={s.close} style={[styles.scrim, { backgroundColor: colors.overlay }]} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
        {confirming ? (
          <>
            <AppText variant="headline">{s.confirmArchiveTitle(name)}</AppText>
            <AppText tone="secondary">{s.confirmArchiveBody}</AppText>
            <Button label={s.confirmArchive} onPress={() => onAction('archive')} />
            <Button label={s.cancel} variant="secondary" onPress={() => setConfirming(false)} />
          </>
        ) : (
          <>
            <AppText variant="headline">{s.sheetTitle(name)}</AppText>
            {items
              .filter((i) => !i.hidden)
              .map((i) => (
                <Pressable
                  key={i.key}
                  accessibilityRole="button"
                  accessibilityLabel={i.label}
                  style={styles.item}
                  onPress={() => (i.key === 'archive' ? setConfirming(true) : onAction(i.key))}
                >
                  <Icon name={i.icon} size={22} color={colors.textPrimary} />
                  <AppText>{i.label}</AppText>
                </Pressable>
              ))}
          </>
        )}
      </View>
    </Modal>
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
  item: { minHeight: minTapTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
