import { StyleSheet, View } from 'react-native';
import { strings } from '../../strings/en';
import { AppText, Button, Card, Icon, Screen, SegmentedControl } from '../../ui/components';
import { uiIcons } from '../../ui/icons';
import { useTheme } from '../../ui/ThemeProvider';
import { spacing } from '../../ui/tokens';
import { previewStats } from '../mockData';
import { DotRing, HeatmapGrid, HorizontalBars, TrendDots, VerticalBars } from './charts';

function StreakTile({ label, days, icon }: { label: string; days: number; icon: typeof uiIcons.streak | typeof uiIcons.best }) {
  const { colors } = useTheme();
  return (
    <Card style={styles.tile}>
      <Icon name={icon} size={20} color={colors.accent} />
      <AppText variant="title">{strings.stats.days(days)}</AppText>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
    </Card>
  );
}

export function StatsPreview() {
  const r = strings.stats.ranges;
  return (
    <Screen>
      <Button label={previewStats.groupLabel} icon={uiIcons.expand} variant="secondary" accessibilityLabel={strings.stats.chooseGroup} />
      <SegmentedControl
        accessibilityLabel={strings.stats.rangeLabel}
        selected="d30"
        segments={[
          { value: 'd7', label: r.d7 },
          { value: 'd30', label: r.d30 },
          { value: 'd90', label: r.d90 },
          { value: 'y1', label: r.y1 },
          { value: 'all', label: r.all },
        ]}
      />
      <SegmentedControl
        accessibilityLabel={strings.stats.modeLabel}
        selected="weighted"
        segments={[
          { value: 'weighted', label: strings.stats.weighted },
          { value: 'strict', label: strings.stats.strict },
        ]}
      />
      <Card style={styles.center}>
        <AppText variant="label" tone="secondary">
          {strings.stats.completion}
        </AppText>
        <DotRing value={previewStats.completion} label={strings.stats.completion} />
      </Card>
      <View style={styles.tiles}>
        <StreakTile label={strings.stats.currentStreak} days={previewStats.currentStreak} icon={uiIcons.streak} />
        <StreakTile label={strings.stats.bestStreak} days={previewStats.bestStreak} icon={uiIcons.best} />
      </View>
      <Card>
        <AppText variant="headline">{strings.stats.heatmap}</AppText>
        <HeatmapGrid values={previewStats.heatmap} label={strings.stats.heatmap} />
      </Card>
      <Card>
        <AppText variant="headline">{strings.stats.weeklyBars}</AppText>
        <VerticalBars items={previewStats.weekly} label={strings.stats.weeklyBars} />
      </Card>
      <Card>
        <AppText variant="headline">{strings.stats.trend}</AppText>
        <TrendDots values={previewStats.trend} label={strings.stats.trend} />
      </Card>
      <Card>
        <AppText variant="headline">{strings.stats.perGoal}</AppText>
        <HorizontalBars items={previewStats.perGoal} />
      </Card>
      <Card>
        <AppText variant="headline">{strings.stats.bestWeekday}</AppText>
        <AppText tone="secondary">{previewStats.bestWeekday}</AppText>
        <VerticalBars items={previewStats.weekdays} label={strings.stats.bestWeekday} />
      </Card>
      <View style={styles.tiles}>
        <Button label={strings.stats.weeklyReview} variant="secondary" accessibilityLabel={strings.stats.openReview(strings.stats.weeklyReview)} />
        <Button label={strings.stats.monthlyReview} variant="secondary" accessibilityLabel={strings.stats.openReview(strings.stats.monthlyReview)} />
      </View>
      <Card muted>
        <AppText variant="headline">{strings.stats.createGroupTitle}</AppText>
        <AppText tone="secondary">{strings.stats.createGroupBody}</AppText>
        <Button label={strings.stats.createGroupAction} icon={uiIcons.add} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  tiles: { flexDirection: 'row', gap: spacing.md },
  tile: { flex: 1 },
});
