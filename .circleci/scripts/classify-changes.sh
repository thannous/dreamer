#!/usr/bin/env bash

set -euo pipefail

if [[ "$#" -ne 4 ]]; then
  echo "Usage: $0 <pr|full|release> <base-revision> <head-revision> <parameters-file>" >&2
  exit 2
fi

mode="$1"
base_revision="$2"
head_revision="$3"
parameters_file="$4"

write_parameters() {
  local pipeline_kind="$1"
  local diff_base="$2"
  local run_app="$3"
  local run_site="$4"
  local run_edge="$5"
  local run_changed_tests="$6"
  local require_timing_baseline="$7"
  local publish_timing_baseline="$8"
  local save_site_npm_cache="$9"

  printf \
    '{"pipeline_kind":"%s","diff_base":"%s","run_app":%s,"run_site":%s,"run_edge":%s,"run_changed_tests":%s,"require_timing_baseline":%s,"publish_timing_baseline":%s,"save_site_npm_cache":%s}\n' \
    "$pipeline_kind" \
    "$diff_base" \
    "$run_app" \
    "$run_site" \
    "$run_edge" \
    "$run_changed_tests" \
    "$require_timing_baseline" \
    "$publish_timing_baseline" \
    "$save_site_npm_cache" \
    > "$parameters_file"
}

if [[ "$mode" == "full" ]]; then
  echo "Full pipeline requested for master; publishing a reusable Jest baseline."
  write_parameters full "" true true true false true true false
  exit 0
fi

if [[ "$mode" == "release" ]]; then
  echo "Full pipeline requested for a release branch or tag; preserving the master Jest baseline."
  write_parameters full "" true true true false true false false
  exit 0
fi

if [[ "$mode" != "pr" ]]; then
  echo "Unsupported pipeline mode: $mode" >&2
  exit 2
fi

if [[ -z "$base_revision" ]] || \
  ! git cat-file -e "${base_revision}^{commit}" 2>/dev/null || \
  ! git cat-file -e "${head_revision}^{commit}" 2>/dev/null; then
  echo "No usable PR base commit; running every path gate without the exhaustive Jest suite."
  write_parameters pr "" true true true false false false false
  exit 0
fi

changed_files="$(mktemp)"
trap 'rm -f "$changed_files"' EXIT
git diff --name-only "$base_revision" "$head_revision" > "$changed_files"

if [[ ! -s "$changed_files" ]]; then
  echo "No changed files; continuing with an explicit no-op workflow."
  write_parameters pr "$base_revision" false false false false false false false
  exit 0
fi

echo "Changed files:"
cat "$changed_files"

docs_social_or_chore='^(doc_web_interne/|marketing/|docs-src/|docs/|data/.+\.json$|.*\.mdx?$)'
site_paths='^(\.circleci/|\.github/workflows/quality\.yml|docs-src/|docs/|data/|package(-lock)?\.json$|scripts/lib/|scripts/(docs-(build|check)\.js|build-(content-manifest|site-manifest|experience|guides-pages)\.js|check-(content-release-gates|public-url-stability|content-hub-contract|symbol-illustration-parity|docs-links|docs-shell|article-date-contract|intent-ownership|web-performance-contract|symbol-image-contract|image-seo-contract)\.js|generate-(symbol-hero-posters|image-seo-assets|symbol-responsive-images|sitemap-v2)\.js|validate-i18n-seo\.js)$)'
edge_paths='^(\.circleci/|\.github/workflows/quality\.yml|supabase/|deno\.lock$)'

if grep -Evq "$docs_social_or_chore" "$changed_files"; then
  run_app=true
  echo "App/code paths changed; running Node quality and Jest."
else
  run_app=false
  echo "Docs/social/chore-only changes; skipping Node quality and Jest."
fi

if grep -Eq "$site_paths" "$changed_files"; then
  run_site=true
  echo "Site-related files changed; running the site build and checks."
else
  run_site=false
  echo "No site-related files changed; skipping the site build."
fi

if grep -Eq "$edge_paths" "$changed_files"; then
  run_edge=true
  echo "Edge Function paths changed; running Deno checks."
else
  run_edge=false
  echo "No Edge Function paths changed; skipping Deno checks."
fi

if [[ "$run_site" == true && "$run_app" == false ]]; then
  save_site_npm_cache=true
else
  save_site_npm_cache=false
fi

write_parameters \
  pr \
  "$base_revision" \
  "$run_app" \
  "$run_site" \
  "$run_edge" \
  "$run_app" \
  false \
  false \
  "$save_site_npm_cache"
