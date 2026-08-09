# Dream Journal App Comparison Dataset 2026

## Deposit status

This is a pre-publication deposit companion for version `1.0.0`. No repository
account has been created, no DOI has been reserved, and no deposit has been
published from this package.

The copyright holder has not yet approved a formal reuse license. Before any
public deposit, replace this notice with the approved license. The proposed
license is Creative Commons Attribution 4.0 International (`CC BY 4.0`).

## Dataset

- Source file: `docs-src/static/data/dream-journal-apps-comparison-2026.csv`
- Deposit copy: `dream-journal-apps-comparison-2026.csv` in this directory
- Public distribution: <https://noctalia.app/data/dream-journal-apps-comparison-2026.csv>
- Landing page: <https://noctalia.app/en/dream-journal-apps#dataset>
- Format: UTF-8 CSV with a header row
- Dimensions: 11 app records and 11 columns
- Version: `1.0.0` (proposed first repository release)
- First public citation date: 2026-08-03
- Latest source-route verification in this package: 2026-08-09
- SHA-256: `c5fc652cf6af20184fc6e5c3c3d3e96ba506c69cb229516301af1380892ff28e`

The deposit copy is intentionally byte-for-byte identical to the tracked source
file. Re-run both a byte comparison and `SHA256SUMS.txt` verification immediately
before creating a repository draft; do not upload a regenerated spreadsheet.

## Scope and method

This dataset is a dated desk review of claims visible on official product pages
and public app-store listings. It compares dedicated dream journals and broader
journals with a documented dream workflow. No competitor account was created,
no subscription was purchased, and no clinical or hands-on product benchmark was
performed.

Each row records the source used and the date on which that row was last
reviewed. `Yes` means that the linked official source advertised the feature on
that date. Qualified values such as `Limited`, `Strong`, or `Text-first` preserve
narrower or incomplete public evidence rather than converting it to a binary
score.

Noctalia produced this compilation and is one of the apps represented. The rows
are not a ranking, market-share estimate, quality score, efficacy claim, or
independent product endorsement.

## Data dictionary

| Column | Meaning |
| --- | --- |
| `app` | Public product name used by the source |
| `platforms` | Publicly advertised platform or distribution status |
| `voice_capture` | Public signal for voice-based dream capture |
| `ai_interpretation` | Public signal for AI-assisted interpretation or reflection |
| `generated_images` | Public signal for generated dream imagery |
| `privacy_or_export_signal` | Concise privacy, deletion, backup, or export claim visible in the source |
| `lucid_dreaming` | Public signal for lucid-dreaming tools or positioning |
| `best_for` | Editorial description of the product's clearest public positioning |
| `caveat` | Material limitation or unresolved point in the public evidence |
| `source_url` | Official product or app-store source used for the row |
| `last_reviewed` | ISO date of the row's latest documented review |

## Reproducibility and limits

The four summary counts published on the landing page use exact, disclosed
category rules. They can be reproduced by filtering the normalized CSV values.
Broader or qualified labels are excluded unless the landing page names them.

Product pages, prices, availability, and features can change after the review
date. The dataset contains vendor-supplied public claims, not private user data,
medical data, user dream records, survey responses, or performance measurements.
Researchers and journalists should recheck the linked official source before
using a changing product fact.

## Suggested citation before DOI publication

Noctalia. (2026, August 3). *Dream Journal App Comparison Dataset 2026*
(Version 1.0.0) [Data set].
<https://noctalia.app/en/dream-journal-apps#dataset>

After a repository DOI is published, replace the final URL with the DOI in the
preferred citation and retain the landing page as a related identifier.

## Corrections

Send a dated official source for a correction to `contact@noctalia.app`.
