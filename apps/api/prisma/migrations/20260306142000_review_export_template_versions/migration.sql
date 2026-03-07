-- CreateTable
CREATE TABLE `review_export_template_versions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `template_id` VARCHAR(64) NOT NULL,
    `owner_user_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `filters_json` JSON NOT NULL,
    `columns_json` JSON NOT NULL,
    `encoding` VARCHAR(191) NOT NULL DEFAULT 'utf-8',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `review_export_template_versions_template_id_created_at_idx`(`template_id`, `created_at`),
    INDEX `review_export_template_versions_owner_user_id_idx`(`owner_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `review_export_template_versions` ADD CONSTRAINT `review_export_template_versions_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `review_export_templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
