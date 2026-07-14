#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-start}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

if [[ $# -gt 0 ]]; then
  shift
fi

show_usage() {
  cat <<'USAGE'
usage: ./script/build_and_run.sh [mode] [Expo options]

Modes:
  start, run        Start the Expo dev server
  --ios, ios        Start Expo and open iOS
  --android, android
                   Start Expo and open Android
  --web, web        Start Expo for web
  --dev-client, dev-client
                   Start Expo in development-client mode
  --tunnel, tunnel Start Expo using tunnel transport
  --export-web, export-web
                   Export the web build locally
  --doctor, doctor Run Expo diagnostics
  --help, help     Show this help

Environment profiles:
  Add --profile <path> after a start mode to load exactly that profile
  without copying it to .env.local.
USAGE
}

run_doctor() {
  if [[ -f pnpm-lock.yaml ]] && command -v pnpm >/dev/null 2>&1; then
    pnpm exec expo-doctor
  elif [[ -f yarn.lock ]] && command -v yarn >/dev/null 2>&1; then
    yarn expo-doctor
  elif { [[ -f bun.lock ]] || [[ -f bun.lockb ]]; } && command -v bun >/dev/null 2>&1; then
    bunx expo-doctor
  else
    npx expo-doctor
  fi
}

EXPO_RUNNER=(node ./scripts/expo-safe-runner.js)

case "$MODE" in
  start|run)
    exec "${EXPO_RUNNER[@]}" start "$@"
    ;;
  --ios|ios)
    exec "${EXPO_RUNNER[@]}" start --ios "$@"
    ;;
  --android|android)
    exec "${EXPO_RUNNER[@]}" start --android "$@"
    ;;
  --web|web)
    exec "${EXPO_RUNNER[@]}" start --web "$@"
    ;;
  --dev-client|dev-client)
    exec "${EXPO_RUNNER[@]}" start --dev-client "$@"
    ;;
  --tunnel|tunnel)
    exec "${EXPO_RUNNER[@]}" start --tunnel "$@"
    ;;
  --export-web|export-web)
    exec "${EXPO_RUNNER[@]}" export --platform web "$@"
    ;;
  --doctor|doctor)
    run_doctor "$@"
    ;;
  --help|help)
    show_usage
    ;;
  *)
    show_usage >&2
    exit 2
    ;;
esac
