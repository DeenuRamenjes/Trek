import { SchedulableTriggerInputTypes } from 'expo-notifications';
import type {
  DateTriggerInput,
  TimeIntervalTriggerInput,
  WeeklyTriggerInput,
} from 'expo-notifications';

/** Typed trigger builders (no casts); channelId is only meaningful on Android. */
export function weeklyTrigger(weekday: number, hour: number, minute: number, channelId?: string): WeeklyTriggerInput {
  return { type: SchedulableTriggerInputTypes.WEEKLY, weekday, hour, minute, channelId };
}

export function dateTrigger(at: Date, channelId?: string): DateTriggerInput {
  return { type: SchedulableTriggerInputTypes.DATE, date: at, channelId };
}

export function timeIntervalTrigger(seconds: number): TimeIntervalTriggerInput {
  return { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats: false };
}
