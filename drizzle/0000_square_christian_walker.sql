CREATE TABLE `nexus_keepsakes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`game_id` text NOT NULL,
	`version` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_nexus_owner_game_updated` ON `nexus_keepsakes` (`owner`,`game_id`,`updated_at`);