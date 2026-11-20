# Noctalia signup confirmation

In the intended Supabase project, open **Authentication → Email Templates →
Confirm sign up**. Save the current subject and message body for rollback, then
paste the full [subject template](confirmation.subject.txt) and
[confirmation template](confirmation.html) in their corresponding fields.
The app sends its selected language in signup metadata as `lang`. The
template supports French, English, Spanish, German, Italian and Portuguese.
English is the fallback when the language is missing or unsupported. The
link uses Supabase's `{{ .ConfirmationURL }}`.

Validate with fresh signups in an isolated project. Open the delivered
message in Gmail for iOS in light and dark modes, then tap the confirmation
button and check that the account is confirmed. The decorative images are
served from Noctalia's public site. The message and action are also
available with remote images disabled.

The repository's native Supabase CLI stack rejects `content_path` for auth
templates. Keep this hosted template out of the shared local `config.toml`.

[Supabase email template documentation](https://supabase.com/docs/guides/auth/auth-email-templates)
