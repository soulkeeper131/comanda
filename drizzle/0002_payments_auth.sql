CREATE TABLE `auth_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_tokens_token_hash_unique` ON `auth_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `uploads` (
	`filename` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`attached_at` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `offers` ADD `requires_prepayment` integer;--> statement-breakpoint
ALTER TABLE `plans` ADD `options_snapshot` text;--> statement-breakpoint
ALTER TABLE `plans` ADD `season_from` text;--> statement-breakpoint
ALTER TABLE `plans` ADD `season_to` text;--> statement-breakpoint
ALTER TABLE `plans` ADD `stripe_subscription_id` text;--> statement-breakpoint
ALTER TABLE `plans` ADD `stripe_status` text;--> statement-breakpoint
ALTER TABLE `plans` ADD `paid_until` text;--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `terms_accepted_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `terms_version` text;--> statement-breakpoint
ALTER TABLE `users` ADD `stripe_customer_id` text;--> statement-breakpoint
UPDATE `users` SET `email_verified_at` = COALESCE(`created_at`, datetime('now')) WHERE `email_verified_at` IS NULL;--> statement-breakpoint
UPDATE `offers` SET `requires_prepayment` = CASE WHEN `price` IS NULL OR `price` >= 100 THEN 1 ELSE 0 END WHERE `requires_prepayment` IS NULL;--> statement-breakpoint
UPDATE `plans` SET `options_snapshot` = (SELECT json_group_array(json_object('template_id', pi.`template_id`, 'per_month', pi.`per_month`)) FROM `package_items` pi, json_each(`plans`.`options`) je WHERE pi.`id` = je.`value` AND pi.`optional` = 1) WHERE `options` IS NOT NULL AND `options_snapshot` IS NULL;--> statement-breakpoint
UPDATE `plans` SET `season_from` = (SELECT `active_from` FROM `packages` WHERE `id` = `plans`.`package_id`), `season_to` = (SELECT `active_to` FROM `packages` WHERE `id` = `plans`.`package_id`) WHERE `package_id` IS NOT NULL AND `season_from` IS NULL;
