-- Migration: Fix RLS security and performance issues
-- Created: 2025-12-15
-- Author: Database security audit
--
-- ISSUES ADDRESSED:
-- 1. guest_usage: RLS enabled but NO policies defined (security risk)
-- 2. quota_usage: RLS policy calls auth.uid() directly (performance issue)
-- 3. quota_usage: Unused index idx_quota_usage_dream (dead weight)
-- 4. quota_limits: Multiple permissive SELECT policies for authenticated role
--
-- ============================================================================
-- STEP 1: Create explicit deny-all RLS policies for guest_usage table
-- ============================================================================
-- The guest_usage table is accessed ONLY via SECURITY DEFINER functions
-- (increment_guest_quota, get_guest_quota_status). Direct table access should
-- be completely blocked for all roles to prevent unauthorized reads/writes.

-- First, ensure RLS is enabled (idempotent)
ALTER TABLE public.guest_usage ENABLE ROW LEVEL SECURITY;

-- Create explicit deny-all policy for SELECT (blocks direct reads)
-- Uses false to deny all rows - access only via SECURITY DEFINER functions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'guest_usage'
      AND policyname = 'guest_usage_deny_all_select'
  ) THEN
    CREATE POLICY guest_usage_deny_all_select
      ON public.guest_usage
      FOR SELECT
      TO anon, authenticated
      USING (false);
  END IF;
END
$$;

-- Create explicit deny-all policy for INSERT (blocks direct inserts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'guest_usage'
      AND policyname = 'guest_usage_deny_all_insert'
  ) THEN
    CREATE POLICY guest_usage_deny_all_insert
      ON public.guest_usage
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (false);
  END IF;
END
$$;

-- Create explicit deny-all policy for UPDATE (blocks direct updates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'guest_usage'
      AND policyname = 'guest_usage_deny_all_update'
  ) THEN
    CREATE POLICY guest_usage_deny_all_update
      ON public.guest_usage
      FOR UPDATE
      TO anon, authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

-- Create explicit deny-all policy for DELETE (blocks direct deletes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'guest_usage'
      AND policyname = 'guest_usage_deny_all_delete'
  ) THEN
    CREATE POLICY guest_usage_deny_all_delete
      ON public.guest_usage
      FOR DELETE
      TO anon, authenticated
      USING (false);
  END IF;
END
$$;

-- Add comment explaining the security model
COMMENT ON TABLE public.guest_usage IS
  'Tracks quota usage for anonymous/guest users by fingerprint hash. '
  'RLS policies deny ALL direct access. Access is ONLY allowed via SECURITY DEFINER functions: '
  'increment_guest_quota() and get_guest_quota_status(). This prevents quota bypass attacks.';

-- ============================================================================
-- STEP 2: Optimize quota_usage RLS policy to use subquery for auth.uid()
-- ============================================================================
-- Problem: USING (auth.uid() = user_id) calls auth.uid() for EVERY row scanned
-- Solution: USING (user_id = (select auth.uid())) evaluates auth.uid() ONCE
-- This is a significant performance improvement for tables with many rows

-- Drop the existing inefficient policy
DROP POLICY IF EXISTS quota_usage_select_own ON public.quota_usage;

-- Create optimized policy with subquery pattern
CREATE POLICY quota_usage_select_own
  ON public.quota_usage
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Add comment explaining the optimization
COMMENT ON POLICY quota_usage_select_own ON public.quota_usage IS
  'Users can only view their own quota usage. Uses (select auth.uid()) pattern '
  'for performance - evaluates auth.uid() once per query instead of per row.';

-- ============================================================================
-- STEP 3: Remove unused index idx_quota_usage_dream
-- ============================================================================
-- This index on dream_id is not used by any queries because:
-- - Most quota queries filter by user_id + quota_type + occurred_at
-- - Dream_id lookups are rare and not performance-critical
-- - The composite index idx_quota_usage_user_type_time handles all common queries

DROP INDEX IF EXISTS public.idx_quota_usage_dream;

-- ============================================================================
-- STEP 4: Consolidate quota_limits RLS policies
-- ============================================================================
-- Problem: Two separate permissive policies for authenticated role on SELECT:
--   1. quota_limits_select_all (SELECT for anon, authenticated) - USING (true)
--   2. quota_limits_write_service_role (ALL for authenticated) - includes SELECT
--
-- With permissive policies, ANY matching policy grants access. Having multiple
-- policies for the same role/action is confusing and can lead to security issues.
--
-- Solution:
--   - Keep quota_limits_select_all for read access (anon + authenticated)
--   - Change quota_limits_write_service_role to only handle WRITE operations

-- Drop the existing write policy that incorrectly uses FOR ALL
DROP POLICY IF EXISTS quota_limits_write_service_role ON public.quota_limits;

-- Recreate as separate INSERT/UPDATE/DELETE policies for service_role only
-- Note: service_role bypasses RLS anyway, but this documents intent

-- For INSERT operations by service_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quota_limits'
      AND policyname = 'quota_limits_insert_service_role'
  ) THEN
    CREATE POLICY quota_limits_insert_service_role
      ON public.quota_limits
      FOR INSERT
      TO authenticated
      WITH CHECK ((select auth.role()) = 'service_role');
  END IF;
END
$$;

-- For UPDATE operations by service_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quota_limits'
      AND policyname = 'quota_limits_update_service_role'
  ) THEN
    CREATE POLICY quota_limits_update_service_role
      ON public.quota_limits
      FOR UPDATE
      TO authenticated
      USING ((select auth.role()) = 'service_role')
      WITH CHECK ((select auth.role()) = 'service_role');
  END IF;
END
$$;

-- For DELETE operations by service_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quota_limits'
      AND policyname = 'quota_limits_delete_service_role'
  ) THEN
    CREATE POLICY quota_limits_delete_service_role
      ON public.quota_limits
      FOR DELETE
      TO authenticated
      USING ((select auth.role()) = 'service_role');
  END IF;
END
$$;

-- Update comment on table to document security model
COMMENT ON TABLE public.quota_limits IS
  'Configuration table for quota limits by tier/period/quota_type. '
  'Read access: ALL users (anon + authenticated) via quota_limits_select_all. '
  'Write access: service_role ONLY via separate insert/update/delete policies.';

-- ============================================================================
-- DOWN Migration (Rollback)
-- ============================================================================
-- To rollback this migration, run:
--
-- -- Remove guest_usage policies
-- DROP POLICY IF EXISTS guest_usage_deny_all_select ON public.guest_usage;
-- DROP POLICY IF EXISTS guest_usage_deny_all_insert ON public.guest_usage;
-- DROP POLICY IF EXISTS guest_usage_deny_all_update ON public.guest_usage;
-- DROP POLICY IF EXISTS guest_usage_deny_all_delete ON public.guest_usage;
--
-- -- Restore original quota_usage policy
-- DROP POLICY IF EXISTS quota_usage_select_own ON public.quota_usage;
-- CREATE POLICY quota_usage_select_own
--   ON public.quota_usage
--   FOR SELECT
--   USING (auth.uid() = user_id);
--
-- -- Restore idx_quota_usage_dream index
-- CREATE INDEX IF NOT EXISTS idx_quota_usage_dream
--   ON public.quota_usage(dream_id);
--
-- -- Restore original quota_limits policies
-- DROP POLICY IF EXISTS quota_limits_insert_service_role ON public.quota_limits;
-- DROP POLICY IF EXISTS quota_limits_update_service_role ON public.quota_limits;
-- DROP POLICY IF EXISTS quota_limits_delete_service_role ON public.quota_limits;
-- CREATE POLICY quota_limits_write_service_role
--   ON public.quota_limits
--   FOR ALL
--   TO authenticated
--   USING ((select auth.role()) = 'service_role')
--   WITH CHECK ((select auth.role()) = 'service_role');
