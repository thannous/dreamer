# Linkable asset: 11-app feature snapshot — 2026-08-10

This pass turns four reproducible fields from Noctalia's public 11-app dataset
into a publication-ready 1200 × 675 SVG. It is an owned citation asset for
future earned-media pitches, not an external backlink or evidence of a Domain
Rating increase.

## Public package

- Source page: `https://noctalia.app/en/dream-journal-apps#feature-snapshot`
- Graphic: `https://noctalia.app/img/research/dream-journal-apps-feature-snapshot-2026.svg`
- Dataset: `https://noctalia.app/data/dream-journal-apps-comparison-2026.csv`
- Methodology: `https://noctalia.app/en/dream-journal-apps#methodology`
- Press-kit discovery route: `https://noctalia.app/en/press`

The comparison and press pages expose the graphic through visible links and an
`ImageObject` schema entry. The comparison page supplies the source CSV,
methodology, attribution wording and limitations beside the image.

## Reproducible counts

| Signal | Count | Included normalized CSV labels |
| --- | ---: | --- |
| AI interpretation | 10 / 11 | Nine `Yes` rows plus DreamKit's `Former listing advertised it` row. DreamMirror's `Reflective AI stance` is excluded. |
| Voice capture | 7 / 11 | `Strong`, `Yes`, or `Text and voice positioning`. |
| Generated images | 4 / 11 | Three `Yes` rows plus DreamKit's `Former listing advertised it` row. Partial visual claims and editorial styles are excluded. |
| Lucid-dreaming structure | 3 / 11 | Oniri `Strong`, Dreamiary `Yes`, and DreamKit's `Former listing advertised reality checks`. |

DreamKit remains a historical listing row in the source dataset. The graphic
therefore describes normalized dataset signals, not current hands-on feature
availability. It also does not claim a ranking, market share, product quality,
clinical evidence or medical benefit.

## Intended backlink use

Use the graphic only as supporting evidence in an already-qualified editorial
pitch, source response or approved owned-publication excerpt. Link recipients to
the stable comparison page so the chart's methodology and caveats remain
available. Do not send the asset as a cold attachment, promise a followed link,
or describe reuse as independent editorial endorsement.

No third-party account, post, message, form, attachment, payment or publication
was used in this pass. No Russian-operated site was opened or added.

## Validation

- SVG XML parse: passed.
- CSV reconciliation: 11 rows; calculated counts are 10, 7, 4 and 3 under
  the explicit label rules above.
- `git diff --check`: passed.
- `npm run docs:build`: passed with 1,196 sitemap URLs.
- `npm run docs:check`: passed across 1,199 HTML pages and 128,579 link
  references, with zero broken internal links, zero errors and zero warnings.

These checks prove local source and generated-site integrity. Public URLs and
edge headers still require verification after the authorized production push.
