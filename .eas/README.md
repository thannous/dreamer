EAS configuration and keys directory

- Place your Google Play Console Service Account JSON at:
  `.eas/keys/google-service-account.json`

- This file is ignored by git (see `.gitignore`). Do not commit it.

- Submit examples:
  - Internal track: `npx eas submit -p android --profile internal --latest`
  - Production track: `npx eas submit -p android --profile production --latest`

- You can also set `EXPO_PUBLIC_API_URL` as a project secret in EAS to avoid
  committing environment values into `eas.json`:
  `npx eas secret:create --name EXPO_PUBLIC_API_URL --value https://your.api`

