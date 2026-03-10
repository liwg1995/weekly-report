ALTER TABLE `weekly_reports`
  ADD COLUMN `mention_leader` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `mention_comment` VARCHAR(255) NOT NULL DEFAULT '';
