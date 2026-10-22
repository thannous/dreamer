-- The three-argument sync claim does not verify the transcript sent to the
-- provider. The API now uses claim_authenticated_analysis_quota_bound instead.
-- RESTRICT fails the migration if an unexpected database object still depends
-- on this obsolete entry point; never cascade away a dependent object.
drop function if exists public.claim_authenticated_analysis_quota(uuid, bigint, uuid) restrict;
