-- Run this if login returns 500 and you already imported schema.sql
-- Fix: refresh_tokens.token was varchar(500), JWT can be longer
ALTER TABLE refresh_tokens MODIFY COLUMN token TEXT NOT NULL;
