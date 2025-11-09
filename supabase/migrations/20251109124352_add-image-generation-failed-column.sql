alter table if exists public.dreams
add column if not exists image_generation_failed boolean default false;
