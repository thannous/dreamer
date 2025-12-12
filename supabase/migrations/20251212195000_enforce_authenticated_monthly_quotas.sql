-- Enforce monthly quotas for authenticated users at the database level.
-- Prevents race conditions, stale caches, and client-side bypasses.

-- 1) Log quota events using server time (avoid client backdating).
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
    SELECT NEW.user_id, NEW.id, 'analysis', now()
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
    SELECT NEW.user_id, NEW.id, 'exploration', now()
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

-- 2) Enforce quotas when a dream becomes "explored" or "analyzed".
-- Uses an advisory lock to make concurrent requests for the same user/month serial.
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
BEGIN
  -- Only enforce for authenticated users
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow admin/service contexts (migrations, service-role operations)
  IF (select auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Default tier to free if missing
  tier := COALESCE((select auth.jwt() -> 'user_metadata' ->> 'tier'), 'free');
  IF tier = 'premium' THEN
    RETURN NEW;
  END IF;

  -- Fail closed: treat unknown tiers as free (except premium).
  IF tier <> 'free' THEN
    tier := 'free';
  END IF;

  -- Monthly period in UTC
  period_start := (date_trunc('month', now() at time zone 'utc') at time zone 'utc');
  period_end := ((date_trunc('month', now() at time zone 'utc') + interval '1 month') at time zone 'utc');

  -- Enforce exploration quota on transition NULL -> NOT NULL
  IF (
    (TG_OP = 'INSERT' AND NEW.exploration_started_at IS NOT NULL)
    OR (TG_OP = 'UPDATE' AND OLD.exploration_started_at IS NULL AND NEW.exploration_started_at IS NOT NULL)
  ) THEN
    lock_key := format('quota:exploration:%s:%s', NEW.user_id::text, to_char(period_start, 'YYYY-MM'));
    PERFORM pg_advisory_xact_lock(hashtextextended(lock_key, 0));

    SELECT count(*)
    INTO used_count
    FROM public.user_quota_events e
    WHERE e.user_id = NEW.user_id
      AND e.quota_type = 'exploration'
      AND e.occurred_at >= period_start
      AND e.occurred_at < period_end;

    IF used_count >= 2 THEN
      RAISE EXCEPTION 'QUOTA_EXPLORATION_LIMIT_REACHED' USING ERRCODE = 'P0001';
    END IF;

    -- Normalize timestamp to server time to avoid backdating.
    NEW.exploration_started_at := now();
  END IF;

  -- Enforce analysis quota on transition FALSE/NULL -> TRUE
  IF (
    (TG_OP = 'INSERT' AND NEW.is_analyzed IS TRUE)
    OR (TG_OP = 'UPDATE' AND COALESCE(OLD.is_analyzed, false) IS FALSE AND NEW.is_analyzed IS TRUE)
  ) THEN
    lock_key := format('quota:analysis:%s:%s', NEW.user_id::text, to_char(period_start, 'YYYY-MM'));
    PERFORM pg_advisory_xact_lock(hashtextextended(lock_key, 0));

    SELECT count(*)
    INTO used_count
    FROM public.user_quota_events e
    WHERE e.user_id = NEW.user_id
      AND e.quota_type = 'analysis'
      AND e.occurred_at >= period_start
      AND e.occurred_at < period_end;

    IF used_count >= 3 THEN
      RAISE EXCEPTION 'QUOTA_ANALYSIS_LIMIT_REACHED' USING ERRCODE = 'P0001';
    END IF;

    -- Normalize timestamp to server time to avoid backdating.
    NEW.analyzed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_authenticated_monthly_quota ON public.dreams;

CREATE TRIGGER trg_enforce_authenticated_monthly_quota
BEFORE INSERT OR UPDATE OF is_analyzed, analyzed_at, exploration_started_at
ON public.dreams
FOR EACH ROW
EXECUTE FUNCTION public.enforce_authenticated_monthly_quota();
