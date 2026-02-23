-- Add subscriptions table (run this if you already have a database and don't want to re-run full schema)
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `doctor_id` int unsigned NOT NULL COMMENT 'user id (admin or doctor role)',
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00 COMMENT 'monthly subscription amount paid',
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_subscriptions_doctor` (`doctor_id`),
  KEY `idx_subscriptions_end` (`end_date`),
  CONSTRAINT `fk_subscriptions_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
