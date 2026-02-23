-- Add assigned_admin_id to users (receptionist -> admin assignment)
-- Run this if your users table already exists.

ALTER TABLE `users`
  ADD COLUMN `assigned_admin_id` int unsigned DEFAULT NULL COMMENT 'For receptionists: the admin (doctor) they are assigned to' AFTER `role_id`,
  ADD KEY `idx_users_assigned_admin` (`assigned_admin_id`),
  ADD CONSTRAINT `fk_users_assigned_admin` FOREIGN KEY (`assigned_admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
