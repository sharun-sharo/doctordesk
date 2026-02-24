-- Add Assistant doctor role (same functionality as receptionist)
-- Run this if your roles table already exists and you need to add role 5.
INSERT IGNORE INTO `roles` (`id`, `name`, `description`) VALUES
(5, 'assistant_doctor', 'Assistant doctor - same as receptionist');
