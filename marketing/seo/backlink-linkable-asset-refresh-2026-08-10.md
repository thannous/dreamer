# Linkable-asset integrity refresh — 2026-08-10

This pass improved Noctalia's public comparison dataset as a citable editorial
asset. It changed site sources only. No outreach, form, account, payment,
publication on a third-party site or backlink claim was used.

## Live pre-change evidence

The rendered English comparison at
https://noctalia.app/en/dream-journal-apps was self-canonical and
index, follow. It exposed:

- two visible download links to
  https://noctalia.app/data/dream-journal-apps-comparison-2026.csv;
- a rendered Dataset JSON-LD object with dateModified set to 2026-08-09,
  a free DataDownload distribution and the stable #dataset identifier;
- visible methodology, independence, correction, reuse and citation sections.

Two integrity gaps remained. The copyable citation still said August 3 even
though the dataset schema and three refreshed rows said August 9. The CSV also
claimed to reproduce the page's comparison while omitting the visible
Pricing signal column.

## Source correction

- Added pricing_signal to the public CSV and populated all 11 rows from the
  already-published comparison table. No new product fact was invented.
- Added pricing signal to the English Dataset variableMeasured list.
- Added the machine-readable dataset version (2026-08-09) and
  temporalCoverage (2026-07-12/2026-08-09) properties.
- Aligned the citation date to August 9 on the comparison and press pages in
  English, French, Spanish, German and Italian.
- Made the visible chronology explicit: dataset updated August 9, methodology
  updated August 3 and initial product review July 12.

The existing attribution-based reuse wording was preserved. No new public
license or legal grant was introduced.

## Validation

- CSV parse: 11 data rows, 12 named columns and a non-empty pricing_signal
  value on every row.
- git diff --check: passed.
- npm run docs:build: passed.
- npm run docs:check: passed with 1,185 canonical sitemap URLs, zero broken
  internal links, zero errors and zero warnings.

This improves the source's citation accuracy and reproducibility. It does not
prove discovery, indexation, a third-party citation, a backlink, a new
referring domain or DR movement.
