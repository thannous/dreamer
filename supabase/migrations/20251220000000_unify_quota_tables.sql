-- Migration: Unify quota tables for simplicity and performance
-- Consolidate user_quota_events and quota_events into single quota_usage table
--
-- CHANGES:
-- - Create quota_usage table (replaces user_quota_events and quota_events)
-- - Migrate data from user_quota_events
-- - Update triggers to use quota_usage
-- - Simplify enforce_quota_for_chat() - remove message logging
-- - Drop old tables and functions

-- Enable pgcrypto if needed
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- STEP 1: Create new unified quota_usage table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.quota_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    dream_id BIGINT,
    quota_type TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB DEFAULT NULL,

    CONSTRAINT quota_usage_quota_type_check
      CHECK (quota_type IN ('analysis', 'exploration'))
);

-- Indexes optimized for common queries
CREATE INDEX IF NOT EXISTS idx_quota_usage_user_type_time
  ON public.quota_usage(user_id, quota_type, occurred_at);

CREATE INDEX IF NOT EXISTS idx_quota_usage_dream
  ON public.quota_usage(dream_id);

-- Enable RLS
ALTER TABLE public.quota_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own quota usage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quota_usage'
      AND policyname = 'quota_usage_select_own'
  ) THEN
    CREATE POLICY quota_usage_select_own
      ON public.quota_usage
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- ============================================================================
-- STEP 2: Migrate data from user_quota_events to quota_usage
-- ============================================================================

INSERT INTO public.quota_usage (id, user_id, dream_id, quota_type, occurred_at, metadata)
SELECT id, user_id, dream_id, quota_type, occurred_at, NULL
FROM public.user_quota_events
ON CONFLICT DO NOTHING;

-- Note: We do NOT migrate quota_events because:
-- - Each chat message doesn't need to be logged (redundant with dreams.chat_history)
-- - Message count is calculated directly from chat_history JSON
-- - This reduces table growth and improves performance

-- ============================================================================
-- STEP 3: Update log_user_quota_event trigger function
-- ============================================================================

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
    INSERT INTO public.quota_usage (user_id, dream_id, quota_type, occurred_at)
    SELECT NEW.user_id, NEW.id, 'analysis', COALESCE(NEW.analyzed_at, now())
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.quota_usage e
      WHERE e.user_id = NEW.user_id
        AND e.dream_id = NEW.id
        AND e.quota_type = 'analysis'
    );
  END IF;

  -- Record exploration usage: one event per (user, dream)
  IF NEW.exploration_started_at IS NOT NULL THEN
    INSERT INTO public.quota_usage (user_id, dream_id, quota_type, occurred_at)
    SELECT NEW.user_id, NEW.id, 'exploration', COALESCE(NEW.exploration_started_at, now())
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.quota_usage e
      WHERE e.user_id = NEW.user_id
        AND e.dream_id = NEW.id
        AND e.quota_type = 'exploration'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 4: Update enforce_authenticated_monthly_quota trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_authenticated_monthly_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  tier text;
  period_start timestamptz;
  period_end timestamptz;
  used_count integer;
  lock_key text;
  exploration_limit integer;
  analysis_limit integer;
  occurred_at timestamptz;
BEGIN
  -- Only enforce for authenticated users
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow admin/service contexts (migrations, service-role operations)
  IF (select auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Tier is stored in app_metadata (admin-only)
  tier := COALESCE((select auth.jwt() -> 'app_metadata' ->> 'tier'), 'free');

  -- Fail closed: treat unknown tiers as free.
  IF tier NOT IN ('free', 'plus', 'premium') THEN
    tier := 'free';
  END IF;

  -- Enforce exploration quota on transition NULL -> NOT NULL
  IF (
    (TG_OP = 'INSERT' AND NEW.exploration_started_at IS NOT NULL)
    OR (TG_OP = 'UPDATE' AND OLD.exploration_started_at IS NULL AND NEW.exploration_started_at IS NOT NULL)
  ) THEN
    occurred_at := COALESCE(NEW.exploration_started_at, now());
    -- Monthly period in UTC based on when the exploration occurred
    period_start := (date_trunc('month', occurred_at at time zone 'utc') at time zone 'utc');
    period_end := ((date_trunc('month', occurred_at at time zone 'utc') + interval '1 month') at time zone 'utc');

    SELECT q.quota_limit
    INTO exploration_limit
    FROM public.quota_limits q
    WHERE q.tier = tier
      AND q.period = 'monthly'
      AND q.quota_type = 'exploration';

    IF NOT FOUND THEN
      exploration_limit := 2;
    END IF;

    -- NULL quota_limit means unlimited; skip enforcement.
    IF exploration_limit IS NOT NULL THEN
      lock_key := format('quota:exploration:%s:%s', NEW.user_id::text, to_char(period_start, 'YYYY-MM'));
      PERFORM pg_advisory_xact_lock(hashtextextended(lock_key, 0));

      SELECT count(*)
      INTO used_count
      FROM public.quota_usage e
      WHERE e.user_id = NEW.user_id
        AND e.quota_type = 'exploration'
        AND e.occurred_at >= period_start
        AND e.occurred_at < period_end;

      IF used_count >= exploration_limit THEN
        RAISE EXCEPTION 'QUOTA_EXPLORATION_LIMIT_REACHED' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  -- Enforce analysis quota on transition FALSE/NULL -> TRUE
  IF (
    (TG_OP = 'INSERT' AND NEW.is_analyzed IS TRUE)
    OR (TG_OP = 'UPDATE' AND COALESCE(OLD.is_analyzed, false) IS FALSE AND NEW.is_analyzed IS TRUE)
  ) THEN
    occurred_at := COALESCE(NEW.analyzed_at, now());
    -- Monthly period in UTC based on when the analysis occurred
    period_start := (date_trunc('month', occurred_at at time zone 'utc') at time zone 'utc');
    period_end := ((date_trunc('month', occurred_at at time zone 'utc') + interval '1 month') at time zone 'utc');

    SELECT q.quota_limit
    INTO analysis_limit
    FROM public.quota_limits q
    WHERE q.tier = tier
      AND q.period = 'monthly'
      AND q.quota_type = 'analysis';

    IF NOT FOUND THEN
      analysis_limit := 3;
    END IF;

    -- NULL quota_limit means unlimited; skip enforcement.
    IF analysis_limit IS NOT NULL THEN
      lock_key := format('quota:analysis:%s:%s', NEW.user_id::text, to_char(period_start, 'YYYY-MM'));
      PERFORM pg_advisory_xact_lock(hashtextextended(lock_key, 0));

      SELECT count(*)
      INTO used_count
      FROM public.quota_usage e
      WHERE e.user_id = NEW.user_id
        AND e.quota_type = 'analysis'
        AND e.occurred_at >= period_start
        AND e.occurred_at < period_end;

      IF used_count >= analysis_limit THEN
        RAISE EXCEPTION 'QUOTA_ANALYSIS_LIMIT_REACHED' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 5: Simplify enforce_quota_for_chat() - remove logging
-- ============================================================================
-- NOTE: This function no longer logs to quota_events.
-- It only enforces the quota. Message history is already in dreams.chat_history.

CREATE OR REPLACE FUNCTION public.enforce_quota_for_chat()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tier text;
  message_limit integer;
  new_count integer;
  old_count integer;
  lock_key text;
BEGIN
  -- Early return if chat_history hasn't changed
  IF OLD.chat_history IS NOT DISTINCT FROM NEW.chat_history THEN
    RETURN NEW;
  END IF;

  -- Ignore for guests (no user_id) - they're handled via client-side enforcement
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ignore if no authenticated user context (service-role operations, migrations)
  IF (select auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  -- ✅ CRITICAL: Read tier from app_metadata (admin-only, not client-modifiable)
  tier := COALESCE((select auth.jwt() -> 'app_metadata' ->> 'tier'), 'free');

  -- Premium users have unlimited messages - bypass quota check
  IF tier = 'premium' THEN
    RETURN NEW;
  END IF;

  -- Fail closed: treat unknown tiers as 'free'
  IF tier NOT IN ('free', 'plus', 'guest') THEN
    tier := 'free';
  END IF;

  -- Fetch the per-dream message limit from quota_limits table
  SELECT q.quota_limit
  INTO message_limit
  FROM public.quota_limits q
  WHERE q.tier = tier
    AND q.period = 'monthly'
    AND q.quota_type = 'messages_per_dream';

  -- Fallback limits if not configured in DB
  IF message_limit IS NULL THEN
    message_limit := CASE WHEN tier = 'guest' THEN 10 WHEN tier = 'free' THEN 20 WHEN tier = 'plus' THEN 20 ELSE 20 END;
  END IF;

  -- Count user messages in old and new chat_history
  old_count := COALESCE(
    (SELECT COUNT(*)::int FROM jsonb_array_elements(COALESCE(OLD.chat_history, '[]'::jsonb)) AS msg WHERE msg->>'role' = 'user'),
    0
  );

  new_count := COALESCE(
    (SELECT COUNT(*)::int FROM jsonb_array_elements(COALESCE(NEW.chat_history, '[]'::jsonb)) AS msg WHERE msg->>'role' = 'user'),
    0
  );

  -- Check if quota would be exceeded
  IF new_count > message_limit THEN
    -- Acquire advisory lock to prevent race conditions
    lock_key := format('chat_quota:%s:%s', NEW.id::text, NEW.user_id::text);
    PERFORM pg_advisory_xact_lock(hashtextextended(lock_key, 0));

    -- Raise exception to abort the transaction
    RAISE EXCEPTION 'QUOTA_MESSAGE_LIMIT_REACHED: Tier "%" allows max % messages per dream, attempted %',
      tier, message_limit, new_count
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 6: Verify trigger still exists and is properly configured
-- ============================================================================

DROP TRIGGER IF EXISTS trg_enforce_quota_for_chat ON public.dreams;
CREATE TRIGGER trg_enforce_quota_for_chat
  BEFORE UPDATE OF chat_history
  ON public.dreams
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quota_for_chat();

-- ============================================================================
-- STEP 7: Drop old tables and functions (CLEANUP)
-- ============================================================================

-- Drop the old logging table for chat quotas (no longer needed)
DROP TABLE IF EXISTS public.quota_events;

-- Drop the old quota events table (replaced by quota_usage)
DROP TABLE IF EXISTS public.user_quota_events;

-- Drop the old helper function (no longer used in triggers)
DROP FUNCTION IF EXISTS public.count_user_messages(jsonb);

-- ============================================================================
-- STEP 8: Add helpful comment to document the table
-- ============================================================================

COMMENT ON TABLE public.quota_usage IS 'Unified quota usage tracking. Records when users analyze/explore dreams. Per-dream message quota counts are derived from dreams.chat_history.';
COMMENT ON COLUMN public.quota_usage.quota_type IS 'Type of quota action: analysis, exploration';
COMMENT ON COLUMN public.quota_usage.metadata IS 'Optional JSON metadata for analytics (reserved for future use)';
