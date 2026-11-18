# Noctalia signup confirmation

In the intended Supabase project, open **Authentication → Email Templates →
Confirm sign up**. Save the current subject and message body for rollback, then
set the subject to **Confirm your email for Noctalia** and paste the full
[confirmation template](confirmation.html) as the message body. Apply only
this template. The confirmation link uses Supabase's `{{ .ConfirmationURL }}`.

Validate on an isolated project with a fresh test signup. Open the delivered
message in Gmail for iOS in light and dark modes, then tap **Confirm my email** and check that the account is confirmed. The images are decorative
and served from Noctalia's public site. The message and action are also
available with remote images disabled.

The repository's native Supabase CLI stack rejects `content_path` for auth
templates. Keep this hosted template out of the shared local `config.toml`.

[Supabase email template documentation](https://supabase.com/docs/guides/auth/auth-email-templates)
