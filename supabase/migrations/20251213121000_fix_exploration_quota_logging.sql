-- Fix missing exploration quota tracking:
-- - Ensure exploration_started_at is set server-side when chat_history gets first user message.
-- - Ensure enforcement trigger runs on all updates (including chat_history-only updates).
-- - Log quota events using server time to prevent client backdating.

-- 1) Log quota events using server time (anti-backdating).
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

-- 2) Auto-set exploration_started_at from chat_history.
CREATE OR REPLACE FUNCTION public.set_exploration_started_at_from_chat_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.exploration_started_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.chat_history IS NULL THEN
    RETURN NEW;
  END IF;

  -- Detect first user message.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(NEW.chat_history) elem
    WHERE elem->>'role' = 'user'
  ) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.exploration_started_at := now();
      RETURN NEW;
    END IF;

    IF OLD.chat_history IS NULL OR NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(OLD.chat_history) elem
      WHERE elem->>'role' = 'user'
    ) THEN
      NEW.exploration_started_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_00_set_exploration_started_at_from_chat_history ON public.dreams;
CREATE TRIGGER trg_00_set_exploration_started_at_from_chat_history
BEFORE INSERT OR UPDATE OF chat_history
ON public.dreams
FOR EACH ROW
EXECUTE FUNCTION public.set_exploration_started_at_from_chat_history();

-- 3) Ensure enforcement runs even when exploration_started_at is set by another trigger.
DROP TRIGGER IF EXISTS trg_10_enforce_authenticated_monthly_quota ON public.dreams;
CREATE TRIGGER trg_10_enforce_authenticated_monthly_quota
BEFORE INSERT OR UPDATE
ON public.dreams
FOR EACH ROW
EXECUTE FUNCTION public.enforce_authenticated_monthly_quota();

