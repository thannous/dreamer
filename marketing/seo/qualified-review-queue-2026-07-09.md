# Noctalia qualified content review queue — 2026-07-09

## Current status

No named sleep or mental-health professional has approved the current Noctalia article set. The site must therefore use editorial authorship and clear informational disclaimers only. Do not emit `reviewedBy`, “medically reviewed”, a reviewer portrait, or professional credentials until the evidence checklist below is complete.

This is an independence boundary, not a missing-schema problem: structured data must describe a real review that happened.

## Pilot review batch

Start with the pages where an inaccurate statement could most affect a reader's health decision. Review the English canonical first, then use the approved claim notes to check the four translations.

| Priority | Article family | Required reviewer profile | Review focus |
| --- | --- | --- | --- |
| P0 | `blog.sleep-debt-health` | Physician or researcher with documented sleep-medicine expertise | Sleep-debt effects, recovery language, thresholds, red flags, source recency. |
| P0 | `blog.sleep-paralysis-guide` | Sleep physician, neurologist, or clinical sleep researcher | Differential-warning language, when to seek care, prevalence and mechanism claims. |
| P0 | `blog.dreams-mental-health` | Licensed clinical psychologist or psychiatrist | Avoid diagnostic inference from dream content; crisis and referral language; evidence boundaries. |
| P0 | `blog.stop-nightmares-guide` | Licensed clinical psychologist, psychiatrist, or clinician experienced with nightmare disorder | Distinguish self-help from treatment; imagery rehearsal claims; escalation criteria. |
| P0 | `blog.children-dreams-guide` | Paediatric sleep clinician or child psychologist | Age-appropriate advice, caregiver red flags, no diagnostic interpretation. |

## Second review batch

Proceed only after the pilot process has been proven and the same evidence can be retained.

- Sleep technology and measurement: `blog.wearable-sleep-trackers`, `blog.ai-sleep-analysis`, `blog.rem-sleep-dreams`.
- Seasonal and environmental sleep advice: `blog.daylight-saving-time-sleep`, `blog.spring-sleep-disruption`, `blog.heatwave-sleep-dreams`, `blog.night-noise-sleep-dreams`.
- General science explainers: `blog.why-we-dream-science`, `blog.vivid-dreams-restful-sleep`, `blog.night-waking-dream-recall`.

## Qualification evidence required

Keep this evidence outside the public article source until the reviewer has explicitly consented to publication.

1. Full name and the exact professional title the reviewer authorizes Noctalia to display.
2. Jurisdiction and current licence or professional registration when the review is clinical.
3. Public institutional, registry, ORCID, or professional-society profile that independently supports the stated expertise.
4. Conflict-of-interest and compensation disclosure.
5. Written acceptance of the review scope and permission to publish the reviewer's name, credentials and profile link.
6. The exact source commit or immutable article export reviewed.
7. Dated approval plus a retained list of required corrections and their resolution.
8. A re-review trigger: material claim change, cited-guideline change, or at least the cadence the reviewer agrees to.

Useful starting pools, not endorsements of any individual:

- Société Française de Recherche et Médecine du Sommeil training-centre list: `https://www.sfrms-sommeil.org/wp-content/uploads/2026/01/Centres-et-stages-FST-Sommeil-19_janv_26-.pdf`
- European Sleep Research Society: `https://esrs.eu/`
- ESRS individual membership criteria: `https://esrs.eu/membership/individual-membership/`

Membership alone is not proof that a person is qualified for every topic. Verify the specific role, registration and subject expertise.

## Reviewer brief

### Scope

- Check factual and clinical accuracy, not brand voice or SEO keywords.
- Flag claims that are unsupported, overstated, outdated, diagnostic, predictive, or likely to delay professional care.
- Check whether cited sources support the exact nearby claim and prefer current guidelines or primary research where appropriate.
- Confirm that red-flag and “seek help” guidance is proportionate and understandable.
- Review Noctalia's boundaries: a reflection and journaling product, not diagnosis, therapy, prediction, or emergency support.
- The reviewer is free to reject the article or require removal of a claim. Payment, if any, is for review time and never for endorsement.

### Deliverables

1. Annotated article or claim table with `approve`, `revise`, or `remove` for each health-sensitive claim.
2. Replacement source or wording for every required revision.
3. A short public disclosure that accurately describes the review performed.
4. Explicit approval of the final corrected version, identified by commit or dated export.

## Outreach draft

Subject: Independent factual review of five Noctalia sleep articles

Hello [Name],

I publish Noctalia, an Android dream-journal and reflection app. We are improving the accuracy and transparency of five public educational articles covering sleep debt, sleep paralysis, dreams and mental health, nightmares, and children's dreams.

I am looking for an independent reviewer with documented expertise in [sleep medicine / clinical psychology / paediatric sleep]. The assignment is to check claims, sources, red-flag guidance and the boundary between education and medical advice. It is not a request for an endorsement, and you would be free to require revisions or reject a page.

If the scope fits your practice, could you share your availability, review rate, preferred disclosure, and the public professional profile or registry entry we may use to verify your credentials? We would provide versioned article exports and retain your approval only for the exact corrected version you review.

Thank you,

Thanh Chau  
Publication Director, Noctalia  
contact@noctalia.app  
https://noctalia.app/en/press

## Publication gate after a real review

Only when all evidence is retained:

- add a visible review box with the reviewer-approved wording and review date;
- link the reviewer name to the verified public profile;
- add a `Person` node and `reviewedBy` only to the exact reviewed article versions;
- synchronize `dateModified` with the substantive corrections, while keeping the review date separately visible;
- record translated-review scope explicitly: reviewed translation, checked against approved claims, or not reviewed;
- run the article, schema, metadata, link and full docs release checks before publication.

If a reviewer has not approved a translation, do not imply that they did.
