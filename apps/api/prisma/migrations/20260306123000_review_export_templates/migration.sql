-- CreateTable
CREATE TABLE `review_export_templates` (
    `id` VARCHAR(64) NOT NULL,
    `owner_user_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `filters_json` JSON NOT NULL,
    `columns_json` JSON NOT NULL,
    `encoding` VARCHAR(191) NOT NULL DEFAULT 'utf-8',
    `created_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `review_export_templates_owner_user_id_name_key`(`owner_user_id`, `name`),
    INDEX `review_export_templates_owner_user_id_idx`(`owner_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `review_export_templates` ADD CONSTRAINT `review_export_templates_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
