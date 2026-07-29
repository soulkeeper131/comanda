CREATE TABLE `evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`job_item_id` text,
	`storage_path` text NOT NULL,
	`taken_at` text DEFAULT (datetime('now')),
	`lat` real,
	`lng` real,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_item_id`) REFERENCES `job_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `finding_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`finding_id` text NOT NULL,
	`storage_path` text NOT NULL,
	`taken_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`finding_id`) REFERENCES `findings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `findings` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`property_id` text NOT NULL,
	`job_id` text,
	`reported_by` text,
	`title` text NOT NULL,
	`body` text,
	`status` text DEFAULT 'open',
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reported_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`phone` text,
	`email` text,
	`city` text,
	`property_kind` text,
	`service` text,
	`message` text,
	`status` text DEFAULT 'new',
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `job_items` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`zone_label` text,
	`label` text NOT NULL,
	`proof_type` text DEFAULT 'photo',
	`required` integer DEFAULT true,
	`sort` integer DEFAULT 0,
	`done` integer DEFAULT false,
	`count_value` integer,
	`note` text,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`property_id` text NOT NULL,
	`plan_id` text,
	`template_id` text,
	`assignee_id` text,
	`title` text,
	`duration_min` integer,
	`planned_at` text NOT NULL,
	`status` text DEFAULT 'planned',
	`check_in` text,
	`check_out` text,
	`note` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `service_templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`finding_id` text NOT NULL,
	`price` real,
	`days` integer,
	`scope` text,
	`sent_at` text DEFAULT (datetime('now')),
	`decision` text DEFAULT 'pending',
	FOREIGN KEY (`finding_id`) REFERENCES `findings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text,
	`accent` text DEFAULT '#1b98e0',
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_unique` ON `organizations` (`slug`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`template_id` text NOT NULL,
	`name` text NOT NULL,
	`per_month` integer DEFAULT 4,
	`price` real DEFAULT 0,
	`active` integer DEFAULT true,
	`started_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `service_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`geofence_m` integer DEFAULT 75,
	`kind` text DEFAULT 'apartment',
	`access_notes` text,
	`archived` integer DEFAULT false,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `service_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text DEFAULT '🧹',
	`duration_min` integer DEFAULT 60,
	`price` real DEFAULT 0,
	`bookable` integer DEFAULT true,
	`archived` integer DEFAULT false,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `template_items` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`zone_label` text,
	`label` text NOT NULL,
	`proof_type` text DEFAULT 'photo',
	`required` integer DEFAULT true,
	`sort` integer DEFAULT 0,
	FOREIGN KEY (`template_id`) REFERENCES `service_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'worker' NOT NULL,
	`full_name` text,
	`phone` text,
	`active` integer DEFAULT true,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `zones` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`name` text NOT NULL,
	`sort` integer DEFAULT 0,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
