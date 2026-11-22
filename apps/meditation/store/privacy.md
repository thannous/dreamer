# Privacy worksheet — Noctalia Meditation 1.0.0

These are proposed console answers for the **current production configuration**, not a submitted declaration. `eas.json` disables accounts, subscriptions, and mock mode. World sales are mock-only in [worldSales.ts](../constants/worldSales.ts); all worlds are free in the current production code. Do not use these answers unchanged if sales or any other outbound data flow is activated.

## App Store Connect → App Privacy

- **Do you or your third-party partners collect data from this app? No.** Proposed label: **Data Not Collected**.
- **Data used to track you: None.** No ad or tracking integration is used by Meditation. No data types or purposes to select.

## Google Play Console → App content → Data safety

- **Does your app collect or share any of the required user data types? No.** Proposed display: **No data collected** and **No data shared with third parties**.
- With that answer, do not select any collected/shared types. Encryption in transit and server deletion are not applicable to local-only app data; there is no account creation or account-deletion URL to report. Users may still erase their local data in **Settings → Your profile → Erase my data**.

## Evidence and boundaries

| Feature / SDK | Behavior relevant to the declarations |
| --- | --- |
| Practice, preferences and local profile | [AsyncStorage](../services/storageService.ts) stores practice history, saved sessions, progress, goals, preferences and profile data on-device. [Profile settings](../app/settings/account.tsx) accept an optional photo from the system picker and store its local URI. Reset clears app storage and attempts to cancel scheduled reminders. There is no app account, cloud sync or application backend in this profile. OS backups, if enabled by the user/platform, are separate from app collection. |
| Reminders | [Expo Notifications](../services/notificationServiceReal.ts) schedules notifications locally. No app code registers for or sends push tokens. |
| Breathing and session audio | [Bundled audio](../content/worldSounds.ts) is free, nonverbal and not streamed. [Voice cues](../lib/breathGuidance.ts) pass only localized phase instructions to system text-to-speech, not microphone input, a profile or a practice history. [The Expo config](../app.json) disables audio recording and camera permissions for the relevant plugins. |
| Purchases | World offers and receipt handling use [RevenueCat](../services/worldPurchaseServiceReal.ts) only when reached. [The world provider](../context/WorldPurchaseContext.tsx) skips startup configuration with sales off; free worlds expose no purchase or restore action. [The subscription provider](../context/SubscriptionContext.tsx) also skips SDK initialization when subscriptions are off. The installed SDK and Android Billing permission alone do not establish collection. |
| Browser and support | [Legal and support links](../constants/legalLinks.ts) and the optional link to Noctalia open an external browser, another app or the user's email client. No Meditation practice or profile data is attached. Separately, the website has its own privacy disclosures and a support email can contain information the user chooses to send. |

## Existing privacy policy

**Settings → Legal → Privacy Policy** already opens the localized first-party policies. Each has a **Noctalia Meditation** section; use the corresponding public link for the stores, or English when the console permits only one URL:

- [English](https://noctalia.app/en/privacy-policy/)
- [Français](https://noctalia.app/fr/politique-confidentialite/)
- [Español](https://noctalia.app/es/politica-privacidad/)
- [Deutsch](https://noctalia.app/de/datenschutz/)
- [Italiano](https://noctalia.app/it/privacy-policy/)
- [Português (Brasil)](https://noctalia.app/pt-br/politica-de-privacidade/)

The [site sources](../../../docs-src/content/pages/legal.privacy) distinguish Meditation from the Noctalia dream journal and Lucid; their collection does not carry over to Meditation. TiMax is named as controller and [contact@noctalia.app](mailto:contact@noctalia.app) is the published privacy contact.

## If one-time world purchases are activated

Do not file the no-collection answers above for an enabled-sales build. The code requests non-subscription store products and uses store receipts and RevenueCat customer information to validate, unlock and restore worlds. It calls `Purchases.configure` without a custom app user ID; the SDK uses its own anonymous ID. The platform store handles the payment, not Meditation.

- **Apple:** with that anonymous configuration and no integrations or way to link the ID to an individual, RevenueCat's guidance calls for **Purchase History → App Functionality and Analytics** (RevenueCat reporting), **not linked to the user's identity**, and **not used for tracking**. Recheck linked data and identifier answers against the final configuration.
- **Google Play:** declare **Financial info → Purchase history**, **collected**, **not processed ephemerally**, for **App functionality and Analytics**. RevenueCat encrypts data in transit. Do not mark the transfer as shared only if RevenueCat qualifies as a service provider acting on TiMax's behalf and no other sharing applies. Confirm required vs optional from the final data flow (the existing enabled-sales flow would initialize at startup, not only on purchase); confirm the deletion-request process before asserting it on the form. Review the final SDK settings for any additional identifiers, partners or data types.
- Update the published Meditation policy in all locales before submitting an enabled-sales build: describe the single-purchase model, store and RevenueCat processing, data and purposes, applicable retention and deletion, support contact, and any active partners. A local reset does not delete store or processor purchase records.

Before filing either form, inspect the built SDKs and production options (including store SDKs and Android's native services) and check the candidate's outbound traffic on clean launch, practice, reminders and any enabled purchase/restore paths. For iOS, verify the final bundled privacy manifests and required-reason API declarations separately from the nutrition label. No signed candidate or runtime network trace was produced as part of this kit.

References: [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/), [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469), [RevenueCat / Apple](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy), [RevenueCat / Google Play](https://www.revenuecat.com/docs/platform-resources/google-platform-resources/google-plays-data-safety).
