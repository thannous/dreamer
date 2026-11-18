# Noctalia signup confirmation

In the intended Supabase project, open **Authentication → Email Templates →
Confirm sign up**. Save the current subject and message body for rollback, then
paste the full [subject template](confirmation.subject.txt) and
[confirmation template](confirmation.html) in their corresponding fields.
The French copy is selected when the signup metadata contains `lang: fr`.
English is the fallback. The link uses Supabase's `{{ .ConfirmationURL }}`.

Validate on an isolated project with fresh French and English test signups. Open the delivered
message in Gmail for iOS in light and dark modes, then tap **Confirm my email** and check that the account is confirmed. The images are decorative
and served from Noctalia's public site. The message and action are also
available with remote images disabled.

The repository's native Supabase CLI stack rejects `content_path` for auth
templates. Keep this hosted template out of the shared local `config.toml`.

[Supabase email template documentation](https://supabase.com/docs/guides/auth/auth-email-templates)
