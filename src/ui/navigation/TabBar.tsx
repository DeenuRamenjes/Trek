import { useEffect } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { strings } from '../../strings/en';
import { AppText } from '../components/AppText';
import { Icon } from '../components/Icon';
import { uiIcons } from '../icons';
import { springs, useReduceMotion } from '../motion';
import { useTheme } from '../ThemeProvider';
import { minTapTarget, radii, spacing } from '../tokens';

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string; params?: object }[] };
  navigation: {
    emit(e: { type: 'tabPress'; target: string; canPreventDefault: true }): { defaultPrevented: boolean };
    navigate(name: string, params?: object): void;
  };
};

const tabMeta = {
  today: { label: strings.tabs.today, icon: uiIcons.today },
  stats: { label: strings.tabs.stats, icon: uiIcons.stats },
  goals: { label: strings.tabs.goals, icon: uiIcons.goals },
  settings: { label: strings.tabs.settings, icon: uiIcons.settings },
} as const;

export function TabBar({ state, navigation }: TabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const width = useSharedValue(0);
  const x = useSharedValue(0);
  const count = state.routes.length;

  const move = (w: number) => {
    const target = (w / count) * state.index;
    x.value = reduce ? target : withSpring(target, springs.snappy);
  };

  useEffect(() => {
    if (width.value > 0) move(width.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, reduce]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    const first = width.value === 0;
    width.value = w;
    if (first) x.value = (w / count) * state.index;
    else move(w);
  };

  const indicator = useAnimatedStyle(() => ({
    width: width.value / count,
    transform: [{ translateX: x.value }],
  }));

  return (
    <View
      testID="tab-bar"
      accessibilityRole="tablist"
      accessibilityLabel={strings.navigation.tabBar}
      onLayout={onLayout}
      style={[
        styles.bar,
        { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom },
      ]}
    >
      <Animated.View
        testID="tab-indicator"
        pointerEvents="none"
        style={[styles.indicator, { top: spacing.xs }, indicator]}
      >
        <View style={[styles.pill, { backgroundColor: colors.accentMuted }]} />
      </Animated.View>
      {state.routes.map((route, i) => {
        const meta = tabMeta[route.name as keyof typeof tabMeta];
        const focused = state.index === i;
        const color = focused ? colors.accent : colors.textSecondary;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={meta.label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            style={styles.tab}
          >
            <Icon name={meta.icon} size={22} color={color} />
            <AppText variant="caption" color={color}>
              {meta.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.xs },
  indicator: { position: 'absolute', left: 0, bottom: 0, paddingTop: spacing.xs, alignItems: 'center' },
  pill: { width: 64, height: 56, borderRadius: radii.pill },
  tab: { flex: 1, minHeight: minTapTarget, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: spacing.xs },
});
