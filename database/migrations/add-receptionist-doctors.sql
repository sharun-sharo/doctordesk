-- Receptionist can be assigned to multiple doctors (replacement for single assigned_admin_id)
-- Keep users.assigned_admin_id for backward compat (set to first assigned doctor)

CREATE TABLE IF NOT EXISTS `receptionist_doctors` (
  `receptionist_id` int unsigned NOT NULL,
  `doctor_id` int unsigned NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`receptionist_id`, `doctor_id`),
  KEY `idx_receptionist_doctors_doctor` (`doctor_id`),
  CONSTRAINT `fk_rd_receptionist` FOREIGN KEY (`receptionist_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_rd_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill: one row per receptionist who has assigned_admin_id
INSERT IGNORE INTO `receptionist_doctors` (`receptionist_id`, `doctor_id`)
SELECT u.id, u.assigned_admin_id
FROM users u
WHERE u.assigned_admin_id IS NOT NULL AND u.role_id = 4;
