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
# Safe to run again: an install that already succeeded for the same lockfile
# and patches is skipped. It installs no tool manager: with mise it runs
# `mise install`; without it, it looks for an already installed Node of the
# pinned version.
set -euo pipefail

self="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
root="$(dirname "$(dirname "$self")")"
cd "$root"

link=0
meditation=0
for argument in "$@"; do
  case "$argument" in
    --link) link=1 ;;
    --meditation) meditation=1 ;;
    -h|--help) sed -n '2,16p' "$self" | sed 's/^# \{0,1\}//'; exit 0 ;;
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
    # The link only helps if that directory comes before the other Node on PATH.
    if [ "$(PATH="${PATH#"$node_bin:"}" node --version 2>/dev/null || true)" != "v$pinned" ]; then
      echo "setup: $HOME/.local/bin is not ahead of the default node on PATH; put it first:" >&2
      echo "  export PATH=\"$HOME/.local/bin:\$PATH\"" >&2
    fi
  else
    echo "setup: Node $pinned is at $node_bin but is not the default. Rerun with --link, or put it first on PATH:"
    echo "  export PATH=\"$node_bin:\$PATH\""
  fi
fi

# An install is skipped only when the same lockfile and patches were installed
# to the end before: the stamp is written after the command succeeds, so a
# failed postinstall (patches, the hook) is retried on the next run.
digest() { if command -v sha256sum >/dev/null 2>&1; then sha256sum; else shasum -a 256; fi; }
identity() {
  local directory="$1"
  { cat "$directory/package-lock.json"; [ -d "$directory/patches" ] && cat "$directory"/patches/* 2>/dev/null; true; } | digest | cut -d' ' -f1
}
install() {
  local directory="$1"
  shift
  local stamp="$directory/node_modules/.setup-agent-session"
  local wanted
  wanted="$(identity "$directory")"
  if [ "$(cat "$stamp" 2>/dev/null || true)" = "$wanted" ]; then
    echo "setup: $directory dependencies are up to date."
  else
    run "$@"
    printf '%s\n' "$wanted" > "$stamp"
  fi
}

install . npm ci --no-audit --no-fund
# A clone or worktree that received an installed node_modules still needs the hook.
if [ "$(git config --get core.hooksPath || true)" != ".githooks" ]; then
  run node scripts/install-git-hooks.js
fi
install tools/e2e npm run test:testerarmy:setup
run npm run test:testerarmy:browsers
if [ "$meditation" = 1 ]; then
  install apps/meditation npm ci --no-audit --no-fund --prefix apps/meditation
fi

echo "setup: ready. Node $(run node --version), hooks at $(git config --get core.hooksPath || echo 'not installed')."
if ! command -v deno >/dev/null 2>&1 && ! command -v mise >/dev/null 2>&1; then
  echo "setup: Deno is not installed: a diff under supabase/functions leaves verify:pr incomplete here."
fi
