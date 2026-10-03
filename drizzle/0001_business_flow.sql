CREATE TABLE `job_reschedules` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`user_id` text NOT NULL,
	`from_date` text NOT NULL,
	`to_date` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `offer_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`offer_id` text NOT NULL,
	`storage_path` text NOT NULL,
	`uploaded_by` text,
	`taken_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `package_items` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`template_id` text NOT NULL,
	`per_month` integer DEFAULT 1 NOT NULL,
	`optional` integer DEFAULT false,
	`extra_price` real DEFAULT 0,
	`sort` integer DEFAULT 0,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `service_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `packages` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`per_month` integer DEFAULT 2 NOT NULL,
	`price` real DEFAULT 0 NOT NULL,
	`list_price` real,
	`active_from` text,
	`active_to` text,
	`archived` integer DEFAULT false,
	`sort` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `evidence` ADD `client_taken_at` text;--> statement-breakpoint
ALTER TABLE `evidence` ADD `uploaded_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `findings` ADD `severity` text DEFAULT 'normal';--> statement-breakpoint
ALTER TABLE `findings` ADD `quote_requested_at` text;--> statement-breakpoint
ALTER TABLE `job_items` ADD `done_at` text;--> statement-breakpoint
ALTER TABLE `job_items` ADD `done_client_at` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `check_in_client_at` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `gen_key` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `rescheduled_at` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `rescheduled_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `jobs` ADD `rescheduled_from` text;--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_gen_key_idx` ON `jobs` (`gen_key`);--> statement-breakpoint
ALTER TABLE `offers` ADD `created_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `offers` ADD `expires_at` text;--> statement-breakpoint
ALTER TABLE `offers` ADD `decided_at` text;--> statement-breakpoint
ALTER TABLE `offers` ADD `done_at` text;--> statement-breakpoint
ALTER TABLE `offers` ADD `paid_at` text;--> statement-breakpoint
ALTER TABLE `offers` ADD `reminders_sent` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `offers` ADD `payment_reminders_sent` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `plans` ADD `package_id` text REFERENCES packages(id);--> statement-breakpoint
ALTER TABLE `plans` ADD `options` text;--> statement-breakpoint
ALTER TABLE `plans` ADD `status` text DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `plans` ADD `first_job_at` text;--> statement-breakpoint
ALTER TABLE `plans` ADD `cancelled_at` text;--> statement-breakpoint
ALTER TABLE `plans` ADD `ends_at` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `status` text DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `properties` ADD `rejection_reason` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `approved_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `properties` ADD `approved_at` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `contact_name` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `contact_phone` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `assigned_inspector_id` text REFERENCES users(id);--> statement-breakpoint
UPDATE `findings` SET `status` = 'closed' WHERE `status` = 'resolved';--> statement-breakpoint
UPDATE `findings` SET `status` = 'quoted' WHERE `status` = 'in_progress' AND EXISTS (SELECT 1 FROM `offers` o WHERE o.`finding_id` = `findings`.`id`);--> statement-breakpoint
UPDATE `findings` SET `status` = 'open' WHERE `status` = 'in_progress';--> statement-breakpoint
UPDATE `offers` SET `expires_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+7 days') WHERE `decision` = 'pending' AND `expires_at` IS NULL;
