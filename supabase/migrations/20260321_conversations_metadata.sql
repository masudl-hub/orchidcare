-- Add metadata column to conversations for rich content persistence.
-- Stores: images, shopping results, confirmation state, etc.
-- Existing rows have metadata = NULL and render as plain text.

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;
