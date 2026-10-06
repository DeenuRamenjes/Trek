import { StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { strings } from '../../../strings/en';
import { AppText, IconButton } from '../../../ui/components';
import { useTheme } from '../../../ui/ThemeProvider';
import { minTapTarget, radii, spacing, typography } from '../../../ui/tokens';
import { isValidTime } from '../goalFormSchema';

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  invalid?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  flex?: boolean;
};

export function Field({ label, value, onChangeText, placeholder, keyboardType, invalid = false, autoFocus, maxLength, flex }: FieldProps) {
  const { colors } = useTheme();
  return (
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      keyboardType={keyboardType}
      autoFocus={autoFocus}
      maxLength={maxLength}
      autoCorrect={false}
      style={[
        styles.input,
        typography.body,
        flex && styles.flex,
        { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: invalid ? colors.status.missed : colors.border },
      ]}
    />
  );
}

type StepperProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
};

export function Stepper({ label, value, onChange, min, max, step = 1 }: StepperProps) {
  const f = strings.goalForm;
  return (
    <View style={styles.row}>
      <AppText style={styles.flex}>{label}</AppText>
      <IconButton icon="remove" accessibilityLabel={f.decrease(label)} onPress={() => onChange(Math.max(min, value - step))} filled />
      <AppText variant="headline" style={styles.value} accessibilityLabel={`${label} ${value}`}>
        {value}
      </AppText>
      <IconButton icon="add" accessibilityLabel={f.increase(label)} onPress={() => onChange(Math.min(max, value + step))} filled />
    </View>
  );
}

function shiftTime(time: string, deltaMin: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (((h * 60 + m + deltaMin) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

type TimeFieldProps = { label: string; value: string; onChange: (value: string) => void };

/** HH:mm text input with 15-minute steppers; the text stays editable while invalid. */
export function TimeField({ label, value, onChange }: TimeFieldProps) {
  const f = strings.goalForm;
  const valid = isValidTime(value);
  return (
    <View style={styles.row}>
      <IconButton icon="remove" accessibilityLabel={`${f.earlierTime}: ${label}`} onPress={() => onChange(shiftTime(valid ? value : '09:00', -15))} filled />
      <Field label={label} value={value} onChangeText={onChange} keyboardType="numbers-and-punctuation" invalid={!valid} maxLength={5} flex />
      <IconButton icon="add" accessibilityLabel={`${f.laterTime}: ${label}`} onPress={() => onChange(shiftTime(valid ? value : '09:00', 15))} filled />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  value: { minWidth: 32, textAlign: 'center' },
  input: { minHeight: minTapTarget, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: spacing.md },
});
