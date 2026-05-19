-- Link standalone invoices to the treating doctor (appointments still use appointment_id → doctor_id).
ALTER TABLE `invoices`
  ADD COLUMN `doctor_id` int unsigned DEFAULT NULL AFTER `appointment_id`,
  ADD KEY `idx_inv_doctor` (`doctor_id`);

ALTER TABLE `invoices`
  ADD CONSTRAINT `fk_invoice_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
