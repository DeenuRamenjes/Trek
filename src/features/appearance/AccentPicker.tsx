import { StyleSheet, View } from 'react-native';
import { strings } from '../../strings/en';
import { AppText, ColorPicker } from '../../ui/components';
import { buildColors, minTapTarget, radii, spacing } from '../../ui/tokens';

type Props = { value: string; onChange: (hex: string) => void };

function Swatches({ label, mode, accent }: { label: string; mode: 'light' | 'dark'; accent: string }) {
  const c = buildColors(mode, accent);
  const items = [c.accent, c.onAccent, c.accentMuted];
  return (
    <View style={styles.group} accessible accessibilityLabel={strings.settings.appearanceScreen.previewFor(label)}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <View style={styles.row}>
        {items.map((color, i) => (
          <View key={i} style={[styles.chip, { backgroundColor: color, borderColor: c.border }]} />
        ))}
      </View>
    </View>
  );
}

/** Curated palette plus custom picker, with the generated tonal palette shown for both themes. */
export function AccentPicker({ value, onChange }: Props) {
  const a = strings.settings.appearanceScreen;
  return (
    <View style={styles.root}>
      <ColorPicker value={value} onChange={onChange} />
      <AppText variant="label" tone="secondary">
        {a.accentPreview}
      </AppText>
      <View style={styles.row}>
        <Swatches label={a.previewLight} mode="light" accent={value} />
        <Swatches label={a.previewDark} mode="dark" accent={value} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  group: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: { width: minTapTarget, height: spacing.lg, borderRadius: radii.sm, borderWidth: 1 },
});
