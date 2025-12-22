-- Migration: Add guest image quota tracking

ALTER TABLE public.guest_usage
  ADD COLUMN IF NOT EXISTS image_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.guest_usage
  ADD CONSTRAINT guest_usage_image_count_non_negative
  CHECK (image_count >= 0);

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
    v_image_count INTEGER := 0;
    v_is_upgraded BOOLEAN := false;
BEGIN
    SELECT analysis_count, exploration_count, image_count, is_upgraded
    INTO v_analysis_count, v_exploration_count, v_image_count, v_is_upgraded
    FROM public.guest_usage
    WHERE fingerprint_hash = p_fingerprint;

    RETURN json_build_object(
        'analysis_count', COALESCE(v_analysis_count, 0),
        'exploration_count', COALESCE(v_exploration_count, 0),
        'image_count', COALESCE(v_image_count, 0),
        'is_upgraded', COALESCE(v_is_upgraded, false)
    );
END;
$$;

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
    v_image_count INTEGER := 0;
    v_current INTEGER := 0;
    v_allowed BOOLEAN := false;
    v_is_upgraded BOOLEAN := false;
BEGIN
    IF p_quota_type NOT IN ('analysis', 'exploration', 'image') THEN
        RAISE EXCEPTION 'Invalid quota_type: %. Must be analysis, exploration, or image', p_quota_type;
    END IF;

    INSERT INTO public.guest_usage (fingerprint_hash)
    VALUES (p_fingerprint)
    ON CONFLICT (fingerprint_hash) DO NOTHING;

    SELECT analysis_count, exploration_count, image_count, is_upgraded
    INTO v_analysis_count, v_exploration_count, v_image_count, v_is_upgraded
    FROM public.guest_usage
    WHERE fingerprint_hash = p_fingerprint
    FOR UPDATE;

    IF p_quota_type = 'analysis' THEN
        v_current := v_analysis_count;
    ELSIF p_quota_type = 'exploration' THEN
        v_current := v_exploration_count;
    ELSE
        v_current := v_image_count;
    END IF;

    IF v_is_upgraded THEN
        RETURN json_build_object('allowed', false, 'new_count', COALESCE(v_current, 0), 'is_upgraded', true);
    END IF;

    v_allowed := v_current < p_limit;
    IF v_allowed THEN
        IF p_quota_type = 'analysis' THEN
            UPDATE public.guest_usage
            SET analysis_count = analysis_count + 1, last_seen_at = now()
            WHERE fingerprint_hash = p_fingerprint;
            v_current := v_current + 1;
        ELSIF p_quota_type = 'exploration' THEN
            UPDATE public.guest_usage
            SET exploration_count = exploration_count + 1, last_seen_at = now()
            WHERE fingerprint_hash = p_fingerprint;
            v_current := v_current + 1;
        ELSE
            UPDATE public.guest_usage
            SET image_count = image_count + 1, last_seen_at = now()
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
