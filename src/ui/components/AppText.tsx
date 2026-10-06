import { Text, TextProps } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { typography, TypographyVariant } from '../tokens';

export type TextTone = 'primary' | 'secondary' | 'accent' | 'onAccent';

type Props = TextProps & {
  variant?: TypographyVariant;
  tone?: TextTone;
  color?: string;
};

export function AppText({ variant = 'body', tone = 'primary', color, style, ...rest }: Props) {
  const { colors } = useTheme();
  const toneColor = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    accent: colors.accent,
    onAccent: colors.onAccent,
  }[tone];
  return <Text {...rest} style={[typography[variant], { color: color ?? toneColor }, style]} />;
}
