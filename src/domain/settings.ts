import { z } from 'zod';

/** Settings persisted in MMKV (CLAUDE.md §3). Pure: no React or Expo imports. */

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm');
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected #RRGGBB');

const appLockSchema = z.object({
  enabled: z.boolean().default(false),
  timeout: z.enum(['immediate', '1m', '5m', '15m']).default('immediate'),
  hideInAppSwitcher: z.boolean().default(true),
});
const widgetSchema = z.object({
  hideGoalNames: z.boolean().default(false),
  groupId: z.string().optional(),
});
const reviewNotificationsSchema = z.object({
  weekly: z.boolean().default(true),
  monthly: z.boolean().default(true),
});

export const settingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  accentColor: hexColor.default('#2E7D5B'),
  /** 0 = Sunday … 6 = Saturday. */
  weekStart: z.number().int().min(0).max(6).default(1),
  timeFormat: z.enum(['12h', '24h']).default('24h'),
  haptics: z.boolean().default(true),
  reduceMotionOverride: z.enum(['system', 'on', 'off']).default('system'),
  /** Hour (0–4) at which the logical day ends. */
  dayEndsAt: z.number().int().min(0).max(4).default(0),
  /** null = quiet hours off. */
  quietHours: z.object({ start: hhmm, end: hhmm }).nullable().default(null),
  homeEmptyStateMode: z.enum(['allGoals', 'requireGroup']).default('allGoals'),
  backupReminderFrequency: z.enum(['off', 'weekly', 'biweekly', 'monthly']).default('biweekly'),
  backupFormat: z.enum(['xlsx', 'json', 'both']).default('both'),
  autoBackupEnabled: z.boolean().default(true),
  androidBackupFolderUri: z.string().optional(),
  lastBackupAt: z.string().optional(),
  backupBannerSnoozedUntil: z.string().optional(),
  appLock: appLockSchema.prefault({}),
  widget: widgetSchema.prefault({}),
  reviewNotifications: reviewNotificationsSchema.prefault({}),
  lastKnownTimeZone: z.string().optional(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

/** Nested settings objects; each of their fields falls back to its default on its own. */
const NESTED = {
  appLock: appLockSchema,
  widget: widgetSchema,
  reviewNotifications: reviewNotificationsSchema,
} as const;

function parseNested(schema: z.ZodObject, value: unknown): Record<string, unknown> {
  const input = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const result = schema.parse({}) as Record<string, unknown>;
  for (const key of Object.keys(schema.shape)) {
    if (!(key in input)) continue;
    const field = schema.shape[key].safeParse(input[key]);
    if (field.success) result[key] = field.data;
  }
  return result;
}

/**
 * Reads persisted settings. Unknown keys are dropped, invalid values fall back to
 * their defaults one field at a time (nested objects too), so a single bad value never
 * wipes the rest.
 */
export function parseSettings(raw: unknown): Settings {
  const input = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const result = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const key of Object.keys(settingsSchema.shape) as (keyof Settings)[]) {
    if (!(key in input)) continue;
    if (key in NESTED) {
      result[key] = parseNested(NESTED[key as keyof typeof NESTED], input[key]);
      continue;
    }
    const field = settingsSchema.shape[key].safeParse(input[key]);
    if (field.success) result[key] = field.data;
  }
  return result as Settings;
}

/** Applies only the patch fields that validate; invalid ones keep their previous value. */
export function applySettingsPatch(current: Settings, patch: Partial<Settings>): Settings {
  const merged = { ...current } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in settingsSchema.shape)) continue;
    if (key in NESTED) {
      const candidate = parseNested(NESTED[key as keyof typeof NESTED], value);
      const prev = current[key as keyof Settings] as Record<string, unknown>;
      const input = value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
      const out = { ...prev };
      for (const k of Object.keys(input)) if (k in candidate) {
        const ok = NESTED[key as keyof typeof NESTED].shape[k as never] as z.ZodType;
        if (ok.safeParse(input[k]).success) out[k] = candidate[k];
      }
      merged[key] = out;
      continue;
    }
    if (settingsSchema.shape[key as keyof Settings].safeParse(value).success) merged[key] = value;
  }
  return parseSettings(merged);
}
