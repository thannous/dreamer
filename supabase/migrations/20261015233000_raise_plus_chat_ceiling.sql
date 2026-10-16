-- Plus chat is sold as unlimited under fair use: the per-dream safety ceiling
-- rises from 20 to 100 user messages. Free and guest stay at 10.
-- constants/limits.ts and supabase/db-contract.manifest.json carry the same value.

insert into public.quota_limits (tier, period, quota_type, quota_limit)
values
  ('plus', 'monthly', 'messages_per_dream', 100),
  ('premium', 'monthly', 'messages_per_dream', 100)
on conflict (tier, period, quota_type)
do update set
  quota_limit = excluded.quota_limit,
  updated_at = now();
