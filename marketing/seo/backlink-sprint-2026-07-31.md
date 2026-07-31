# Noctalia authority sprint — 2026-07-31

## Operating boundary

This file is the execution source of truth for the current backlink sprint. Research, local content, copy and QA can proceed autonomously. Account creation, form submission, email or DM sending, publication, paid placement, reciprocal links and Ahrefs report-credit consumption require explicit approval.

The A/B/C execution batch was approved on 2026-07-31. No spending, invented identity, CAPTCHA solving or unverified publication claim is implied by that approval. The user then explicitly authorized pushing the SEO commits to `master`, including the resulting Cloudflare Production deployment. The push and production verification completed on 2026-07-31.

## Baseline captured today

Ahrefs project dashboard, read on 2026-07-31 without opening a detailed report or consuming a report credit:

| Metric | Current value | 30-day change | Interpretation |
| --- | ---: | ---: | --- |
| Domain Rating | 0 | — | Authority remains below Ahrefs' first displayed point. |
| Referring domains | 348 | +143 | Raw discovery volume is high but does not prove useful link equity. |
| Organic traffic estimate | 3.4K | +2.3K | Organic visibility is growing despite DR 0. |
| Organic keywords | 868 | +312 | Content breadth is growing; authority is the weak layer. |
| Google Search clicks | 4K over 28 days | Previous 3K milestone on 2026-07-17 | Search Console milestone dated 2026-07-29; this proves growing visibility, not stronger backlink authority. |
| Site Audit health | 100 | — | 1.6K pages crawled, 0 broken and 0 blocked in the 2026-07-27 crawl. |

The detailed referring-domain report was intentionally not opened. The expanded manual recovery pass verifies four independent domains with at least one indexable and followed listing page: PeerPush, JunkStartups, Launch Llama and SaaSHub. The large Ahrefs count must not be reported as 348 quality endorsements.

The 4K-click Search Console milestone was received at `thannous@gmail.com` in message `19fb7b8d5e1cd617`. It reports the 28-day threshold reached on 2026-07-29; it is retained as a dated milestone rather than a full Search Console export.

Tracking files:

- `marketing/seo/backlink-results-2026-07-31.csv`: eleven manually audited surfaces, including four indexable followed pages on independent domains, one rendered Reddit `nofollow ugc` citation, one lost historical listing and one access-blocked store-derived citation;
- `marketing/seo/backlink-measurements-2026.csv`: dated authority and visibility snapshots, with evidence scope kept explicit;
- `marketing/seo/backlink-prospects-2026-07-31.csv`: 44 qualified opportunities, including 2 P0 corrections/reclamations, 18 P1 prospects and four platform-specific editorial syndication routes.
- `marketing/seo/backlink-outreach-wave-1-2026-07-31.md`: ten recipient-specific editorial drafts, current contact routes and a two-follow-up stop policy.
- `marketing/seo/backlink-outreach-log-2026-07-31.csv`: send, reply, follow-up and live-link state for the ten-message wave.
- `marketing/seo/directory-submission-pack-wave-3-ai-2026-07-31.md`: one field-ready free Future Tools dossier plus an official-price decision matrix for six paid or reciprocal AI-directory routes.
- `marketing/seo/directory-submission-pack-wave-2-2026-07-31.md`: distinct, field-ready copy and public readiness gates for PitchWall, Launching Next and AI Tools Inc.
- `marketing/seo/product-hunt-launch-pack-2026-07-31.md`: current field requirements, final listing copy, first maker comment, readiness gates and a relative launch-day protocol.
- `marketing/seo/editorial-syndication-pack-2026-07-31.md`: one technical master article, canonical metadata for DEV/Hashnode/Medium and a non-duplicative Substack excerpt.

## Manual backlink audit

| Surface | Public state on 2026-07-31 | Treatment | Next action |
| --- | --- | --- | --- |
| PeerPush | HTTP 200; `index, follow`; self-canonical; Noctalia link has `rel="noopener"` only. | Count as an indexable followed referring page. | Retain and recheck quarterly. |
| JunkStartups | HTTP 200; self-canonical; repeated Noctalia links use `noopener noreferrer` without `nofollow`. | Count as an indexable followed referring page. | Retain and recheck quarterly. |
| Launch Llama | HTTP 200; indexable; self-canonical; the official-site link now uses `noopener noreferrer` without `nofollow`. | Count as a followed referring domain; the June nofollow observation is no longer current. | Retain and monitor for link-policy changes. |
| Good AI Tools | HTTP 200; canonical; Noctalia link is `nofollow`; description still overstates offline analysis and psychological meaning. | Entity/discovery mention only. | Send the factual correction after approval. |
| SaaSHub | HTTP 200; self-canonical; `noindex, follow`; mixed followed-looking and `nofollow` CTAs. | Do not count as indexed authority. | Ask for an indexable distinct app entity and consistent linking after approval. |
| SaaSHub alternatives | HTTP 200; indexable; self-canonical; one press link is `nofollow`, while the official-site link has empty `rel`. | Count SaaSHub as a followed referring domain through this page, not through the noindexed main profile. | Retain and recheck with the main profile. |
| Chrome-Stats | Automated request receives Cloudflare 403; search visibility was previously observed from store-derived data. | Store-data citation only; not a review. | Monitor through public search, not repeated automated requests. |
| AppBrain | HTTP 200; indexable; self-canonical; public website link is `nofollow`; the developer claim is verified. | Count as an entity/discovery citation, not link equity. | Keep the listing accurate; do not treat the verified dashboard or paid promotion offers as additional authority. |
| GitHub README | HTTP 200 and indexable; external Noctalia link is `nofollow`. | Entity/discovery evidence only. | Retain while the repository remains public and accurate. |
| Reddit profile post | Public rendered page is indexed; the Noctalia link uses `rel="noopener nofollow ugc"`; no canonical or `noindex` directive was exposed in the rendered DOM. | User-generated discovery/entity citation only; do not count as followed equity. | Retain as an existing launch record; do not manufacture engagement. |
| Zearches | HTTP 200 and indexable, but the directory page no longer contains a detectable Noctalia link. | Historical listing is lost; do not count it as live. | Consider one factual resubmission only if the current free route still exists. |

## Strategic conclusion

The fastest path is not more automatically discovered domains. It is a small set of real topical links that Ahrefs can value:

1. two suitable launch directories with indexable product pages;
2. inclusion or review on Android, journaling, sleep and lucid-dreaming publications;
3. citations to deep resources rather than homepage-only links;
4. a reusable comparison dataset that makes editorial citation easier;
5. factual correction and entity disambiguation on existing surfaces.

## Linkable asset created

The five localized dream-journal comparison pages now expose a downloadable, source-labelled 11-app dataset:

- public path after deployment: `https://noctalia.app/data/dream-journal-apps-comparison-2026.csv`
- English citation page: `https://noctalia.app/en/dream-journal-apps`
- source file: `docs-src/static/data/dream-journal-apps-comparison-2026.csv`
- product facts last reviewed: 2026-07-12
- page and compilation update: 2026-07-31
- reuse condition: attribution to Noctalia and a link to the comparison page

The asset is public. `https://noctalia.app/data/dream-journal-apps-comparison-2026.csv` returned HTTP 200 with `text/csv; charset=utf-8` after the production deployment, so it can now be cited in reviewed outreach.

## Submission dossiers

### Uneed

- **Name:** Noctalia
- **Tagline:** Remember dreams before they fade
- **Short description:** Voice-first Android dream journal with guided AI reflection.
- **Long description:** Noctalia helps Android users capture dreams by voice or text before the details fade. It turns each entry into a structured journal record with themes, symbols, generated imagery and follow-up questions for personal reflection. Users can search their journal, revisit recurring patterns and use basic lucid-dreaming tools. Noctalia is designed for journaling and wellbeing, not diagnosis or prediction. A free plan is available; Google Play displays the applicable Noctalia Plus price and eligibility before purchase.
- **Tags:** Android, dream journal, voice notes, journaling, wellbeing, AI reflection, lucid dreaming
- **Category:** Personal life / productivity / mobile app
- **URL:** `https://noctalia.app/en/press`
- **Logo:** `docs-src/static/logo512.png`
- **Screenshots:** the four files under `docs-src/static/screenshot/product-hunt/`
- **Constraint:** the current free-launch rule requires 10 genuine upvotes to remain published. No purchased, exchanged or stranger-solicited votes.

### Microlaunch

- **Tagline:** Capture a dream before it disappears
- **Short description:** An Android-first voice journal for dreams, images and guided reflection.
- **Long description:** Noctalia is an Android-first dream journal for people who want to record a dream while it is still fresh. Capture starts with voice or text, then the app organizes the entry for reflective exploration through possible symbols, themes, generated imagery and follow-up questions. It also supports journal search, recurring-pattern review and basic lucid-dreaming tools. Noctalia does not diagnose, predict or claim universal meanings.
- **Category:** Lifestyle & Health / mobile app
- **URL:** `https://noctalia.app/en/press`
- **CTA:** Try the Android app
- **Constraint:** verify the final price and publication terms immediately before submitting.

### AlternativeTo

- **Name:** Noctalia
- **Category:** Dream journal / personal journal
- **Alternative framing:** Voice-first Android alternative for people comparing DreamApp or Oniri.
- **Description:** Noctalia combines voice and text capture, structured dream entries, possible symbol and theme review, generated imagery, guided follow-up questions and journal search. It is a reflective journaling product rather than a medical, diagnostic or predictive service.
- **URLs:** `https://noctalia.app/en/dreamapp-alternative`, `https://noctalia.app/en/oniri-alternative`
- **Constraint:** resolve the legitimate account flow; do not create duplicate identities.

### AppBrain

- **App:** `com.tanuki75.noctalia`
- **Positioning:** Android-first voice dream journal with structured reflection.
- **Destination:** `https://noctalia.app/en/android-dream-analysis-app`
- **State:** developer claim verified through `contact@noctalia.app`; Noctalia appears under “Your apps in Google Play”. Any Featured Apps or paid-promotion action remains separate and unapproved.

### Second-wave free directories

| Directory | Positioning | Current free-path evidence | Hold condition |
| --- | --- | --- | --- |
| PitchWall | Voice-first Android dream journal with transparent reflection boundaries. | Official submit page exposes a free launch, a stated 30+ day wait and a claimed dofollow backlink. | Account exists, but profile changes failed to persist twice; no product was submitted. OAuth also disclosed newsletter signup, so keep this route paused until the account controls work. |
| Launching Next | Fast morning voice capture for an Android dream journal. | Official form accepts a free submission and describes a permanent product profile, with an approximately three-month queue. | Recheck public pricing/demo readiness and the live outbound-link attributes. |
| AI Tools Inc | AI-assisted dream journaling with published methodology and non-medical limits. | Free Typeform submission accepted on 2026-07-31; the official route states a 30–90 day queue and no guaranteed placement. | Pending review, not a live backlink. Only public product data and the professional contact identity were supplied; never pay for priority without separate approval. |

Launching Next remains blocked on a truthful 90-day marketing-budget answer. Reciprocal-link or pay-to-dofollow directories remain excluded from this wave.

### Directory trust check

| Directory | Verified signals | Concrete cautions | Operational decision |
| --- | --- | --- | --- |
| Future Tools | Domain created in 2022; named operator and team; official About, FAQ, Terms and Privacy links; human review and affiliate/sponsorship disclosure; optional newsletter left unchecked. | CAPTCHA requires the user; more than 75% of submissions are rejected; placement and link treatment are not guaranteed. | Acceptable for a free, low-data submission. Form prefilled, not submitted. |
| AI Tools Inc | Domain created in 2024; named founders; official About, Privacy, Terms and affiliate disclosure; public GitHub repository with visible history; official site links to the free Typeform. | Terms still contain `[Your Country/State]`; the free queue is 30–90 days and placement is not guaranteed; audience and authority claims are self-reported. | Acceptable only for public product data and a professional email. Free submission sent; no payment or sensitive data. |
| PitchWall | Domain created in 2023; HTTPS; official privacy/terms/FAQ; limited OAuth profile/email data; privacy policy provides support and deletion routes. | OAuth disclosed newsletter signup; profile changes failed to persist after two saves; account notification/privacy routes exposed no usable controls; traffic, DR and dofollow figures are platform claims. | Pause. Account exists, but no product submission or payment until controls and persistence are reliable. |

The English product walkthrough is public at `https://noctalia.app/video/noctalia-product-walkthrough-en-2026-07.mp4`: 71 seconds, 1920 × 1080, H.264, no audio and 2.7 MB. It uses the four current launch-gallery product screens and an explicit non-medical/non-predictive boundary. The press kit links it and exposes `VideoObject` structured data; the production URL returned HTTP 200 with `video/mp4` and 2,698,770 bytes.

## Outreach templates — prepared, not sent

### A. Existing roundup inclusion

**Subject:** A current Android voice option for your dream-journal comparison

Hi [Name],

I read your [article title], especially the section about [specific point]. I build Noctalia, an Android-first dream journal for voice capture, structured reflection, generated imagery and recurring-pattern review.

It may be useful in your next update because [one audience-specific reason]. I prepared a factual press kit and a dated 11-app comparison dataset so every claim can be checked rather than copied from marketing text:

- Press kit: https://noctalia.app/en/press
- Comparison and methodology: https://noctalia.app/en/dream-journal-apps

The honest limits: Noctalia is Android-first, its advanced lucid-dreaming tools are limited, and its reflections are not medical or predictive. I can provide reviewer access and answer factual questions, while you retain full editorial control.

Would testing it fit a future update?

Thanh Chau
Founder, Noctalia

### B. Source suggestion, without product-placement request

**Subject:** Source suggestion: dated dream-journal app comparison data

Hi [Name],

Your article on [topic] is one of the clearer resources I found on dream journaling. While auditing public claims in this category, I compiled a source-labelled comparison of 11 dream-journal apps covering platforms, voice capture, AI features, export/privacy signals and lucid-dreaming support.

The table and downloadable CSV are here: https://noctalia.app/en/dream-journal-apps

No request for endorsement: I am sharing it as a dated source for any future digital-journaling update. Noctalia publishes the compilation, so that affiliation should be disclosed if you use it. I am also happy to correct or expand any row when you identify stronger official evidence.

Best,
Thanh Chau

### C. Op-ed / methodology pitch

**Subject:** Op-ed: A dream catalog is not a dataset

Hi [Name],

I read your recent work on [specific dream-research or digital-wellness topic]. I would like to propose a 700-word op-ed: “A dream catalog is not a dataset.”

During a source audit of Noctalia, a previously repeated “55,000 dreams” figure could not be reproduced from the public source. We removed it from evidentiary use and published a methodology that separates 150 multilingual editorial symbol records from private journals and clinical research.

The piece would offer three practical rules for reflective AI products: distinguish editorial content from user data, publish provenance before headline numbers, and never present reflective output as diagnosis.

Methodology: https://noctalia.app/en/dream-content-methodology

Would this fit your editorial calendar? You would retain full editorial control.

Thanh Chau

### D. Good AI Tools correction

**Subject:** Factual corrections for the Noctalia listing

Hello Good AI Tools team,

Thank you for listing Noctalia. Could you update three factual points on https://goodaitools.com/ai/noctalia?

- Noctalia can begin capturing a dream offline, but transcription, AI reflection and sync require connectivity.
- The app supports reflection on symbols and emotions; it does not decode a person's subconscious or diagnose emotional health.
- Please describe the output as guided reflection rather than hidden messages or psychological conclusions.

Current product facts and media: https://noctalia.app/en/press
Editorial and data boundaries: https://noctalia.app/en/dream-content-methodology

Thank you,
Thanh Chau
Noctalia
contact@noctalia.app

### E. SaaSHub entity and indexation request

**Subject:** Noctalia app entity and indexation check

Hello SaaSHub team,

Thank you for maintaining https://www.saashub.com/noctalia-app. Could you review two technical issues?

1. The app page currently returns `noindex, follow`, so it cannot act as the public Noctalia app entity in search.
2. Official-site CTAs use inconsistent link attributes, and `/noctalia` refers to an unrelated Linux desktop project.

Could the Android app remain clearly named “Noctalia — Dream Journal” and use one consistent official URL, https://noctalia.app? The current factual press kit is https://noctalia.app/en/press.

Thank you,
Thanh Chau

## Personalization queue

The first outreach wave should contain no more than ten tailored messages:

1. App Charts — actual roundup inclusion and CSV.
2. World of Lucid Dreaming — hands-on developer review with honest lucid-feature limits.
3. Android Authority — Android-first voice workflow.
4. Best Apps for Android — specialist journal use case.
5. Mattress Miracle — research and non-medical boundary.
6. Dream Studies Portal — provenance op-ed.
7. Sleep Review — product-news/methodology angle.
8. Oneironaut — voice/privacy comparison with explicit cloud-processing caveat.
9. TechRadar — first-person app testing or founder briefing, never a brand-authored article.
10. Tom's Guide — dedicated alternative to general-purpose AI journaling.

The personalized copy and sources live in `marketing/seo/backlink-outreach-wave-1-2026-07-31.md`. Immediately before any send, recheck the target article, current author/editor, contact route and every linked Noctalia URL. If that evidence is not available, do not send.

## Approval-ready external batch

- [x] Submit Noctalia to Uneed — product `44802` is in the free waiting line under account `thannous-6884`, with launch scheduled for 2027-01-08; accurate copy and the public walkthrough video are saved. This is a queued submission, not a live backlink.
- [ ] Submit Noctalia to Microlaunch — current launch route is Pro-only; no spending authorized.
- [x] Send the Good AI Tools factual correction — sent from the verified public developer identity to `submitmatic@gmail.com`; Gmail message `19fb7ec531196fa8`; awaiting publisher update.
- [x] Send the SaaSHub entity/indexation request — submitted through the product-change form; pending moderation.
- [x] Send one final follow-up in the older SearchGun and Digital.Health threads — sent once with new methodology/eligibility value; no further message without a reply.
- [ ] Send outreach wave 1 to the ten personalized editorial targets — approved, the verified public developer sender is available and the public CSV gate now returns 200; recheck each current recipient, article and contact route immediately before sending.
- [ ] Resolve AlternativeTo account creation through its legitimate current path — correct email identity is available; user-owned password and hCaptcha are still required, then a 7-day account-age wait.
- [x] Claim or verify the AppBrain developer account — the official access email was opened in `contact@noctalia.app`; the developer dashboard now lists `Noctalia: Smart Dream Journal` under “Your apps in Google Play”.

## Execution log — approved A/B/C batch

| Workstream | Result on 2026-07-31 | State |
| --- | --- | --- |
| A — local SEO publication lot | Thirteen scoped SEO commits were ready on `master`; the full release check passed. | Published without staging or modifying the unrelated social-work files. |
| A — production publication | `master` was pushed at commit `7de71bc64d53adf80257fb659f4e12eb669c1d05`; local HEAD, `origin/master` and `git ls-remote` matched. | GitHub Actions run `30635290841` succeeded. Cloudflare Pages production deployment `acb85f4e-de56-4553-9cec-00220aa43115` completed successfully and aliased `https://noctalia.app`. |
| B — SaaSHub | Product name, Android category/entity distinction, official URL consistency and `noindex` review submitted. | Accepted by the form; pending moderation. |
| B — Uneed | Product `44802` was submitted to the free waiting line from account `thannous-6884`; the generated copy was corrected, the public walkthrough video was added and the launch is scheduled for 2027-01-08. | No spend. It remains a queued submission, not a live backlink; the eventual listing requires at least 10 genuine launch-day upvotes to remain published. |
| B — AI Tools Inc | Free Typeform submitted with Noctalia, its public press URL, the submitter name and the professional contact email. | Confirmation received; pending review, no spend, no password or sensitive data, and not a live backlink. |
| B — PitchWall | Google OAuth account created and the free route opened. | Paused before product submission because the profile did not persist after two saves and OAuth disclosed newsletter signup. |
| B — Future Tools | Free submission form prefilled with the approved factual copy; optional newsletter left unchecked. | Paused before submission for the user-owned CAPTCHA; no data was sent. |
| B — Microlaunch | The current New Launch dialog exposes only Pro Launch. | Paused before payment; no spend authorized. |
| B — Good AI Tools | Factual correction sent to `submitmatic@gmail.com` from the verified public developer identity. | Gmail message `19fb7ec531196fa8`; awaiting publisher update. |
| B — SearchGun | One final follow-up added the public methodology and offered an easy close-the-loop response. | Gmail message `19fb83074b0b329f`; stop unless the editor replies. |
| B — Digital.Health | One final follow-up asked only whether a clearly non-medical consumer wellness app is eligible. | Gmail message `19fb830a67794116`; stop unless the directory replies. |
| B — editorial wave | Ten tailored drafts remain ready, the sender identity is verified and the cited CSV is public. | Approved to send after a fresh recipient/article/contact-route check for each message. |
| C — AlternativeTo | Current signup form and its 7-day new-account rule verified; correct email identity available. | Paused for user-owned password and hCaptcha. |
| C — AppBrain | The official access email was opened in the authenticated `contact@noctalia.app` mailbox and the claim link was validated for package `com.tanuki75.noctalia`. | Complete: the developer dashboard lists `Noctalia: Smart Dream Journal` under “Your apps in Google Play”. No promotion or spend was activated. |

Product Hunt now has a complete local launch pack and the pricing/video deployment gate is cleared. It remains outside this batch until the walkthrough is uploaded to YouTube with publication approval, the personal account is verified, and a launch date plus genuine feedback cohort are approved.

## Measurement

Weekly, record only verified public outcomes:

- live referring page URL;
- indexability and canonical;
- followed, nofollow, UGC or sponsored link treatment;
- linked Noctalia destination;
- topical relevance;
- referral sessions and conversions where measurable;
- first-seen and lost dates;
- Ahrefs DR and referring-domain count from the dashboard, monthly rather than daily.

Update `marketing/seo/backlink-results-2026-07-31.csv` only after a referring page is publicly verifiable. A sent message, accepted submission or account creation is not a live backlink.

Targets for the first 30 days after authorized execution:

- 5–8 new live referring domains;
- at least 2 topical editorial links;
- at least 2 deep links;
- zero paid, automated, reciprocal or manipulated links.
