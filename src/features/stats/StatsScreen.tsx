import { logCatch } from '../../services/errorLog';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { onDbChanged } from '../../db/changes';
import { useDb } from '../../db/DbProvider';
import { useLiveLogs } from '../../db/live';
import { listGroupGoals, listGroups } from '../../db/repositories';
import type { Group } from '../../db/schema';
import type { StatsMode, StatsRange } from '../../domain/statsCalculator';
import type { GoalContext } from '../../domain/types';
import { strings } from '../../strings/en';
import { AppText, Button, Card, Screen, SegmentedControl } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { Skeleton, Stagger } from '../../ui/motion';
import { spacing } from '../../ui/tokens';
import { loadGoalContexts } from '../goals/goalContexts';
import { useSettings } from '../settings/settingsStore';
import { formatPeriodParam } from '../reviews/periodParam';
import { useLogicalToday } from '../tracking/useLogicalToday';
import { BestWeekday, CompletionRing, Heatmap, PerGoalBars, StreakCard, TrendLine, WeeklyBars } from './charts';
import { ALL_GOALS, GroupDropdown } from './GroupDropdown';
import { RangeControl } from './RangeControl';
import { buildStatsModel, type StatsModel } from './statsModel';

const t = strings.stats;

type Loaded = { contexts: GoalContext[]; groups: Group[]; links: Record<string, string[]> };

function StatsCards({ model }: { model: StatsModel }) {
  return (
    <Stagger>
      <CompletionRing model={model} />
      <StreakCard model={model} />
      <Heatmap model={model} />
      <WeeklyBars model={model} />
      <TrendLine model={model} />
      <PerGoalBars model={model} />
      <BestWeekday model={model} />
    </Stagger>
  );
}

export function StatsScreen() {
  const router = useRouter();
  const db = useDb();
  const { today } = useLogicalToday();
  const dayEndsAt = useSettings((s) => s.settings.dayEndsAt);
  const weekStart = useSettings((s) => s.settings.weekStart);
  const emptyMode = useSettings((s) => s.settings.homeEmptyStateMode);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [group, setGroup] = useState(ALL_GOALS);
  const [range, setRange] = useState<StatsRange>('30D');
  const [mode, setMode] = useState<StatsMode>('weighted');
  const { data: logs } = useLiveLogs();

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [contexts, groups, goalLinks] = await Promise.all([loadGoalContexts(db, { dayEndsAt }), listGroups(db), listGroupGoals(db)]);
      const links: Record<string, string[]> = {};
      for (const l of goalLinks) (links[l.groupId] ??= []).push(l.goalId);
      if (alive) setLoaded({ contexts, groups, links });
    };
    const run = () => void load().catch(logCatch('stats.load'));
    run();
    const off = onDbChanged(run);
    return () => {
      alive = false;
      off();
    };
  }, [db, dayEndsAt]);

  const groups = loaded?.groups ?? [];
  const selected = groups.some((g) => g.id === group) ? group : ALL_GOALS;
  const noGroups = loaded !== null && groups.length === 0;
  const blocked = noGroups && emptyMode === 'requireGroup';

  const model = useMemo(
    () =>
      loaded && !blocked
        ? buildStatsModel({
            contexts: loaded.contexts,
            logs,
            goalIds: selected === ALL_GOALS ? null : (loaded.links[selected] ?? []),
            range,
            mode,
            today,
            weekStart,
          })
        : null,
    [loaded, blocked, logs, selected, range, mode, today, weekStart],
  );

  const createGroup = () => router.push('/group/new');
  const weekPeriod = formatPeriodParam({ kind: 'week', anchor: today }, weekStart);
  const monthPeriod = formatPeriodParam({ kind: 'month', anchor: today }, weekStart);

  return (
    <Screen edges={['top', 'left', 'right']}>
      <AppText variant="display">{strings.tabs.stats}</AppText>
      {loaded === null ? (
        <View accessibilityLabel={t.loading} style={styles.stack}>
          <Skeleton height={44} />
          <Skeleton height={160} />
          <Skeleton height={96} />
        </View>
      ) : blocked ? (
        <Card muted>
          <AppText variant="headline">{t.emptyRequireGroup}</AppText>
          <Button label={t.createGroupAction} icon={uiIcons.add} onPress={createGroup} />
        </Card>
      ) : (
        <View style={styles.stack}>
          <GroupDropdown groups={groups} selected={selected} onChange={setGroup} />
          <RangeControl value={range} onChange={setRange} />
          <SegmentedControl
            accessibilityLabel={t.modeLabel}
            selected={mode}
            onChange={setMode}
            segments={[
              { value: 'weighted', label: t.weighted },
              { value: 'strict', label: t.strict },
            ]}
          />
          {noGroups ? (
            <Card muted>
              <AppText variant="headline">{t.createGroupTitle}</AppText>
              <AppText tone="secondary">{t.createGroupBody}</AppText>
              <Button label={t.createGroupAction} icon={uiIcons.add} onPress={createGroup} />
            </Card>
          ) : null}
          {model ? <StatsCards model={model} /> : null}
          <AppText variant="headline">{t.reviewsTitle}</AppText>
          <View style={styles.row}>
            <Button
              label={t.weeklyReview}
              variant="secondary"
              accessibilityLabel={t.openReview(t.weeklyReview)}
              onPress={() => router.push(`/review/${weekPeriod}`)}
            />
            <Button
              label={t.monthlyReview}
              variant="secondary"
              accessibilityLabel={t.openReview(t.monthlyReview)}
              onPress={() => router.push(`/review/${monthPeriod}`)}
            />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
});
