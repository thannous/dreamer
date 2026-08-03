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
| PeerPush | `https://peerpush.com/p/noctalia` is HTTP 200, self-canonical and `index, follow`; the direct Noctalia link has `rel="noopener"`. The old `.net` route now uses `.com` as canonical. Ahrefs reports DR 70. Its current Terms do not identify a legal entity, address or concrete operating jurisdiction. | Retain the already-live followed citation as technical evidence, but perform no new account, boost, payment, engagement or submission while the operator location and non-Russian status remain independently unverified. |
| StackScope | The rendered 3 July directory filters to a real Noctalia row and a public 9.1/10 launch report. StackScope identifies DATAFREAK LTD, company 17328826, and publishes current About, Privacy, Terms and contact routes. The launch page's outbound links use `rel="nofollow noopener"`. | Legitimate topical citation, but current DOM overrides Ahrefs' historical dofollow label; exclude from followed equity. |
| Droidspy | The public package profile is HTTP 200, indexable and self-canonical, with a direct Website link using `noopener noreferrer` and no `nofollow`. Terms, Privacy and Contact pages are live. | Count as followed, but only as a low-authority secondary citation: Ahrefs reports DR 0 and the public legal pages do not name an operator. |
| Dreammeaniings | The Spanish article currently returns HTTP 200 and links to Noctalia with `nofollow`; Ahrefs reports DR 7 and also marked the same URL lost after a crawl error. | Low-trust, unstable citation. Do not pursue, pay, reciprocate or count it as quality authority. |

The manual page totals therefore move from four to six verified indexable followed pages after the GSC reconciliation and from four to seven verified indexable nofollow pages after the later Mental Momentum discovery. This is a page-level audit, not proof that Ahrefs DR has increased.

## Search Console link inventory — 2026-08-03

The authenticated `sc-domain:noctalia.app` Links report currently exposes 149 external links from eight source domains to four Noctalia pages. The complete dated reconciliation is stored in `marketing/seo/search-console/2026-08-03-external-links-baseline.md`.

The total is highly concentrated: 89 `google.com` source pages are only the base Google Play listing and localized `hl=` variants, 39 come from the nofollow Good AI Tools listing and 14 come from SaaSHub. Chrome-Stats contributes three rows; AppBrain, Crunchbase, Dreammeaniings and Tham Hiem Mekong contribute one each. The eight-domain GSC inventory and Ahrefs' current 360-domain project-card value measure different discovery corpora and must not be substituted for one another.

Tham Hiem Mekong is the only newly reconciled manual surface. Its exact Italian source page is Google-indexed, self-canonical and links to Noctalia with `rel="noopener noreferrer"` and no `nofollow`. The root domain publishes Vietnamese tax number `1801226459`, a Cần Thơ address and a tourism licence; current search results identify MEKONG DELTA EXPLORER AND EVENT CO., LTD, so the accountable non-Russian operator gate passes. The translated broad-topic Q&A page and its unrelated automotive author profile still fail the editorial-quality gate. It is retained as a sixth technically followed page with `followed_low_trust` treatment, with no outreach, payment, reciprocity or quality-authority claim.

## Ahrefs dashboard refresh — 2026-08-03

The authenticated project `9361004` dashboard was re-read without opening the detailed referring-domain report or consuming a report credit. Monthly-volume metrics now show DR `0`, 360 referring domains (`+130` over 30 days), estimated organic traffic `4.2K` (`+3K`) and 894 organic keywords (`+299`). Site Audit health remains 100. The raw referring-domain total increased from 348 on 2026-07-31, yet DR remains below Ahrefs' first displayed point. This strengthens the sprint's quality conclusion: more discovered domains alone are not the target; followed, relevant editorial citations from accountable publishers are.

## Editorial discovery and pending-state check — 2026-08-03

The third rendered discovery pass is recorded in `marketing/seo/editorial-discovery-wave-3-2026-08-03.md`. Seven new domains were added as exclusions or evidence-blocked prospects rather than padded into the outreach queue. TinkeringProd was the only new page with a strong topical article and direct followed competitor-domain links, but its author, legal operator and non-Russian location could not be established; no message was sent. Craftnote failed the editorial-quality gate, while Empath, Talkamore and Inner Journal did not link competing product domains. MakeUseOf's relevant 2021 article routes app references through affiliate Google Play links. Direct Wirecutter access was blocked by Chrome's site-safety policy and was not retried through another browser or raw request.

The pending-publication check found no indexed Noctalia result for AI Tools Inc, AllThingsAI or Uneed. Good AI Tools remains unchanged and `nofollow` after the factual correction. An exact `contact@noctalia.app` inbox search found no reply, bounce or acknowledgement from the six 2026-08-03 recipients. Make Tech Easier remains the strongest qualified unsubmitted route: the current page still exposes its unpaid General Enquiries form, the earlier prefill did not persist, and the current Chrome session shows both the cookie-consent dialog and an empty Turnstile response. A user must clear those two gates before submission.

The fourth rendered discovery pass is recorded in `marketing/seo/editorial-discovery-wave-4-2026-08-03.md`. Murkaverse, Plume and mic.so publish current product-owned comparisons but give named competitors no outbound domain citations, so all three fail the authority-value gate before contact. MobileAppDaily publishes a current named-author guide and an India address, but almost every app link points to a mobile store and its product route explicitly sells advertising, custom rank and promotional reviews. It was rejected under the no-spend boundary without emailing the public editor address or using the form.

The fifth rendered discovery pass is recorded in `marketing/seo/editorial-discovery-wave-5-2026-08-03.md`. Journal Lock and Rojlekho publish current product-owned guides but do not cite competing developer domains. Blink's OpenClaw voice-journaling use case mentions Day One and Dayora without linking either product and exposes no named-author editorial route. All three fail the domain-citation gate before contact; no message, form, account or product data was used.

## First follow-up preparation — 2026-08-05

The exact replies and send gates are stored in `marketing/seo/backlink-follow-up-wave-1-2026-08-05.md`. The twelve route records that previously carried a 2026-08-05 date do not authorize twelve messages. Ten existing email threads are eligible only after a fresh no-reply, no-bounce, no-live-link check. App Charts has no reply thread and must not receive a duplicate contact-form submission. JournPad remains delivery-gated; its calendar dates are cleared until Gmail supplies authoritative delivery confirmation, after which a new three-day interval must be observed. Each eligible reply adds one new factual resource or test angle, stays in the original thread and asks for neither a link, ranking, placement date nor guaranteed inclusion.

### Inbox and scheduled-send stop check — 2026-08-03 08:18 CEST

The authenticated `contact@noctalia.app` Zimbra session was checked in the real Chrome browser. Exact `in:inbox from:` searches returned zero messages for the fourteen tracked sender domains: AndroidAyuda, BestForAndroid, Android Headlines, Sleep.com, The Verge, Engadget, 9to5Google, Goals & Progress, Penzu, Atlas Workspace, KapanLagi, Android Central, Gratitude Genie and Android Police. This is an inbox stop-check only; it is not proof that a remote mailbox accepted or delivered every earlier message.

The six clock-marked drafts scheduled for later on 2026-08-03 also returned zero results in exact `in:sent to:` searches for `kristijan.lucic@androidheadlines.com`, `amy@amywilkinson.co`, `victoria.song@theverge.com`, `staff@engadget.com`, `abner@9to5mac.com` and `hello@ilty.co`. They remain scheduled drafts and must be confirmed in Sent after their stated times before any follow-up date is assigned. No duplicate message was sent and no tracker state was advanced.

Opening each of the six drafts then showed Zimbra's authoritative scheduled-send notice: Android Headlines at 14:00, Sleep.com at 15:30, The Verge at 15:45, ILTY at 17:00, Engadget at 17:45 and 9to5Google at 19:30 CEST on 2026-08-03. The draft previews showed the intended recipient aliases and subjects; opening them did not alter, send or unschedule any message.

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

A new Gmail search after that wave found no editorial reply or delivery failure for Android Guías, SlashGear or the six other recently contacted domains. The connector still covers `thannous@gmail.com` only and says nothing about the separate `contact@noctalia.app` inbox. The search did surface a temporary JournPad delivery delay: Gmail reports connection timeouts to both advertised mail-server addresses and continues retrying for 45 hours. This is not a permanent failure, but JournPad must not receive a follow-up unless delivery is confirmed. SearchGun's authorized final follow-up is also temporarily delayed: Gmail reported a new 22-hour retry window on 2026-08-02 against the same timed-out mail server. It is not yet a permanent failure; no additional SearchGun message is allowed.

Gratitude Genie passed the operator-location and contact-route gates. Its current Android-journaling comparison discloses its own-product context, current Terms identify Indie Genie Labs, the Support and Terms pages publish `prashanthvaidya@therunninggenie.com`, and the prior Google Play operator check identifies developer Prashanth Vaidya at a Bengaluru, India address. After an exact Zimbra sent-folder search returned no prior message, one factual future-update suggestion was sent from `contact@noctalia.app` on 2026-08-03 and Zimbra confirmed the send.

Speakwise was rejected without contact. Its current product-owned voice-journaling comparison and legal pages are public, but the Terms identify TN Labs LLC as the Delaware operator while the current Apple App Store listing identifies Setter AI LLC as the developer. This material official-entity conflict fails the accountability gate even though both signals point to the United States and neither supplies a Russian-operator signal.

Frandroid passed the French operator, editorial-independence, topical-fit and contact-route gates. Its official notices identify Humanoid SAS and a Paris address, its About page names the current editorial team and distinguishes editorial coverage from sponsored content, and its contact page exposes a dedicated editorial-suggestion path. One French Android voice-dream-journal suggestion was submitted through that path with `contact@noctalia.app`; no CAPTCHA or commercial route was present, and the page displayed the authoritative confirmation `Votre message a bien été envoyé.` The form asked for a future hands-on or app-guide consideration under full editorial control, without payment, ranking, reciprocal-link or guaranteed-link request.

Clubic was verified as a legitimate French operator but rejected without contact under the no-spend boundary. The current official software-reference page prices a one-year dofollow listing at 1,000 EUR, a visibility pack at 2,000 EUR and an editorial-test pack at 3,000 EUR. No form, phone number, product data or payment was submitted. The transparent commercial terms disprove a free-backlink interpretation without making the service untrustworthy.

Four additional publications were initially researched without contact. Android Headlines identifies a United States publisher and a California address; on 2026-08-03 its automatic security check completed in the user-designated Chrome session without CAPTCHA interaction, and the target article rendered Kristijan Lucic's exact author address in visible text and a `mailto:` control. An exact Zimbra Sent-folder search returned no prior author or general-address message. One factual pitch is now scheduled from `contact@noctalia.app` for 14:00 CEST, but it remains a clock-marked draft until the Sent folder proves delivery. AndroidGuys names its founder and accepts free review requests, but does not publish a current accountable legal entity or address; its Privacy Policy retains an unresolved hosting-country placeholder and the form sits behind a 469-vendor consent layer, so its non-Russian operator status remains unverified. Technical Ustad likewise lacks a verified legal operator and location while its Privacy Policy contains staging and country placeholders. Zapier is accountable, but its current selection criteria explicitly exclude both special-purpose and AI-enhanced journals, making Noctalia a documented editorial mismatch rather than an outreach target.

Sleep.com's dream-journal article remains a qualified future-update target: Sleep.com identifies Mattress Firm Inc., a Houston address, current editorial standards, Terms and Privacy, with no Russian operator signal. The article is dated 2022 and names Amy Wilkinson. Its author profile and About page expose no editorial inbox, and Mattress Firm customer support was correctly rejected as a non-editorial route. A focused current Chrome search instead found Amy's professional site, cross-checked through the matching Brooklyn editor-writer identity, Women's Health work and exact LinkedIn profile; its Contact page directly publishes `amy@amywilkinson.co` for work inquiries. An exact Zimbra Sent-folder search returned no prior message. One factual future-refresh pitch is scheduled from `contact@noctalia.app` for 15:30 CEST, but it remains a clock-marked draft with no follow-up date until the Sent folder proves delivery.

Atlas Workspace supplied another current, methodology-led comparison route. Its June 30 guide names Jet New, discloses Atlas as the publisher's own product, records a 30-day test across four apps and exposes four external citations without `nofollow`. Jet's author page identifies him as founder and directly publishes `jet@atlasworkspace.ai`; the Contact page permits partnership and press messages. The 2026 footer identifies AgentScale AI Pte. Ltd. Although the site's governing-law clause is generic, an independent Singapore registry mirror reports active UEN `202508156C`, Singapore jurisdiction and a registered Singapore address, so the accountable non-Russian operator gate passes with that caveat retained. An exact Zimbra Sent-folder search returned no prior message. One factual Android specialist-use pitch was sent from `contact@noctalia.app` at 03:27 CEST; Zimbra displayed `Le mail a été envoyé.` and the exact subject appears in Sent. This remains outreach only, not a backlink or DR gain.

Two further current product-owned comparisons were qualified in the user-designated Chrome session without contact. Claire Calls exposes a strong direct-link pattern and names founder Shawn Beck, but its Terms identify only “Claire AI Technologies” and Illinois law without an exact legal entity or accountable address; a focused company-and-founder search supplied no independent identity or location evidence. Its contact form also requires Turnstile, so it was rejected before any challenge or data submission. Reflection.app exposes direct followed “Visit Website” links to competitor domains and its legal page identifies Journal Better Inc. at a Wilmington, Delaware address. It is nevertheless paused: founder Dave Radparvar is the same founder presented as Dave Rad in Holstee's comparison, and the Holstee thread opened on 2026-07-31 remains unresolved. No second message was sent through the sister company's public mailbox. This preserves person-level deduplication without discarding a qualified future domain-citation opportunity.

The sixth rendered discovery pass is recorded in `marketing/seo/editorial-discovery-wave-6-2026-08-03.md`. ILTY passed the strongest current gate combination: a self-canonical `index, follow` comparison, a declared 30+ day seven-app test, six direct competitor-domain links without `nofollow`, named Colorado founders, an official general-inquiries route and Apple's independent seller identification as SUUR Limited Liability Company. An exact Zimbra Sent-folder search returned no prior ILTY message, so one short factual note is scheduled for 17:00 CEST, or 09:00 in Colorado. Seauton, Habit and Pensio were rejected because their named competitors receive no domain citations. AI Journal App exposes useful direct links but was rejected because its unnamed operator and two inconsistent public contact addresses fail the accountability gate.

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

The same operator-location gate now applies to editorial prospects, not just profile platforms. Android Police passed through its named article, public guidelines, explicit editorial-suggestions route and Valnet Inc.'s Canadian legal identity. Lifehacker passed through its named hands-on article, Ziff Davis's United States ownership and the author's official no-CAPTCHA form; one factual message was accepted from `contact@noctalia.app`. Android Authority also passed through its named Pixel Journal comparison, Authority Media identity, Canadian address, editorial terms and official General enquiries form. That form's Submit control was clicked exactly once with `contact@noctalia.app`, but the page supplied no success or error acknowledgement and retained every field. Post-action reconciliation then found the earlier 2026-07-31 Android Authority email, making the form click a publisher-level deduplication miss. Delivery is quarantined as unconfirmed; the domain is closed to every retry and follow-up, and the form attempt is not counted as accepted outreach. Apps Tested and Slant were rejected despite topical pages because neither current surface establishes an accountable operator, legal address and non-Russian location strongly enough for outreach.

The next editorial discovery pass kept relevance and publisher policy ahead of host authority. Forbes Vetted is the strongest new prospect: its January 2026 sleep-app guide names McKenzie Dillon, records two weeks of hands-on Oniri testing and reserves a specific dream-journaling category. Forbes Media LLC and its New Jersey address are current official operator evidence. The current author page links Dillon's matching verified LinkedIn profile, but the direct-message route prompts a Premium InMail trial and no public author email is exposed. No address, connection request, trial, payment or outreach was used. TechCrunch also passes the United States operator gate through TechCrunch Media LLC and its California legal address, but its official contact page explicitly refuses pitches and guest-post submissions; the author address published in the Pixel Journal article was therefore not used to bypass the publisher policy. Tech Advisor passes through Foundry and Regent ownership plus its official staff contact page, but the relevant opinion explicitly rejects AI-guided journaling; Noctalia was paused as a thesis and positioning mismatch rather than forced into an authoritative but hostile context.

The professional mailbox is now available in the user-designated Chrome session. Zimbra visibly identified `DEFAULT <contact@noctalia.app>`. Eight qualified messages were confirmed sent on 2026-08-03: AllThingsAI, Digital Trends, Gratitude Genie, Android Police, Goals & Progress, Penzu, Atlas Workspace and KapanLagi. Six deduplicated messages remain scheduled but not sent: Android Headlines at 14:00, Sleep.com at 15:30, The Verge at 15:45, ILTY at 17:00, Engadget at 17:45 and 9to5Google at 19:30 CEST. All six are deliberately excluded from sent counts, and none receives a follow-up date until its clock-marked draft moves into Sent. Targeted inbox and spam searches found no new reply, automatic response, rejection or delivery failure for the campaign routes. KapanLagi has exact Sent-folder proof at 05:27 CEST; repeated inbox and mailer-daemon searches at 05:33 CEST returned no result, and no public link change has been claimed. Every confirmed or scheduled message remains outreach awaiting review rather than a backlink claim.

The fifteenth rendered discovery pass is recorded in `marketing/seo/editorial-discovery-wave-15-2026-08-03.md`. Sleepopolis passed the topical, operator and official-press-route gates: its 2023 dream-app article names Molly Nodurft, the current Contact page identifies Sleepopolis/Pillar4 Media in Charlotte, North Carolina, and the current Press page publishes `contact@sleepopolis.com`. Exact Zimbra searches found no prior send or inbound reply, and one factual Android update suggestion was sent from `contact@noctalia.app` at 08:39 CEST; the exact Sent search returned one result with the subject. This remains transmission-only outreach, not delivery, acceptance, publication, a backlink or a DR gain. Sandman remains a qualified hold because its founder review contains direct product-domain citations and MUJO LLC evidence but no current editorial or press route. Mirror, Night Omen, Kelly Bulkeley and Dreams & Stars were excluded before outreach under the documented domain-citation, operator-route or renderability gates.

### Public editorial assets recheck — 2026-08-03 08:50 CEST

The live Chrome session rechecked the three assets used by the current outreach queue. `/en/press` is self-canonical and `index, follow`, shows the July 31 press-kit update, and exposes the public CSV, 71-second walkthrough, screenshots, Google Play listing and `contact@noctalia.app`. `/en/dream-journal-apps` is self-canonical and `index, follow`, shows `Methodology updated August 3, 2026` and links the exact public comparison CSV. `/en/voice-dream-journal` is self-canonical and `index, follow`, with the July 9 voice-capture update. These checks confirm that the assets are publicly reachable and citable; they do not prove a publisher used them, a backlink exists or Ahrefs DR changed.

The eighth rendered discovery pass added one live citation and one source-reclamation route. Google's exact result surfaced Mental Momentum's 2026 research page; rendered Chrome confirms a self-canonical `index, follow` page with one Noctalia source link marked `nofollow`. Current Terms identify Mental Momentum Inc. in Virginia, so the accountable non-Russian gate passes, but the citation is discovery/entity evidence only and required no outreach. KapanLagi's June 29 article cites Noctalia twice and prints the exact water-dream URL in its references without creating any Noctalia anchor. Official KapanLagi pages establish named editorial staff, a Jakarta office, the KLY/EMTEK operator and `redaksi.kapanlagi@kly.id`. After exact Sent-folder deduplication, one short source-attribution request was sent at 05:27 CEST. The article remains an unlinked mention unless and until a live clickable source is independently verified.

The ninth discovery pass found a historical APKPure result, but current direct checks return `HTTP 410` for both the legacy and current profile paths and expose no `noctalia.app` link. APKPure's official developer agreement identifies ELECYBER INTERNATIONAL PTE. LTD. in Singapore, so the non-Russian operator gate passes; the profile itself is retired and has no recoverable link. It is recorded as an unverified historical entity surface and a P2 retired-profile exclusion, with no account, submission or outreach. Evidence is in `marketing/seo/editorial-discovery-wave-9-2026-08-03.md`.

The tenth discovery pass expands the KapanLagi reclamation target. In addition to the June 29 article already contacted, six current KapanLagi water-dream pages return `HTTP 200`, repeat the exact `https://noctalia.app/en/blog/water-dreams-meaning` reference and expose zero Noctalia anchors: wallet falling into water, ocean water, murky water, a flooded bathroom, collecting rainwater and drowning in the sea. This is one accountable Indonesian editorial route, not seven separate sends. The existing message remains the only send; the six URLs are queued for the conditional 2026-08-08 follow-up if no reply or live link appears. No backlink or DR gain is claimed until a clickable public result is verified. Evidence is in `marketing/seo/editorial-discovery-wave-10-2026-08-03.md`.

The eleventh discovery pass found no new safe send. Dreams Journal has an active, relevant blog and a public partnership mailbox, but its About, Terms and Privacy pages identify only the brand and no accountable legal entity, address or jurisdiction. Dream Network Journal publishes a submission policy and a named revival team, but its own About page describes a tentative archive with no current editor and no fixed next issue. The university-hosted International Journal of Dream Research is a peer-reviewed research venue, not a commercial app-placement route. These are recorded as two P2 holds and one non-prospect; no email, attachment, account, CAPTCHA or product data was used. Evidence is in `marketing/seo/editorial-discovery-wave-11-2026-08-03.md`.

The three data-led additions passed a stricter journalist gate in Chrome. The exact Pixel Journal coverage, current role, official contact route, accountable United States operator and five recent articles were reviewed for 9to5Google's Abner Li, The Verge's Victoria Song and Engadget's Igor Bonifacic. Each pitch is under 150 words and discloses that Noctalia compiled the 11-app dataset and appears in it; the findings are framed as a small, dated review of advertised features rather than market share, product quality or clinical evidence. TechCrunch remained excluded because its official contact policy refuses pitches and guest posts, Zapier remained a documented editorial mismatch, and already-contacted publishers received no duplicate. Evidence and exact copy are in `marketing/seo/editorial-discovery-wave-7-2026-08-03.md`.

Dribbble is a legitimate Canadian/US platform, but direct shot rendering and outbound-link treatment could not be verified in the current audit, while paid visibility starts at 48 USD per year; it is deferred rather than used as a duplicate portfolio stack. Chrome Web Store was rejected because it requires an extension, developer registration and a fee. GitHub Pages was rejected as a self-created duplicate of the existing production site and public repository. Gumroad was rejected because no separate digital product or membership is being sold there; an empty commerce profile would not be an editorial citation.

Stripe Climate is not a free backlink route. Stripe's official documentation makes the hosted climate page available to businesses that activate a percentage-of-revenue, fixed monthly or one-time carbon-removal contribution. No Stripe setting, contribution, badge or hosted page was activated: spending is not authorized, and a climate commitment must be a genuine business decision rather than an SEO tactic.

Tracking files:

- `marketing/seo/backlink-results-2026-07-31.csv`: nineteen manually audited surfaces, including six indexable followed pages (one explicitly low-trust), seven indexable nofollow pages (one explicitly low-trust), two nonindexable profiles, one lost historical listing and three search-visible store-derived or entity-profile surfaces whose link treatment remains unverified;
- `marketing/seo/backlink-measurements-2026.csv`: dated authority and visibility snapshots, with evidence scope kept explicit;
- `marketing/seo/search-console/2026-08-03-external-links-baseline.md`: authenticated GSC inventory of 149 external links, eight source domains and four target pages, reconciled to manual link quality;
- `marketing/seo/backlink-prospects-2026-07-31.csv`: 159 researched opportunities: 2 P0 corrections/reclamations, 54 P1 prospects, 102 P2 prospects or exclusions and 1 P3 launch route;
- `marketing/seo/editorial-discovery-wave-3-2026-08-03.md`: rendered trust, domain-link and pending-publication decisions for the third editorial discovery pass.
- `marketing/seo/editorial-discovery-wave-4-2026-08-03.md`: four current comparison decisions plus the no-credit Ahrefs project-dashboard refresh.
- `marketing/seo/editorial-discovery-wave-5-2026-08-03.md`: three current product-owned guide decisions, all rejected at the direct competitor-domain citation gate.
- `marketing/seo/editorial-discovery-wave-6-2026-08-03.md`: five current product-owned comparison decisions, including one qualified and scheduled ILTY route plus four evidence-backed exclusions.
- `marketing/seo/editorial-discovery-wave-7-2026-08-03.md`: three journalist-qualified, data-led and scheduled pitches plus evidence-backed policy or deduplication exclusions.
- `marketing/seo/editorial-discovery-wave-8-2026-08-03.md`: one live nofollow research citation plus one qualified and sent KapanLagi source-reclamation route.
- `marketing/seo/editorial-discovery-wave-9-2026-08-03.md`: one historical APKPure profile verified as HTTP 410 and excluded without contact.
- `marketing/seo/editorial-discovery-wave-10-2026-08-03.md`: six additional KapanLagi unlinked source mentions consolidated into the existing single follow-up route.
- `marketing/seo/editorial-discovery-wave-11-2026-08-03.md`: Dreams Journal and Dream Network Journal holds plus the IJoDR research-venue exclusion; no outreach sent.
- `marketing/seo/editorial-discovery-wave-15-2026-08-03.md`: Sleepopolis qualification and sent transmission, Sandman hold, and four fresh search-result exclusions.
- `marketing/seo/backlink-outreach-wave-1-2026-07-31.md`: 39 numbered recipient-specific editorial messages or form dossiers plus replacement route 4R, with current contact routes and a two-follow-up stop policy; routes 32–34 live in the professional-mailbox wave and route 39 is Sleepopolis.
- `marketing/seo/backlink-outreach-wave-2-professional-mailbox-2026-08-03.md`: the exact sent copy, current trust evidence and follow-up dates for Digital Trends, Gratitude Genie and Android Police from `contact@noctalia.app`.
- `marketing/seo/backlink-follow-up-wave-1-2026-08-05.md`: ten thread-specific first replies, one no-send form route, one delivery-gated route and the exact pre-send stop checks.
- `marketing/seo/backlink-outreach-log-2026-07-31.csv`: send, reply, follow-up and live-link state for 45 route records covering 44 unique publishers or directories: 6 scheduled but not yet sent messages, 1 temporarily delayed route, 1 unconfirmed form attempt and 3 failed official routes, with all other states stored row-by-row in the CSV.
- `marketing/seo/directory-submission-pack-wave-3-ai-2026-07-31.md`: one field-ready free Future Tools dossier plus an official-price decision matrix for six paid or reciprocal AI-directory routes.
- `marketing/seo/directory-submission-pack-wave-4-entities-design-2026-08-02.md`: the existing Crunchbase entity audit, a field-ready Behance mobile-product case study and evidence-backed exclusions for Dribbble, Chrome Web Store, GitHub Pages and Gumroad.
- `marketing/seo/directory-submission-pack-wave-5-verified-free-2026-08-02.md`: one sent AllThingsAI dossier, field-ready TinyLaunch and 10words copy, and explicit trust or reciprocity exclusions for four lower-confidence routes.
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
| B — SearchGun | One final follow-up added the public methodology and offered an easy close-the-loop response. | Gmail message `19fb83074b0b329f`; Gmail issued a new 22-hour temporary-delay notice on 2026-08-02 after repeated server timeouts. This is not yet a permanent failure; do not send anything else unless the editor replies. |
| B — Digital.Health | One final follow-up asked only whether a clearly non-medical consumer wellness app is eligible. | Gmail message `19fb830a67794116`; stop unless the directory replies. |
| B — editorial wave | Forty-two route records cover forty-one unique publishers or directories: thirty-one are delivered, accepted, acknowledged or waiting after an automatic reply; Android Headlines, Sleep.com, The Verge, ILTY, Engadget and 9to5Google each have one message scheduled but not yet sent; JournPad remains temporarily delayed; Android Authority has one delivered route closed after the duplicate form attempt plus one unconfirmed form record; Best Apps for Android, Know Your Ethos and Dreamz Journal failed and were closed without guessed alternatives. The eight confirmed professional-mailbox sends on 2026-08-03 include AllThingsAI, Digital Trends, Gratitude Genie, Android Police, Goals & Progress, Penzu, Atlas Workspace and the KapanLagi source-reclamation request; Paul Hatton remains away through 2026-08-12. | First verify after 14:00, 15:30, 15:45, 17:00, 17:45 and 19:30 that Android Headlines, Sleep.com, The Verge, ILTY, Engadget and 9to5Google respectively moved from their clock-marked drafts to Sent before assigning any follow-up date. Ten email-thread replies are conditionally due on 2026-08-05 after fresh stop checks; App Charts must not receive a duplicate form and JournPad has no active follow-up date until delivery is confirmed. Dream Studies Portal is due on 2026-08-06, nine confirmed 2026-08-02 contacts on 2026-08-07, and the eight confirmed 2026-08-03 sends on 2026-08-08; TechRadar remains deferred to 2026-08-13. Android Authority is closed to every retry or follow-up. No scheduled or sent message is counted as a backlink. |
| B — trusted-prospect extension | Make Tech Easier passed the Singapore operator and editorial-fit gates but remains unsubmitted behind its cookie-consent choice and human Turnstile. The current blank General Enquiries form is separate from paid reviews and sponsored content; the earlier prefill did not persist. Digital Trends, Gratitude Genie and Android Police passed refreshed topical, operator, non-Russian-location, official-route and professional-mailbox deduplication checks and were sent once from `contact@noctalia.app`. G2 and Capterra remain excluded for B2B eligibility mismatch, Geekflare for a commercial placement route, and ZipDo for unresolved operator, address and free-route evidence. | Three confirmed sends awaiting replies; one user-action route remains paused; four exclusions received no data. Zero spend, reciprocal links, guaranteed-link requests or backlink claims. |
| B — current comparison extension | Claire Calls has a useful followed citation pattern but failed the legal-operator and accountable-location gate and also requires Turnstile. Reflection.app passed the Delaware operator and direct competitor-domain link checks but shares founder Dave Radparvar with Holstee, whose 2026-07-31 thread remains open. | Claire rejected without data; Reflection qualified but paused under person-level deduplication. No message, challenge, form submission or backlink claim. |
| B — verified free-directory extension | AllThingsAI passed the D2X Enterprises LLC, Pennsylvania address, free-route and non-Russian operator gates; one factual dossier was sent from `contact@noctalia.app` and Zimbra confirmed the send. TinyLaunch and 10words also passed, but remain blocked on user-owned professional account credentials. LaunchVault was rejected for a mandatory reciprocal dofollow link; What Launched Today, Firsto and ai-tool.ai failed operator or legal-route verification. | One message awaiting review, two field-ready account-blocked routes and four exclusions. No spend, CAPTCHA bypass, invented password, reciprocal link or live-backlink claim. |
| C — AlternativeTo | Current signup form and its 7-day new-account rule verified; correct email identity available. | Paused for user-owned password and hCaptcha. |
| C — AppBrain | The official access email was opened in the authenticated `contact@noctalia.app` mailbox and the claim link was validated for package `com.tanuki75.noctalia`. | Complete: the developer dashboard lists `Noctalia: Smart Dream Journal` under “Your apps in Google Play”. No promotion or spend was activated. |

Product Hunt now has a complete local launch pack and the pricing/video deployment gate is cleared. It remains outside this batch until the walkthrough is uploaded to YouTube with publication approval, the personal account is verified, and a launch date plus genuine feedback cohort are approved.

## Measurement

The read-only public verifier was rerun at 08:26 CEST on 2026-08-03 against all 19 rows in `marketing/seo/backlink-results-2026-07-31.csv`. It returned 6 followed, 4 nofollow, 2 missing-link, 3 non-indexable, 3 HTTP 403 and 1 HTTP 410 result. The four changed or unreachable surfaces were Reddit (missing link), Chrome Stats (403), AppBrain (403) and StackScope (non-indexable). Crunchbase's 403 and APKPure's 410 remained their recorded baseline outcomes; no tracker row was modified. These are remote-state observations, not evidence of a new DR gain or a defect introduced by the SEO documentation.

A second read-only verifier run at 08:49 CEST on 2026-08-03 produced the same 19-row summary: 6 followed, 4 nofollow, 2 missing-link, 3 non-indexable, 3 HTTP 403 and 1 HTTP 410. The checker again left `marketing/seo/backlink-results-2026-07-31.csv` untouched. This repeat confirms that the documented public-link state has not changed during the morning; it still does not establish Ahrefs DR movement, editorial acceptance or delivery of any outreach.

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
