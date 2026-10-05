import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { strings } from '../../strings/en';
import { AppText, Button, Card, Icon, Screen } from '../../ui/components';
import { contrastRatio } from '../../ui/color';
import { goalIcons, uiIcons } from '../../ui/icons';
import { useTheme } from '../../ui/ThemeProvider';
import { goalPalette, minTapTarget, radii, spacing, typography } from '../../ui/tokens';
import { previewCreateGoal } from '../mockData';

function SectionHeader({ title, summary, open }: { title: string; summary: string; open: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={strings.goalForm.toggleSection(title)}
      accessibilityState={{ expanded: open }}
      style={styles.sectionHeader}
    >
      <View style={styles.flex}>
        <AppText variant="headline">{title}</AppText>
        <AppText variant="caption" tone="secondary">
          {summary}
        </AppText>
      </View>
      <Icon name={open ? uiIcons.expand : uiIcons.forward} size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

function Chip({ label, selected, accessibilityLabel }: { label: string; selected: boolean; accessibilityLabel: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={[styles.chip, { backgroundColor: selected ? colors.accent : colors.surfaceMuted }]}
    >
      <AppText variant="label" tone={selected ? 'onAccent' : 'primary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function CreateGoalPreview() {
  const { colors, mode } = useTheme();
  const f = strings.goalForm;
  const selectedColor = goalPalette[mode][previewCreateGoal.selectedColorIndex];
  const passes = contrastRatio(selectedColor, colors.surface) >= 3;
  return (
    <Screen>
      <AppText variant="display">{f.newTitle}</AppText>
      <TextInput
        accessibilityLabel={f.nameLabel}
        placeholder={f.namePlaceholder}
        placeholderTextColor={colors.textSecondary}
        defaultValue={previewCreateGoal.name}
        style={[styles.input, typography.headline, { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border }]}
      />
      <AppText variant="label" tone="secondary">
        {f.templates}
      </AppText>
      <View style={styles.wrap}>
        {previewCreateGoal.templates.map((t) => (
          <Chip key={t} label={f.templateNames[t]} selected={false} accessibilityLabel={f.useTemplate(f.templateNames[t])} />
        ))}
      </View>
      <Card>
        <SectionHeader title={f.sections.schedule} summary={f.scheduleTypes.weekdays} open />
        <View style={styles.wrap}>
          {(Object.keys(f.scheduleTypes) as (keyof typeof f.scheduleTypes)[]).map((k) => (
            <Chip key={k} label={f.scheduleTypes[k]} selected={k === 'customDays'} accessibilityLabel={f.scheduleTypes[k]} />
          ))}
        </View>
        <View style={styles.weekdays}>
          {previewCreateGoal.weekdays.map((d) => (
            <Chip key={d.label} label={d.label} selected={d.on} accessibilityLabel={f.weekdayToggle(d.label)} />
          ))}
        </View>
        <AppText variant="caption" tone="secondary">
          {f.scheduleNote}
        </AppText>
      </Card>
      <Card>
        <SectionHeader title={f.sections.times} summary={f.noTimes} open={false} />
      </Card>
      <Card>
        <SectionHeader title={f.sections.tracking} summary={f.trackingSummary} open={false} />
      </Card>
      <Card>
        <SectionHeader title={f.sections.duration} summary={f.durationSummary} open={false} />
      </Card>
      <Card>
        <SectionHeader title={f.sections.reminders} summary={f.remindersSummary} open={false} />
      </Card>
      <Card>
        <SectionHeader title={f.sections.appearance} summary={f.colorLabel} open />
        <View style={styles.wrap}>
          {goalPalette[mode].map((hex, i) => (
            <Pressable
              key={hex}
              accessibilityRole="button"
              accessibilityLabel={f.chooseColor(i + 1)}
              accessibilityState={{ selected: i === previewCreateGoal.selectedColorIndex }}
              style={[styles.swatch, { backgroundColor: hex, borderColor: i === previewCreateGoal.selectedColorIndex ? colors.textPrimary : 'transparent' }]}
            />
          ))}
        </View>
        <View style={styles.badgeRow}>
          <Icon name={passes ? 'checkmark-circle' : 'alert-circle'} size={16} color={passes ? colors.status.done : colors.status.missed} />
          <AppText variant="caption" tone="secondary">
            {passes ? f.contrastPass : f.contrastFail}
          </AppText>
        </View>
        <AppText variant="label" tone="secondary">
          {f.iconLabel}
        </AppText>
        <View style={styles.wrap}>
          {goalIcons.map((name) => (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityLabel={f.chooseIcon(name)}
              accessibilityState={{ selected: name === previewCreateGoal.selectedIcon }}
              style={[styles.iconChoice, { backgroundColor: name === previewCreateGoal.selectedIcon ? colors.accentMuted : colors.surfaceMuted }]}
            >
              <Icon name={name} size={20} color={colors.textPrimary} />
            </Pressable>
          ))}
        </View>
      </Card>
      <Button label={f.save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  input: { minHeight: 52, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  weekdays: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  sectionHeader: { minHeight: minTapTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chip: { minHeight: minTapTarget, minWidth: minTapTarget, paddingHorizontal: spacing.md, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: minTapTarget, height: minTapTarget, borderRadius: radii.pill, borderWidth: 3 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  iconChoice: { width: minTapTarget, height: minTapTarget, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
});
