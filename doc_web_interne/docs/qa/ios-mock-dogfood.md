# iOS Simulator mock dogfood: French capture and reload

This flow checks the app in a compatible, already installed iOS Dev Client. It uses synthetic text and does not require a native rebuild, app reinstall, or data reset. The dogfood profile persists mock onboarding under `noctalia_mock_dogfood_v1:` keys, separate from real storage. Mock dreams and other preferences remain ephemeral. The release-notes modal is suppressed in this profile so it cannot obstruct repeated automation runs.

## Start

Use the project Node version and install from the lockfile if needed. Start Metro through the package script:

```sh
npm ci
npm run start:mock:dogfood -- --port 8081
```

Use the booted simulator with the matching `com.tanuki75.noctalia` Dev Client. In a second terminal:

```sh
xcrun simctl openurl booted 'exp+noctalia://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081&disableFab=1&disableAutoLaunch=1'
```

If the Dev Client opens its launcher, select the `http://127.0.0.1:8081` project. The `disableFab` parameter hides Expo's floating Tools button without moving product controls. Avoid `--localhost` for Metro on this Mac: it bound only to IPv6 `::1`, while the simulator URL above uses IPv4. See [Expo's development-build automation and deep-link guidance](https://docs.expo.dev/develop/development-builds/development-workflows/#using-updates-deep-links-in-automation-scenarios).

## Journey

1. In the app, complete or skip onboarding, then reach **Capturer**. Check that the top-right product control is unobstructed.
2. Copy this synthetic fixture to the Mac clipboard:

   ```sh
   printf '%s' 'Je marchais dans une forêt la nuit. La lune était rouge.' | pbcopy
   xcrun simctl pbpaste booted
   ```

   Wait and repeat `pbpaste` until it prints the exact fixture. The simulator clipboard sync can lag. The AXe typing driver used by XcodeBuildMCP accepts US keyboard characters only, so `type_text` cannot verify accented input.
3. Focus `input.dreamTranscript`, long-press it, and select **Coller** from the iOS edit menu. Use a fresh XcodeBuildMCP `snapshot_ui` to obtain the current element refs; the menu's `Coller` entry may appear in `capture.text` rather than the short `targets` list. Confirm the field value exactly matches the fixture, including `ê` and `é`.
4. Tap `btn.saveDream`, then `btn.dream.primaryCta`. In `analysis.reading.modal`, confirm the interpretation, symbol names, meanings, and emotions are French, and the close control `analysis.reading.close` works. Capture a screenshot.
5. Reload the connected app with `r` in the Metro terminal. Confirm onboarding does not return. Mock dreams reset on reload; check the exact transcript and French analysis before reloading. The dogfood profile suppresses the What's New dialog during automation.
6. Stop and relaunch the existing app without clearing data, then reopen the Dev Client project if its launcher appears. Confirm it opens the main app (for example, Aujourd’hui or Capturer) rather than onboarding.
7. Switch between mock account profiles after completing guest onboarding. Confirm onboarding stays completed for each profile without sharing guest dream content.
8. While the app is open, run `xcrun simctl openurl booted 'noctalia://settings'`. Confirm Paramètres opens. A cold app-specific deep link is outside this Dev Client flow; Expo documents warm-link support. Do not send `/--/settings` to the Metro server.

## Evidence record

For each run, save the Git revision, installed app identifier/version, simulator UDID and iOS version, Metro profile/port, exact fixture, observed field value, pass/fail of each step, and screenshots of the analysis, relaunch destination, profile switch, and Settings link. State explicitly that a Dev Client/mock run does not qualify real backend persistence or a store build.
