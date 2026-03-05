# Link Opportunities Review

Source export: `C:\Users\thann\Downloads\noctalia_02-mar-2026_link-opportunities_2026-03-06_00-16-48.csv`

Method used:
- Follow Ahrefs' Link Opportunities workflow: filter by target page or keyword, review `Keyword context`, and prioritize stronger source pages by `PR`.
- Validate targets against localized URLs in the codebase before treating a row as actionable.

## Key Findings

- The export contains 11 rows across 10 source pages.
- 10 of 11 rows point to `/en/blog/dream-journal-guide`.
- Most of those source pages are Italian or German, but localized target pages already exist:
  - IT: `https://noctalia.app/it/blog/dream-journaling-la-guida-completa-per-registrare-le-tue-avventure-notturne`
  - DE: `https://noctalia.app/de/blog/dream-journaling-der-vollstaendige-leitfaden-zum-aufzeichnen-ihrer-naechtlichen-abenteuer`
  - ES: `https://noctalia.app/es/blog/guia-diario-suenos`
- Three rows come from legal pages (`privacy-policy`, `termini`, `datenschutz`, `agb`). These are technically valid mentions but low-value internal links.
- One row is a strong Spanish editorial opportunity: `/es/simbolos/avion` to `/es/blog/suenos-de-volar`.

## Highest Priority

| Priority | Source page | Recommended target | Anchor/theme | Why it matters |
| --- | --- | --- | --- | --- |
| 1 | `https://noctalia.app/es/simbolos/avion` | `https://noctalia.app/es/blog/suenos-de-volar` | `soñar con volar` | Best row in the file. `PR` 45, exact topical match, same locale, same intent. |
| 2 | `https://noctalia.app/it/blog/come-ricordare-i-tuoi-sogni-10-tecniche-efficaci` | `https://noctalia.app/it/blog/dream-journaling-la-guida-completa-per-registrare-le-tue-avventure-notturne` | `dream journaling` | Strong editorial fit. Readers already looking for dream recall tactics are likely to click through to a journaling guide. |
| 3 | `https://noctalia.app/it/blog/perche-dimentichiamo-i-nostri-sogni-la-scienza-dietro-l-amnesia-onirica` | `https://noctalia.app/it/blog/dream-journaling-la-guida-completa-per-registrare-le-tue-avventure-notturne` | `dream journal` or `dream journaling` | Appears twice in the export. Use one natural contextual link, not two. |
| 4 | `https://noctalia.app/it/blog/guida-ai-sogni-lucidi-per-principianti-prendi-il-controllo-delle-tue-notti` | `https://noctalia.app/it/blog/dream-journaling-la-guida-completa-per-registrare-le-tue-avventure-notturne` | `dream journal` | Clear topical overlap. Dream journaling is a natural support concept for lucid dreaming. |
| 5 | `https://noctalia.app/it/blog/incubi-cause-significato-e-come-fermarli` | `https://noctalia.app/it/blog/dream-journaling-la-guida-completa-per-registrare-le-tue-avventure-notturne` | `dream journaling` | Good contextual fit if the paragraph discusses recording nightmares or reducing nightmare intensity. |
| 6 | `https://noctalia.app/it/blog/sogni-e-salute-mentale-come-il-tuo-sonno-rivela-la-tua-mente` | `https://noctalia.app/it/blog/dream-journaling-la-guida-completa-per-registrare-le-tue-avventure-notturne` | `dream journaling` | Relevant, but the context reads broader than the rows above, so place after the clearer instructional pages. |

## Low Priority Or Skip

| Source page | Recommended action | Reason |
| --- | --- | --- |
| `https://noctalia.app/it/privacy-policy` | Skip | Legal page mention is not editorial. Do not clutter legal copy for SEO. |
| `https://noctalia.app/it/termini` | Skip | Same issue. Valid term match, weak UX and little ranking value. |
| `https://noctalia.app/de/datenschutz` | Skip | Same issue. |
| `https://noctalia.app/de/agb` | Skip | Same issue. |

## Important Corrections

Before implementing any of the dream journal rows, swap the English target for the source locale:

- IT sources should link to `https://noctalia.app/it/blog/dream-journaling-la-guida-completa-per-registrare-le-tue-avventure-notturne`
- DE sources should link to `https://noctalia.app/de/blog/dream-journaling-der-vollstaendige-leitfaden-zum-aufzeichnen-ihrer-naechtlichen-abenteuer`
- ES sources should link to `https://noctalia.app/es/blog/guia-diario-suenos` when the opportunity is about dream journaling

## Recommended Execution Order

1. Add the Spanish link from `/es/simbolos/avion` to `/es/blog/suenos-de-volar`.
2. Add 3 to 5 Italian editorial links to the localized dream journal guide.
3. Ignore legal-page suggestions unless you explicitly want navigational links there for users, not SEO.
4. Re-run Ahrefs after implementation so the next export reflects the locale-correct targets.
