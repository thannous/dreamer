# Web password recovery rollout

The Dreamer web reset route accepts only two GoTrue recovery proofs:

- A same-browser PKCE `code` from `resetPasswordForEmail`, bound to the browser's stored recovery verifier and exchanged in a memory-only client.
- A `token_hash` with `type=recovery`, redeemed through `verifyOtp` in an isolated in-memory client. The reset screen confirms the account email, changes the password and sends the user to explicit sign-in; neither recovery path installs its session in the app.

An `access_token`/`refresh_token` URL, even with `type=recovery`, is rejected and removed from the address bar. Existing implicit links therefore expire at the new web client. A reset started on iOS/Android or opened in a different browser requires the hosted Supabase **Reset password** email template to link directly to the app with a token hash:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery">Reset password</a>
```

Keep the redirect URL on the project's Auth allowlist. The app's `resetPasswordForEmail` call supplies `/auth/reset-password` on its current web origin. Changing the hosted template, allowlist or live service is a separate deployment action; this repository patch does not make it. Before publishing the web client, verify the template on the intended Supabase project and exercise a fresh link from the same browser and from a different browser or the native app. Check that the URL loses the credential, a wrong account email cannot change the password, a valid link updates only the verified account, and the token-hash flow returns to sign-in without replacing an existing app session. Old implicit links need a fresh recovery request.

Lucid uses the same Supabase Auth project as Dreamer, so the hosted recovery template is shared. New Dreamer and Lucid native builds redeem a token hash on `/auth/reset-password` through a separate, memory-only Auth client. The account email must match the verified recovery user; an existing app session is not replaced. Lucid web already requests its own origin's `/auth/reset-password` route, and new Lucid native builds now do the same.

On native, the route captures the one-use hash, then clears authentication parameters from Expo Router's route state with `router.setParams`. The local route test checks that the form retains the hash after parameters are removed. A signed-device run must still verify the actual navigation URL and log behavior; the operating system's original deep-link URL cannot be erased by the app.

Older installed Lucid binaries still request `https://lucid.noctalia.app/lucid/account`. To preserve their existing link behavior while new builds roll out, the hosted template can branch on that exact redirect (Supabase templates support Go `eq`):

```html
{{ if eq .RedirectTo "https://lucid.noctalia.app/lucid/account" }}
  <a href="{{ .ConfirmationURL }}">Reset password</a>
{{ else }}
  <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery">Reset password</a>
{{ end }}
```

That branch preserves the prior flow for an old Lucid binary; it is not proof that the old binary can complete a reset. An old Dreamer binary already requests `/auth/reset-password`, the same redirect as Dreamer web, so `.RedirectTo` alone cannot distinguish it for a template condition. Sending either old native binary a token-hash link to `/auth/reset-password` would not work: its route exists, but it cannot redeem the hash, and its iOS/Android app links may open the native app instead of the web page. Before activating the shared template, qualify fresh links on Dreamer web, Lucid web, and signed new native builds, and establish a recovery path for old installed binaries (for example, a separately hosted browser-only reset page). A template condition for Lucid's old account redirect does not solve Dreamer's old binary. Updating the template, allowlist, deployments or installed apps is outside this repository patch.

See [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates) and [JavaScript password reset](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).
