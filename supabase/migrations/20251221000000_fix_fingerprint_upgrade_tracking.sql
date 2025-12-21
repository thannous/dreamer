-- Migration: Fix fingerprint upgrade tracking (missing columns/functions)
-- Ensures guest_usage has upgrade fields and RPCs exist for /auth/mark-upgrade

-- Add missing columns for upgrade tracking
ALTER TABLE public.guest_usage
  ADD COLUMN IF NOT EXISTS is_upgraded BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.guest_usage
  ADD COLUMN IF NOT EXISTS upgraded_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.guest_usage
  ADD COLUMN IF NOT EXISTS upgraded_at TIMESTAMPTZ;

-- Indexes for upgrade tracking
CREATE INDEX IF NOT EXISTS idx_guest_usage_is_upgraded
  ON public.guest_usage(is_upgraded);

CREATE INDEX IF NOT EXISTS idx_guest_usage_upgraded_user_id
  ON public.guest_usage(upgraded_user_id);

-- Update quota status function to include upgrade flag
CREATE OR REPLACE FUNCTION public.get_guest_quota_status(
    p_fingerprint TEXT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_analysis_count INTEGER := 0;
    v_exploration_count INTEGER := 0;
    v_is_upgraded BOOLEAN := false;
BEGIN
    SELECT analysis_count, exploration_count, is_upgraded
    INTO v_analysis_count, v_exploration_count, v_is_upgraded
    FROM public.guest_usage
    WHERE fingerprint_hash = p_fingerprint;

    RETURN json_build_object(
        'analysis_count', COALESCE(v_analysis_count, 0),
        'exploration_count', COALESCE(v_exploration_count, 0),
        'is_upgraded', COALESCE(v_is_upgraded, false)
    );
END;
$$;

-- RPC to mark a fingerprint as upgraded after signup/login
CREATE OR REPLACE FUNCTION public.mark_fingerprint_upgraded(
    p_fingerprint TEXT,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.guest_usage (fingerprint_hash, is_upgraded, upgraded_user_id, upgraded_at)
    VALUES (p_fingerprint, true, p_user_id, now())
    ON CONFLICT (fingerprint_hash)
    DO UPDATE SET
        is_upgraded = true,
        upgraded_user_id = p_user_id,
        upgraded_at = now();

    RETURN true;
END;
$$;

-- Ensure guest quota increments are blocked for upgraded fingerprints
CREATE OR REPLACE FUNCTION public.increment_guest_quota(
    p_fingerprint TEXT,
    p_quota_type TEXT,
    p_limit INTEGER
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_analysis_count INTEGER := 0;
    v_exploration_count INTEGER := 0;
    v_current INTEGER := 0;
    v_allowed BOOLEAN := false;
    v_is_upgraded BOOLEAN := false;
BEGIN
    IF p_quota_type NOT IN ('analysis', 'exploration') THEN
        RAISE EXCEPTION 'Invalid quota_type: %. Must be analysis or exploration', p_quota_type;
    END IF;

    INSERT INTO public.guest_usage (fingerprint_hash)
    VALUES (p_fingerprint)
    ON CONFLICT (fingerprint_hash) DO NOTHING;

    SELECT analysis_count, exploration_count, is_upgraded
    INTO v_analysis_count, v_exploration_count, v_is_upgraded
    FROM public.guest_usage
    WHERE fingerprint_hash = p_fingerprint
    FOR UPDATE;

    IF p_quota_type = 'analysis' THEN
        v_current := v_analysis_count;
    ELSE
        v_current := v_exploration_count;
    END IF;

    IF v_is_upgraded THEN
        RETURN json_build_object('allowed', false, 'new_count', COALESCE(v_current, 0), 'is_upgraded', true);
    END IF;

    IF p_quota_type = 'analysis' THEN
        v_allowed := v_current < p_limit;
        IF v_allowed THEN
            UPDATE public.guest_usage
            SET analysis_count = analysis_count + 1, last_seen_at = now()
            WHERE fingerprint_hash = p_fingerprint;
            v_current := v_current + 1;
        END IF;
    ELSIF p_quota_type = 'exploration' THEN
        v_allowed := v_current < p_limit;
        IF v_allowed THEN
            UPDATE public.guest_usage
            SET exploration_count = exploration_count + 1, last_seen_at = now()
            WHERE fingerprint_hash = p_fingerprint;
            v_current := v_current + 1;
        END IF;
    END IF;

    RETURN json_build_object(
        'allowed', v_allowed,
        'new_count', COALESCE(v_current, 0),
        'is_upgraded', v_is_upgraded
    );
END;
$$;
