import { strings } from '../../strings/en';
import { statusIcons } from '../icons';
import { useTheme } from '../ThemeProvider';
import type { StatusKey } from '../tokens';
import { Icon } from './Icon';

type Props = {
  status: StatusKey;
  size?: number;
};

/** Icon for a day status. Pair it with text or an accessibility label; never rely on color alone. */
export function StatusGlyph({ status, size = 18 }: Props) {
  const { colors } = useTheme();
  const name = statusIcons[status];
  if (!name) return null;
  return <Icon name={name} size={size} color={colors.status[status]} />;
}

export function statusLabel(status: StatusKey): string {
  return strings.status[status];
}
