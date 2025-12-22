-- Migration: Create guest_usage table for tracking guest quota by fingerprint
-- This prevents the quota bypass vulnerability where guests could delete dreams to reset quota

-- Activer pgcrypto si pas déjà fait
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Table pour tracker l'usage des invités par fingerprint
CREATE TABLE IF NOT EXISTS public.guest_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint_hash TEXT NOT NULL UNIQUE,
    analysis_count INTEGER NOT NULL DEFAULT 0,
    exploration_count INTEGER NOT NULL DEFAULT 0,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT analysis_count_non_negative CHECK (analysis_count >= 0),
    CONSTRAINT exploration_count_non_negative CHECK (exploration_count >= 0)
);
-- Index pour recherche rapide par fingerprint
CREATE INDEX IF NOT EXISTS idx_guest_usage_fingerprint ON public.guest_usage(fingerprint_hash);
-- Activer RLS - pas de policies publiques, accès uniquement via SECURITY DEFINER function
ALTER TABLE public.guest_usage ENABLE ROW LEVEL SECURITY;
-- Fonction atomique: check + increment quota
-- Utilise FOR UPDATE pour éviter les race conditions
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
    v_current INTEGER;
    v_allowed BOOLEAN := false;
BEGIN
    -- Validation du quota_type
    IF p_quota_type NOT IN ('analysis', 'exploration') THEN
        RAISE EXCEPTION 'Invalid quota_type: %. Must be analysis or exploration', p_quota_type;
    END IF;

    -- Créer l'entrée si elle n'existe pas
    INSERT INTO public.guest_usage (fingerprint_hash)
    VALUES (p_fingerprint)
    ON CONFLICT (fingerprint_hash) DO NOTHING;

    IF p_quota_type = 'analysis' THEN
        SELECT analysis_count INTO v_current FROM public.guest_usage
        WHERE fingerprint_hash = p_fingerprint FOR UPDATE;
        v_allowed := v_current < p_limit;
        IF v_allowed THEN
            UPDATE public.guest_usage
            SET analysis_count = analysis_count + 1, last_seen_at = now()
            WHERE fingerprint_hash = p_fingerprint;
            v_current := v_current + 1;
        END IF;
    ELSIF p_quota_type = 'exploration' THEN
        SELECT exploration_count INTO v_current FROM public.guest_usage
        WHERE fingerprint_hash = p_fingerprint FOR UPDATE;
        v_allowed := v_current < p_limit;
        IF v_allowed THEN
            UPDATE public.guest_usage
            SET exploration_count = exploration_count + 1, last_seen_at = now()
            WHERE fingerprint_hash = p_fingerprint;
            v_current := v_current + 1;
        END IF;
    END IF;

    RETURN json_build_object('allowed', v_allowed, 'new_count', COALESCE(v_current, 0));
END;
$$;
-- Fonction pour obtenir le statut quota d'un invité
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
BEGIN
    SELECT analysis_count, exploration_count
    INTO v_analysis_count, v_exploration_count
    FROM public.guest_usage
    WHERE fingerprint_hash = p_fingerprint;

    RETURN json_build_object(
        'analysis_count', COALESCE(v_analysis_count, 0),
        'exploration_count', COALESCE(v_exploration_count, 0)
    );
END;
$$;
