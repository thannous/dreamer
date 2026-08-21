#!/usr/bin/env bash

set -euo pipefail

if [[ "$#" -ne 4 ]]; then
  echo "Usage: $0 <pr|main|full|release> <base-revision> <head-revision> <parameters-file>" >&2
  exit 2
fi

mode="$1"
base_revision="$2"
head_revision="$3"
parameters_file="$4"

write_parameters() {
  local pipeline_kind="$1"
  local diff_base="$2"
  local run_noctalia="$3"
  local run_meditation="$4"
  local run_site="$5"
  local run_edge_functions="$6"
  local run_edge_contracts="$7"
  local run_changed_tests="$8"
  local run_full_tests="$9"
  local require_timing_baseline="${10}"
  local publish_timing_baseline="${11}"
  local save_site_npm_cache="${12}"
  local save_edge_contracts_npm_cache="${13}"

  printf \
    '{"pipeline_kind":"%s","diff_base":"%s","run_noctalia":%s,"run_meditation":%s,"run_site":%s,"run_edge_functions":%s,"run_edge_contracts":%s,"run_changed_tests":%s,"run_full_tests":%s,"require_timing_baseline":%s,"publish_timing_baseline":%s,"save_site_npm_cache":%s,"save_edge_contracts_npm_cache":%s}\n' \
    "$pipeline_kind" \
    "$diff_base" \
    "$run_noctalia" \
    "$run_meditation" \
    "$run_site" \
    "$run_edge_functions" \
    "$run_edge_contracts" \
    "$run_changed_tests" \
    "$run_full_tests" \
    "$require_timing_baseline" \
    "$publish_timing_baseline" \
    "$save_site_npm_cache" \
    "$save_edge_contracts_npm_cache" \
    > "$parameters_file"
}

if [[ "$mode" == "full" ]]; then
  echo "Manual full validation requested on master; publishing a reusable Jest baseline."
  write_parameters full "" true true true true true false true true true false false
  exit 0
fi

if [[ "$mode" == "release" ]]; then
  echo "Full validation requested for a release branch, tag, or manual non-master pipeline."
  write_parameters full "" true true true true true false true true false false false
  exit 0
fi

if [[ "$mode" != "pr" && "$mode" != "main" ]]; then
  echo "Unsupported pipeline mode: $mode" >&2
  exit 2
fi

if [[ -z "$base_revision" ]] || \
  ! git cat-file -e "${base_revision}^{commit}" 2>/dev/null || \
  ! git cat-file -e "${head_revision}^{commit}" 2>/dev/null || \
  ! git merge-base --is-ancestor "$base_revision" "$head_revision"; then
  echo "No usable diff base; running every affected gate without the exhaustive portfolio."
  write_parameters affected "" true true true true true false false false false false false
  exit 0
fi

changed_files="$(mktemp)"
trap 'rm -f "$changed_files"' EXIT
git diff --name-only "$base_revision" "$head_revision" > "$changed_files"

if [[ ! -s "$changed_files" ]]; then
  echo "No changed files; continuing with an explicit no-op workflow."
  write_parameters affected "$base_revision" false false false false false false false false false false false
  exit 0
fi

echo "Changed files:"
cat "$changed_files"

run_noctalia=false
run_meditation=false
run_site=false
run_edge_functions=false
run_edge_contracts=false

mark_all_surfaces() {
  run_noctalia=true
  run_meditation=true
  run_site=true
  run_edge_functions=true
  run_edge_contracts=true
}

while IFS= read -r path; do
  case "$path" in
    .circleci/*|.github/workflows/quality.yml)
      # CI control-plane changes are deliberately fail-closed.
      mark_all_surfaces
      ;;
    .nvmrc)
      # Shared Node toolchain; Deno does not consume it.
      run_noctalia=true
      run_meditation=true
      run_site=true
      run_edge_contracts=true
      ;;
    apps/meditation/*)
      # Meditation has its own package, lockfile, TypeScript, lint and Jest setup.
      run_meditation=true
      ;;
    package.json|package-lock.json)
      # The root package is consumed by Noctalia, the generated site and Node DB contracts.
      run_noctalia=true
      run_site=true
      run_edge_contracts=true
      ;;
    docs-src/static/data/curation-pages.json)
      # Imported by services/dreamGuideService.ts and copied into the site.
      run_noctalia=true
      run_site=true
      ;;
    data/dream-symbols.json|data/dream-symbols-extended.json|data/dream-symbols-extended-tier3.json|data/practicalDreamGuides.ts)
      # Verified shared inputs for the root mobile app and site generators.
      run_noctalia=true
      run_site=true
      ;;
    docs-src/*|docs/*|data/*)
      run_site=true
      ;;
    supabase/functions/api/routes/analytics.ts|supabase/functions/api/routes/chat.ts|supabase/functions/api/routes/quota.ts)
      # Deno routes with explicit source-reading Node contract tests.
      run_edge_functions=true
      run_edge_contracts=true
      ;;
    supabase/functions/*|supabase/lib/*|deno.lock)
      run_edge_functions=true
      ;;
    supabase/migrations/*|supabase/legacy_migrations/*|supabase/db-contract.manifest.json|supabase/types/*)
      run_edge_contracts=true
      ;;
    supabase/*)
      # Unknown Supabase control files affect both runtime and database validation.
      run_edge_functions=true
      run_edge_contracts=true
      ;;
    scripts/analysis-idempotency-migration.test.js|scripts/check-db-contract.js|scripts/check-db-contract.test.js|scripts/dream-images-auth-user-policy-migration.test.js|scripts/guest-chat-route-contract.test.js|scripts/guest-qa-passport-migration.test.js|scripts/interpretation-entitlement-migration.test.js|scripts/product-analytics-migration.test.js|scripts/product-analytics-schema-parity.test.js)
      run_edge_contracts=true
      ;;
    lib/productAnalytics.ts)
      # Compared directly with the Edge analytics route by the parity contract.
      run_noctalia=true
      run_edge_contracts=true
      ;;
    scripts/lib/*|scripts/docs-*|scripts/build-content-manifest.js|scripts/build-site-manifest.js|scripts/build-experience.js|scripts/build-guides-pages.js|scripts/check-article-date-contract.js|scripts/check-blog-crosslinking-plan.js|scripts/check-content-hub-contract.js|scripts/check-content-release-gates.js|scripts/check-docs-*|scripts/check-image-seo-contract.js|scripts/check-intent-ownership.js|scripts/check-public-url-stability.js|scripts/check-symbol-*|scripts/check-web-performance-contract.js|scripts/generate-image-seo-assets.js|scripts/generate-sitemap*.js|scripts/generate-symbol-*.js|scripts/validate-i18n-seo.js|scripts/audit-blog-i18n-parity.js|scripts/audit-content-parity.js|scripts/serve-docs.js|scripts/site-shell-*.test.js)
      run_site=true
      ;;
    app/*|components/*|constants/*|context/*|hooks/*|lib/*|services/*|tests/*|__mocks__/*|assets/*|mock-data/*|maestro/*|plugins/*|script/*)
      run_noctalia=true
      ;;
    app.config.ts|app.json|eas.json|global.css|babel.config.js|eslint.config.js|jest.config.js|jest.config.*.js|jest.setup.ts|metro.config.js|tsconfig.json|tsconfig.test.json|uniwind-env.d.ts|uniwind-types.d.ts|vitest.config.mts|vitest.setup.ts|workbox-config.js)
      run_noctalia=true
      ;;
    scripts/*)
      # Unclassified root scripts are Noctalia tooling, never implicit site inputs.
      run_noctalia=true
      ;;
    doc_web_interne/*|marketing/*|specs/*|*.md|*.mdx)
      # Internal documentation and planning do not exercise a product surface.
      ;;
    *)
      echo "Unclassified path '$path'; failing closed across every surface."
      mark_all_surfaces
      ;;
  esac
done < "$changed_files"

save_site_npm_cache=false
save_edge_contracts_npm_cache=false

if [[ "$run_site" == true && "$run_noctalia" == false ]]; then
  save_site_npm_cache=true
elif [[ "$run_edge_contracts" == true && "$run_noctalia" == false ]]; then
  save_edge_contracts_npm_cache=true
fi

echo "Selected surfaces: Noctalia=$run_noctalia Meditation=$run_meditation Site=$run_site Edge=$run_edge_functions DB-contracts=$run_edge_contracts"

write_parameters \
  affected \
  "$base_revision" \
  "$run_noctalia" \
  "$run_meditation" \
  "$run_site" \
  "$run_edge_functions" \
  "$run_edge_contracts" \
  "$run_noctalia" \
  false \
  false \
  false \
  "$save_site_npm_cache" \
  "$save_edge_contracts_npm_cache"
