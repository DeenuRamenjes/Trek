import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { onDbChanged } from '../../db/changes';
import { useDb } from '../../db/DbProvider';
import { useLiveLogs } from '../../db/live';
import { buildReview, formatInsight, previousPeriod, type Period } from '../../domain/reviewBuilder';
import type { GoalContext } from '../../domain/types';
import { strings } from '../../strings/en';
import { AppText, Button, Card, IconButton, Screen } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { Skeleton, Stagger } from '../../ui/motion';
import { spacing } from '../../ui/tokens';
import { loadGoalContexts } from '../goals/goalContexts';
import { useSettings } from '../settings/settingsStore';
import { useLogicalToday } from '../tracking/useLogicalToday';
import { BestTimeRow, BestWorstRow, InsightCards, OverallCard, PerGoalCard, StreaksRow, TotalsCard } from './ReviewCards';
import { canGoNext, formatPeriodParam, nextPeriod, parsePeriodParam, periodLabel } from './periodParam';

const r = strings.review;

export function ReviewScreen({ param }: { param: string | undefined }) {
  const router = useRouter();
  const db = useDb();
  const { today } = useLogicalToday();
  const dayEndsAt = useSettings((s) => s.settings.dayEndsAt);
  const weekStart = useSettings((s) => s.settings.weekStart);
  const parsed = useMemo(() => parsePeriodParam(param), [param]);
  const [period, setPeriod] = useState<Period | null>(parsed);
  const [contexts, setContexts] = useState<GoalContext[] | null>(null);
  const { data: logs } = useLiveLogs();

  useEffect(() => setPeriod(parsed), [parsed]);

  useEffect(() => {
    let alive = true;
    const run = () =>
      void loadGoalContexts(db, { dayEndsAt })
        .then((c) => alive && setContexts(c))
        .catch(() => undefined);
    run();
    const off = onDbChanged(run);
    return () => {
      alive = false;
      off();
    };
  }, [db, dayEndsAt]);

  const review = useMemo(
    () => (period && contexts && contexts.length > 0 ? buildReview({ period, weekStart, today, ctxs: contexts, logs }) : null),
    [period, contexts, logs, weekStart, today],
  );
  const goalColors = useMemo(() => Object.fromEntries((contexts ?? []).map((c) => [c.goal.id, c.goal.color])), [contexts]);

  if (!period) {
    return (
      <Screen>
        <IconButton icon={uiIcons.back} accessibilityLabel={r.back} onPress={() => router.back()} />
        <Card muted>
          <AppText variant="headline">{r.notFoundTitle}</AppText>
          <AppText tone="secondary">{r.notFoundBody}</AppText>
          <Button label={r.backToStats} icon={uiIcons.stats} onPress={() => router.replace('/stats')} />
        </Card>
      </Screen>
    );
  }

  const handlePreviousPeriod = () => {
    const prev = previousPeriod(period, weekStart);
    setPeriod(prev);
    router.setParams({ period: formatPeriodParam(prev, weekStart) });
  };

  const handleNextPeriod = () => {
    const next = nextPeriod(period, weekStart);
    setPeriod(next);
    router.setParams({ period: formatPeriodParam(next, weekStart) });
  };

  const header = (
    <View style={styles.nav}>
      <IconButton icon={uiIcons.back} accessibilityLabel={strings.navigation.back} onPress={() => router.back()} />
      <AppText variant="headline" accessibilityRole="header">
        {periodLabel(period, weekStart)}
      </AppText>
      <View style={styles.navRight}>
        <View style={styles.rotated}>
          <IconButton icon={uiIcons.forward} accessibilityLabel={r.previousPeriod} onPress={handlePreviousPeriod} />
        </View>
        <IconButton
          icon={uiIcons.forward}
          accessibilityLabel={r.nextPeriod}
          disabled={!canGoNext(period, weekStart, today)}
          onPress={handleNextPeriod}
        />
      </View>
    </View>
  );

  return (
    <Screen>
      {header}
      {contexts === null ? (
        <View accessibilityLabel={r.loading} style={styles.stack}>
          <Skeleton height={160} />
          <Skeleton height={96} />
        </View>
      ) : review === null ? (
        <Card muted>
          <AppText variant="headline">{r.emptyTitle}</AppText>
          <AppText tone="secondary">{r.emptyBody}</AppText>
          <Button label={r.createGoal} icon={uiIcons.add} onPress={() => router.push('/goal/new')} />
        </Card>
      ) : (
        <View style={styles.stack}>
          <Stagger>
            <OverallCard review={review} />
            <PerGoalCard goals={review.perGoal} colors={goalColors} />
            <BestWorstRow review={review} />
            <StreaksRow review={review} />
            <BestTimeRow review={review} />
            <TotalsCard review={review} />
            <InsightCards insights={review.insights} format={(i) => formatInsight(i, strings.insights)} />
          </Stagger>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navRight: { flexDirection: 'row', alignItems: 'center' },
  rotated: { transform: [{ scaleX: -1 }] },
});
