-- Migration: Add has_person and has_animal columns to dreams table
-- Created: 2025-12-18
-- Purpose: Track whether dreams contain people or animals for filtering and statistics

-- has_person: TRUE if the dream contains people/characters, FALSE if not, NULL if not yet categorized
-- has_animal: TRUE if the dream contains animals, FALSE if not, NULL if not yet categorized
-- NULL default allows lazy backfill: existing dreams remain NULL until re-analyzed

ALTER TABLE IF EXISTS public.dreams
ADD COLUMN IF NOT EXISTS has_person BOOLEAN DEFAULT NULL;
ALTER TABLE IF EXISTS public.dreams
ADD COLUMN IF NOT EXISTS has_animal BOOLEAN DEFAULT NULL;
COMMENT ON COLUMN public.dreams.has_person IS 'Whether the dream contains people or characters. NULL means not yet categorized.';
COMMENT ON COLUMN public.dreams.has_animal IS 'Whether the dream contains animals. NULL means not yet categorized.';
