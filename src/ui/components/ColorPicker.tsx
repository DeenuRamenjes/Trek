import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { strings } from '../../strings/en';
import { useTheme } from '../ThemeProvider';
import { hexToHsl, hslToHex, isHexColor, meetsAA } from '../color';
import { buildColors, goalPalette, minTapTarget, radii, spacing, typography } from '../tokens';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

type Props = {
  /** Stored hex: a light-mode palette color or a custom color. */
  value: string;
  onChange: (hex: string) => void;
};

const LIGHT_SURFACE = buildColors('light').surface;
const DARK_SURFACE = buildColors('dark').surface;

/**
 * A goal color is drawn as a glyph on the theme surface, so it must hold 3:1 (WCAG AA non-text).
 * Palette colors are checked as their per-theme variants; custom colors are one hex shown in both themes.
 */
export function passesContrast(hex: string): boolean {
  if (!isHexColor(hex)) return false;
  const i = goalPalette.light.indexOf(hex.toUpperCase());
  if (i !== -1) {
    return meetsAA(goalPalette.light[i], LIGHT_SURFACE, 'nonText') && meetsAA(goalPalette.dark[i], DARK_SURFACE, 'nonText');
  }
  return meetsAA(hex, LIGHT_SURFACE, 'nonText') && meetsAA(hex, DARK_SURFACE, 'nonText');
}

const HUE_STEP = 15;
const LIGHTNESS_STEP = 0.05;
const SATURATION = 0.6;

export function ColorPicker({ value, onChange }: Props) {
  const { colors, mode } = useTheme();
  const f = strings.goalForm;
  const [hexText, setHexText] = useState<string | null>(null);
  const valid = isHexColor(value);
  const passes = passesContrast(value);
  const hsl = valid ? hexToHsl(value) : { h: 0, s: SATURATION, l: 0.5 };
  const s = hsl.s < 0.1 ? SATURATION : hsl.s;

  const shift = (patch: Partial<typeof hsl>) => {
    setHexText(null);
    onChange(hslToHex({ h: hsl.h, s, l: hsl.l, ...patch }));
  };
  const hue = (delta: number) => shift({ h: (hsl.h + delta + 360) % 360 });
  const light = (delta: number) => shift({ l: Math.min(0.9, Math.max(0.1, hsl.l + delta)) });

  return (
    <View style={styles.root}>
      <View style={styles.wrap}>
        {goalPalette[mode].map((hex, i) => {
          const stored = goalPalette.light[i];
          const selected = value.toUpperCase() === stored;
          return (
            <Pressable
              key={stored}
              accessibilityRole="button"
              accessibilityLabel={f.chooseColor(i + 1)}
              accessibilityState={{ selected }}
              onPress={() => {
                setHexText(null);
                onChange(stored);
              }}
              style={[styles.swatch, { backgroundColor: hex, borderColor: selected ? colors.textPrimary : 'transparent' }]}
            >
              {selected ? <Icon name="checkmark" size={20} color={colors.surface} /> : null}
            </Pressable>
          );
        })}
      </View>
      <AppText variant="label" tone="secondary">
        {f.customColor}
      </AppText>
      <TextInput
        accessibilityLabel={f.customColorHex}
        value={hexText ?? value}
        onChangeText={(text) => {
          const next = text.startsWith('#') ? text : `#${text}`;
          setHexText(next);
          if (isHexColor(next)) onChange(next.toUpperCase());
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={7}
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, typography.body, { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border }]}
      />
      <StepRow label={f.hue} onDown={() => hue(-HUE_STEP)} onUp={() => hue(HUE_STEP)} />
      <StepRow label={f.lightness} onDown={() => light(-LIGHTNESS_STEP)} onUp={() => light(LIGHTNESS_STEP)} />
      <View style={styles.badgeRow} accessible accessibilityLabel={passes ? f.contrastPass : f.contrastFail}>
        <Icon name={passes ? 'checkmark-circle' : 'alert-circle'} size={16} color={passes ? colors.status.done : colors.status.missed} />
        <AppText variant="caption" tone="secondary">
          {passes ? f.contrastPass : f.contrastFail}
        </AppText>
      </View>
    </View>
  );
}

function StepRow({ label, onDown, onUp }: { label: string; onDown: () => void; onUp: () => void }) {
  const f = strings.goalForm;
  return (
    <View style={styles.stepRow}>
      <AppText style={styles.flex}>{label}</AppText>
      <IconButton icon="remove" accessibilityLabel={f.decrease(label)} onPress={onDown} filled />
      <IconButton icon="add" accessibilityLabel={f.increase(label)} onPress={onUp} filled />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: { width: minTapTarget, height: minTapTarget, borderRadius: radii.pill, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: minTapTarget, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: spacing.md },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
