# Noctalia

Noctalia contains Dreamer (the dream journal), Lucid (lucid-dreaming practice),
Meditation, their shared tooling, a Supabase backend and a multilingual marketing site.

- Website: https://noctalia.app
- Google Play: https://play.google.com/store/apps/details?id=com.tanuki75.noctalia
- Contact: contact@noctalia.app

For development, start with the [repository task index](doc_web_interne/docs/README.md)
and the [command catalog](scripts/README.md).

## What It Does

Noctalia helps people record dreams by voice or text, then turns those entries into structured dream insights:

- Automatic dream transcription
- AI-guided dream interpretation
- Recurring symbols and dominant themes
- Dream type and emotion tracking
- Generated image for each dream entry
- Guided reflection for follow-up questions
- Dream symbol dictionary
- Lucid dreaming rituals and recall habits

Dreamer is available in English, French, Spanish, German, Italian and Portuguese.
The other applications have their own content and locale coverage.

## Positioning

Noctalia is designed for dream journaling, sleep reflection, personal development, and lucid dreaming practice. It is not a medical or diagnostic product.

## Privacy

Dreamer's recording flow converts speech to text and cleans up temporary native
audio. Lucid's optional voice notes are stored locally and follow a separate
[product contract](specs/noctalia-brand-contract.md). See the
[transcription guide](doc_web_interne/docs/speech-to-text-integration.md) for
platform behavior and the [published privacy policy](https://noctalia.app/en/privacy-policy)
for the user-facing policy.

## Development

To open Dreamer locally with simulated services, from the repository root:

```sh
mise install
mise exec -- npm ci
mise exec -- npm run start:mock -- --web
```

Use the local URL printed by Expo. This profile does not require backend
credentials; some fixture images still load from remote URLs. See the
[mock quick start](MOCK_MODE_QUICKSTART.md) for persistent fixtures.

| Area | Source and starting guide |
| --- | --- |
| Dreamer | `app/`, shared `components/`, `hooks/`, `services/`; [task index](doc_web_interne/docs/README.md) |
| Lucid | `routes/lucid/`; [product and runtime specification](specs/noctalia-lucid-trainer.md) |
| Meditation | `apps/meditation/`, with its own install and commands; [local guide](apps/meditation/AGENTS.md) |
| Backend | `supabase/`; [backend entry point](README_BACKEND.md) |
| Marketing site | `docs-src/` and `data/`; [site guide](docs-src/README.md). `docs/` is generated. |

See [AGENTS.md](AGENTS.md) for repository conventions and the
[proportional validation guide](doc_web_interne/docs/validation-proportionnee.md)
for choosing tests and reviews according to the change.
