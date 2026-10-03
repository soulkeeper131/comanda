ALTER TABLE `jobs` ADD `reminder_sent_at` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `reminders_sent` integer DEFAULT 0;