ALTER TABLE `plans` ADD `billing_paused_until` text;--> statement-breakpoint
ALTER TABLE `plans` ADD `suspended_at` text;--> statement-breakpoint
ALTER TABLE `template_items` ADD `season` text DEFAULT 'all';