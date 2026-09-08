-- Keyset pagination in read_journal_import_page:
-- where user_id = owner_id and id > cursor and id <= watermark order by id.
create index if not exists dreams_user_id_id_idx
  on public.dreams (user_id, id);
