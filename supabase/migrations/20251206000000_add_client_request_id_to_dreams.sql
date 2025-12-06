-- Add client-side idempotency key for dream creation
alter table public.dreams
  add column if not exists client_request_id uuid;

create unique index if not exists idx_dreams_user_client_request
  on public.dreams(user_id, client_request_id)
  where client_request_id is not null;
