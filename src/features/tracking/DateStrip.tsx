import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { parseDate } from '../../domain/dates';
import { strings } from '../../strings/en';
import { AppText } from '../../ui/components';
import { springs, useReduceMotion } from '../../ui/motion';
import { useTheme } from '../../ui/ThemeProvider';
import { minTapTarget, radii } from '../../ui/tokens';

type Props = { days: string[]; selected: string; onSelect: (date: string) => void };

/** Seven-day strip (today last). The selected pill slides with the snappy spring. */
export function DateStrip({ days, selected, onSelect }: Props) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const index = Math.max(days.indexOf(selected), 0);
  const cell = width / days.length;

  useEffect(() => {
    x.value = reduce ? index * cell : withSpring(index * cell, springs.snappy);
  }, [index, cell, reduce, x]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View accessibilityLabel={strings.today.dateStrip} style={styles.strip} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? <Animated.View style={[styles.pill, { width: cell, backgroundColor: colors.accent }, pill]} /> : null}
      {days.map((d) => {
        const on = d === selected;
        const date = parseDate(d);
        return (
          <Pressable
            key={d}
            accessibilityRole="button"
            accessibilityLabel={strings.today.selectDay(format(date, 'EEEE d MMMM'))}
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(d)}
            style={styles.day}
          >
            <AppText variant="caption" tone={on ? 'onAccent' : 'secondary'}>
              {format(date, 'EEE')}
            </AppText>
            <AppText variant="headline" tone={on ? 'onAccent' : 'primary'}>
              {format(date, 'd')}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', minHeight: 56 },
  pill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: radii.md },
  day: { flex: 1, minWidth: minTapTarget, minHeight: 56, alignItems: 'center', justifyContent: 'center' },
});
