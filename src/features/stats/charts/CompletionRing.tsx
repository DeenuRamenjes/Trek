import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDerivedValue, useSharedValue, withSpring } from 'react-native-reanimated';
import { strings } from '../../../strings/en';
import { AppText, Card } from '../../../ui/components';
import { AnimatedNumber, springs, useReduceMotion } from '../../../ui/motion';
import { useTheme } from '../../../ui/ThemeProvider';
import { spacing } from '../../../ui/tokens';
import type { StatsModel } from '../statsModel';

const t = strings.stats;
const SIZE = 120;
const STROKE = 12;

function arcPath() {
  const p = Skia.Path.Make();
  const r = (SIZE - STROKE) / 2;
  p.addArc({ x: STROKE / 2, y: STROKE / 2, width: r * 2, height: r * 2 }, -90, 359.9);
  return p;
}
const ARC = arcPath();

export function CompletionRing({ model }: { model: StatsModel }) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const c = model.completion;
  const target = Math.min(Math.max(c.percent / 100, 0), 1);
  const progress = useSharedValue(reduce ? target : 0);
  useEffect(() => {
    progress.value = reduce ? target : withSpring(target, springs.gentle);
  }, [target, reduce, progress]);
  const end = useDerivedValue(() => progress.value);
  const summary = `${t.completionSummary(Math.round(c.percent))}. ${t.countsSummary(c.done, c.partial, c.skipped, c.vacation, c.missed)}`;

  return (
    <Card accessible accessibilityLabel={summary} testID="stats-completion">
      <AppText variant="headline">{t.completion}</AppText>
      <View style={styles.row}>
        <View style={styles.ring}>
          <Canvas style={styles.canvas} accessible={false}>
            <Path path={ARC} style="stroke" strokeWidth={STROKE} strokeCap="round" color={colors.surfaceMuted} />
            <Path path={ARC} style="stroke" strokeWidth={STROKE} strokeCap="round" color={colors.accent} start={0} end={end} />
          </Canvas>
          <View style={styles.center} pointerEvents="none">
            <AnimatedNumber value={c.percent} variant="title" format={(n) => `${Math.round(n)}%`} accessibilityLabel={`${Math.round(c.percent)}%`} />
          </View>
        </View>
        <View style={styles.counts}>
          <AppText tone="secondary">{`${strings.status.done}: ${c.done}`}</AppText>
          <AppText tone="secondary">{`${strings.status.partial}: ${c.partial}`}</AppText>
          <AppText tone="secondary">{`${strings.status.skipped}: ${c.skipped}`}</AppText>
          <AppText tone="secondary">{`${strings.status.vacation}: ${c.vacation}`}</AppText>
          <AppText tone="secondary">{`${strings.status.missed}: ${c.missed}`}</AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  ring: { width: SIZE, height: SIZE },
  canvas: { width: SIZE, height: SIZE },
  center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  counts: { flex: 1, gap: spacing.xs },
});
