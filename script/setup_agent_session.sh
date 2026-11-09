#!/usr/bin/env bash
# Prepare a fresh clone or cloud container so `npm run verify:pr` can prove a
# diff there: the Node version pinned in .nvmrc, the root dependencies (which
# install the pre-push hook), the e2e tooling and its browsers.
#
#   script/setup_agent_session.sh [--link] [--meditation]
#
#   --link        when the pinned Node is installed but is not the default
#                 `node`, link node, npm and npx into ~/.local/bin so that
#                 later shells use it (cloud containers; not needed with mise)
#   --meditation  also install apps/meditation, for a diff that touches it
#
# Safe to run again: an install whose lockfile did not change is skipped. It
# downloads no toolchain: with mise it runs `mise install`; without it, it
# looks for an already installed Node of the pinned version.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

link=0
meditation=0
for argument in "$@"; do
  case "$argument" in
    --link) link=1 ;;
    --meditation) meditation=1 ;;
    -h|--help) sed -n '2,15p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "setup: unknown option $argument" >&2; exit 2 ;;
  esac
done

pinned="$(tr -d '[:space:]' < .nvmrc)"
pinned="${pinned#v}"
run() { "$@"; }

if command -v mise >/dev/null 2>&1; then
  mise install
  run() { mise exec -- "$@"; }
elif [ "$(node --version 2>/dev/null || true)" != "v$pinned" ]; then
  node_bin=""
  for candidate in "/opt/node${pinned%%.*}/bin" "$HOME/.nvm/versions/node/v$pinned/bin" "${NVM_DIR:-$HOME/.nvm}/versions/node/v$pinned/bin"; do
    if [ -x "$candidate/node" ] && [ "$("$candidate/node" --version)" = "v$pinned" ]; then
      node_bin="$candidate"
      break
    fi
  done
  if [ -z "$node_bin" ]; then
    echo "setup: Node $pinned is not installed. Install mise (https://mise.jdx.dev), then run \`mise install\` here." >&2
    exit 1
  fi
  export PATH="$node_bin:$PATH"
  if [ "$link" = 1 ]; then
    mkdir -p "$HOME/.local/bin"
    for tool in node npm npx; do ln -sf "$node_bin/$tool" "$HOME/.local/bin/$tool"; done
    echo "setup: linked Node $pinned into $HOME/.local/bin."
  else
    echo "setup: Node $pinned is at $node_bin but is not the default. Rerun with --link, or put it first on PATH:"
    echo "  export PATH=\"$node_bin:\$PATH\""
  fi
fi

# npm records what it installed in node_modules/.package-lock.json: a lockfile
# older than that record is already installed.
install() {
  local directory="$1"
  shift
  if [ -f "$directory/node_modules/.package-lock.json" ] && [ ! "$directory/package-lock.json" -nt "$directory/node_modules/.package-lock.json" ]; then
    echo "setup: $directory dependencies are up to date."
  else
    run "$@"
  fi
}

install . npm ci --no-audit --no-fund
install tools/e2e npm run test:testerarmy:setup
run npm run test:testerarmy:browsers
if [ "$meditation" = 1 ]; then
  install apps/meditation npm ci --no-audit --no-fund --prefix apps/meditation
fi

echo "setup: ready. Node $(run node --version), hooks at $(git config --get core.hooksPath || echo 'not installed')."
if ! command -v deno >/dev/null 2>&1 && ! command -v mise >/dev/null 2>&1; then
  echo "setup: Deno is not installed: a diff under supabase/functions leaves verify:pr incomplete here."
fi
