-- Extend the opt-in Lucid Trainer sync contract with confirmed/rejected dream
-- sign decisions. Candidate extraction and dream text remain device-local.

alter table public.lucid_trainer_entities
  drop constraint if exists lucid_trainer_entities_entity_type_check;

alter table public.lucid_trainer_entities
  add constraint lucid_trainer_entities_entity_type_check
  check (entity_type in (
    'onboarding', 'preferences', 'progress', 'experiment', 'reality_check',
    'weekly_review', 'dream_sign'
  ));

-- The original function contains the same explicit allow-list as the table.
-- Rewrite only that guard so all conflict, receipt, reset-fence, RLS and grant
-- semantics continue to come from the audited function definition.
do $migration$
declare
  function_definition text;
  updated_definition text;
  previous_guard constant text :=
    'requested_type not in (''onboarding'', ''preferences'', ''progress'', ''experiment'', ''reality_check'', ''weekly_review'')';
  next_guard constant text :=
    'requested_type not in (''onboarding'', ''preferences'', ''progress'', ''experiment'', ''reality_check'', ''weekly_review'', ''dream_sign'')';
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
