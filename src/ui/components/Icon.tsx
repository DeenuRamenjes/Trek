import { Ionicons } from '@expo/vector-icons';
import type { IconName } from '../icons';

type Props = {
  name: IconName;
  size?: number;
  color: string;
};

/** Decorative icon; the surrounding control carries the accessibility label. */
export function Icon({ name, size = 20, color }: Props) {
  return (
    <Ionicons name={name} size={size} color={color} accessible={false} importantForAccessibility="no" />
  );
}
