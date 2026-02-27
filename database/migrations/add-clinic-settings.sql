-- Billing page: business details on invoice (address, phone, email, gstin)
-- Run this migration in production if clinic_settings table is missing.

CREATE TABLE IF NOT EXISTS `clinic_settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `address` text,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `gstin` varchar(50) DEFAULT NULL COMMENT 'GST number (optional)',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default row for single-clinic config (id=1). Safe to run multiple times.
INSERT IGNORE INTO `clinic_settings` (`id`) VALUES (1);
