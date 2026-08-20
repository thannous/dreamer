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

assert_parameters() {
  local label="$1"
  local expected="$2"
  local mode="$3"
  local base="$4"
  local head="$5"
  local output="$test_root/parameters.json"

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

full='{"pipeline_kind":"full","diff_base":"","run_app":true,"run_site":true,"run_edge":true,"run_changed_tests":false,"require_timing_baseline":true,"publish_timing_baseline":true,"save_site_npm_cache":false}'
release='{"pipeline_kind":"full","diff_base":"","run_app":true,"run_site":true,"run_edge":true,"run_changed_tests":false,"require_timing_baseline":true,"publish_timing_baseline":false,"save_site_npm_cache":false}'
fallback='{"pipeline_kind":"pr","diff_base":"","run_app":true,"run_site":true,"run_edge":true,"run_changed_tests":false,"require_timing_baseline":false,"publish_timing_baseline":false,"save_site_npm_cache":false}'
none="{\"pipeline_kind\":\"pr\",\"diff_base\":\"$base_revision\",\"run_app\":false,\"run_site\":false,\"run_edge\":false,\"run_changed_tests\":false,\"require_timing_baseline\":false,\"publish_timing_baseline\":false,\"save_site_npm_cache\":false}"

assert_parameters "full mode" "$full" full "" "$base_revision"
assert_parameters "release mode" "$release" release "" "$base_revision"
assert_parameters "invalid PR base fail-safe" "$fallback" pr deadbeef "$base_revision"
assert_parameters "no changes" "$none" pr "$base_revision" "$base_revision"

commit_change() {
  local path="$1"
  mkdir -p "$test_root/$(dirname "$path")"
  echo changed > "$test_root/$path"
  git -C "$test_root" add "$path"
  git -C "$test_root" commit -qm "$path"
  git -C "$test_root" rev-parse HEAD
}

head_revision="$(commit_change app/feature.ts)"
expected="{\"pipeline_kind\":\"pr\",\"diff_base\":\"$base_revision\",\"run_app\":true,\"run_site\":false,\"run_edge\":false,\"run_changed_tests\":true,\"require_timing_baseline\":false,\"publish_timing_baseline\":false,\"save_site_npm_cache\":false}"
assert_parameters "app change" "$expected" pr "$base_revision" "$head_revision"

git -C "$test_root" reset -q --hard "$base_revision"
head_revision="$(commit_change docs-src/content/page.md)"
expected="{\"pipeline_kind\":\"pr\",\"diff_base\":\"$base_revision\",\"run_app\":false,\"run_site\":true,\"run_edge\":false,\"run_changed_tests\":false,\"require_timing_baseline\":false,\"publish_timing_baseline\":false,\"save_site_npm_cache\":true}"
assert_parameters "site source change" "$expected" pr "$base_revision" "$head_revision"

git -C "$test_root" reset -q --hard "$base_revision"
head_revision="$(commit_change supabase/functions/api/example.ts)"
expected="{\"pipeline_kind\":\"pr\",\"diff_base\":\"$base_revision\",\"run_app\":true,\"run_site\":false,\"run_edge\":true,\"run_changed_tests\":true,\"require_timing_baseline\":false,\"publish_timing_baseline\":false,\"save_site_npm_cache\":false}"
assert_parameters "Edge Function change" "$expected" pr "$base_revision" "$head_revision"

git -C "$test_root" reset -q --hard "$base_revision"
head_revision="$(commit_change doc_web_interne/docs/runbook.md)"
expected="{\"pipeline_kind\":\"pr\",\"diff_base\":\"$base_revision\",\"run_app\":false,\"run_site\":false,\"run_edge\":false,\"run_changed_tests\":false,\"require_timing_baseline\":false,\"publish_timing_baseline\":false,\"save_site_npm_cache\":false}"
assert_parameters "internal docs change" "$expected" pr "$base_revision" "$head_revision"

git -C "$test_root" reset -q --hard "$base_revision"
head_revision="$(commit_change scripts/check-jest-duration-regression.test.js)"
expected="{\"pipeline_kind\":\"pr\",\"diff_base\":\"$base_revision\",\"run_app\":true,\"run_site\":false,\"run_edge\":false,\"run_changed_tests\":true,\"require_timing_baseline\":false,\"publish_timing_baseline\":false,\"save_site_npm_cache\":false}"
assert_parameters "non-site script change" "$expected" pr "$base_revision" "$head_revision"

git -C "$test_root" reset -q --hard "$base_revision"
head_revision="$(commit_change scripts/docs-check.js)"
expected="{\"pipeline_kind\":\"pr\",\"diff_base\":\"$base_revision\",\"run_app\":true,\"run_site\":true,\"run_edge\":false,\"run_changed_tests\":true,\"require_timing_baseline\":false,\"publish_timing_baseline\":false,\"save_site_npm_cache\":false}"
assert_parameters "site generator change" "$expected" pr "$base_revision" "$head_revision"

git -C "$test_root" reset -q --hard "$base_revision"
head_revision="$(commit_change .circleci/config.yml)"
expected="{\"pipeline_kind\":\"pr\",\"diff_base\":\"$base_revision\",\"run_app\":true,\"run_site\":true,\"run_edge\":true,\"run_changed_tests\":true,\"require_timing_baseline\":false,\"publish_timing_baseline\":false,\"save_site_npm_cache\":false}"
assert_parameters "CircleCI change" "$expected" pr "$base_revision" "$head_revision"

echo "CircleCI path classification tests passed."
