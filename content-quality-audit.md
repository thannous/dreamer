# Content-Quality Audit — noctalia.app

**Date:** 2026-07-20
**Audited by:** automated multi-agent audit (70 auditors), English canonical sources

**Scope & method.** The site is generated from `docs-src/` into ~1,165 public URLs (233 unique pages × 5 locales: en/fr/es/de/it). Since locales are translations of one canonical source, each page was audited once on its English source, plus a dedicated localization-parity spot check. Sources audited: `docs-src/content/pages/*`, `docs-src/content/blog/*`, `data/dream-symbols*.json`, the generators (`scripts/build-guides-pages.js`, `generate-symbol-pages.js`), generated output in `docs/en/`, and git history of `docs-src/content/`. "REQUIRES VERIFICATION" marks claims that could not be confirmed — nothing was assumed or invented.

Scores used throughout: **UV** = unique value /10, **IG** = information gain /10. Risks: Low / Medium / High / Critical.

---

## A. Executive summary

**Overall assessment.** This is **not** a mass-produced AI-content farm — but it carries three concentrated pockets of exactly the failures that make a site look like one. The site's backbone (legal pages, methodology page, the 2026 science-news articles, homepage, comparison pages) is unusually honest, hedged, and verifiable; the July git history shows a genuine anti-slop trajectory (removing fake statistics, clickbait titles, and an invented authority claim — the "55,000-dream corpus" — that the team itself formally retracted). Against that, three problems dominate:

1. **Citation integrity is the single biggest credibility risk.** Across ~15 articles, auditors verified PubMed/DOI links that resolve to *unrelated papers* (a hepatitis-C virology review cited for a meditation claim; a modafinil study labeled "Aurora et al. 2010"; an Achilles-tendinopathy paper cited for pregnancy dreams), misattributed authors ("Guillot et al." for Thapa et al.; "Kim et al." for Pasquier et al.; Izawa et al. placed in *Neuron* instead of *Science*), and **unsourced verbatim quotes attributed to named, living researchers** (Bulkeley, LaBerge, Cartwright, Barrett, Watt, Zadra, Naiman, Walker — likely AI-fabricated). Some of these were bulk-injected by SEO scripts across all 5 locales. On YMYL-adjacent health content, this is worse than having no sources.
2. **59% of the symbol dictionary (88 of 150 pages) is noun-swap template.** The exact same 88 symbols share byte-identical shortDescriptions, one identical FAQ answer ("It depends on the scene…") emitted with FAQPage JSON-LD on every page, identical ask-yourself questions, and nonsense variations produced by substitution ("Losing Tornado — Losing it may suggest fear of disconnection…"). Demon and mother dreams get the identical "relationships, roles, memory, boundaries" interpretation. This is the section a visitor would most plausibly call AI slop.
3. **The English canonical is now the stale locale.** July's quality fixes ("humanize", "Ahrefs-flagged content") were applied to de/fr/es and never backported: fr/es water-dreams articles are newer, more cautious, and better sourced than the English original; the de dream-journal-guide had its fake recall statistics removed while English still asserts them; fr/es/de/it homepages still ship sections English deleted (including hidden named testimonials).

**Main AI-slop risks:** template symbol pages (158 URLs, ~1/3 of the site by URL count); ~6 dream-interpretation spokes recycling a rigid skeleton with interchangeable stats and quotes; guide pages whose unique copy is ~120–180 words over reused cards; three interchangeable hub pages sharing a verbatim "Quick start."

**Strongest pages:** `legal.privacy` (most evidence-backed page on the site), `page.dream-content-methodology` (first-party retraction with provenance rules — rare and excellent), `blog.dream-emotion-regulation-study` (externally verified study coverage with limitations), `blog.heat-stress-nightmares`, `blog.recurring-dreams-meaning` (post-cleanup), `page.home`, `page.oniri-alternative`, `guides/dream-symbols-dictionary`, `guides/dream-locations`.

**Weakest pages:** `blog.stop-nightmares-guide` (**Critical** accuracy), `page.android-dream-analysis-app` (merge candidate), the 88 tier-B symbol pages, `blog.exam-dreams-meaning`, `blog.dreams-about-ex`, `blog.flying-dreams-meaning`, `blog.death-dreams-meaning`, `blog.dream-journal-guide`, guides `scary-/positive-/animal-/water-dream-symbols`.

**Site-wide patterns:** three parallel layers (blog spokes ↔ symbol pages ↔ thematic guides) competing for the same "X dream meaning" head queries with self-referential canonicals; a "Quick answer = meta description verbatim" pattern on ~10 articles; unsourced fake-precision statistics ("over 70%", "33%", "35%", "50%/90%") recycled between articles; six "N meanings" title/body count mismatches; hero images reused across 5+ articles.

**Highest-priority actions:** (1) audit and repair every citation and named-expert quote site-wide; (2) rewrite or noindex the 88 template symbol pages; (3) backport the de/fr/es improvements into English and enforce parity gates; (4) merge `android-dream-analysis-app` → `ai-dream-interpretation-app`; (5) differentiate the blog/symbol/guide three-layer collision.

---

## B. Page-by-page audit

### B1. Marketing & product pages (11)

#### 1. Home — `/en/`
"Noctalia Dream Journal with AI-Guided Reflection"
- **Type:** product landing page | **Intent:** what is Noctalia, is it trustworthy, what does it cost
- Slop **Low** | Accuracy **Low** | UV **7** | IG **6** | Editing: High | **Action: Keep**
- Problems: stale count "150 symbols" (158 published); "Stored securely" vague; no ratings/downloads/testimonials; no Plus pricing.
- Keep: restrained register, concrete offline behavior, exact free-tier limits.
- Missing: trust evidence, pricing, defined feature terms.
- Fix example: "Generate an image for an entry when a visual reminder would help" → state input/output: an illustration is generated from the transcript and attached to the entry (verify before publishing).

#### 2. About — `/en/about`
"About Noctalia"
- **Type:** trust/E-E-A-T page | **Intent:** who runs this, why believe the content
- Slop **Low** | Accuracy **Low** | UV **6** | IG **6** | Editing: High | **Action: Keep (light edit)**
- Problems: claim "every article includes a disclaimer" false (47/49); founder bio one vague unverifiable sentence.
- Keep: legal identity matches the legal notice exactly; editorial-process claims verifiable.
- Missing: founder substantiation (photo, background, external profile), review dates.
- Fix example: "Software engineer and long-time dream journaler…" → specific checkable facts (name, location, years journaling, writes/edits every article) or delete the clause.

#### 3. Press — `/en/press`
"Noctalia Press Kit"
- **Type:** press kit | **Intent:** verified facts, assets, contact, fast
- Slop **Low** | Accuracy **Low** | UV **7** | IG **6** | Editing: High | **Action: Keep (minor edit)**
- Problems: founder bio thin; Quick facts omit launch date and legal entity; no traction data; one copyedit slip ("reflection" doubled).
- Keep: six downloadable assets verified on disk with usage terms; no invented statistics.
- Missing: launch date, entity, founder photo/quote, reception evidence.

#### 4. Dream Content & Dataset Methodology — `/en/dream-content-methodology`
- **Type:** transparency/methodology page | **Intent:** verify content scope; is the dataset citable
- Slop **Low** | Accuracy **Medium** | UV **9** | IG **8** | Editing: High | **Action: Edit**
- Problems: hand-stamped counts already stale 11 days later (44 families/235 files vs actual 46/≈245); "extended covers the same 150 ids" inaccurate (145/150); auditability promised but the artifact is never linked.
- Keep: formally retracts the "55,000-dream corpus" with provenance requirements; named editor; admits no clinician reviewer — a model of editorial honesty.
- Missing: build-generated counts, linked catalog, update cadence.
- Fix example: inject counts from the data files at build time so they can't drift; re-stamp "last checked."

#### 5. Best Dream Journal Apps 2026 — `/en/dream-journal-apps`
- **Type:** comparison listicle / cluster hub | **Intent:** pick a dream journal app
- Slop **Medium** | Accuracy **Medium** | UV **6** | IG **5** | Editing: High | **Action: Edit**
- Problems: "Detailed notes" section restates the comparison table verbatim for 8 apps (pure padding); 8/11 apps lack dated evidence; Oniri "beta" status stale vs sibling page; DreamKit missing from sources.
- Keep: admitted comparison methodology; "Not ideal for" honestly includes Noctalia; dated sources.
- Missing: dated store data, first-hand testing signal.
- Fix example: delete "Detailed notes" entirely; replace with three decision lines that add new information (fastest Android capture → Noctalia; lucid training → Oniri; mainstream iOS → DreamApp).

#### 6. DreamApp Alternative — `/en/dreamapp-alternative`
- **Type:** comparison page | **Intent:** Android user weighing leaving DreamApp
- Slop **Medium** | Accuracy **Medium** | UV **6** | IG **6** | Editing: Medium | **Action: Edit**
- Problems: internal strategy brief published as reader copy ("Noctalia should position…", "do not claim"); "Pricing evidence" section contains zero prices despite owned data; competitor claims secondhand (REQUIRES VERIFICATION).
- Keep: dated sourced store stats; honest don't-switch guidance; concrete migration advice.
- Missing: on-page pricing, first-hand evidence.
- Fix example: "Noctalia should position around reflection and continuity, not certainty" → reader-facing: "DreamApp leans on fixed meanings; Noctalia treats interpretations as reflection prompts and tracks recurring symbols."

#### 7. Oniri Alternative — `/en/oniri-alternative`
- **Type:** vendor comparison page | **Intent:** is Noctalia a credible Oniri replacement
- Slop **Medium** | Accuracy **Low** | UV **7** | IG **7** | Editing: High | **Action: Edit**
- Problems: internal-brief voice leaks; withholds exact IAP prices already on file; pricing panel duplicates the table; displayed date ≠ modifiedTime.
- Keep: concedes Oniri's lucid-dreaming superiority; "Do not switch if" panel; dated sourced snapshot.
- Missing: exact dated prices, testing artifacts.
- Fix example: publish actuals with context ("Noctalia Plus €2.99/mo, €19/yr; Oniri $12.99/$47.99 — US listing, checked 2026-05-20").

#### 8. AI Dream Interpretation App — `/en/ai-dream-interpretation-app`
- **Type:** SEO landing page | **Intent:** find a trustworthy AI interpretation app for Android
- Slop **Medium** | Accuracy **Low** | UV **5** | IG **6** | Editing: High | **Action: Keep + Edit**
- Problems: four generic interchangeable marketing cards; "vs" table names no competitors; heavy overlap with android-dream-analysis-app; zero product artifacts; FAQ restates intro verbatim.
- Keep: honest can/cannot limits; capture-first stance; privacy claims verified against the policy.
- Missing: screenshot, sample interpretation, pricing, named competitors.
- Fix example: replace the four cards with one concrete walkthrough: a real dream entry → interpretation excerpt → example follow-up question.

#### 9. Dream Dictionary App — `/en/dream-dictionary-app`
- **Type:** feature landing page | **Intent:** Android dream-dictionary app; free? credible?
- Slop **Low** | Accuracy **Low** | UV **6** | IG **6** | Editing: High | **Action: Keep (minor edit)**
- Problems: stale "150" count; "150 editorial entries" overstates human review of programmatic content (REQUIRES VERIFICATION); tells, never shows an entry.
- Keep: honest decision table; no-clinician disclosure; no invented stats.
- Missing: a rendered sample entry, reviewer credit, count sync.

#### 10. Android Dream Analysis App — `/en/android-dream-analysis-app`
- **Type:** SEO landing page | **Intent:** see what "analysis" delivers
- Slop **Medium** | Accuracy **Low** | UV **3** | IG **4** | Editing: High | **Action: Merge**
- Problems: the weaker half of the site's highest-risk cannibalization pair; ~250 words writable without opening the app; zero product evidence.
- Keep: "What it cannot determine" limits; verified privacy claims.
- Missing: everything that would prove the product exists.
- Recommendation: merge into `/en/ai-dream-interpretation-app`, 301 the slug, keep its different-jobs disambiguation section.

#### 11. Voice Dream Journal — `/en/voice-dream-journal`
- **Type:** keyword landing page | **Intent:** voice dream capture mechanics, audio handling
- Slop **Medium** | Accuracy **Low** | UV **4** | IG **4** | Editing: Medium | **Action: Edit**
- Problems: sells voice capture but never explains the mechanics (on-device STT first, cloud fallback, audio retained minutes) — all of which sit unused in the privacy policy; "searchable" claimed, never shown; template sameness with three sibling landing pages.
- Keep: verified privacy claims, honest limitations, concrete closing micro-experiment.
- Missing: record-screen screenshot, transcript→entry example, mumbled-speech accuracy.

### B2. Blog articles (50)

#### 12. AI dream journal privacy — `/en/blog/ai-dream-journal-privacy`
Consumer-advice explainer | Intent: is an AI dream journal safe; what to check first
- Slop **Medium** | Accuracy **Low** | UV **3** | IG **4** | Editing: Medium | **Action: Edit**
- Problems: EU AI Act paragraph is empty SEO garnish; five-check list gives no pass/fail criteria; never applies its own checklist to Noctalia despite concrete privacy-policy answers; wrong "5 min read" badge.
- Keep: right question frame, restrained tone, real regulator sources.
- Missing: Noctalia's own policy answers per check.
- Fix: add a "How Noctalia answers these" block (on-device first, Gemini training-disabled, 30-day deletion, EU hosting); replace the AI Act garnish with: the Act phases in 2025–2027, a dream journal is minimal-risk, so "AI Act compliant" certifies almost nothing — GDPR deletion and minimisation are what protect you (wording REQUIRES VERIFICATION).

#### 13. The AI That Reads Your Sleep (SleepFM) — `/en/blog/ai-sleep-analysis-dreams`
Science-news | Intent: what Stanford's SleepFM showed; meaning for lay readers
- Slop **Low** | Accuracy **High** | UV **6** | IG **6** | Editing: Medium | **Action: Edit**
- Problems: wrong author citation "Guillot et al." (actual Thapa et al.); "over 14,000 patients" false (~65,000 participants/585,000 h); C-index 0.87 is breast cancer, not cardiovascular; mortality 0.83 vs reported 0.84; unsourced PTSD "80%" (REQUIRES VERIFICATION).
- Keep: core science correctly framed, substantive ethics/limitations.
- Fix: correct citation to Thapa et al., link both DOIs, correct cohort and C-index figures.

#### 14. Anxiety Dreams — `/en/blog/anxiety-dreams-meaning`
Health editorial | Intent: why anxiety dreams happen, meanings, how to stop
- Slop **Medium** | Accuracy **High** | UV **2** | IG **3** | Editing: Medium | **Action: Edit**
- Problems: Krakow & Zadra link resolves to an unrelated paper — real paper is PMID 16390284 in *Behavioral Sleep Medicine*, not a meta-analysis; invented stats "77%", "40% fewer", "2–3 weeks" (REQUIRES VERIFICATION).
- Keep: accurate REM/norepinephrine passage, concrete IRT protocol, responsible red flags.
- Fix: repair the citation, source or delete the three stats; replace "consistent dream journaling reduces the emotional intensity of dreams within 2-3 weeks" with the honest version: journaling is the working material for IRT — the pattern, not the journal, does the work.

#### 15. Being Chased Dreams — `/en/blog/being-chased-dreams`
Interpretation editorial | Intent: why chase dreams happen; what they mean
- Slop **Medium** | Accuracy **High** | UV **3** | IG **3** | Editing: Medium | **Action: Edit**
- Problems: two unsourced quotes attributed to named experts (Barrett, Loewenberg — possible fabrications); "over 80%" stat repeated 3× into FAQPage JSON-LD; title promises 7 scenarios, delivers 5–6; Quick answer = meta description verbatim.
- Keep: accurate Revonsuo anchor, distinct scenario cards.
- Fix: verify or delete both quotes — the page's highest-risk element.

#### 16. Children's Dreams — `/en/blog/children-dreams-guide`
Help guide | Intent: what kids dream by age; nightmares vs terrors; helping
- Slop **Low** | Accuracy **Medium** | UV **6** | IG **6** | Editing: Medium | **Action: Edit**
- Problems: Quick answer contradicts the body ("children dream more often" vs cited Foulkes: under-5s rarely report narrative dreams); "37% of children 3–6" unverifiable; unverified "whole family" feature claim.
- Keep: real Foulkes citation, reference-grade age×REM table, correct night-terror advice.
- Fix: rewrite the Quick answer to match the body (more REM, *fewer* reported dreams; narrative dreams ~age 7); source or replace the 37% figure.

#### 17. Daylight Saving Time and Sleep — `/en/blog/daylight-saving-time-sleep`
Science editorial with how-to | Intent: DST effects on sleep/dreams; adjustment tips
- Slop **Medium** | Accuracy **High** | UV **5** | IG **6** | Editing: Medium | **Action: Edit**
- Problems: likely-fabricated sun/moon dream-frequency claims existing to justify symbol links; probable season error (depressive-admissions study concerns autumn, not spring); unsourced Roenneberg quote and precise accident/REM figures.
- Keep: four real DOI-linked studies, concrete tips, accurate 2026 policy status.
- Fix: cut the dream-content claims or state the truth: no published study tracks dream content across DST; the mechanism is REM rebound.

#### 18. Death Dreams: 5 Hidden Meanings — `/en/blog/death-dreams-meaning`
Interpretation spoke | Intent: reassurance it's no omen; meaning; next steps
- Slop **High** | Accuracy **High** | UV **2** | IG **3** | Editing: Low | **Action: Edit**
- Problems: title promises 5 meanings, body delivers 6; "over 70%" stat recycled verbatim from the falling-dreams article (REQUIRES VERIFICATION); unsourced named-expert quotes (Naiman, Lennox) with inconsistent titles; decorative sources; template skeleton identical to snake/falling/teeth spokes.
- Keep: distinct scenario cards, therapy referral, not-prophetic reassurance.
- Fix: delete or source the stat and quotes; cut the six unsourced "ancient cultures" bullets; resolve 5-vs-6.

#### 19. Controlling Dreams to Solve Problems — `/en/blog/dream-control-problem-solving`
Science-news | Intent: verify 2026 Northwestern TMR study; apply at home
- Slop **Low** | Accuracy **Medium** | UV **7** | IG **7** | Editing: Medium | **Action: Edit + Verify**
- Problems: headline "doubled resolution 20%→40%" omits that it was a post-hoc subgroup analysis; hippocampus–prefrontal "brain imaging" claim invented (EEG study); Barrett citation links to an unrelated steroid paper (actual: 1993, *Dreaming*).
- Keep: real DOIs, honest home-TMR protocol with lab-vs-home caveat.
- Fix: add "post-hoc, cue-responsive subgroup" wherever the doubling claim appears; delete or source the imaging paragraph; fix the Barrett reference.

#### 20. Do Dreams Regulate Emotions? A 2026 Study — `/en/blog/dreams-emotion-regulation-study-2026`
Science-news | Intent: what the 2026 study found on dreams regulating fear
- Slop **Low** | Accuracy **Low** | UV **7** | IG **7** | Editing: Medium | **Action: Edit**
- Problems: sets up its second research question and never answers it (the β = 0.18 between-person result is missing); moderation paradox stated without interpretation; hero image reused across 5+ articles.
- Keep: all quantitative claims match the verified PubMed abstract; real limitations; study-derived journaling protocol.
- Fix: report the missing result or delete the dangling setup — the best science article on the site; finish it.

#### 21. Dream Incubation Guide — `/en/blog/dream-incubation-guide`
How-to | Intent: what dream incubation is; concrete protocol for tonight
- Slop **Medium** | Accuracy **High** | UV **3** | IG **4** | Editing: Medium | **Action: Edit**
- Problems: two fabricated-sounding blockquotes attributed to named living people (Barrett, Moss); "5 proven techniques" vs 6-step contradiction; decorative sources omit the actual Barrett study; broken duplicated CTA copy.
- Keep: correctly sequenced 6-step protocol, incubation-vs-lucid distinction, advanced WBTB tips.
- Fix: verify or strip both quotes; add Barrett and Haar Horowitz 2020 (MIT TDI) to Sources.

#### 22. Dream Interpretation History — `/en/blog/dream-interpretation-history`
Historical survey | Intent: readable overview of dream interpretation's evolution
- Slop **Medium** | Accuracy **Medium** | UV **5** | IG **5** | Editing: Medium | **Action: Edit**
- Problems: unsourced "65% of dream content" stat; flying-dream bullet contradicts the quoted Assyrian omen; dubious yūgen claim; Ibn Sirin manual is pseudepigraphal; the "humanize" commit removed the only peer-reviewed source (Nielsen 2010).
- Keep: real Chester Beatty entries, correctly dated theory anchors, Achuar/Iroquois specifics.
- Fix: restore Nielsen 2010; resolve the contradiction; source or cut the 65%.

#### 23. Dream Journal (hub) — `/en/blog/dream-journal`
Hub page | Intent: starting point on dream journaling; route to guides
- Slop **Medium** | Accuracy **Low** | UV **2** | IG **2** | Editing: Low | **Action: Edit**
- Problems: "Quick start" block verbatim-identical on all three hubs — this hub got zero customization; "Related Symbols" claims symbols "from this article" (false); lucid card duplicated twice; empty author/date metadata; no product link despite being the app's core topic.
- Fix: journal-specific Quick start (capture one fragment on waking before notifications; after seven nights, review which mornings you remembered most); fill metadata; link the voice-journal page.

#### 24. Dream journal: a simple method — `/en/blog/dream-journal-guide`
How-to | Intent: minimal routine to start journaling tonight; improve recall
- Slop **High** | Accuracy **High** | UV **3** | IG **3** | Editing: Medium | **Action: Edit**
- Problems: two overlapping FAQ blocks (SEO scaffolding); minimalist lede contradicted by a 13-item "comprehensive entry" body; unsourced fake-precision stats (50%/90% forgetting, 0.5→2–4 dreams/night) — **the fix was validated in German but never ported to English**; unsourced Waggoner quote.
- Keep: 60-second template, "no dream remembered" habit trick.
- Fix: delete duplicate FAQ and the 13-item list; source or remove the stats; delete the quote.

#### 25. Dream Meanings (hub) — `/en/blog/dream-meanings`
Hub page | Intent: learn what dreams mean; reach matching symbol/topic fast
- Slop **Medium** | Accuracy **Low** | UV **3** | IG **4** | Editing: Medium | **Action: Edit**
- Problems: same topic-agnostic "Quick start" as the other hubs; identical three-noun teaser formula ("Fear, change, and intuition."); lede's context-dependent stance contradicts the fixed-triad teasers.
- Keep: defensible lede, verified link grid, one concrete forest-dream example.
- Fix: replace teasers with what each spoke actually answers.

#### 26. Dreaming While Awake — `/en/blog/dreamlike-wakefulness-sleep`
Science-news | Intent: clear summary of the study; journaling relevance
- Slop **Low** | Accuracy **Low** | UV **5** | IG **5** | Editing: Medium | **Action: Edit (light)**
- Problems: dangling "EEG tracked" detail — the headline C3 fronto-occipital finding is omitted; zero quantitative results; close paraphrase of one press release.
- Keep: verified accuracy, honest limits, tight ~600 words.
- Fix: add 2–3 sentences on the EEG signature plus one number and one researcher quote.

#### 27. Ex Dreams: 6 Surprising Reasons — `/en/blog/dreams-about-ex`
Interpretation editorial | Intent: why ex dreams keep happening; do feelings remain
- Slop **High** | Accuracy **High** | UV **2** | IG **3** | Editing: Medium | **Action: Edit**
- Problems: unverifiable named quotes (Walsh, Wallace); invented "35%" stat; title promises 6 reasons, body lists 5; Zeigarnik effect overextended to dream recurrence; citation theater.
- Keep: 6-scenario card grid, tell-your-partner subsection, concrete closure advice.
- Fix: verify or delete quotes and stat; replace with one named, dated, linked study or cut the numbers.

#### 28. Dreams and Creativity — `/en/blog/dreams-and-creativity`
Science editorial | Intent: whether dreams boost creativity; how to use deliberately
- Slop **Medium** | Accuracy **High** | UV **4** | IG **6** | Editing: Medium | **Action: Edit**
- Problems: Wagner 2004 misstated 3× (was ~59% vs ~23%, >2×, not "+33%"; REM not isolated); Dalí clocks claim conflicts with the Camembert account; anonymous invented-feeling testimonial; "June 2026 update" section is freshness theater (one generic paragraph + date bump).
- Keep: real sources incl. rare Lacaux 2021; concrete incubation protocol.
- Fix: correct the Wagner claim in body, card, FAQ and JSON-LD.

#### 29. When Dreams Feel Real (MÖBIUS) — `/en/blog/dreams-feel-real-mobius-model`
Science-news | Intent: understand the MÖBIUS model; whether it matters
- Slop **Medium** | Accuracy **Low** | UV **3** | IG **4** | Editing: Medium | **Action: Edit**
- Problems: the acronym is never expanded; the core mechanism (MCH, CA2, orexin) omitted; sole empirical result (4v4 pilot, Hedges' g ≈ −1.00) missing; inflated "6 min read."
- Keep: real source, disciplined hedging, responsible caution.
- Fix: expand the acronym and name the three-safeguard mechanism — the article currently summarizes everything except the paper's point.

#### 30. Dreams and Mental Health — `/en/blog/dreams-mental-health`
Health editorial | Intent: do dreams reflect anxiety/depression/PTSD; what to do
- Slop **Medium** | Accuracy **High** | UV **3** | IG **3** | Editing: Medium | **Action: Verify, then Edit**
- Problems: uncited fake-precision stats — "78% accuracy", "4× more common", "55%", "70–80% IRT reduction" (all REQUIRES VERIFICATION); two unattributed testimonials on a health page; Walker's "overnight therapy" stated as settled fact; duplicates three sibling articles section-by-section.
- Keep: real modalities (IRT, EMDR, prazosin, CBT), responsible red flags.
- Fix: a real citation per statistic or delete the number; convert duplicated sibling sections to summaries + links.

#### 31. Your Dreams Are Not Random (2026 AI study) — `/en/blog/dreams-not-random-ai-study`
Science-news | Intent: what the AI study found; does it prove meaning
- Slop **Low** | Accuracy **Low** | UV **5** | IG **5** | Editing: Medium | **Action: Keep (light edit)**
- Problems: vaguer than its own source ("3,000" vs 3,700+ reports/287 participants); privacy section presents inference as study finding; no limitations; metadata date mismatch.
- Keep: fully verifiable citation (Elce et al. 2026, DOI confirmed), accurate paraphrase, useful journaling framework.
- Fix: name Elce/IMT, add the precise figures and one limitations sentence.

#### 32. Exam dreams meaning — `/en/blog/exam-dreams-meaning`
Interpretation explainer | Intent: quick trustworthy interpretation of exam fail/pass/unprepared dreams
- Slop **High** | Accuracy **Low** | UV **2** | IG **3** | Editing: Medium | **Action: Edit**
- Problems: fully programmatic origin (SEO campaign script), no editorial pass; FAQ restates the cards idea-for-idea (~20% of the article); "5 min read" inflated; stale scripted seasonal hook.
- Keep: all four DOIs resolve and are relevant; hedged claims; tight prose.
- Fix: cut or rewrite the schema-only FAQ; add the missing classic variants (late, can't find the room, decades later) and adult recurrence.

#### 33. Falling Dreams Meaning — `/en/blog/falling-dreams-meaning`
Interpretation spoke | Intent: what falling dreams mean; why the jolt; bad sign?
- Slop **Medium** | Accuracy **High** | UV **2** | IG **3** | Editing: Medium | **Action: Edit**
- Problems: unverifiable Walker and Cartwright quotes; "over 70%" stat lost its citations when the humanize commit deleted them, now misattributed to "Sleep Research Society"; 7-vs-6 count mismatch; Quick answer = meta description.
- Keep: visceral intro, six distinct variation cards, proper hypnic-jerk hedging.
- Fix: verify/replace the quotes; restore the deleted Nielsen/Schredl citations onto the stat.

#### 34. Flying Dreams Meaning — `/en/blog/flying-dreams-meaning`
Interpretation spoke | Intent: what flying dreams mean — variants, good or bad sign
- Slop **High** | Accuracy **High** | UV **2** | IG **3** | Editing: Low | **Action: Edit**
- Problems: unsourced named quotes (Bulkeley, LaBerge) — likely fabricated; "33% of dreamers" kept after its supporting citations were removed (evidence regression); same 4–6 ideas restated five times; decorative sources.
- Keep: flight-type×emotion heuristic, quick-answer box.
- Fix: keep the number only with a real citation (e.g., Schredl's survey); delete the Bulkeley quote unless sourced; say once what is said five times.

#### 35. Heat, Stress and Nightmares — `/en/blog/heat-stress-nightmares`
Health explainer | Intent: do hot nights plus stress cause nightmares; what helps
- Slop **Low** | Accuracy **Medium** | UV **7** | IG **7** | Editing: High | **Action: Edit**
- Problems: two verified citation misattributions ("Kim et al. 2025" is Pasquier et al., PMID 40704570; "Vallat et al. 2020" is van Wyk, Solms & Lipinska 2019, PMID 31680920); one unsourced longitudinal claim; date mismatch.
- Keep: hedged causal framing, waking-bridge mechanism, accurate IRT/AASM guidance, red-flag triage — one of the best articles.
- Fix: correct the two labels and re-audit remaining links.

#### 36. Heatwaves and sleep — `/en/blog/heatwave-sleep-dreams`
Seasonal explainer | Intent: why hot nights bring vivid dreams; what to do
- Slop **Low** | Accuracy **Low** | UV **6** | IG **6** | Editing: High | **Action: Keep**
- Problems: thirty-second voice-note advice repeated 3× across two overlapping sections; anonymous in-text citations; FAQ restates body.
- Keep: all six sources verified real and accurately characterized; useful context-vs-content framework; timely hook.
- Fix: merge the overlapping sections; attribute studies inline with one figure each.

#### 37. How to Remember Dreams — `/en/blog/how-to-remember-dreams`
Help guide | Intent: concrete techniques to improve dream recall starting tonight
- Slop **Medium** | Accuracy **High** | UV **4** | IG **4** | Editing: Medium | **Action: Edit**
- Problems: **verified broken citations script-injected across all 5 locales** — "University of Lincoln (2015)" links a hepatitis-C virology review; "Neuron (2019)" links Izawa et al., which is a *Science* mouse study; unsourced "4–6 dreams/2h"; irrelevant train-symbol link.
- Keep: ten concrete protocols, rare WBTB contraindications, verified De Gennaro citation.
- Fix: repair the citations at the generator-script source and regenerate all locales.

#### 38. Resources (blog index) — `/en/blog/`
Hub/listing | Intent: browse dream articles; find guides by topic
- Slop **Medium** | Accuracy **Medium** | UV **5** | IG **6** | Editing: Medium | **Action: Edit**
- Problems: coverage bug — `how-to-remember-dreams` missing from the grid (45 of 46 cards); "Stay Informed" newsletter block is actually the app waitlist (misleading); "Discover…" teaser formula ×17; unsourced 95%/40% stats.
- Keep: working search/filters, teasers often name real studies.
- Fix: generate the grid from front matter so it can't drift; honest waitlist copy.

#### 39. Lucid Dreaming (hub) — `/en/blog/lucid-dreaming`
Hub page | Intent: orientation to lucid dreaming; routes to techniques
- Slop **Medium** | Accuracy **Low** | UV **4** | IG **4** | Editing: Medium | **Action: Edit**
- Problems: identical generic "Quick start" never mentions lucid dreaming; duplicate dream-journal card; cluster sibling omitted.
- Keep: accurate definition, dream-sign mining workflow, sleep-paralysis safety card.
- Fix: lucid-specific Quick start (recall week → reality checks → MILD/WBTB after two weeks).

#### 40. Lucid Dreaming Guide for Beginners — `/en/blog/lucid-dreaming-beginners-guide`
How-to | Intent: concrete step-by-step techniques for a first lucid dream
- Slop **Medium** | Accuracy **High** | UV **3** | IG **4** | Editing: Medium | **Action: Edit**
- Problems: "Heidelberg University (2021)" 55%/23% attribution looks invented (likely Saunders 2016 meta-analysis); unsourced "60% higher success", "3–8 weeks", verbatim LaBerge quote; duplicate on-page FAQ.
- Keep: correctly parameterized MILD/WBTB/WILD protocols, real sources list, accurate Hearne 1975 history.
- Fix: verify or replace the attribution; source or cut the remaining numbers and quote; set honest failure expectations.

#### 41. Night noise, sleep and dreams — `/en/blog/night-noise-sleep-dreams`
Practical explainer | Intent: why noisy fragmented nights produce remembered dreams; coping
- Slop **Medium** | Accuracy **Low** | UV **3** | IG **3** | Editing: Medium | **Action: Edit**
- Problems: batch-template sameness with its vacation/night-waking siblings (verbatim CTA panel); sound-incorporation claim unsupported by its own four sources; metadata inflation; wrong "Seasonal" chip.
- Keep: restrained anti-overinterpretation stance, concrete dictation example.
- Fix: differentiate within the cluster (noise → micro-awakenings → recall → what to log); one unique piece of evidence.

#### 42. Night waking and dream recall — `/en/blog/night-waking-dream-recall`
Practical guide | Intent: woke at 3 a.m.; capture dream without ruining sleep
- Slop **Medium** | Accuracy **Medium** | UV **3** | IG **4** | Editing: Medium | **Action: Edit**
- Problems: **Sources block verbatim-copied from the night-noise article — two of four citations (WHO noise guidelines, Sleep Foundation noise article) are irrelevant to this page** (verified factual error); FAQ restates body; wrong badge/read-time.
- Keep: "first 90 seconds" protocol, honest red-flag boundary.
- Fix: replace the sources block with recall-relevant citations.

#### 43. Are Precognitive Dreams Real? — `/en/blog/precognitive-dreams-science`
Science explainer | Intent: straight answer whether precognitive dreams are scientifically real
- Slop **Medium** | Accuracy **Medium** | UV **6** | IG **7** | Editing: Medium | **Action: Edit**
- Problems: likely-invented verbatim quote attributed to real researcher Caroline Watt (most serious); "…In History That Came True" heading contradicts the skeptical thesis; unsourced "hundreds of reports" 9/11 claim; confirmation-bias restated 4×.
- Keep: evidence-vs-limits table with honest null result, verified Watt 2014 citation, falsifiable timestamping self-test.
- Fix: replace the quote with a cited paraphrase; cut the mislabeled Bohr card.

#### 44. Pregnancy Dreams — `/en/blog/pregnancy-dreams-meaning`
Interpretation spoke | Intent: dreamed of pregnancy/birth while not pregnant; meaning
- Slop **Medium** | Accuracy **High** | UV **2** | IG **4** | Editing: Medium | **Action: Edit**
- Problems: **fabricated citations verified** — PMID 17689042 is an active-listening paper, PMID 24135556 is Achilles tendinopathy; Garfield/Siegel quotes untraceable; two sections restate the same five points.
- Keep: hedged quick answer, six differentiated scenarios, right length.
- Fix: repair or delete both links and both quotes — never ship citation text pointing to different papers.

#### 45. Recurring Dreams — `/en/blog/recurring-dreams-meaning`
Health explainer | Intent: why dreams recur, what they mean, how to stop
- Slop **Low** | Accuracy **Low** | UV **5** | IG **5** | Editing: High | **Action: Keep (light edit)**
- Problems: four cause sections left as ~20-word stubs; one uncited "research reports associations" claim; TOC promises ("10 Most Common") the body deliberately refuses; identical hedge-tic closes every section.
- Keep: honest anti-deterministic stance, specific motif cards, real decision-framework exercise — the humanize commit's best result.
- Fix: align TOC with body; expand or collapse the stubs.

#### 46. REM Sleep — `/en/blog/rem-sleep-dreams`
Science explainer | Intent: what REM is, why it matters, how to get more
- Slop **Medium** | Accuracy **Medium** | UV **3** | IG **4** | Editing: Medium | **Action: Edit + Verify**
- Problems: Quick answer = meta description; unsourced Walker quote; unsourced numbers (80% vs 80–90% internally inconsistent, SSRI 30%, RBD figures); supplement dosing (B6, galantamine) needs medical review.
- Keep: accurate Aserinsky 1953/PGO anchors; dream-recall section a real differentiator.
- Fix: cite or cut every percentage and dose; write a real Quick answer.

#### 47. Sleep Day 2026: environment — `/en/blog/sleep-day-environment-dreams`
Science editorial | Intent: how light/noise/temperature/season affect dreams, plus fixes
- Slop **Medium** | Accuracy **High** | UV **4** | IG **4** | Editing: Medium | **Action: Edit (verify-then-cut), redirect candidate after 2026**
- Problems: evidence-integrity failure — seven stats unsourced/misattributed (Cho et al. 2015 misattributed; pink-noise 25%; Scandinavian 30%; Morphée 15–20%; Harvard 20-min REM — all REQUIRES VERIFICATION); muddled event framing (Journée du Sommeil ≠ "National Sleep Day"); digests four sibling articles.
- Keep: real poikilothermy physiology with correct citation; concrete checklist.
- Fix: verify or delete the seven stats; cut factor sections to summaries + links.

#### 48. Sleep Debt and Health — `/en/blog/sleep-debt-health-dreams`
Science/health explainer | Intent: what sleep debt is, consequences, whether repayable
- Slop **Medium** | Accuracy **Medium** | UV **4** | IG **5** | Editing: Medium | **Action: Edit**
- Problems: invented-feeling "7.5h consistent beats alternating 6–9h" claim unsourced; "dreams of moonlight" sentence exists only to hold a symbol link; Depner 2019 cited inline but missing from Sources.
- Keep: real correctly-described studies (Van Dongen 2003, Cappuccio 2010), substantive REM-rebound section.
- Fix: add Depner to Sources; delete or source the regularity claim; cut the moonlight sentence.

#### 49. Sleep Is Your #1 Health Lever — `/en/blog/sleep-health-priority`
Science-news | Intent: what the "sleep beats diet/exercise" study actually found
- Slop **Medium** | Accuracy **High** | UV **4** | IG **4** | Editing: Medium | **Action: Edit (verify-and-correct)**
- Problems: **fabricated central study details** — the real study (McAuliffe et al., *SLEEP Advances*, county-level CDC data 2019–2025) is misreported as "over 40 years of NHANES… longitudinal tracking", propagated into intro, Quick answer, FAQ and JSON-LD; ecological fallacy uncaveated.
- Keep: correctly cited neuroscience backbone; genuine voice ("no subscription box for unconsciousness").
- Fix: replace the NHANES/40-year claims everywhere with the real design; add a correlation≠causation caveat.

#### 50. Sleep Paralysis Guide — `/en/blog/sleep-paralysis-guide`
Health help guide | Intent: why episodes happen, whether dangerous, how to stop them
- Slop **Medium** | Accuracy **Medium** | UV **3** | IG **4** | Editing: Medium | **Action: Edit + Verify**
- Problems: three fabricated first-person quotes presented as quotations; "University of Waterloo" attribution conflicts with the page's own cited Sharpless & Barber 2011; fake-precision "~90%/~10%"; Quick answer = meta description.
- Keep: cultural-name list, Intruder/Incubus/VM taxonomy, concrete doctor-visit triggers.
- Fix: delete or relabel the blockquotes as composites; fix the prevalence attribution to match the page's own citation.

#### 51. Snake Dreams — `/en/blog/snake-dreams-meaning`
Interpretation spoke | Intent: dreamt about a snake — what does it mean for me
- Slop **Medium** | Accuracy **High** | UV **3** | IG **3** | Editing: Medium | **Action: Edit**
- Problems: unsourced Campbell and Naiman quotes (likely fabricated); "8 scenarios" promised, 6 delivered; Quick answer = meta description; the humanize commit removed 3 PubMed sources; caduceus/Asclepius error.
- Keep: tight read, accurate Revonsuo summary.
- Fix: delete or source the quotes; fix 8→6; restore removed sources.

#### 52. Spring Sleep Disruption — `/en/blog/spring-sleep-disruption-dreams`
Science blog post | Intent: why spring disrupts sleep/dreams (equinox, not DST) plus fixes
- Slop **Medium** | Accuracy **High** | UV **5** | IG **6** | Editing: Medium | **Action: Edit**
- Problems: citation contradictions (Wehr 1993 blockquote vs Sources journal mismatch; Terman 2001 vs 2005); unsourced "1 in 3 Europeans" ×3; fabricated-sounding moon-symbolism claims; "winter melatonin reserves" non-physiology.
- Keep: coherent mechanism chain, accurate Gooley 2011, strong adaptation protocol.
- Fix: citation integrity pass; cut or rewrite the moon paragraph as a product self-experiment.

#### 53. Nightmares: Causes, Meaning, How to Stop — `/en/blog/stop-nightmares-guide`
Help guide (health-adjacent) | Intent: why nightmares happen, what they mean, how to stop
- Slop **High** | Accuracy **Critical** | UV **2** | IG **3** | Editing: Low | **Action: Edit — mandatory citation verification first**
- Problems: **verified wrong PubMed links — "Aurora et al. (2010)" links a modafinil/COMT study; "Morgenthaler 2018" links the AASM actigraphy guideline** (bulk-added in commit 924ee0c79 — fake verifiability); unsourced Cartwright quote; broken live copy ("Noctalia's Noctalia", "and, most what you can do"); REM vs "lighter sleep" contradiction; unsourced 50%/80% stats.
- Keep: sound architecture, IRT named first, concise.
- Fix: repair both URLs to the real *J Clin Sleep Med* papers; spot-check every bulk-added PubMed link site-wide; fix the broken sentences; source or remove the quote.

#### 54. Stress Dreams About Work — `/en/blog/stress-dreams-work`
Science help guide | Intent: why they keep dreaming about work; how to reduce/stop it
- Slop **Medium** | Accuracy **High** | UV **4** | IG **5** | Editing: Medium | **Action: Verify**
- Problems: likely-invented "2023 Sleep journal… 3.2 times more likely" stat; unsourced "65% of adults dream about work weekly"; named-journal cortisol claim with no paper; manufactured anecdote blockquote.
- Keep: vivid concrete intro, real Revonsuo/WHO citations, practical triage.
- Fix: remove or source the three numeric claims; qualify the APA claim; attribute or cut the anecdote.

#### 55. Teeth Falling Out Dreams: 7 Meanings — `/en/blog/teeth-falling-out-dreams`
Interpretation listicle | Intent: what a teeth-falling-out dream means; how common; worry?
- Slop **Medium** | Accuracy **High** | UV **2** | IG **3** | Editing: Medium | **Action: Edit**
- Problems: fabricated quotes under real researchers Zadra and Calvin Yu; 39% stat misattributed to *Frontiers* 2018 (actually Yu 2012, and the link goes to a journal homepage); the article ignores that the 2018 study found **no distress correlation** — which undercuts its own 7 interpretations; "top 5 worldwide" unsourced.
- Keep: sensory intro, distinct variation cards, accurate dental-tension summary.
- Fix: delete both quotes; attribute 39% to Yu 2012 with DOI; add the no-distress-correlation sentence.

#### 56. Vacation, Sleep and Dreams — `/en/blog/vacation-sleep-dreams`
Seasonal how-to | Intent: why dreams feel vivid on vacation; lightweight capture
- Slop **Low** | Accuracy **Low** | UV **5** | IG **6** | Editing: High | **Action: Keep**
- Problems: first-night effect described but unnamed/uncited (Tamaki et al. 2016); thin FAQ; hero image reused; programmatic backlink paragraph.
- Keep: premise-correcting "recall ≠ more dreaming" framing, four-anchor routine, verbatim voice-note example, restrained tone.
- Fix: name the first-night effect and cite Tamaki et al. — one sentence converts the weakest claim into an authority anchor.

#### 57. Vivid Dreams and Restful Sleep — `/en/blog/vivid-dreams-restful-sleep`
Science-news | Intent: what the new vivid-dreams study actually says
- Slop **Low** | Accuracy **Low** | UV **6** | IG **6** | Editing: High | **Action: Keep**
- Problems: "more restorative" overshoots the study (perceived depth, not restoration); researchers/institution never named in body; voice-journal claim unsourced.
- Keep: all numbers verified against the PLOS Biology DOI; honest limitations; real DOI.
- Fix: "feel deeper" not "more restorative"; name the Bernardi lab with one quote.

#### 58. Water and flood dreams — `/en/blog/water-dreams-meaning`
Interpretation editorial/reference hybrid | Intent: map water/flood dream meaning to detail plus emotions
- Slop **Medium** | Accuracy **Medium** | UV **2** | IG **3** | Editing: Medium | **Action: Edit + Verify**
- Problems: same 3 ideas restated 5–6 times; SEO card-grid duplicates FAQPage JSON-LD (visible FAQ ≠ schema FAQ); likely-fabricated Bulkeley quote (same template as flying-dreams); uncited Jung quote; near-verbatim recycling of `/symbols/flood`; **the English version is now the stale canonical — fr/es ship a better, more cautious rewrite**.
- Keep: "start with the detail you remember" framing, per-state breakdown.
- Fix: propagate the fr/es stance into English; verify-or-delete the Bulkeley quote; answer each question once; sync JSON-LD with the visible FAQ.

#### 59. Wearable Sleep Trackers and Dreams — `/en/blog/wearable-sleep-trackers-dreams`
Editorial/science explainer | Intent: how accurate are wrist sleep trackers; can they capture dreams
- Slop **Medium** | Accuracy **High** | UV **4** | IG **5** | Editing: Medium | **Action: Edit (verify all stats/citations)**
- Problems: **CTA claims "keeps your data private on your device" — contradicts the article body and the privacy policy** (EU-hosted cloud); unsourced headline "nearly 40% of adults track sleep weekly"; two papers listed with an identical DOI; de Zambotti journal/DOI mismatch; Dreem presented as current (discontinued); deep-sleep↔vivid-dreams example scientifically wrong (REM, not N3).
- Keep: substantive sensor section; categorical "wearables cannot detect dreams" thesis.
- Fix: align CTA with policy; source or delete the 40%; repair the DOIs.

#### 60. Why Do We Dream? — `/en/blog/why-we-dream-science`
Science explainer | Intent: credible evidence-grounded answer to why humans dream
- Slop **Medium** | Accuracy **Medium** | UV **3** | IG **4** | Editing: Medium | **Action: Edit (verify stats/quotes)**
- Problems: Quick answer = meta description; unsourced stats ("six years dreaming", "47% of dreams contain threats", Stickgold "10 times", "REM evolved 200 million years ago"); "all mammals show REM" ignores cetacean/echidna exceptions; dubious Walker quote; Mendeleev anecdote as fact; pseudo-profound consciousness filler.
- Keep: correctly attributed core theories; honest "what we still don't know" sections.
- Fix: real Quick answer naming the four theories; cite-or-delete the four numbers; qualify "all mammals."

#### 61. Why Do We Forget Our Dreams? — `/en/blog/why-we-forget-dreams`
Science blog post | Intent: why dreams fade after waking; actionable recall tips
- Slop **Medium** | Accuracy **High** | UV **4** | IG **5** | Editing: Medium | **Action: Edit + Verify**
- Problems: **confirmed factual error — Izawa et al. 2019 attributed to *Neuron*, actually published in *Science*** (wrong in body and Sources); missing mouse-model caveat; likely-fabricated Stickgold quote; unsourced "90–95%" stat; Quick answer = meta description; prevPath self-link; one broken sentence.
- Keep: real checkable sources; accurate mechanisms (norepinephrine, hippocampus decoupling, MCH neurons).
- Fix: *Neuron*→*Science* both places; add "in mice" caveat; source-or-delete the quote; repair self-links.

### B3. Legal pages (4)

Overall: a **low-slop, high-specificity outlier** — far above typical AI legal boilerplate, and consistent with the marketing claims (no data sale, audio not persistently stored, EU storage, "reflection tool, not diagnosis" all cross-check). All four: Slop **Low**, editing need **High** (structural fixes, not tone).

- **Privacy Policy** `/en/privacy-policy` — Accuracy **Medium** | UV **9** | IG **9** | **Keep, targeted edits.** Compliance-critical claims REQUIRES VERIFICATION against production/contracts: audio "retained… generally a few minutes", "AI providers configured not to train", 7-day journey identifier, 90-day raw events, RevenueCat anonymous ID. Tensions: "In short" box ("audio not retained") vs §6 ("retained a few minutes"); CCPA rights one vague sentence; account-deletion page never linked; controller postal address absent. Dated July 16, 2026 — strongest evidence-backed page on the site.
- **Legal Notice** `/en/legal-notice` — Accuracy **Low** | UV **8** | IG **8** | **Edit.** SIREN 995 316 981 and address need external verification; missing VAT statement; no visible date; §5 asks for an "identifier" the product can't provide — reword to account email.
- **Terms of Use** `/en/terms` — Accuracy **Low** | UV **7** | IG **7** | **Edit.** No governing-law/jurisdiction clause (significant omission); AI-output ownership unstated; no severability; §12 acceptance-by-continued-use with no notice period/channel.
- **Account deletion** `/en/account-deletion` — Accuracy **Low** | UV **7** | IG **7** | **Edit.** Only legal page with no date; **no warning that deletion does NOT cancel a Google Play subscription** (top billing-complaint scenario); "as quickly as possible" conflicts with privacy's "generally within 30 days."

### B4. Guide pages (10, generated)

Overall: Slop **Medium** (intros/outros **High**; structure fine) | Accuracy **Medium** | UV **3** | IG **3**. Each guide contributes only ~120–180 unique words; every card reuses the dictionary's `shortDescription` verbatim — near-zero information gain over the site's own dictionary.

| Guide | Risk | UV/IG | Verdict → Action |
|---|---|---|---|
| `guides/` index | Low | 4/4 | Decent hub undermined by a false "Verified content… research references" badge (zero references exist) → **Edit** (remove/substantiate badge) |
| `dream-symbols-dictionary` | Low | 6/6 | Strongest guide — working A–Z search over 150 symbols, hedged FAQs → **Keep** |
| `most-common-dream-symbols` | Medium | 3/3 | "searched and reported most often" unsupported (editorial order); title promises "20 meanings with examples" — zero examples rendered → **Edit** (deliver scenarios or fix title) |
| `scary-dream-symbols` | High intro/outro | 2/2 | Pop-psych assertions as fact → **Edit** |
| `positive-dream-symbols` | High | 2/2 | Self-help filler mirroring the scary guide by valence → **Edit or merge both** into one "emotional tone in dreams" page |
| `animal-dream-symbols` | High | 2/2 | "Since the dawn of consciousness" filler; near-identical to `/en/symbols/animals` category page → **Merge** |
| `water-dream-symbols` | High | 2/2 | Third layer on the same query as the water article + water symbol page; "most universal symbol" unsourced → **Edit/differentiate** |
| `death-transformation-dreams` | Medium | 3/3 | Hedged but thin (6 symbols), purple outro → **Edit lightly** |
| `people-in-dreams` | Medium | 2/2 | Thinnest (4 symbols); one school presented as "dream psychology" generally; overlaps `/en/symbols/people` → **Merge or expand** |
| `dream-locations` | Low | 4/4 | Best copy on the layer — hedged, practical; use as the house standard → **Keep** |

Crosscut: catalog-wide `datePublished: 2025-01-21` in Article JSON-LD on every guide; three hub-like layers route to the same symbols — consolidate or re-scope.

### B5. Programmatic symbol pages (158 URLs = 150 symbols + 8 category pages)

Pipeline: `generate-symbol-pages.js` rendering `data/dream-symbols.json` (150) + `-extended.json` (145) + a 6-entry tier-3 stub. ~76–85% of the visible text on a templated page is boilerplate/chrome; 21–36 unique lines per page.

**Bespoke tier (~62 symbols: water, teeth, death, snake, house, dog, fire, flood, door, forest, hospital, wolf, + 5 tier-3)**
- Slop **Low–Medium** | Accuracy **Low** (properly hedged; zero sources anywhere) | UV **7–8** | IG **6–7** → **Keep + enrich.**
- Hospital and wolf are the house standard (4 specific FAQs, hedged). Water/house/snake/flying keep with light edits. Legacy assertive tone on teeth/death/snake/falling ("It symbolizes anxiety, fear of aging…") needs normalizing. 53 symbols ship no FAQ at all.

**Template tier (~88 symbols — the exact same 88 across every field)**
- Slop **High–Critical** | Accuracy **Medium** (nonsense combinations dressed as reference) | UV **~1** | IG **~0** → **Rewrite or Merge/noindex.**
- Measured sameness: 88/150 shortDescriptions from 3 macro-formulas (27 byte-identical in 7 groups — mother = partner = teacher = coworker = **demon**; bathroom = workplace = attic = prison = hotel = mall = island); one FAQ answer ("It depends on the scene…") across all 88, each emitting FAQPage JSON-LD; identical 2-question askYourself set on 88; "Seeing/Losing/Finding/Talking about {X}" variation template semantically broken for half the catalog ("Losing Tornado", "Finding Prison", "Talking about Surgery"); volcano never mentions eruption; demon gets the people-relationships template; the `paralysis` symbol page misses the actual sleep-paralysis phenomenon entirely and doesn't cross-link the blog guide.
- Fix path: rewrite the top ~20 by search demand using the hospital pattern (symbol-specific imagery, 3–4 hedged paragraphs, 3–5 real variations), merge the rest into their 7 natural category pages or noindex until rewritten, delete the 5-context variation template, suppress FAQPage JSON-LD on the single-template Q&A, fold tier-3 into the primary file, fix relatedArticles mismatches (ghost → death-dreams article).

---

## C. AI-slop evidence (High / Critical pages)

**`blog.death-dreams-meaning` (High)**
- "Studies suggest that over 70% of people have dreamed about death at some point" — fake precision; the formula is recycled verbatim across spoke articles; no citation survives on the page.
- "'In dreams, death is a symbol of transformation…' — Dr. Rubin Naiman" — unsourced verbatim quote under a named, living expert; his job title is inconsistent across the site. Fabricated-attribution risk.
- "Contemporary dream researchers suggest death dreams help us rehearse…" — unnamed authority; superficial coverage.

**`blog.dream-journal-guide` (High)**
- "It's a powerful tool for self-discovery that anyone can benefit from" — filler plus unsupported popularity claim.
- "within 5 minutes of waking, 50% of dream content is forgotten… 90% is gone" — fake precision, no citation; the German version already had this removed — the English fix was never ported.
- "Dreams are an endless source of ideas" — artificial enthusiasm; inspirational filler.

**`blog.dreams-about-ex` (High)**
- "Studies show that up to 35% of people in relationships dream about exes." — invented percentage; nothing in Sources addresses ex-dream frequency.
- "'Dreams about exes are rarely about the actual person…' — Dr. Wendy Walsh" — unsourced named-expert quote; reads AI-composed.
- Zeigarnik effect stretched from task memory to dream recurrence, uncited — missing evidence.

**`blog.exam-dreams-meaning` (High)**
- FAQ: "It reflects feeling unprepared, exposed, or worried that you have missed something important before a deadline or challenge." — restates the card idea-for-idea; schema-only padding (~20% of the article).
- "At the beginning of May, exam and finals dreams can intensify…" — scripted seasonal hook, stale ten months a year; reveals the programmatic origin.
- "Passing the exam suggests confidence or relief; failing often points to fear of judgment rather than actual failure." — interchangeable with any dream dictionary; no original insight.

**`blog.flying-dreams-meaning` (High)**
- "Flying dreams occur in approximately 33% of dreamers… across all cultures and time periods." — fake precision; the supporting citations were deleted by the July humanize commit and the number stayed.
- "'Flying dreams are the mind's way of experiencing absolute freedom…' — Dr. Kelly Bulkeley" — unsourced named-expert quote; likely fabricated.
- "Studies show that people who have flying dreams often report feelings of joy, exhilaration, and empowerment upon waking." — unnamed studies; evidence-free claim.

**`blog.stop-nightmares-guide` (High slop / Critical accuracy)**
- `<a href="pubmed.ncbi.nlm.nih.gov/20815183/">Aurora et al. (2010): Best practice guide…</a>` — verified wrong link (a modafinil study); citation theater that fake-signals verifiability.
- "'Nightmares are the psyche's way of bringing attention to something…' — Dr. Rosalind Cartwright" — unsourced quote under a real researcher; same fabricated-attribution pattern as falling-dreams.
- "Let's explore why nightmares happen and, most what you can do about them." / "Noctalia's Noctalia helps you decode…" — grammatically broken copy live in production; no editorial pass.

**Symbol template tier (88 pages, Critical)**
- "Seeing Whale — A direct encounter with whale can highlight whale as the main emotional clue in the dream." — tautological noun-swap, byte-equivalent on 84 pages.
- "Losing Tornado — Losing it may suggest fear of disconnection…" — nonsensical variation produced by template substitution.
- "It depends on the scene. Teacher often points toward relationships, roles, memory, boundaries…" — the identical FAQ answer served for mother, father, sibling, partner, friend, stranger, teacher, police… and demon — each page emitting FAQPage rich-results markup.
- "When this image appears in a dream, the first question is not 'what does it always mean?' but 'why did my mind choose this image tonight?'" — identical essay opening on 29 pages that never names the symbol it is ostensibly interpreting.

**Guides (High intros/outros)**
- "Animals have appeared in human dreams since the dawn of consciousness, serving as powerful messengers from our subconscious." — filler, no evidence.
- "Start with the quick meaning, then use the example scenarios…" — the scenarios do not exist on the page (promise not delivered).
- "The most powerful nightmares often precede the most meaningful personal breakthroughs." — unsupported claim presented as fact.
- "Verified content — Guides written with sleep and dream research references." — badge asserting references where zero exist.

---

## D. Priority action plan

### 1. Critical fixes (trust-destroying, do first)
- Repair verified wrong citations: `stop-nightmares-guide` (both PubMed links), `how-to-remember-dreams` (hepatitis/Izawa — fix in the generator script, all 5 locales), `pregnancy-dreams-meaning` (both PMIDs), `anxiety-dreams-meaning` (Krakow & Zadra → PMID 16390284), `ai-sleep-analysis` (→ Thapa et al., correct cohort/C-index), `heat-stress-nightmares` (two author labels), `why-we-forget-dreams` (*Neuron*→*Science* + mouse caveat), `dream-control-problem-solving` (Barrett link), `sleep-health-priority` (replace fabricated NHANES framing with the real McAuliffe/CDC design), `dreams-and-creativity` (Wagner figures).
- **Audit every named-expert blockquote site-wide** (Bulkeley, LaBerge, Cartwright, Barrett, Watt, Zadra, Naiman, Walker, Walsh, Loewenberg, Campbell, Moss, Waggoner, Garfield, Siegel…): source it or delete it. Unverifiable quotes under named living researchers are the site's single most defamatory-looking pattern.
- Run a scripted link-check of every PubMed/DOI URL against its cited label — several bad links were bulk-injected by SEO scripts (e.g., `ti-97-eeat-improvements.js`, commit 924ee0c79).
- Fix broken live copy: "Noctalia's Noctalia", "and, most what you can do", "More checking your phone", the wearable page's privacy-contradicting CTA.

### 2. High-impact content improvements
- Rewrite or merge/noindex the 88 template symbol pages (hospital/wolf as the standard; top ~20 by traffic first); delete the 5-context variation template and the shared FAQ answer; suppress FAQPage JSON-LD on template pages.
- Backport the July de/fr/es improvements into the English canonical (water-dreams stance, dream-journal-guide statistics, home FAQ) — English is currently the stale, least-accurate locale.
- Resolve the six title/body count mismatches ("5 Hidden Meanings"→6, "7 scenarios"→5, "8 scenarios"→6, "6 reasons"→5, "20 meanings with examples"→0 examples, "5 proven techniques"→6).
- Write a real Quick answer on the ~10 articles where it is the meta description pasted verbatim.
- De-duplicate `dream-journal-guide` (two FAQ blocks, 13-item list vs minimalist lede) and the three hubs' verbatim "Quick start."

### 3. Pages requiring expert review
- YMYL-adjacent: `dreams-mental-health`, `anxiety-dreams-meaning`, `stop-nightmares-guide`, `sleep-paralysis-guide`, `rem-sleep-dreams` (supplement dosing), `children-dreams-guide`, `pregnancy-dreams-meaning`. The site claims editorial review in its badge copy; name an actual reviewer (even a consulting clinician) or drop the claim.

### 4. Pages requiring factual verification
- Every unsourced statistic inventoried above — notably: 70%/33%/35%/77%/78%/40%/65%/80%/95% prevalence family, "six years dreaming", "47% threats", "3.2×", "4×", "1 in 3 Europeans", "37% of children 3–6", DST accident figures, sleep-day seven-stat set, wearable 40%. Rule: cite or cut.
- Legal/compliance claims: audio-retention minutes, "providers configured not to train", retention schedules, RevenueCat anonymity, SIREN/address/VAT.
- Product claims: "150 symbols" (×2 pages), "editorial entries", "spot patterns across the whole family", offline-transcription OS floor.

### 5. Pages to merge, remove, or redirect
- Merge `android-dream-analysis-app` → `ai-dream-interpretation-app` (301).
- Merge `guides/animal-dream-symbols` → `/en/symbols/animals`; merge or expand `guides/people-in-dreams`; merge `scary` + `positive` into one emotional-tone guide.
- Post-2026 redirect candidate: `sleep-day-environment-dreams` (event-hooked digest of four siblings).
- Differentiate rather than merge: ~10 meaning spokes vs. their symbol-page twins (symbols = canonical short glossary answer; spokes retitled to long-tail/scenario/psychology queries); `how-to-remember-dreams` ↔ `why-we-forget-dreams` (cut reciprocal off-intent sections to summaries + links).
- Refocus `page.dream-dictionary-app` on the in-app dictionary workflow or fold into home (the guide owns "dream dictionary" better).

### 6. Opportunities to add original data or first-hand experience
- Apply each privacy/consumer article's checklist to Noctalia itself using the (excellent) privacy policy as the source — instant, verifiable unique value.
- Publish aggregate, anonymized product statistics (with methodology): most-journaled symbols, seasonal recall patterns — the site gestures at "symbols people report most often" without data; the app plausibly has it.
- One worked example per interpretation article: a real (or clearly-labeled composite) dream entry → interpretation → follow-up, including screenshots of the actual app on all four landing pages.
- Founder voice: the About/Press pages have a real person — 2–3 checkable sentences and a photo would anchor E-E-A-T for the whole domain.
- First-hand comparison evidence on the alternatives pages (dated store screenshots already partially on file; publish them).

### 7. Lower-priority stylistic improvements
- Unify the 4 medical-disclaimer variants and 3 FAQ-heading casings; fix read-time badges (multiple inflated); sync displayed dates with modifiedTime; stop hero-image reuse across 5+ articles; vary the 4-article shared CTA sentence; delete "June 2026 update"-style freshness sections; remove internal-strategy voice from comparison pages; delete the duplicated strategy-brief cells and "Detailed notes" table restatement.

---

## E. Final verdict

**Does the site appear useful and expert-led, or mass-produced and AI-assisted?** Both — in layers. The editorial core (legal, methodology, homepage, the 2026 study coverage, the cleaned-up health guides) reads as a genuinely careful, self-correcting small team, and the git history proves real human editorial direction: fabricated statistics removed, clickbait titles softened, an invented "55,000-dream corpus" publicly retracted. But roughly a third of the site's URLs (the template symbol tier), the rigid dream-meaning spokes, and the citation/quote fabrication pattern are exactly what "AI slop" looks like to a reader or a quality rater — and the fabricated named-expert quotes convert a quality problem into a trust and accuracy problem.

**Pages most likely to be perceived as AI slop:** the 88 template symbol pages (demon = mother is indefensible), `exam-dreams-meaning`, `dreams-about-ex`, `flying-dreams-meaning`, `death-dreams-meaning`, `dream-journal-guide`, `stop-nightmares-guide`, the scary/positive/animal/water guide intros, and `android-dream-analysis-app`.

**Pages already demonstrating strong information gain:** `dream-content-methodology` (9/10 unique value — a retraction page most sites would never publish), `legal.privacy`, `dream-emotion-regulation-study`, `heat-stress-nightmares`, `dream-control-problem-solving`, `precognitive-dreams-science`, `oniri-alternative`, `home`, `guides/dream-symbols-dictionary`, `recurring-dreams-meaning`.

**The five most important changes:**
1. **Citation and quote amnesty:** verify or delete every named-expert quote and every quantitative claim site-wide; scripted PubMed/DOI link-vs-label check in CI. Trust is the site's differentiator — this protects it.
2. **Fix the symbol dictionary:** rewrite the top ~20 template pages, merge/noindex the other ~68, delete the noun-swap variation/FAQ templates from the data files. One layer of the site should never say demon dreams mean "relationships, roles, memory, boundaries."
3. **Re-establish English as the canonical:** backport the July de/fr/es improvements, then add a release gate diffing section counts/dates per locale so no locale silently diverges again (the Italian page currently ships English headings live; es/de/it ship a different `ai-dream-interpretation-app` page entirely).
4. **Resolve the three-layer cannibalization:** symbol pages own short glossary answers, blog spokes own long-tail/scenario intent (retitle accordingly), guides justify their existence with real curation or merge; merge the android-analysis/ai-interpretation pair.
5. **Convert claims into evidence:** apply the site's own checklists to Noctalia (privacy answers, capture mechanics, real screenshots, one worked interpretation per landing page, dated competitor prices) — the raw material already exists in the privacy policy and competitive data files; publishing it is the cheapest originality the site can buy.

---

*Caveat on method: findings marked REQUIRES VERIFICATION (roughly 40 quantitative claims and ~15 expert quotes) were flagged because no source exists on the page or the linked source contradicts the claim — they should be confirmed against primary sources before republication, not assumed false.*
