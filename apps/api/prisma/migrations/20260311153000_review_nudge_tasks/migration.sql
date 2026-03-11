CREATE TABLE `review_nudge_tasks` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `creator_user_id` INTEGER NOT NULL,
  `level` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  `channel` VARCHAR(32) NOT NULL DEFAULT 'LOCAL_PLACEHOLDER',
  `message` VARCHAR(255) NOT NULL,
  `target_count` INTEGER NOT NULL DEFAULT 0,
  `target_ids_json` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `review_nudge_tasks_creator_user_id_created_at_idx`(`creator_user_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `review_nudge_tasks`
  ADD CONSTRAINT `review_nudge_tasks_creator_user_id_fkey`
  FOREIGN KEY (`creator_user_id`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
