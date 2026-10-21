-- Lucid trainer writes go through sync_lucid_trainer_mutations and
-- delete_lucid_trainer_data (SECURITY DEFINER); clients only read their own
-- rows. 20261021100000 already leaves authenticated with SELECT only; this
-- states it explicitly so production (which granted INSERT, UPDATE, DELETE)
-- and a local replay end in the same place whatever ran before.
revoke insert, update, delete on table public.lucid_trainer_entities from authenticated;
revoke insert, update, delete on table public.lucid_trainer_reset_fences from authenticated;
