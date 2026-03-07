ALTER TABLE `review_export_templates`
  ADD COLUMN `diff_export_mask_sensitive` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `review_export_template_versions`
  ADD COLUMN `diff_export_mask_sensitive` BOOLEAN NOT NULL DEFAULT true;
