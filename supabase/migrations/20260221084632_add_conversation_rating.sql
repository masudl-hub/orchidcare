-- Add rating column to conversations table to track thumbs up / thumbs down feedback
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS rating integer DEFAULT 0;
