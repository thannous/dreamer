# Noctalia entity and design-platform pack — wave 4

Evidence date: 2026-08-02. This pack closes the unverified high-DR claims for Crunchbase, Behance, Dribbble, Chrome Web Store, GitHub Pages and Gumroad. It applies the user's non-Russian-operator constraint and distinguishes an existing entity citation, a genuine design case study and self-created pages that would not represent earned authority.

No profile, project, extension, storefront or microsite was published from this pack. No password was invented and no payment was made.

## Decision summary

| Surface | Current evidence | Decision |
| --- | --- | --- |
| Crunchbase | Current official Terms identify Crunchbase, Inc. and California law. Google exposes an indexed `Noctalia - Crunchbase Company Profile & Funding` result with an accurate Android dream-journal description. Direct access currently stops at Crunchbase's session-verification screen, so the canonical URL, official-site link and `rel` treatment could not be verified. | **Retain as an existing entity citation, not a confirmed backlink.** Do not create a duplicate. Recheck and claim or correct the existing profile only through a verified direct session. |
| Behance | Adobe Inc. is identified at 345 Park Avenue, San Jose, California. A sampled current dream-app project is HTTP 200, `index, follow`, self-canonical and represented as `VisualArtwork`; sampled profile website links use `rel="ugc"` without `nofollow`. | **Qualified for one real design case study.** The account flow confirms no Adobe account for `contact@noctalia.app`, then requires a user-chosen password. Stop there until the user sets it. |
| Dribbble | Current Terms identify Dribbble Holdings Ltd., operation from Canada and the United States, and British Columbia law. Google indexes topical dream-journal shots, but direct shot pages returned an empty 202 response in the current audit and outbound-link treatment could not be verified. Current Pro visibility begins at 48 USD per year. | **Defer.** Publish no duplicate portfolio stack and buy no visibility. Reconsider only after the Behance case study is live and a distinct design story exists. |
| Chrome Web Store | Google's current registration documentation requires a Chrome Web Store developer account and a one-time registration fee before an extension can be published. | **Reject.** Noctalia is an Android app, not a Chrome extension, and the route is neither free nor product-appropriate. |
| GitHub Pages | A `noctalia.github.io` page does not exist. Noctalia already has a public GitHub repository whose README provides an accurate, indexable but `nofollow` entity link. | **Reject a duplicate microsite.** A self-created GitHub Pages mirror would not be an independent endorsement and would add canonical and maintenance risk. |
| Gumroad | Gumroad, Inc. positions the service as a selling platform for digital products, memberships and SaaS, with 10% + 0.50 USD charged per direct transaction and 30% through Discover. | **Reject for this sprint.** No separate downloadable product or membership is being sold there; creating an empty storefront solely for a profile link would be misleading and non-editorial. |

## Crunchbase — existing indexed entity profile

- **Public result:** `https://www.crunchbase.com/organization/noctalia`
- **Indexed title:** `Noctalia - Crunchbase Company Profile & Funding`
- **Indexed description excerpt:** `Noctalia is an AI-powered dream journal app for Android. Users can record dreams by voice or text, get automatic transcription, guided AI interpretation...`
- **Current official requirements:** a registered and socially authenticated user can create or edit a profile; do not create a second profile for the same company.
- **Current limitation:** the direct public page and create-profile route stop at `We must verify your session before you can proceed`. No challenge was solved or bypassed.
- **Authority treatment:** search-visible entity citation only. Exclude it from followed and nofollow backlink totals until the direct official-site anchor, page indexability and `rel` value are observed on the live page.
- **Next action:** when a normal direct Crunchbase session is available, compare the profile against `https://noctalia.app/en/press`, verify the website URL and categories, then claim or correct only if needed.

## Behance — field-ready design case study

### Account state

- **Operator:** Adobe Inc., United States; no Russian operator or Russian-law signal found in the current official legal pages.
- **Account email:** `contact@noctalia.app`
- **Observed state:** Adobe reports no account associated with the address.
- **Blocker:** registration step 1 of 2 requires a user-chosen password.
- **State:** `blocked_user_password_required`; no account was created and no asset was uploaded.

### Project metadata

- **Title:** `Noctalia — Voice-first AI Dream Journal for Android`
- **Creative fields:** UI/UX, Product Design, Mobile App Design
- **Primary destination:** `https://noctalia.app/en/voice-dream-journal`
- **Profile website:** `https://noctalia.app/`
- **Google Play:** `https://play.google.com/store/apps/details?id=com.tanuki75.noctalia`
- **Project type:** product case study using real production screens, not a promotional logo-only profile.
- **Expected authority treatment:** topical, indexable UGC and entity discovery. A `rel="ugc"` link is still qualified user-generated content and must not be counted as pure followed editorial equity.

### Project introduction

> Dreams often disappear in the minutes between waking and typing. Noctalia is an Android dream journal designed around that fragile moment: capture an entry by voice or text, organize it for later review, then explore possible symbols, emotions and recurring themes through guided AI-assisted reflection.
>
> The interface moves from low-friction capture to a calm private journal. The product deliberately avoids universal meanings and predictive claims. Transcription, generated imagery and AI reflection require connectivity, and the output is a personal journaling aid rather than medical advice or diagnosis.

### Case-study sequence

1. **Capture before details fade** — voice-first entry at wake-up, with text as an alternative.
2. **Structure without claiming certainty** — possible symbols, themes, emotions and dream type are presented as reflection prompts.
3. **Continue the reflection** — contextual follow-up questions stay anchored to the saved entry.
4. **Review patterns over time** — search and filters help revisit recurring themes inside a private journal.
5. **Product boundaries** — online processing is required for AI features; interpretations are non-medical and non-predictive.

### Ready upload assets

| Order | Repository asset | Dimensions | Alt text |
| ---: | --- | ---: | --- |
| 1 | `docs-src/static/screenshot/product-hunt/noctalia-product-hunt-01-voice-capture.png` | 1270 × 760 | Noctalia Android voice capture screen with the message Capture dreams before they fade. |
| 2 | `docs-src/static/screenshot/product-hunt/noctalia-product-hunt-02-ai-interpretation.png` | 1270 × 760 | Noctalia dream detail interface organizing possible symbols, themes and dream type. |
| 3 | `docs-src/static/screenshot/product-hunt/noctalia-product-hunt-03-guided-reflection.png` | 1270 × 760 | Noctalia guided reflection conversation with contextual follow-up topics. |
| 4 | `docs-src/static/screenshot/product-hunt/noctalia-product-hunt-04-dream-journal.png` | 1270 × 760 | Noctalia private dream journal showing search, filters and saved dream entries. |
| Profile | `docs-src/static/logo/logo_noctalia.png` | 512 × 512 | Noctalia moon and sleeping-face app mark. |

### Publication gates

1. The user chooses the Adobe password and completes any human verification.
2. If Adobe asks for natural-person identity fields, use only user-confirmed values; do not invent a studio, agency or job title.
3. Leave trials, paid Behance Pro, newsletters and marketing opt-ins unselected.
4. Upload only the five owned assets listed above.
5. Preserve the non-medical, non-predictive and connectivity limitations in the published copy.
6. After publication, verify HTTP status, `index, follow`, self-canonical, project structured data, the Noctalia destination and actual link `rel` before counting any backlink.

## Dribbble — hold rather than duplicate

Dribbble is a legitimate Canadian/US design platform, not a Russian-operated service. Current Google results show that dream-journal UI shots can be indexed there. The present audit cannot verify direct shot-page rendering or outbound-link attributes, while the official Pro pricing sells additional visibility from 48 USD per year.

No account, subscription or shot should be created merely to repeat the Behance material. Reconsider a free Dribbble route only if it permits a distinct, finished design artifact and the live free-page link behavior can be verified before publication.

## Measurement after any later publication

Do not report a backlink from account creation or an upload receipt. Record only after the public page is verified:

- public URL and HTTP status;
- indexability and canonical URL;
- operator and current legal jurisdiction;
- exact Noctalia destination and `rel` value;
- project accuracy and topical relevance;
- first verified date and next recheck;
- referral sessions or Google Play visits when measurable.

## Official evidence register

- Crunchbase profile requirements and creation flow: `https://support.crunchbase.com/hc/en-us/articles/115010642588-Requirements-to-Create-a-Crunchbase-Profile-Page`, `https://support.crunchbase.com/hc/en-us/articles/115011823988-How-do-I-create-a-Crunchbase-profile`
- Crunchbase Terms: `https://about.crunchbase.com/terms-of-service/`
- Adobe Terms and Behance: `https://www.adobe.com/legal/terms.html`, `https://www.behance.net/`
- Sample indexable Behance dream-app project: `https://www.behance.net/gallery/248186313/Somni-AI-Dream-Journal-App`
- Dribbble Terms and pricing: `https://dribbble.com/terms`, `https://support.dribbble.com/hc/en-us/articles/25939443069335-Dribbble-Pricing-and-Payment-Terms`
- Chrome Web Store developer registration: `https://developer.chrome.com/docs/webstore/register`
- GitHub Pages documentation: `https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages`
- Gumroad pricing and product scope: `https://gumroad.com/pricing`
