-- Fix Postgres error: column reference "tier" is ambiguous
--
-- Symptoms in app:
-- - "Failed to sync offline mutation [Error: column reference \"tier\" is ambiguous]"
--
-- Root cause:
-- - In PL/pgSQL trigger functions, a local variable named `tier` conflicts with table columns named `tier`
--   (e.g. `public.quota_limits.tier`). Depending on `plpgsql.variable_conflict`, statements like
--   `WHERE q.tier = tier` can be interpreted as ambiguous.
--
-- Fix:
-- - Rename the PL/pgSQL variable to `tier_value` in quota enforcement triggers.

CREATE OR REPLACE FUNCTION public.enforce_authenticated_monthly_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  tier_value text;
  period_start timestamptz;
  period_end timestamptz;
  used_count integer;
  lock_key text;
  exploration_limit integer;
  analysis_limit integer;
  occurred_at timestamptz;
  has_quota_usage boolean;
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
  tier_value := COALESCE((select auth.jwt() -> 'app_metadata' ->> 'tier'), 'free');

  -- Fail closed: treat unknown tiers as free.
  IF tier_value NOT IN ('free', 'plus', 'premium') THEN
    tier_value := 'free';
  END IF;

  -- Support both schemas:
  -- - pre-unification: public.user_quota_events
  -- - post-unification: public.quota_usage
  has_quota_usage := to_regclass('public.quota_usage') IS NOT NULL;

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
    WHERE q.tier = tier_value
      AND q.period = 'monthly'
      AND q.quota_type = 'exploration';

    IF NOT FOUND THEN
      exploration_limit := 2;
    END IF;

    -- NULL quota_limit means unlimited; skip enforcement.
    IF exploration_limit IS NOT NULL THEN
      lock_key := format('quota:exploration:%s:%s', NEW.user_id::text, to_char(period_start, 'YYYY-MM'));
      PERFORM pg_advisory_xact_lock(hashtextextended(lock_key, 0));

      IF has_quota_usage THEN
        SELECT count(*)
        INTO used_count
        FROM public.quota_usage e
        WHERE e.user_id = NEW.user_id
          AND e.quota_type = 'exploration'
          AND e.occurred_at >= period_start
          AND e.occurred_at < period_end;
      ELSE
        SELECT count(*)
        INTO used_count
        FROM public.user_quota_events e
        WHERE e.user_id = NEW.user_id
          AND e.quota_type = 'exploration'
          AND e.occurred_at >= period_start
          AND e.occurred_at < period_end;
      END IF;

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
    WHERE q.tier = tier_value
      AND q.period = 'monthly'
      AND q.quota_type = 'analysis';

    IF NOT FOUND THEN
      analysis_limit := 3;
    END IF;

    -- NULL quota_limit means unlimited; skip enforcement.
    IF analysis_limit IS NOT NULL THEN
      lock_key := format('quota:analysis:%s:%s', NEW.user_id::text, to_char(period_start, 'YYYY-MM'));
      PERFORM pg_advisory_xact_lock(hashtextextended(lock_key, 0));

      IF has_quota_usage THEN
        SELECT count(*)
        INTO used_count
        FROM public.quota_usage e
        WHERE e.user_id = NEW.user_id
          AND e.quota_type = 'analysis'
          AND e.occurred_at >= period_start
          AND e.occurred_at < period_end;
      ELSE
        SELECT count(*)
        INTO used_count
        FROM public.user_quota_events e
        WHERE e.user_id = NEW.user_id
          AND e.quota_type = 'analysis'
          AND e.occurred_at >= period_start
          AND e.occurred_at < period_end;
      END IF;

      IF used_count >= analysis_limit THEN
        RAISE EXCEPTION 'QUOTA_ANALYSIS_LIMIT_REACHED' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.enforce_quota_for_chat()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tier_value text;
  message_limit integer;
  new_count integer;
  old_count integer;
  lock_key text;
  has_quota_events boolean;
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

  -- Tier is stored in app_metadata (admin-only)
  tier_value := COALESCE((select auth.jwt() -> 'app_metadata' ->> 'tier'), 'free');

  -- Fail closed: treat unknown tiers as free.
  IF tier_value NOT IN ('free', 'plus', 'premium') THEN
    tier_value := 'free';
  END IF;

  -- Fetch the per-dream message limit from quota_limits table.
  -- If a tier has a NULL limit, it is unlimited.
  SELECT q.quota_limit
  INTO message_limit
  FROM public.quota_limits q
  WHERE q.tier = tier_value
    AND q.period = 'monthly'
    AND q.quota_type = 'messages_per_dream';

  IF NOT FOUND THEN
    message_limit := 20;
  ELSIF message_limit IS NULL THEN
    -- Unlimited
    RETURN NEW;
  END IF;

  -- Count user messages in old and new chat_history
  old_count := COALESCE(
    (SELECT COUNT(*)::int
     FROM jsonb_array_elements(COALESCE(OLD.chat_history, '[]'::jsonb)) AS msg
     WHERE msg->>'role' = 'user'),
    0
  );

  new_count := COALESCE(
    (SELECT COUNT(*)::int
     FROM jsonb_array_elements(COALESCE(NEW.chat_history, '[]'::jsonb)) AS msg
     WHERE msg->>'role' = 'user'),
    0
  );

  -- Check if quota would be exceeded
  IF new_count > message_limit THEN
    -- Acquire advisory lock to prevent race conditions
    lock_key := format('chat_quota:%s:%s', NEW.id::text, NEW.user_id::text);
    PERFORM pg_advisory_xact_lock(hashtextextended(lock_key, 0));

    -- Optional logging (only if the table exists)
    has_quota_events := to_regclass('public.quota_events') IS NOT NULL;
    IF has_quota_events THEN
      INSERT INTO public.quota_events (
        user_id,
        dream_id,
        quota_type,
        tier,
        count_before,
        count_after,
        limit_value,
        blocked,
        created_at
      ) VALUES (
        NEW.user_id,
        NEW.id,
        'chat_message',
        tier_value,
        old_count,
        new_count,
        message_limit,
        true,
        now()
      );
    END IF;

    -- Raise exception to abort the transaction
    RAISE EXCEPTION 'QUOTA_MESSAGE_LIMIT_REACHED: Tier \"%\" allows max % messages per dream, attempted %',
      tier_value, message_limit, new_count
      USING ERRCODE = 'P0001';
  END IF;

  -- Optional logging (only if the table exists)
  has_quota_events := to_regclass('public.quota_events') IS NOT NULL;
  IF has_quota_events THEN
    INSERT INTO public.quota_events (
      user_id,
      dream_id,
      quota_type,
      tier,
      count_before,
      count_after,
      limit_value,
      blocked,
      created_at
    ) VALUES (
      NEW.user_id,
      NEW.id,
      'chat_message',
      tier_value,
      old_count,
      new_count,
      message_limit,
      false,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;
