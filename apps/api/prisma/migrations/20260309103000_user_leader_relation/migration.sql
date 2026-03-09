ALTER TABLE `users`
  ADD COLUMN `leader_user_id` INTEGER NULL;

ALTER TABLE `users`
  ADD INDEX `users_leader_user_id_idx`(`leader_user_id`);

ALTER TABLE `users`
  ADD CONSTRAINT `users_leader_user_id_fkey`
  FOREIGN KEY (`leader_user_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
