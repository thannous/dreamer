# Noctalia authority sprint — 2026-07-31

## Operating boundary

This file is the execution source of truth for the current backlink sprint. Research, local content, copy and QA can proceed autonomously. Account creation, form submission, email or DM sending, publication, paid placement, reciprocal links and Ahrefs report-credit consumption require explicit approval.

The A/B/C execution batch was approved on 2026-07-31. No spending, invented identity, CAPTCHA solving or unverified publication claim is implied by that approval. The user then explicitly authorized pushing the SEO commits to `master`, including the resulting Cloudflare Production deployment. The push and production verification completed on 2026-07-31.

The user added a geopolitical trust constraint on 2026-08-02: do not use Russian-operated platforms. Any operator with unresolved Russian ownership or operational ties is excluded by default; a Russian-language interface alone is not treated as evidence of Russian operation. No account, message or submission may proceed until the legal operator and current location are independently verified.

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

## Evidence update — 2026-08-02

Ahrefs Gmail message `19fbe540f2066626` reports, for 2026-07-01 through 2026-08-01, three new referring domains, four new backlinks and one lost backlink. This is an alert delta, not a current absolute DR or referring-domain total; those absolute metrics were not re-read and must not be inferred from the email.

The four alerted surfaces were independently checked before being counted:

| Surface | Current evidence | Treatment |
| --- | --- | --- |
| PeerPush | `https://peerpush.com/p/noctalia` is HTTP 200, self-canonical and `index, follow`; the direct Noctalia link has `rel="noopener"`. The old `.net` route now uses `.com` as canonical. Ahrefs reports DR 70. | Retain as a high-value indexable followed citation. |
| StackScope | The rendered 3 July directory filters to a real Noctalia row and a public 9.1/10 launch report. StackScope identifies DATAFREAK LTD, company 17328826, and publishes current About, Privacy, Terms and contact routes. The launch page's outbound links use `rel="nofollow noopener"`. | Legitimate topical citation, but current DOM overrides Ahrefs' historical dofollow label; exclude from followed equity. |
| Droidspy | The public package profile is HTTP 200, indexable and self-canonical, with a direct Website link using `noopener noreferrer` and no `nofollow`. Terms, Privacy and Contact pages are live. | Count as followed, but only as a low-authority secondary citation: Ahrefs reports DR 0 and the public legal pages do not name an operator. |
| Dreammeaniings | The Spanish article currently returns HTTP 200 and links to Noctalia with `nofollow`; Ahrefs reports DR 7 and also marked the same URL lost after a crawl error. | Low-trust, unstable citation. Do not pursue, pay, reciprocate or count it as quality authority. |

The manual page totals therefore move from four to five verified indexable followed pages and from four to six verified indexable nofollow pages. This is a page-level audit, not proof that Ahrefs DR has increased.

F6S remains a qualified operator, but account creation did not pass the execution gate. Google sign-in did not expose an account chooser in the in-app browser; the email recovery path for `contact@noctalia.app` then required reCAPTCHA. No CAPTCHA was solved or bypassed, no password was invented and no profile was created. The next step requires the user to complete the human verification before the public organization fields can be reviewed.

The authenticated Gmail connector for `thannous@gmail.com` showed no reply from the editorial target domains after 2026-08-01. That check does not cover the separate `contact@noctalia.app` inbox and is not evidence that every form or address is unanswered.

### Editorial extension — 2026-08-02

Two additional comparison publishers passed the operator, legal-page and contact-route checks before outreach:

- Individuate.Me: the article names Evgeny Smirnov, PhD, discloses its own-product affiliation, and the legal pages identify 4xxi Software Ltd in England and Wales. One factual Android comparison email was sent to the official `hello@individuate.me` address (Gmail message `19fc367251acc725`).
- Dreamly: the article names Martin Berbesson, whose official app presence identifies him as the EU trader, and the site publishes current Privacy, Terms and support routes. One factual Android comparison email was sent to `hello@dreamly-app.com` (Gmail message `19fc36826b487888`). Dreamly's privacy policy permits commercial use of anonymized aggregated dream data; this is retained as a qualification caveat, and contacting the publisher is not an endorsement of that policy.

Two further publications passed the same checks later on 2026-08-02:

- Elsewhere: the 2025 comparison names Dan Kennedy and discloses that it is written by the Elsewhere team; the current Privacy Policy identifies ELSEWHERE.TO LTD and a Sheffield address, while the official research page publishes `team@elsewhere.to`. One factual update email disclosed Noctalia's comparison CSV as a vendor source rather than independent research (Gmail message `19fc39babffac4d5`).
- Vowise: the July 2026 comparison names Jason Chen, dates its product-source review and says it relies on published documentation rather than laboratory testing of every app. Current Terms identify Zhuhai Dekuai Technology Co., Ltd. in China and the official contact route publishes `support@vowise.com`. One factual Android specialist-journal email was sent there (Gmail message `19fc39bd70c07636`).

ViviDiary was rejected without contact. Its current comparison uses a named author persona and broad hands-on and privacy claims, but no verifiable legal operator, Terms or official editorial contact could be found on the public properties. No recipient was inferred.

CHITTA was rejected without contact because its current article and product copy claim 98% accuracy, precise universal decoding, a 5,000-year-old symbolic system and Oracle guidance. Those claims conflict materially with Noctalia's reflective, non-predictive and non-medical position.

Everi and Hypnos were also rejected without contact after a fresh 2026-08-02 trust review. Everi's comparison discloses that its author developed the product, but its only located privacy notice both claims no personal-data collection and says dream content plus onboarding age and gender are sent to an LLM API; it names an individual without a legal entity or address, so the operator location and non-Russian ownership gate remain unresolved. Hypnos has no apparent Russian-operator signal: Apple identifies its trader at a German address and current public profiles place the named developer in Germany with Dutch nationality. Its editorial route still fails the accuracy gate because the article claims dreams remain entirely on-device with zero collection, while the current Privacy Policy says account, dream, usage and device data may be collected and shared with service providers. Hypnos's Terms also omit a specific governing law and jurisdiction, and its About and Press links currently lead to branded 404 pages. No message or data was submitted to either publisher.

Android Central also passed the 2026-08-02 operator, editorial-standards and official-author-contact gates. The current feature names Namerah Saud Fatmi, Android Central identifies Future PLC as its operator and publishes its editorial standards, and the author's official Android Central-linked X profile publishes a `futurenet.com` address. One factual specialist-journal email was sent there (Gmail message `19fc3d204bde9cb5`). No Russian operator signal or prior Gmail thread was found.

Android Guías and SlashGear then passed the same trust and deduplication gates. Android Guías identifies AB Internet Networks 2008 S.L., its Spanish CIF and address, names the current comparison author and publishes `androidguias@actualidadblog.com`; one Spanish update email was sent (Gmail message `19fc3e97bd835195`). SlashGear identifies Static Media Inc. at a United States address, states its editorial-review independence and exposes `staff@slashgear.com` in current structured contact data; one specialist Android-journal email was sent (Gmail message `19fc3e96d8df1d9f`). Both Noctalia destination pages returned HTTP 200 immediately before send and neither recipient had a prior Gmail thread.

The authenticated Gmail connector nevertheless sent both as `Thanh Chau <thannous@gmail.com>`, not from `contact@noctalia.app`. The two messages are valid deliveries and must not be resent, but further email outreach is paused until the connector itself is authenticated to the intended professional account.

A new Gmail search after that wave found no editorial reply or delivery failure for Android Guías, SlashGear or the six other recently contacted domains. The connector still covers `thannous@gmail.com` only and says nothing about the separate `contact@noctalia.app` inbox. The search did surface a temporary JournPad delivery delay: Gmail reports connection timeouts to both advertised mail-server addresses and continues retrying for 45 hours. This is not a permanent failure, but JournPad must not receive a follow-up unless delivery is confirmed. The Searchgun delay in the same search is an older, unrelated thread.

Gratitude Genie passed the operator-location and contact-route gates without being contacted. Its current Android-journaling comparison discloses its own-product context, the official site identifies Indie Genie Labs and publishes `prashanthvaidya@therunninggenie.com`, and Google Play identifies developer Prashanth Vaidya at a Bengaluru, India address. The official route is email-only, so it remains a qualified future-update target until the Gmail connector is verified as `contact@noctalia.app`; no message or data was sent.

Speakwise was rejected without contact. Its current product-owned voice-journaling comparison and legal pages are public, but the Terms identify TN Labs LLC as the Delaware operator while the current Apple App Store listing identifies Setter AI LLC as the developer. This material official-entity conflict fails the accountability gate even though both signals point to the United States and neither supplies a Russian-operator signal.

Frandroid passed the French operator, editorial-independence, topical-fit and contact-route gates. Its official notices identify Humanoid SAS and a Paris address, its About page names the current editorial team and distinguishes editorial coverage from sponsored content, and its contact page exposes a dedicated editorial-suggestion path. One French Android voice-dream-journal suggestion was submitted through that path with `contact@noctalia.app`; no CAPTCHA or commercial route was present, and the page displayed the authoritative confirmation `Votre message a bien été envoyé.` The form asked for a future hands-on or app-guide consideration under full editorial control, without payment, ranking, reciprocal-link or guaranteed-link request.

Clubic was verified as a legitimate French operator but rejected without contact under the no-spend boundary. The current official software-reference page prices a one-year dofollow listing at 1,000 EUR, a visibility pack at 2,000 EUR and an editorial-test pack at 3,000 EUR. No form, phone number, product data or payment was submitted. The transparent commercial terms disprove a free-backlink interpretation without making the service untrustworthy.

Four additional publications were researched without contact. Android Headlines identifies a United States publisher and a California address, but its official editorial addresses are protected behind an automated Cloudflare challenge, so none was guessed or bypassed. AndroidGuys names its founder and accepts free review requests, but does not publish a current accountable legal entity or address; its Privacy Policy retains an unresolved hosting-country placeholder and the form sits behind a 469-vendor consent layer, so its non-Russian operator status remains unverified. Technical Ustad likewise lacks a verified legal operator and location while its Privacy Policy contains staging and country placeholders. Zapier is accountable, but its current selection criteria explicitly exclude both special-purpose and AI-enhanced journals, making Noctalia a documented editorial mismatch rather than an outreach target.

Sleep.com's dream-journal article remains a qualified future-update target: Sleep.com identifies Mattress Firm Inc., a Houston address, current editorial standards, Terms and Privacy, with no Russian operator signal. Its author profile and About page expose no current editorial inbox, however; the About email control is a share link, and Mattress Firm customer support is not an editorial route. No address was inferred and no message was sent.

DreamStream and Inner Dispatch were rejected without contact under the tightened operator-location gate. DreamStream names a research lead and chooses Delaware law in its Terms, but publishes no accountable legal entity, address or usable editorial route. Inner Dispatch exposes no verifiable operator, Privacy, Terms, address or editorial route. Non-Russian ownership and operations therefore remain unresolved for both sites; no message or data was submitted.

All seven messages sent on 2026-08-02 offer factual reviewer access under full editorial control. They request neither payment, reciprocity, ranking nor a guaranteed link. A sent message remains outreach only: it is not a backlink, referring domain, publication or DR increase unless a live public result is later verified.

IndiePage was also checked against the original "free backlink" claim. It is an established product attributed publicly to Marc Lou, and sampled deployed profiles are indexable, self-canonical and use direct followed outbound links. It is not a free backlink route, however: the official pricing requires a 25 USD one-year pass or a 45 USD lifetime payment to deploy the page, while the Privacy and Terms pages remain dated 21 March 2023 and do not identify a legal entity or address. No account, profile or payment was created. The route is rejected for this sprint without labelling the service fraudulent.

About.me passed the operator and free-plan trust checks, but not the authority-value gate. About.me Inc. offers a public free page; a sampled live profile was HTTP 200, indexable and self-canonical, yet its external website link was explicitly `nofollow`. The Terms also require the user to be an individual acting for personal use rather than on behalf of a third party. No account or brand-only profile was created. A genuine founder profile could be reconsidered for entity discovery, not as a DR backlink tactic.

Carrd is a legitimate free publishing platform operated by Carrd Inc.; sampled pages are HTTP 200, canonical and use followed outbound links. It is not an editorial citation or a startup directory. Publishing a thin Noctalia duplicate solely to manufacture a referring domain would provide little authority and could create brand or canonical confusion, so no account or page was created. Carrd should be reconsidered only if Noctalia has a distinct, user-serving mini-tool or campaign that merits its own page.

Linktree is also a legitimate, current and free platform whose Terms identify Linktree Pty Ltd and allow authorized business use. Noctalia already has active Instagram, TikTok and X channels, so the route became a genuine maintained social hub rather than a standalone profile-stack link. The free `https://linktr.ee/noctaliadreams` profile was created through `contact@noctalia.app`; the user completed the one-time email verification, while the Pro trial and marketing opt-in were skipped and no payment method was added. It links to the official HTTPS site, Google Play and the three verified social handles with a factual non-medical, non-predictive bio.

The logged-out public page is HTTP 200 and self-canonical, and the outbound anchors have no element-level `nofollow`. Its current page-level directive is nevertheless `meta robots="noindex, nofollow"`. The profile is therefore useful for social navigation but excluded from indexable followed and nofollow authority totals until both the directive and actual public indexation are independently reverified.

Mssg.me is not a Russian-operated service according to its current public Terms: they identify Sticktech LLC and an address in Cherkasy, Ukraine, and expressly make the service unavailable in Russia. A sampled public profile was indexable and exposed direct external links without `nofollow`, and the Terms retain a free version. Registration nevertheless requires both a user-chosen password and a Cloudflare Turnstile human check. No password was invented, no challenge was solved or bypassed, and no account was created; the route remains suspended for user action.

Taplink is excluded under the user's non-Russian-operator constraint. Its current official Terms name Taplink LLC without a verifiable company address and state that court cases are governed by current Russian legislation. No account, data or payment was submitted; the route remains rejected unless current official legal documents later establish a non-Russian operator and jurisdiction.

The remaining high-DR profile claims from the original list were audited on 2026-08-02. Crunchbase already has a Google-indexed Noctalia company result with an accurate Android dream-journal description; direct access currently stops at session verification, so its website anchor and link treatment remain unverified and no duplicate profile was created. Behance passed the operator and public-page gates: Adobe Inc. is identified in the United States, sampled topical projects are indexable and self-canonical, and sampled profile website links use `rel="ugc"` without `nofollow`. A substantive Noctalia design case study is field-ready from four owned 1270 × 760 production-screen presentations, but Adobe registration for `contact@noctalia.app` requires a user-chosen password. No password was invented and nothing was uploaded.

Dribbble is a legitimate Canadian/US platform, but direct shot rendering and outbound-link treatment could not be verified in the current audit, while paid visibility starts at 48 USD per year; it is deferred rather than used as a duplicate portfolio stack. Chrome Web Store was rejected because it requires an extension, developer registration and a fee. GitHub Pages was rejected as a self-created duplicate of the existing production site and public repository. Gumroad was rejected because no separate digital product or membership is being sold there; an empty commerce profile would not be an editorial citation.

Stripe Climate is not a free backlink route. Stripe's official documentation makes the hosted climate page available to businesses that activate a percentage-of-revenue, fixed monthly or one-time carbon-removal contribution. No Stripe setting, contribution, badge or hosted page was activated: spending is not authorized, and a climate commitment must be a genuine business decision rather than an SEO tactic.

Tracking files:

- `marketing/seo/backlink-results-2026-07-31.csv`: sixteen manually audited surfaces, including five indexable followed pages, six indexable nofollow pages, two nonindexable profiles, one lost historical listing and two search-visible store-derived or entity-profile surfaces whose link treatment remains unverified;
- `marketing/seo/backlink-measurements-2026.csv`: dated authority and visibility snapshots, with evidence scope kept explicit;
- `marketing/seo/backlink-prospects-2026-07-31.csv`: 94 researched opportunities: 2 P0 corrections/reclamations, 38 P1 prospects, 53 P2 prospects or exclusions and 1 P3 launch route.
- `marketing/seo/backlink-outreach-wave-1-2026-07-31.md`: 27 recipient-specific editorial messages or form dossiers, current contact routes and a two-follow-up stop policy.
- `marketing/seo/backlink-outreach-log-2026-07-31.csv`: send, reply, follow-up and live-link state for 26 attempted routes, including 22 delivered or accepted, 1 temporarily delayed and 3 failed official routes.
- `marketing/seo/directory-submission-pack-wave-3-ai-2026-07-31.md`: one field-ready free Future Tools dossier plus an official-price decision matrix for six paid or reciprocal AI-directory routes.
- `marketing/seo/directory-submission-pack-wave-4-entities-design-2026-08-02.md`: the existing Crunchbase entity audit, a field-ready Behance mobile-product case study and evidence-backed exclusions for Dribbble, Chrome Web Store, GitHub Pages and Gumroad.
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
| Chrome-Stats | Direct automated requests receive Cloudflare 403, but the current public search rendering exposes an explicit Website link to `https://noctalia.app/`. | Link existence and indexability are visible; link attributes remain unverified, so exclude it from followed and nofollow totals. This is a store-derived citation, not a review. | Monitor through public search, not repeated automated requests. |
| AppBrain | HTTP 200; indexable; self-canonical; public website link is `nofollow`; the developer claim is verified. | Count as an entity/discovery citation, not link equity. | Keep the listing accurate; do not treat the verified dashboard or paid promotion offers as additional authority. |
| GitHub README | HTTP 200 and indexable; external Noctalia link is `nofollow`. | Entity/discovery evidence only. | Retain while the repository remains public and accurate. |
| Reddit profile post | Public rendered page is indexed; the Noctalia link uses `rel="noopener nofollow ugc"`; no canonical or `noindex` directive was exposed in the rendered DOM. | User-generated discovery/entity citation only; do not count as followed equity. | Retain as an existing launch record; do not manufacture engagement. |
| Linktree social hub | HTTP 200; self-canonical; direct official-site and Google Play anchors use `noopener noreferrer`, but the page declares `meta robots="noindex, nofollow"`. | Social navigation only; exclude from both indexable followed and nofollow totals. | Maintain only if used by Noctalia's real social channels; recheck robots and public indexation on 2026-08-09. |
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

The first outreach wave targets ten reachable editorial recipients. A route that hard-bounces may be replaced once after a fresh trust and contact audit, without retrying or guessing an address:

1. App Charts — actual roundup inclusion and CSV.
2. World of Lucid Dreaming — hands-on developer review with honest lucid-feature limits.
3. Android Authority — Android-first voice workflow.
4. Best Apps for Android — specialist journal use case; official email failed, so Holstee became the verified replacement target.
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
- [x] Send outreach wave 1 to ten reachable personalized editorial targets — Best Apps for Android failed with `554 5.7.1 Relay access denied`, so the current, transparent Holstee comparison was verified and contacted once as its replacement. Eight emails plus the accepted App Charts and Dream Studies Portal forms are now in the awaiting-reply state. Dream Studies Portal confirmed the 2026-08-01 submission on-page; no reCAPTCHA bypass occurred. The public CSV gate returns 200.
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
| B — editorial wave | Twenty-six official routes have been attempted: twenty-two are delivered or accepted, JournPad remains temporarily delayed inside Gmail's retry window, and Best Apps for Android, Know Your Ethos and Dreamz Journal failed and were closed without guessed alternatives. Frandroid accepted the dedicated editorial-suggestion form without CAPTCHA; Paul Hatton remains away through 2026-08-12. | Twenty-two editorial contacts are awaiting outcomes, while JournPad is excluded from follow-up until delivery is confirmed. General first follow-ups remain due on 2026-08-05; Dream Studies Portal is due on 2026-08-06; the 2026-08-02 extension and Frandroid are due on 2026-08-07; TechRadar is deferred to 2026-08-13. No sent message is counted as a backlink. |
| B — trusted-prospect extension | Make Tech Easier and Digital Trends passed topical, operator and non-Russian-location checks. Make Tech Easier's factual General Enquiries form is prefilled but not submitted because human Turnstile is required; Digital Trends is drafted but not sent while Gmail remains authenticated as `thannous@gmail.com`. G2 and Capterra were excluded for B2B eligibility mismatch, Geekflare for a commercial placement route, and ZipDo because its accountable operator, address, non-Russian ownership and free route remain unverified. | Zero new outreach attempts and zero backlink claims. The two qualified actions remain waiting on user-owned verification or the correct professional mailbox; no data was submitted to the four excluded platforms. |
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
