import type { ComponentType } from 'react';
import { strings } from '../../strings/en';
import { CreateGoalPreview } from './CreateGoalPreview';
import { HistoryPreview } from './HistoryPreview';
import { LockPreview } from './LockPreview';
import { ReviewPreview } from './ReviewPreview';
import { SettingsPreview } from './SettingsPreview';
import { SplashPreview } from './SplashPreview';
import { StatsPreview } from './StatsPreview';
import { TodayPreview } from './TodayPreview';

export type PreviewKey = keyof typeof strings.designPreview.screens;

export const previewScreens: Record<PreviewKey, ComponentType> = {
  splash: SplashPreview,
  today: TodayPreview,
  stats: StatsPreview,
  createGoal: CreateGoalPreview,
  history: HistoryPreview,
  review: ReviewPreview,
  settings: SettingsPreview,
  lock: LockPreview,
};

export const previewKeys = Object.keys(previewScreens) as PreviewKey[];

export function isPreviewKey(value: unknown): value is PreviewKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(previewScreens, value);
}
