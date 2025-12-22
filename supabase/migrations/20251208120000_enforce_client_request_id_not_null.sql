-- Ensure client_request_id is always present and uniquely constrained
alter table public.dreams
  alter column client_request_id set default gen_random_uuid();
update public.dreams
set client_request_id = gen_random_uuid()
where client_request_id is null;
alter table public.dreams
  alter column client_request_id set not null;
drop index if exists idx_dreams_user_client_request;
create unique index idx_dreams_user_client_request
  on public.dreams (user_id, client_request_id);
