import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { strings } from '../../strings/en';
import { AppText, Button, Card, Icon } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { Motion } from '../../ui/motion';
import { useTheme } from '../../ui/ThemeProvider';
import { minTapTarget, spacing } from '../../ui/tokens';

export const ALL_GOALS = 'all';

type Props = {
  groups: { id: string; name: string }[];
  /** ALL_GOALS or a group id. */
  selected: string;
  onChange: (value: string) => void;
};

/** Group picker for the Stats tab. The menu fades and scales in and out over 150 ms. */
export function GroupDropdown({ groups, selected, onChange }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const options = [{ id: ALL_GOALS, name: strings.stats.allGoals }, ...groups];
  const current = options.find((o) => o.id === selected) ?? options[0];

  return (
    <View style={styles.wrap}>
      <Button
        label={current.name}
        icon={uiIcons.expand}
        variant="secondary"
        accessibilityLabel={`${strings.stats.chooseGroup}: ${current.name}`}
        onPress={() => setOpen((o) => !o)}
      />
      {open ? (
        <Motion
          from={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 'fast', easing: 'enter' }}
        >
          <Card>
            {options.map((o) => {
              const active = o.id === current.id;
              return (
                <Pressable
                  key={o.id}
                  accessibilityRole="button"
                  accessibilityLabel={o.name}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setOpen(false);
                    onChange(o.id);
                  }}
                  style={styles.option}
                >
                  <AppText tone={active ? 'primary' : 'secondary'}>{o.name}</AppText>
                  {active ? <Icon name={uiIcons.check} size={18} color={colors.accent} /> : null}
                </Pressable>
              );
            })}
          </Card>
        </Motion>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  option: {
    minHeight: minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
