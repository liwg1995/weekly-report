-- Add optimistic concurrency version columns for performance config entities
ALTER TABLE `performance_cycles`
ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;

ALTER TABLE `performance_dimensions`
ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;
