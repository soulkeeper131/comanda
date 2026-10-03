ALTER TABLE `invoices` ADD `credit_for` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `buyer_name` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `buyer_email` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `buyer_company` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `buyer_eik` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `buyer_vat` text;--> statement-breakpoint
UPDATE `invoices` SET `number` = `number` || '-' || substr(`id`, 1, 4) WHERE rowid NOT IN (SELECT min(rowid) FROM `invoices` GROUP BY `number`);--> statement-breakpoint
UPDATE `invoices` SET `payment_id` = NULL WHERE `payment_id` IS NOT NULL AND rowid NOT IN (SELECT min(rowid) FROM `invoices` WHERE `payment_id` IS NOT NULL GROUP BY `payment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number_idx` ON `invoices` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_payment_idx` ON `invoices` (`payment_id`);--> statement-breakpoint
ALTER TABLE `payments` ADD `plan_id` text REFERENCES plans(id);--> statement-breakpoint
ALTER TABLE `plans` ADD `stripe_checkout_session_id` text;