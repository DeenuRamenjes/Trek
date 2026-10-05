CREATE TABLE `goal_pauses` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `goal_schedule_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`effective_from` text NOT NULL,
	`schedule_type` text NOT NULL,
	`schedule_days` integer NOT NULL,
	`every_n_days` integer,
	`times_per_week` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goal_schedule_versions_goal_effective_idx` ON `goal_schedule_versions` (`goal_id`,`effective_from`);--> statement-breakpoint
CREATE TABLE `goal_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_version_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`time` text NOT NULL,
	`label` text,
	FOREIGN KEY (`schedule_version_id`) REFERENCES `goal_schedule_versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT 'flag' NOT NULL,
	`color` text DEFAULT '#2E7D5B' NOT NULL,
	`tracking_type` text DEFAULT 'check' NOT NULL,
	`target_value` integer DEFAULT 1 NOT NULL,
	`unit` text,
	`start_date` text NOT NULL,
	`end_date` text,
	`target_days` integer,
	`paused_at` text,
	`archived_at` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `group_goals` (
	`group_id` text NOT NULL,
	`goal_id` text NOT NULL,
	PRIMARY KEY(`group_id`, `goal_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `logs` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`date` text NOT NULL,
	`slot_id` text,
	`value` integer NOT NULL,
	`status` text NOT NULL,
	`note` text,
	`logged_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `logs_goal_date_idx` ON `logs` (`goal_id`,`date`);--> statement-breakpoint
CREATE TABLE `pending_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`goal_id` text NOT NULL,
	`date` text NOT NULL,
	`slot_id` text,
	`action` text NOT NULL,
	`value` integer,
	`created_at` text NOT NULL,
	`processed_at` text
);
--> statement-breakpoint
CREATE INDEX `pending_actions_processed_at_idx` ON `pending_actions` (`processed_at`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`slot_id` text,
	`weekday` integer NOT NULL,
	`time` text NOT NULL,
	`offset_min` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `vacation_goals` (
	`vacation_id` text NOT NULL,
	`goal_id` text NOT NULL,
	PRIMARY KEY(`vacation_id`, `goal_id`),
	FOREIGN KEY (`vacation_id`) REFERENCES `vacations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `vacations` (
	`id` text PRIMARY KEY NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`scope` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
