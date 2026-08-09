# DOI deposit dossier — 2026-08-09

## Decision

Use Zenodo as the primary repository and Figshare only as a fallback. Do not
publish on both: duplicate records would split citations and create avoidable
version ambiguity.

| Gate | Zenodo | Figshare | Decision |
| --- | --- | --- | --- |
| Account cost | Free | Free individual account | Zenodo |
| DOI | DataCite DOI on publication; DOI can be reserved in the draft | DataCite DOI on publication | Zenodo |
| Operator | CERN/OpenAIRE, Europe | Figshare LLP/Digital Science, United Kingdom | Both admissible; neither is a Russian operator |
| Dataset support | Explicitly accepts datasets and research artifacts | Explicitly supports research outputs and datasets | Both admissible |
| Versioning | New versions are linked under a concept DOI | Versioned public items | Zenodo |
| Public license | Required for public files | License selected during item creation | Pending owner approval |

Primary evidence:

- Zenodo about and governance: <https://about.zenodo.org/>
- Zenodo policies: <https://about.zenodo.org/policies/>
- Zenodo record description: <https://help.zenodo.org/docs/deposit/describe-records/>
- Zenodo DOI reservation: <https://help.zenodo.org/docs/deposit/describe-records/reserve-doi/>
- Figshare about: <https://info.figshare.com/about/>
- Figshare privacy and operator: <https://info.figshare.com/privacy-policy/>

## Proposed Zenodo metadata

This is a reviewable proposal, not an API payload and not a license grant.

| Field | Proposed value |
| --- | --- |
| Resource type | Dataset |
| Title | Dream Journal App Comparison Dataset 2026 |
| Publication date | 2026-08-03 (first public citation date) |
| Version | 1.0.0 |
| Creator | Thanh Chau |
| Affiliation | Noctalia (only if the owner confirms this public affiliation) |
| Description | Dated, source-linked desk review comparing 11 dream-journal apps across platforms, voice capture, AI interpretation, generated images, privacy or export signals, lucid-dreaming features, use cases, and caveats. Noctalia compiled the dataset and is included. The records describe vendor-supplied public claims; they are not a ranking, clinical study, market-share estimate, or hands-on benchmark. |
| Keywords | dream journal apps; dream journaling; AI dream interpretation; lucid dreaming apps; mobile apps; comparative dataset |
| Language | English |
| Access | Open |
| License | CC BY 4.0 — proposed, pending explicit approval |
| Related identifier | `https://noctalia.app/en/dream-journal-apps#dataset` |
| Relationship | Is supplement to |
| Publisher | Zenodo (assigned by the repository) |

Do not invent an ORCID. Add one only if the creator supplies and confirms it.

## Proposed upload files

1. `dream-journal-apps-comparison-2026.csv`, now present in this directory and
   verified byte-for-byte against
   `docs-src/static/data/dream-journal-apps-comparison-2026.csv`.
2. `README.md` from this directory, after replacing the pending-license notice.
3. `SHA256SUMS.txt` from this directory.

The public CSV currently has 11 records, 11 columns, 3,463 bytes, and SHA-256
`c5fc652cf6af20184fc6e5c3c3d3e96ba506c69cb229516301af1380892ff28e`.
The packaged copy has the same size and hash. `SHA256SUMS.txt` validates the
upload filename directly.

## Pre-publication stop gates

- Confirm that Thanh Chau is the desired public creator name.
- Confirm whether `Noctalia` should be shown as the affiliation.
- Approve a formal license; recommendation: `CC BY 4.0`.
- Sign in to or create the selected repository account.
- Create a draft and reserve its DOI, but do not publish until the draft preview,
  file hashes, metadata, and related identifier have been checked.
- After publication, add the DOI to the Noctalia dataset page and Dataset JSON-LD
  in a separate source change, then verify the live DOI and production page.

## SEO evidence boundary

A repository record can make the dataset easier to cite and discover, but a DOI
or repository link is not evidence of a followed backlink, a new referring
domain, indexation, referral traffic, or Domain Rating movement. Record each of
those layers separately after publication.
