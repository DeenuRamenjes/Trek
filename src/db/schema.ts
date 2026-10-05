import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon').notNull().default('flag'),
  // Equals the default accent color; src/db must not import src/ui.
  color: text('color').notNull().default('#2E7D5B'),
  trackingType: text('tracking_type', { enum: ['check', 'count', 'duration', 'value'] })
    .notNull()
    .default('check'),
  targetValue: real('target_value').notNull().default(1),
  unit: text('unit'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  targetDays: integer('target_days'),
  pausedAt: text('paused_at'),
  archivedAt: text('archived_at'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const goalScheduleVersions = sqliteTable(
  'goal_schedule_versions',
  {
    id: text('id').primaryKey(),
    goalId: text('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    effectiveFrom: text('effective_from').notNull(),
    scheduleType: text('schedule_type', {
      enum: ['daily', 'weekdays', 'weekends', 'customDays', 'everyNDays', 'timesPerWeek'],
    }).notNull(),
    scheduleDays: integer('schedule_days').notNull(),
    everyNDays: integer('every_n_days'),
    timesPerWeek: integer('times_per_week'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('goal_schedule_versions_goal_effective_idx').on(t.goalId, t.effectiveFrom)],
);

export const goalSlots = sqliteTable('goal_slots', {
  id: text('id').primaryKey(),
  scheduleVersionId: text('schedule_version_id')
    .notNull()
    .references(() => goalScheduleVersions.id, { onDelete: 'cascade' }),
  weekday: integer('weekday').notNull(),
  time: text('time').notNull(),
  label: text('label'),
});

export const reminders = sqliteTable('reminders', {
  id: text('id').primaryKey(),
  goalId: text('goal_id')
    .notNull()
    .references(() => goals.id, { onDelete: 'cascade' }),
  slotId: text('slot_id'),
  weekday: integer('weekday').notNull(),
  time: text('time').notNull(),
  offsetMin: integer('offset_min').notNull().default(0),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
});

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const groupGoals = sqliteTable(
  'group_goals',
  {
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    goalId: text('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.goalId] })],
);

export const goalPauses = sqliteTable('goal_pauses', {
  id: text('id').primaryKey(),
  goalId: text('goal_id')
    .notNull()
    .references(() => goals.id, { onDelete: 'cascade' }),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const logs = sqliteTable(
  'logs',
  {
    id: text('id').primaryKey(),
    goalId: text('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    slotId: text('slot_id'),
    value: real('value').notNull(),
    status: text('status', { enum: ['done', 'partial', 'skipped'] }).notNull(),
    note: text('note'),
    loggedAt: text('logged_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    // Unique (goal_id, date, coalesce(slot_id, '')) lives in custom migration 0001: drizzle-kit cannot express it.
    index('logs_goal_date_idx').on(t.goalId, t.date),
  ],
);

export const vacations = sqliteTable('vacations', {
  id: text('id').primaryKey(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  scope: text('scope', { enum: ['all', 'selected'] }).notNull(),
  note: text('note'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const vacationGoals = sqliteTable(
  'vacation_goals',
  {
    vacationId: text('vacation_id')
      .notNull()
      .references(() => vacations.id, { onDelete: 'cascade' }),
    goalId: text('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.vacationId, t.goalId] })],
);

export const pendingActions = sqliteTable(
  'pending_actions',
  {
    id: text('id').primaryKey(),
    source: text('source', { enum: ['notification', 'widget'] }).notNull(),
    goalId: text('goal_id').notNull(),
    date: text('date').notNull(),
    slotId: text('slot_id'),
    action: text('action', { enum: ['done', 'increment', 'skip', 'snooze'] }).notNull(),
    value: real('value'),
    createdAt: text('created_at').notNull(),
    processedAt: text('processed_at'),
  },
  (t) => [index('pending_actions_processed_at_idx').on(t.processedAt)],
);

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type ScheduleVersion = typeof goalScheduleVersions.$inferSelect;
export type NewScheduleVersion = typeof goalScheduleVersions.$inferInsert;
export type Slot = typeof goalSlots.$inferSelect;
export type NewSlot = typeof goalSlots.$inferInsert;
export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type GroupGoal = typeof groupGoals.$inferSelect;
export type NewGroupGoal = typeof groupGoals.$inferInsert;
export type GoalPause = typeof goalPauses.$inferSelect;
export type NewGoalPause = typeof goalPauses.$inferInsert;
export type Log = typeof logs.$inferSelect;
export type NewLog = typeof logs.$inferInsert;
export type Vacation = typeof vacations.$inferSelect;
export type NewVacation = typeof vacations.$inferInsert;
export type VacationGoal = typeof vacationGoals.$inferSelect;
export type NewVacationGoal = typeof vacationGoals.$inferInsert;
export type PendingAction = typeof pendingActions.$inferSelect;
export type NewPendingAction = typeof pendingActions.$inferInsert;
