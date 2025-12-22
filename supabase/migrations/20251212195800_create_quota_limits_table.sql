-- Configurable quota limits stored in DB.
-- Source of truth for both enforcement (triggers) and UI (SupabaseQuotaProvider).

CREATE TABLE IF NOT EXISTS public.quota_limits (
  tier text NOT NULL,
  period text NOT NULL,
  quota_type text NOT NULL,
  quota_limit integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quota_limits_tier_check CHECK (tier IN ('guest', 'free', 'premium')),
  CONSTRAINT quota_limits_period_check CHECK (period IN ('initial', 'monthly')),
  CONSTRAINT quota_limits_quota_type_check CHECK (quota_type IN ('analysis', 'exploration', 'messages_per_dream')),
  CONSTRAINT quota_limits_quota_limit_check CHECK (quota_limit IS NULL OR quota_limit >= 0),
  CONSTRAINT quota_limits_pk PRIMARY KEY (tier, period, quota_type)
);
ALTER TABLE public.quota_limits ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  -- Read-only for everyone (anon + authenticated) so the app can render limits.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quota_limits'
      AND policyname = 'quota_limits_select_all'
  ) THEN
    CREATE POLICY quota_limits_select_all
      ON public.quota_limits
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;

  -- Only service_role can modify limits.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quota_limits'
      AND policyname = 'quota_limits_write_service_role'
  ) THEN
    CREATE POLICY quota_limits_write_service_role
      ON public.quota_limits
      FOR ALL
      TO authenticated
      USING ((select auth.role()) = 'service_role')
      WITH CHECK ((select auth.role()) = 'service_role');
  END IF;
END
$$;
-- Seed defaults. Re-runnable.
INSERT INTO public.quota_limits (tier, period, quota_type, quota_limit)
VALUES
  ('guest', 'monthly', 'analysis', 2),
  ('guest', 'monthly', 'exploration', 2),
  ('guest', 'monthly', 'messages_per_dream', 10),
  ('free', 'monthly', 'analysis', 3),
  ('free', 'monthly', 'exploration', 2),
  ('free', 'monthly', 'messages_per_dream', 20),
  ('premium', 'monthly', 'analysis', NULL),
  ('premium', 'monthly', 'exploration', NULL),
  ('premium', 'monthly', 'messages_per_dream', NULL)
ON CONFLICT (tier, period, quota_type)
DO UPDATE SET
  quota_limit = EXCLUDED.quota_limit,
  updated_at = now();
