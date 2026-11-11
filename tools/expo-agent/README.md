# Expo agent CLI

This private tooling package pins experimental `@expo/agent-cli` **1.0.23**.
It is shared by Dreamer/Lucid (repository root) and Meditation (`apps/meditation`).
Neither app's dependencies, lockfile, SDK nor npm scripts are changed by this tool.
The separate package follows the existing `tools/e2e` isolation pattern and avoids
adding agent tooling to app manifests used by the native runtime fingerprint.

## Install and inspect

Use the repository Node version (`mise exec --` unless already activated):

```sh
mise exec -- npm ci --prefix tools/expo-agent
mise exec -- node tools/expo-agent/run.cjs --version
mise exec -- npm run status --prefix tools/expo-agent
mise exec -- npm run plan:ios --prefix tools/expo-agent
mise exec -- npm run plan:android --prefix tools/expo-agent
```

The runner preserves the caller's working directory. The package's convenience
scripts explicitly select the repository root, since npm changes directory.
To select Meditation, run from its own directory:

```sh
cd apps/meditation
mise exec -- node ../../tools/expo-agent/run.cjs status --json
mise exec -- node ../../tools/expo-agent/run.cjs dev --ios --local --plan --json
mise exec -- node ../../tools/expo-agent/run.cjs dev --android --local --plan --json
```

For Lucid, supply the existing Lucid profile/environment before diagnosis; it
shares the root dependency tree with Dreamer. A root report with no Lucid profile
only establishes Dreamer's configuration. In a clean shell, for example:

```sh
mise exec -- node --env-file=.env.lucid.mock tools/expo-agent/run.cjs status --no-fingerprint-cache --json
mise exec -- node --env-file=.env.lucid.mock tools/expo-agent/run.cjs dev --ios --local --plan --no-fingerprint-cache --json
```

Use `--no-fingerprint-cache` when switching profiles: the CLI's cached config
can otherwise reflect the previous environment. Keep `start:lucid` /
`start:lucid:mock` and the existing profile launchers for running it.

`status` may cache under `.expo` and inspect existing local services or EAS build
metadata; it does not build. Do not pass a physical `--device` casually: on iOS
that flag consents to launching the app. Its default exit 0 means a report was
produced, not that configuration, freshness or a device has been qualified.
Read the report's `errors`, reasons and unknown fields. `dev --plan --local`
prints the proposed steps without executing them. `--local` explicitly keeps
both build and device backends local.

## Set up each app's skills and documentation

From the repository root:

```sh
mise exec -- npm run setup --prefix tools/expo-agent
mise exec -- npm run skills:sync --prefix tools/expo-agent
```

Then independently from `apps/meditation`:

```sh
mise exec -- node ../../tools/expo-agent/run.cjs agents:setup --yes --project --agent codex --no-plugins --no-agents-md --json
mise exec -- node ../../tools/expo-agent/run.cjs skills:sync --agent codex --json
```

Setup links skills shipped by installed packages, saves the explicit agent
selection in `.expo/agent-skill-links.json`, updates generated `.gitignore`
entries and downloads local Expo SDK docs. It does not install a global plugin.
Use `skills:sync --dry-run --agent codex --json` to inspect link changes, and
`skills:list` / `skills:show <name>` to inspect available package guidance.
SDK 58 introduces colocated skills; not every Expo package contains one.
Run sync again after dependency changes; ordinary `npm ci` does not run it.
The skill links and `.expo` caches are generated and must not be committed.
Use `docs:sync` / `docs:search <query>` to refresh or find SDK documentation.

The upstream setup's default managed AGENTS block was inspected. It introduces
unpinned commands and generic launch/release advice. This repository uses
`--no-agents-md` and hand-maintained shared instructions to preserve guarded
profiles and delivery rules. Do not create CLAUDE.md; all agents read AGENTS.md.
`--no-docs` can defer documentation downloading when offline, but that is not a
successful documentation sync. Setup errors must remain visible.

## Official Expo plugin and MCP

Install the official Codex plugin once per machine. Its skills complement the
package-specific skills linked above; this does not replace the pinned agent CLI.
The current official plugin name is `expo` (the older announcement used `expo2`).

```sh
codex plugin add expo@openai-curated
codex mcp list
```

Check that `expo` points to `https://mcp.expo.dev/mcp`. Some plugin bundles
register the server automatically; the installed `d420d130` bundle contains only
skills. If the server is absent, register it once:

```sh
codex mcp add expo --url https://mcp.expo.dev/mcp
```

That command starts OAuth. For an existing server, use `codex mcp login expo`.
Complete authorization in the browser with the same Expo account as Expo CLI.
Limit access to the accounts that own the selected apps. Developer covers normal
builds and updates; Release Manager also covers protected channels and credentials.
Restart the Codex chat/session after installation to load its skills and tools.

Both app roots declare `expo-mcp` as a development dependency. Enable local
capabilities explicitly while retaining the existing profile-aware launchers:

```sh
# Dreamer mock, from the repository root
EXPO_UNSTABLE_MCP_SERVER=1 mise exec -- npm run start:mock -- --localhost
# Lucid mock, from the repository root
EXPO_UNSTABLE_MCP_SERVER=1 mise exec -- npm run start:lucid:mock -- --localhost
# Meditation mock, from apps/meditation
EXPO_UNSTABLE_MCP_SERVER=1 mise exec -- npm run start:mock -- --localhost
```

Reconnect the Expo MCP connection when Metro starts or stops. For native
inspection, keep the existing device ownership, profile and QA locks. Configure
ports explicitly when several apps run together. The remote connection needs
OAuth; installing the local package alone does not prove authentication or a
running app. SDK/dependency checks and MCP setup are distinct from native Release
qualification. See [Expo MCP](https://docs.expo.dev/mcp/) and
[official Expo skills](https://docs.expo.dev/skills/).

## Existing workflow boundaries

Use this pinned runner for equivalent standalone Expo operations (including
SDK-compatible `install <package>`). Keep canonical guarded launchers and
release scripts; do not substitute a raw `dev`, `typecheck` or `deploy` for their
profile preparation, route generation, checks or consent. Review CLI suggestions
against the selected task instead of automatically executing the next command.
Native run/smoke/inspection requires the repository's owned, isolated QA device
and lock protocol. Do not disturb existing Metro sessions, personal apps or
another worktree's `agent-cli` simulator. CLI `smoke` checks development loading
and runtime errors; TesterArmy remains the real journey and Release authority.
No EAS build/session, deployment, Store submission, permission change or data
reset is implied by setup. There is no EAS backend configured by this integration.
`verify:pr` and `verify:release` retain their full existing scope.

## Upstream references

- [Introduction](https://expo.dev/blog/introducing-expo-agent-cli)
- [Official package documentation](https://github.com/expo/expo-agent-cli/tree/main/packages/@expo/agent-cli)
- The installed package's `README.md` and each command's `--help` describe the
  pinned version. Upgrade the explicit dependency and lockfile deliberately,
  then repeat setup inspection, status and local plans for both app roots.
