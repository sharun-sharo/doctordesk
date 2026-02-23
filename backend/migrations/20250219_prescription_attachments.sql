-- Multiple attachments per prescription
CREATE TABLE IF NOT EXISTS prescription_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prescription_id INT NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  original_name VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
  INDEX idx_prescription_attachments_prescription_id (prescription_id)
);
