# Noctalia Meditation — Store kit 1.0.0

Copy the localized text to the **Noctalia Meditation** records (`com.noctalia.meditation` on both platforms), not to the Noctalia or Lucid records. This kit does not upload metadata, launch a build, or submit the app.

| App language | File | App Store Connect | Google Play Console |
| --- | --- | --- | --- |
| English | [en](en.json) | en-US | en-US |
| Français | [fr](fr.json) | fr-FR | fr-FR |
| Español | [es](es.json) | es-ES | es-ES |
| Deutsch | [de](de.json) | de-DE | de-DE |
| Italiano | [it](it.json) | it | it-IT |
| Português (Brasil) | [pt](pt.json) | pt-BR | pt-BR |

| JSON field | App Store Connect | Google Play Console |
| --- | --- | --- |
| `name` | Name (30 characters) | App name (30 characters) |
| `description` | Description (4,000 characters) | Full description (4,000 characters) |
| `releaseNotes` | What's New, if available (4,000 characters); not used for the first App Store version | Release notes (500 characters per language), under the release rather than the listing |
| `appStore.subtitle` | Subtitle (30 characters) | — |
| `appStore.keywords` | Keywords (100 UTF-8 bytes) | — |
| `appStore.promotionalText` | Promotional text (170 characters) | — |
| `googlePlay.shortDescription` | — | Short description (80 characters) |

Google Play has no separate keyword or promotional-text field on the main listing. See [Apple's app information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/), [Apple's platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/), [Google's listing instructions](https://support.google.com/googleplay/android-developer/answer/9859152), and [Google's release instructions](https://support.google.com/googleplay/android-developer/answer/9859348).

## Before submission

- Use the [privacy worksheet](privacy.md) and verify it against the final signed binaries and existing public policies.
- The current release profile leaves sales off. If one-time world purchases are enabled before release, update the store text, all six privacy-policy sections and both disclosure forms before submission. Qualify purchase, entitlement and restore on both stores. There are no subscriptions; audio remains free and bundled.
- Supply final screenshots and complete the store-specific review, age rating and compliance forms for the actual candidate. Native build numbers remain managed by EAS remote auto-increment; verify them against both store records when a build is authorized.
