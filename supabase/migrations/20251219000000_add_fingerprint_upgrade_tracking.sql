-- Migration: Add fingerprint upgrade tracking to prevent quota bypass
-- Prevents users from creating multiple accounts on the same device to get fresh quotas
-- When a user signs up, we mark their device fingerprint as "upgraded" and link it to their user ID
-- Upgraded fingerprints no longer get guest quotas

-- Ajouter les colonnes pour tracking des upgrades
ALTER TABLE public.guest_usage
ADD COLUMN is_upgraded BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN upgraded_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN upgraded_at TIMESTAMPTZ;

-- Créer des index pour recherche rapide
CREATE INDEX idx_guest_usage_is_upgraded ON public.guest_usage(is_upgraded);
CREATE INDEX idx_guest_usage_upgraded_user_id ON public.guest_usage(upgraded_user_id);

-- Mettre à jour la fonction get_guest_quota_status pour inclure le statut is_upgraded
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

-- Créer une nouvelle fonction pour marquer un fingerprint comme upgradé
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
    -- Créer l'entrée si elle n'existe pas, sinon mettre à jour
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
