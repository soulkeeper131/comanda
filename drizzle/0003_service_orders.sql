CREATE TABLE `service_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`template_id` text NOT NULL,
	`requested_by` text NOT NULL,
	`requested_date` text NOT NULL,
	`note` text,
	`price` real NOT NULL,
	`status` text DEFAULT 'pending_payment',
	`job_id` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `service_templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `payments` ADD `order_id` text REFERENCES service_orders(id);