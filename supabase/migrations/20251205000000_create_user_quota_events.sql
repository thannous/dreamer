-- Migration: Track authenticated user quota usage independently of dream deletion
-- This introduces a per-user quota events table so that deleting dreams
-- does not reset analysis/exploration credits.

-- Enable pgcrypto for UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Table to track authenticated user quota usage events
CREATE TABLE IF NOT EXISTS public.user_quota_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    dream_id BIGINT,
    quota_type TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_quota_events_quota_type_check CHECK (quota_type IN ('analysis', 'exploration'))
);

-- Indexes for efficient queries by user, type and time
CREATE INDEX IF NOT EXISTS idx_user_quota_events_user_type_time
  ON public.user_quota_events(user_id, quota_type, occurred_at);

CREATE INDEX IF NOT EXISTS idx_user_quota_events_dream
  ON public.user_quota_events(dream_id);

-- Enable RLS and restrict direct reads to the owning user
ALTER TABLE public.user_quota_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_quota_events'
      AND policyname = 'user_can_select_own_quota_events'
  ) THEN
    CREATE POLICY user_can_select_own_quota_events
      ON public.user_quota_events
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Helper function: log quota usage when dreams are analyzed or explored.
-- SECURITY DEFINER so that it can write to user_quota_events from triggers
-- even with RLS enabled on the events table.
CREATE OR REPLACE FUNCTION public.log_user_quota_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only track authenticated users (skip guests without user_id)
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Record analysis usage: one event per (user, dream)
  IF NEW.is_analyzed IS TRUE THEN
    INSERT INTO public.user_quota_events (user_id, dream_id, quota_type, occurred_at)
    SELECT NEW.user_id, NEW.id, 'analysis', COALESCE(NEW.analyzed_at, now())
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_quota_events e
      WHERE e.user_id = NEW.user_id
        AND e.dream_id = NEW.id
        AND e.quota_type = 'analysis'
    );
  END IF;

  -- Record exploration usage: one event per (user, dream)
  IF NEW.exploration_started_at IS NOT NULL THEN
    INSERT INTO public.user_quota_events (user_id, dream_id, quota_type, occurred_at)
    SELECT NEW.user_id, NEW.id, 'exploration', COALESCE(NEW.exploration_started_at, now())
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_quota_events e
      WHERE e.user_id = NEW.user_id
        AND e.dream_id = NEW.id
        AND e.quota_type = 'exploration'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on dreams to log usage events whenever analysis or exploration is set.
DROP TRIGGER IF EXISTS trg_log_quota_event_on_dreams ON public.dreams;

CREATE TRIGGER trg_log_quota_event_on_dreams
AFTER INSERT OR UPDATE OF is_analyzed, analyzed_at, exploration_started_at
ON public.dreams
FOR EACH ROW
EXECUTE FUNCTION public.log_user_quota_event();

-- Backfill existing analyzed/explored dreams into user_quota_events.
-- This keeps current quotas consistent while ensuring future deletions
-- do not reduce usage counts.
INSERT INTO public.user_quota_events (user_id, dream_id, quota_type, occurred_at)
SELECT d.user_id,
       d.id,
       'analysis' AS quota_type,
       COALESCE(d.analyzed_at, d.created_at, now()) AS occurred_at
FROM public.dreams d
WHERE d.user_id IS NOT NULL
  AND d.is_analyzed IS TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_quota_events e
    WHERE e.user_id = d.user_id
      AND e.dream_id = d.id
      AND e.quota_type = 'analysis'
  );

INSERT INTO public.user_quota_events (user_id, dream_id, quota_type, occurred_at)
SELECT d.user_id,
       d.id,
       'exploration' AS quota_type,
       COALESCE(d.exploration_started_at, d.created_at, now()) AS occurred_at
FROM public.dreams d
WHERE d.user_id IS NOT NULL
  AND d.exploration_started_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_quota_events e
    WHERE e.user_id = d.user_id
      AND e.dream_id = d.id
      AND e.quota_type = 'exploration'
  );

