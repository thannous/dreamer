-- Make authenticated quota enforcement read limits from `public.quota_limits`.
-- Keeps DB enforcement aligned with UI quotas.

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
    SELECT q.quota_limit
    INTO exploration_limit
    FROM public.quota_limits q
    WHERE q.tier = tier
      AND q.period = 'monthly'
      AND q.quota_type = 'exploration';

    IF NOT FOUND THEN
      exploration_limit := 2;
    END IF;

    IF exploration_limit IS NOT NULL THEN
      lock_key := format('quota:exploration:%s:%s', NEW.user_id::text, to_char(period_start, 'YYYY-MM'));
      PERFORM pg_advisory_xact_lock(hashtextextended(lock_key, 0));

      SELECT count(*)
      INTO used_count
      FROM public.user_quota_events e
      WHERE e.user_id = NEW.user_id
        AND e.quota_type = 'exploration'
        AND e.occurred_at >= period_start
        AND e.occurred_at < period_end;

      IF used_count >= exploration_limit THEN
        RAISE EXCEPTION 'QUOTA_EXPLORATION_LIMIT_REACHED' USING ERRCODE = 'P0001';
      END IF;
    END IF;

    -- Normalize timestamp to server time to avoid backdating.
    NEW.exploration_started_at := now();
  END IF;

  -- Enforce analysis quota on transition FALSE/NULL -> TRUE
  IF (
    (TG_OP = 'INSERT' AND NEW.is_analyzed IS TRUE)
    OR (TG_OP = 'UPDATE' AND COALESCE(OLD.is_analyzed, false) IS FALSE AND NEW.is_analyzed IS TRUE)
  ) THEN
    SELECT q.quota_limit
    INTO analysis_limit
    FROM public.quota_limits q
    WHERE q.tier = tier
      AND q.period = 'monthly'
      AND q.quota_type = 'analysis';

    IF NOT FOUND THEN
      analysis_limit := 3;
    END IF;

    IF analysis_limit IS NOT NULL THEN
      lock_key := format('quota:analysis:%s:%s', NEW.user_id::text, to_char(period_start, 'YYYY-MM'));
      PERFORM pg_advisory_xact_lock(hashtextextended(lock_key, 0));

      SELECT count(*)
      INTO used_count
      FROM public.user_quota_events e
      WHERE e.user_id = NEW.user_id
        AND e.quota_type = 'analysis'
        AND e.occurred_at >= period_start
        AND e.occurred_at < period_end;

      IF used_count >= analysis_limit THEN
        RAISE EXCEPTION 'QUOTA_ANALYSIS_LIMIT_REACHED' USING ERRCODE = 'P0001';
      END IF;
    END IF;

    -- Normalize timestamp to server time to avoid backdating.
    NEW.analyzed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

