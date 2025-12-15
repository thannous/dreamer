-- Migration: Create quota_events table for chat message quota logging
-- This table tracks all chat message quota enforcement events, both successful and blocked.
-- Referenced by triggers in: 20251214000002_add_chat_quota_trigger.sql

-- Enable pgcrypto for UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Table to track chat message quota enforcement events
CREATE TABLE IF NOT EXISTS public.quota_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    dream_id BIGINT,
    quota_type TEXT NOT NULL,
    tier TEXT NOT NULL,
    count_before INTEGER NOT NULL,
    count_after INTEGER NOT NULL,
    limit_value INTEGER NOT NULL,
    blocked BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT quota_events_quota_type_check CHECK (quota_type IN ('chat_message'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_quota_events_user_id
  ON public.quota_events(user_id);

CREATE INDEX IF NOT EXISTS idx_quota_events_dream_id
  ON public.quota_events(dream_id);

CREATE INDEX IF NOT EXISTS idx_quota_events_created_at
  ON public.quota_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quota_events_blocked
  ON public.quota_events(blocked);

-- Composite index for common queries (user's blocked events over time)
CREATE INDEX IF NOT EXISTS idx_quota_events_user_blocked_time
  ON public.quota_events(user_id, blocked, created_at DESC);

-- Enable RLS and restrict direct reads to the owning user
ALTER TABLE public.quota_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own quota events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quota_events'
      AND policyname = 'user_can_select_own_quota_events'
  ) THEN
    CREATE POLICY user_can_select_own_quota_events
      ON public.quota_events
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- NOTE: No INSERT/UPDATE policies needed - the trigger function that writes to this table
-- uses SECURITY DEFINER, allowing it to bypass RLS. This ensures quota enforcement
-- cannot be bypassed by users.
