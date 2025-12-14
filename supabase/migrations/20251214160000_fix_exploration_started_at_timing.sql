-- Fix exploration_started_at to only be set when AI responds (first model message)
-- Previously it was set when the user sent the first message, causing quota to be consumed
-- even if the AI call failed.

-- This migration changes the trigger logic to detect the FIRST MODEL MESSAGE (AI response)
-- instead of the first USER message. This ensures exploration_started_at is only set
-- when the AI has actually engaged with the dream.

CREATE OR REPLACE FUNCTION public.set_exploration_started_at_from_chat_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Skip if already set
  IF NEW.exploration_started_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if no chat history
  IF NEW.chat_history IS NULL THEN
    RETURN NEW;
  END IF;

  -- Detect first MODEL message (AI response)
  -- This ensures exploration_started_at is only set when AI has actually responded
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(NEW.chat_history) elem
    WHERE elem->>'role' = 'model'
  ) THEN
    -- On INSERT: set if there's a model message
    IF TG_OP = 'INSERT' THEN
      NEW.exploration_started_at := now();
      RETURN NEW;
    END IF;

    -- On UPDATE: set if there was no model message before
    IF TG_OP = 'UPDATE' THEN
      IF OLD.chat_history IS NULL OR NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(OLD.chat_history) elem
        WHERE elem->>'role' = 'model'
      ) THEN
        NEW.exploration_started_at := now();
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- No need to recreate the trigger, just replace the function
-- The trigger trg_00_set_exploration_started_at_from_chat_history will continue to use this function
