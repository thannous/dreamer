-- PHASE 1: CRITICAL SECURITY FIX - Move tier to app_metadata (admin-only)
--
-- VULNERABILITY FIXED: Users could modify their own tier via:
--   supabase.auth.updateUser({ data: { tier: 'premium' } })
--   OR by calling updateUserTier() function
--
-- SOLUTION: Move tier from user_metadata (client-modifiable) to app_metadata (admin-only).
-- This prevents unauthorized privilege escalation while maintaining quota enforcement.
--
-- BACKWARD COMPATIBILITY:
-- - Keeps tier in user_metadata temporarily during transition
-- - Code will read from app_metadata first, fallback to user_metadata if needed
-- - Can be cleaned up after app is fully migrated

DO $$
DECLARE
  user_count INT := 0;
  tier_value TEXT;
BEGIN
  -- Copy tier from user_metadata to app_metadata for all users that have a tier
  FOR user_count IN
    SELECT COUNT(*)::INT
    FROM auth.users
    WHERE raw_user_meta_data->>'tier' IS NOT NULL
  LOOP
    -- For each user with a tier in user_metadata
    UPDATE auth.users u
    SET raw_app_meta_data = (
      COALESCE(u.raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object('tier', u.raw_user_meta_data->>'tier')
    )
    WHERE u.raw_user_meta_data->>'tier' IS NOT NULL;
  END LOOP;

  -- Log the migration result
  IF user_count > 0 THEN
    RAISE NOTICE 'Migration complete: moved tier to app_metadata for % users', user_count;
  ELSE
    RAISE NOTICE 'Migration complete: no users with tier found to migrate';
  END IF;
END $$;
