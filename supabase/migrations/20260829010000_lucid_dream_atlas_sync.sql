-- Extend the opt-in Lucid Trainer sync contract with the dream atlas overlay.
-- The overlay is a singleton; dream text remains device-local.

alter table public.lucid_trainer_entities
  drop constraint if exists lucid_trainer_entities_entity_type_check;

alter table public.lucid_trainer_entities
  add constraint lucid_trainer_entities_entity_type_check
  check (entity_type in (
    'onboarding', 'preferences', 'progress', 'experiment', 'reality_check',
    'weekly_review', 'dream_sign', 'dream_atlas'
  ));

-- The original function contains the same explicit allow-list as the table.
-- Rewrite only that guard so all conflict, receipt, reset-fence, RLS and grant
-- semantics continue to come from the audited function definition.
do $migration$
declare
  function_definition text;
  updated_definition text;
  previous_guard constant text :=
    'requested_type not in (''onboarding'', ''preferences'', ''progress'', ''experiment'', ''reality_check'', ''weekly_review'', ''dream_sign'')';
  next_guard constant text :=
    'requested_type not in (''onboarding'', ''preferences'', ''progress'', ''experiment'', ''reality_check'', ''weekly_review'', ''dream_sign'', ''dream_atlas'')';
begin
  select pg_get_functiondef('public.sync_lucid_trainer_mutations(jsonb)'::regprocedure)
    into function_definition;

  if position(previous_guard in function_definition) = 0 then
    raise exception 'Expected Lucid Trainer entity allow-list was not found';
  end if;

  updated_definition := replace(function_definition, previous_guard, next_guard);
  execute updated_definition;
end
$migration$;
