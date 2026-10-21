# Web password recovery rollout

The Dreamer web reset route accepts only two GoTrue recovery proofs:

- A same-browser PKCE `code` from `resetPasswordForEmail`, bound to the browser's stored recovery verifier and exchanged in a memory-only client.
- A `token_hash` with `type=recovery`, redeemed through `verifyOtp` in an isolated in-memory client. The reset screen confirms the account email, changes the password and sends the user to explicit sign-in; neither recovery path installs its session in the app.

An `access_token`/`refresh_token` URL, even with `type=recovery`, is rejected and removed from the address bar. Existing implicit links therefore expire at the new web client. A reset started on iOS/Android or opened in a different browser requires the hosted Supabase **Reset password** email template to link directly to the app with a token hash:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery">Reset password</a>
```

Keep the redirect URL on the project's Auth allowlist. The app's `resetPasswordForEmail` call supplies `/auth/reset-password` on its current web origin. Changing the hosted template, allowlist or live service is a separate deployment action; this repository patch does not make it. Before publishing the web client, verify the template on the intended Supabase project and exercise a fresh link from the same browser and from a different browser or the native app. Check that the URL loses the credential, a wrong account email cannot change the password, a valid link updates only the verified account, and the token-hash flow returns to sign-in without replacing an existing app session. Old implicit links need a fresh recovery request.

The hosted template may be shared with Lucid. Its native `getPasswordResetRedirect()` currently points to `https://lucid.noctalia.app/lucid/account`, which does not consume a recovery `token_hash`. Qualify or adapt that route before changing a shared template; otherwise Lucid recovery would fail. This Dreamer patch does not activate the hosted template.

See [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates) and [JavaScript password reset](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).
