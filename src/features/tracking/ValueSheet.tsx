import { useState } from 'react';
import { TextInput } from 'react-native';
import { strings } from '../../strings/en';
import { Button } from '../../ui/components';
import { useTheme } from '../../ui/ThemeProvider';
import { parseAmount, SheetFrame, useInputStyle } from './LogSheet';
import type { TodayRow } from './todayModel';

type Props = { row: TodayRow; onSave: (value: number) => void; onClose: () => void };

/** Number sheet for value goals. */
export function ValueSheet({ row, onSave, onClose }: Props) {
  const { colors } = useTheme();
  const inputStyle = useInputStyle();
  const [text, setText] = useState(row.value > 0 ? String(row.value) : '');
  const amount = parseAmount(text);
  return (
    <SheetFrame title={strings.today.valueSheetTitle(row.name)} onClose={onClose}>
      <TextInput
        accessibilityLabel={strings.today.valueLabel}
        autoFocus
        keyboardType="decimal-pad"
        value={text}
        onChangeText={setText}
        placeholder={row.unit ?? strings.today.valueLabel}
        placeholderTextColor={colors.textSecondary}
        style={inputStyle}
      />
      <Button label={strings.today.save} disabled={amount === null} onPress={() => amount !== null && onSave(amount)} />
    </SheetFrame>
  );
}
