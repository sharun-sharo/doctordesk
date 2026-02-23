-- Add WhatsApp phone to users (for profile; used when sending messages to appointment patients)
ALTER TABLE `users`
  ADD COLUMN `whatsapp_phone` varchar(20) DEFAULT NULL COMMENT 'WhatsApp number for sending messages to patients' AFTER `phone`;
