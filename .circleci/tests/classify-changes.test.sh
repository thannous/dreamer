#!/usr/bin/env bash

set -euo pipefail

repository_root="$(git rev-parse --show-toplevel)"
classifier="$repository_root/.circleci/scripts/classify-changes.sh"
test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT

git -C "$test_root" init -q -b master
git -C "$test_root" config user.email ci-test@noctalia.invalid
git -C "$test_root" config user.name "Noctalia CI test"

mkdir -p "$test_root/app"
echo initial > "$test_root/app/index.ts"
git -C "$test_root" add app/index.ts
git -C "$test_root" commit -qm initial
base_revision="$(git -C "$test_root" rev-parse HEAD)"

parameters_json() {
  printf \
    '{"pipeline_kind":"%s","diff_base":"%s","run_noctalia":%s,"run_meditation":%s,"run_site":%s,"run_edge_functions":%s,"run_edge_contracts":%s,"run_changed_tests":%s,"run_full_tests":%s,"require_timing_baseline":%s,"publish_timing_baseline":%s,"save_site_npm_cache":%s,"save_edge_contracts_npm_cache":%s}' \
    "$@"
}

assert_parameters() {
  local label="$1"
  local expected="$2"
  local mode="$3"
  local base="$4"
  local head="$5"
  local output="$test_root/parameters.json"
  local actual

  (
    cd "$test_root"
    "$classifier" "$mode" "$base" "$head" "$output" >/dev/null
  )

  actual="$(cat "$output")"
  if [[ "$actual" != "$expected" ]]; then
    echo "$label failed" >&2
    echo "expected: $expected" >&2
    echo "actual:   $actual" >&2
    exit 1
  fi
}

commit_change() {
  local path="$1"
  mkdir -p "$test_root/$(dirname "$path")"
  echo changed > "$test_root/$path"
  git -C "$test_root" add "$path"
  git -C "$test_root" commit -qm "$path"
  git -C "$test_root" rev-parse HEAD
}

assert_change() {
  local label="$1"
  local path="$2"
  local mode="$3"
  shift 3
  local expected
  local head_revision

  git -C "$test_root" reset -q --hard "$base_revision"
  head_revision="$(commit_change "$path")"
  expected="$(parameters_json affected "$base_revision" "$@")"
  assert_parameters "$label" "$expected" "$mode" "$base_revision" "$head_revision"
}

full="$(parameters_json full "" true true true true true false true true true false false)"
release="$(parameters_json full "" true true true true true false true true false false false)"
fallback="$(parameters_json affected "" true true true true true false false false false false false)"
none="$(parameters_json affected "$base_revision" false false false false false false false false false false false)"

assert_parameters "full mode" "$full" full "" "$base_revision"
assert_parameters "release mode" "$release" release "" "$base_revision"
assert_parameters "invalid PR base fail-safe" "$fallback" pr deadbeef "$base_revision"
assert_parameters "invalid main base fail-safe" "$fallback" main deadbeef "$base_revision"
assert_parameters "no changes" "$none" pr "$base_revision" "$base_revision"

assert_change \
  "Noctalia app change" app/feature.ts pr \
  true false false false false true false false false false false

assert_change \
  "main uses affected Noctalia smoke" app/main-feature.ts main \
  true false false false false true false false false false false

git -C "$test_root" reset -q --hard "$base_revision"
commit_change app/main-batch.ts >/dev/null
main_batch_head="$(commit_change docs-src/content/main-batch.md)"
expected="$(parameters_json affected "$base_revision" true false true false false true false false false false false)"
assert_parameters \
  "main multi-commit push covers every changed surface" \
  "$expected" \
  main \
  "$base_revision" \
  "$main_batch_head"

assert_change \
  "Meditation app change" apps/meditation/app/index.tsx pr \
  false true false false false false false false false false false

assert_change \
  "site source change" docs-src/content/page.md pr \
  false false true false false false false false false true false

assert_change \
  "Edge Function change" supabase/functions/api/lib/example.ts pr \
  false false false true false false false false false false false

assert_change \
  "Edge route with Node contract" supabase/functions/api/routes/analytics.ts pr \
  false false false true true false false false false false true

assert_change \
  "database migration change" supabase/migrations/20260820000000_example.sql pr \
  false false false false true false false false false false true

assert_change \
  "internal docs change" doc_web_interne/docs/runbook.md pr \
  false false false false false false false false false false false

assert_change \
  "verified shared content" data/dream-symbols.json pr \
  true false true false false true false false false false false

assert_change \
  "root lockfile consumers" package-lock.json pr \
  true false true false true true false false false false false

assert_change \
  "shared Node version" .nvmrc pr \
  true true true false true true false false false false false

assert_change \
  "site generator change" scripts/docs-check.js pr \
  false false true false false false false false false true false

assert_change \
  "Noctalia tooling change" scripts/check-jest-duration-regression.test.js pr \
  true false false false false true false false false false false

assert_change \
  "Supabase control file" supabase/config.toml pr \
  false false false true true false false false false false true

assert_change \
  "CircleCI control-plane change" .circleci/config.yml pr \
  true true true true true true false false false false false

assert_change \
  "unknown global file fails closed" .gitignore pr \
  true true true true true true false false false false false

echo "CircleCI path classification tests passed."
