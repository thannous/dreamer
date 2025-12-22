-- PHASE 2: Add chat quota enforcement trigger
--
-- VULNERABILITY FIXED: Endpoint /chat had ZERO quota enforcement
-- Users could send unlimited messages, causing infinite Gemini API costs
--
-- SOLUTION: Implement "claim before cost" pattern (same as exploration quota):
-- 1. User message is added to chat_history
-- 2. Trigger validates quota BEFORE update commits
-- 3. If quota exceeded, transaction rolls back with QUOTA_MESSAGE_LIMIT_REACHED error
-- 4. Client catches 429 and shows error to user
-- 5. Only after trigger passes, the message is persisted and Gemini is called

-- Function to count user messages in chat_history JSONB array
CREATE OR REPLACE FUNCTION public.count_user_messages(history jsonb)
RETURNS int
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::int, 0)
  FROM jsonb_array_elements(COALESCE(history, '[]'::jsonb)) AS msg
  WHERE msg->>'role' = 'user';
$$;
-- Main quota enforcement trigger for chat messages
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
  IF tier NOT IN ('free', 'guest') THEN
    tier := 'free';
  END IF;

  -- Fetch the per-dream message limit from quota_limits table
  SELECT q.quota_limit
  INTO message_limit
  FROM public.quota_limits q
  WHERE q.tier_name = tier
    AND q.period = 'monthly'
    AND q.quota_type = 'messages_per_dream';

  -- Fallback limits if not configured in DB
  IF message_limit IS NULL THEN
    message_limit := CASE WHEN tier = 'guest' THEN 10 WHEN tier = 'free' THEN 20 ELSE 20 END;
  END IF;

  -- Count user messages in old and new chat_history
  old_count := count_user_messages(OLD.chat_history);
  new_count := count_user_messages(NEW.chat_history);

  -- Check if quota would be exceeded
  IF new_count > message_limit THEN
    -- Acquire advisory lock to prevent race conditions
    lock_key := format('chat_quota:%s:%s', NEW.id::text, NEW.user_id::text);
    PERFORM pg_advisory_xact_lock(hashtextextended(lock_key, 0));

    -- Log the blocked quota event
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
      tier,
      old_count,
      new_count,
      message_limit,
      true,
      now()
    );

    -- Raise exception to abort the transaction
    RAISE EXCEPTION 'QUOTA_MESSAGE_LIMIT_REACHED: Tier "%" allows max % messages per dream, attempted %',
      tier, message_limit, new_count
      USING ERRCODE = 'P0001';
  END IF;

  -- Quota check passed - log successful event
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
    tier,
    old_count,
    new_count,
    message_limit,
    false,
    now()
  );

  RETURN NEW;
END;
$$;
-- Apply the trigger BEFORE updating chat_history to fail fast
DROP TRIGGER IF EXISTS trg_enforce_quota_for_chat ON public.dreams;
CREATE TRIGGER trg_enforce_quota_for_chat
  BEFORE UPDATE OF chat_history
  ON public.dreams
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quota_for_chat();
