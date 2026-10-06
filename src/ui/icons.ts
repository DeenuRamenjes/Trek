import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { StatusKey } from './tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Curated goal and group icons. Icons only, never emojis. */
export const goalIcons = [
  'water',
  'barbell',
  'book',
  'flower',
  'walk',
  'bicycle',
  'bed',
  'cafe',
  'nutrition',
  'heart',
  'musical-notes',
  'brush',
  'code-slash',
  'language',
  'medkit',
  'moon',
  'sunny',
  'fitness',
  'footsteps',
  'leaf',
] as const satisfies readonly IconName[];

export type GoalIconName = (typeof goalIcons)[number];

/** Status glyphs so status is never shown by color alone. `notDue` shows no glyph. */
export const statusIcons: Record<StatusKey, IconName | null> = {
  done: 'checkmark-circle',
  partial: 'contrast',
  skipped: 'remove-circle-outline',
  vacation: 'airplane',
  missed: 'close-circle-outline',
  pending: 'ellipse-outline',
  notDue: null,
};

export const uiIcons = {
  today: 'today-outline',
  stats: 'stats-chart-outline',
  goals: 'list-outline',
  settings: 'settings-outline',
  lock: 'lock-closed',
  back: 'chevron-back',
  forward: 'chevron-forward',
  expand: 'chevron-down',
  add: 'add',
  remove: 'remove',
  up: 'arrow-up',
  down: 'arrow-down',
  streak: 'flame',
  best: 'trophy-outline',
  backup: 'cloud-upload-outline',
  vacation: 'airplane-outline',
  check: 'checkmark',
  close: 'close',
  calendar: 'calendar-outline',
  notifications: 'notifications-outline',
  security: 'shield-checkmark-outline',
  widget: 'grid-outline',
  about: 'information-circle-outline',
  palette: 'color-palette-outline',
  time: 'time-outline',
  repeat: 'repeat-outline',
  alarm: 'alarm-outline',
  tracking: 'speedometer-outline',
  insight: 'sparkles-outline',
  mark: 'trail-sign-outline',
} as const satisfies Record<string, IconName>;
