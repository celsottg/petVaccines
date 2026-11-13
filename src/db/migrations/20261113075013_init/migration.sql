CREATE TABLE `attachments` (
	`id` text PRIMARY KEY,
	`vaccination_id` text NOT NULL,
	`file` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_attachments_vaccination_id_vaccinations_id_fk` FOREIGN KEY (`vaccination_id`) REFERENCES `vaccinations`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `pets` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`species` text NOT NULL,
	`breed` text,
	`sex` text,
	`birth_on` text,
	`photo_file` text,
	`status` text DEFAULT 'active' NOT NULL,
	`archived_reason` text,
	`archived_on` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `vaccinations` (
	`id` text PRIMARY KEY,
	`pet_id` text NOT NULL,
	`catalog_id` text,
	`vaccine_name` text NOT NULL,
	`applied_on` text NOT NULL,
	`next_due_on` text,
	`batch` text,
	`brand` text,
	`vet_name` text,
	`vet_license` text,
	`clinic` text,
	`notes` text,
	`reminders_enabled` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_vaccinations_pet_id_pets_id_fk` FOREIGN KEY (`pet_id`) REFERENCES `pets`(`id`) ON DELETE CASCADE
);
