-- Performance advisor findings on production (read-only check, 2026-10-21).

-- auth_rls_initplan: evaluate auth.uid() once per statement, not once per row.
-- Same policy, same role (authenticated) and command; only the expression changes.
alter policy subscription_state_select_own on public.subscription_state
  using ((select auth.uid()) = user_id);

-- unindexed_foreign_keys: device_account_links_user_id_fkey and
-- dream_chat_messages_user_id_fkey have no index starting with user_id (the
-- device_account_links primary key is (fingerprint_hash, user_id)). Deleting a
-- user scans both tables without them. Both tables are small, so a plain
-- (non-concurrent) build inside the migration transaction is short.
create index if not exists device_account_links_user_id_idx
  on public.device_account_links (user_id);
create index if not exists dream_chat_messages_user_id_idx
  on public.dream_chat_messages (user_id);
