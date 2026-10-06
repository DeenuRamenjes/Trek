CREATE UNIQUE INDEX `logs_goal_date_slot_unique` ON `logs` (`goal_id`,`date`,coalesce(`slot_id`, ''));
