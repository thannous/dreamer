-- RPC-only idempotency receipts remain inaccessible to client roles.
-- sync_dream_mutations is owned by postgres and runs as SECURITY DEFINER.
alter table public.dream_sync_receipts enable row level security;
