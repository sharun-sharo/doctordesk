-- Add optional attachment to prescriptions (any file type)
ALTER TABLE `prescriptions`
  ADD COLUMN `attachment_path` varchar(500) DEFAULT NULL COMMENT 'Stored file path under uploads/' AFTER `notes`,
  ADD COLUMN `attachment_original_name` varchar(255) DEFAULT NULL COMMENT 'Original filename for download' AFTER `attachment_path`;
