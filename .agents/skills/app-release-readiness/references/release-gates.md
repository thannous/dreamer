# Release gate checklist

Read only the sections relevant to the target platform and release path. Provider labels are examples; use the actual stack discovered in the project.

## Store metadata and compliance

### Common

- App name, subtitle or short description, full description, keywords/categories, support URL, marketing URL, privacy policy URL, copyright, and contact details.
- Required locale coverage and whether every locale is saved rather than merely drafted.
- Screenshots, preview media, icons, and device-family requirements.
- Privacy/data-safety answers reconciled with actual SDKs, permissions, account flows, analytics, ads, purchases, and deletion behavior.
- Age/content rating, content rights, app access or demo credentials, review notes, export/encryption declarations, and accessibility declarations.
- Agreements, banking, tax, trader or regional compliance, and account verification.

### Apple App Store

- App record, bundle ID, SKU, version record, copyright, categories, age-rating questions, content rights, encryption/export compliance, app privacy, accessibility, App Review contact, review notes, and sign-in/demo instructions.
- Required iPhone/iPad screenshots must match the device families declared by the binary. If iPad support is intentionally removed, verify both project configuration and the processed build.
- Check agreements, banking, tax, DSA/trader status, and regional availability independently from version metadata.
- Record whether the version is draft, ready for review, submitted, waiting for review, in review, pending developer release, or released.

### Google Play

- Main store listing, short/full description, graphics, screenshots, app category, contact details, privacy policy, target audience, content rating, data safety, ads declaration, app access, news or health declarations when relevant, and account deletion.
- Check testing-track requirements, countries/regions, managed publishing, release notes, policy warnings, and production-access eligibility.
- Record the exact track and rollout state rather than saying only that the build is “on Play”.

## Monetization reconciliation

Build a source-of-truth matrix for each purchasable item:

| Field | Store | Monetization provider | App/runtime |
|---|---|---|---|
| Product ID | Created and exact | Imported/mapped | Referenced exactly |
| Type/duration | Correct | Correct | Expected behavior |
| Price/territories | Available | Reflected | Displayed from provider |
| Entitlement | N/A or store group | Attached | Unlock checked |
| Offering/paywall | N/A | Current/default | Fetched and rendered |
| Credentials | Store key/secret valid | Accepted | Public SDK key configured |
| Test result | Sandbox/test account | Event/customer visible | Unlock and restore evidence |

Classify each row independently. A prefilled app form is not saved configuration; a saved provider app is not valid product mapping; visible products are not purchase-flow evidence.

Never expose private keys, shared secrets, auth tokens, tester credentials, or full account identifiers in the report.

## Build and distribution ladder

Capture the exact identifiers at every stage:

1. Source: commit, branch/worktree, clean or dirty state, app version, build number, bundle/application ID.
2. Local validation: relevant tests, typecheck/lint, platform diagnostics, and release configuration.
3. Build provider: job ID, profile, platform, status, artifact, signing result, and completion time.
4. Store ingestion: upload result and provider delivery ID when available.
5. Processing: build visible and processing completed without compliance errors.
6. Selection: build selected for the intended App Store version or Play track.
7. Testing: TestFlight/internal/closed-track availability and tester access.
8. Submission: review submission receipt and current review state.
9. Publication: production release or rollout percentage, public store visibility, and version shown publicly.

Do not skip rungs when reporting. Mark unseen intermediate stages `INDETERMINATE` even if a later claim exists without inspectable evidence.

## Real-device QA record

For each physical-device session record:

- device model and stable identifier or alias;
- OS version, display size, font scale, accessibility settings, locale, and network mode when relevant;
- installed app version/build and how it maps to the release artifact;
- backend and monetization mode: mock, sandbox/test-store, staging, or production;
- start/end timestamp and evidence directory;
- named screens or journeys, expected result, observed result, and evidence filename;
- crashes, visual regressions, blocked steps, and whether the issue reproduces on the release candidate.

High-risk journeys commonly include authentication, account deletion, consent/privacy, purchase/paywall display, entitlement refresh, restore in a safe environment, deep links, notifications, offline recovery, large text/reflow, screen readers, and upgrade from a previous public build.

Never press buy, confirm payment, restore against a live account, delete a real account, or send real notifications without the matching authorization.

## Blocker severity and ownership

- `P0 publication blocker`: prevents upload, processing, selection, submission, or policy acceptance.
- `P1 release-risk blocker`: release could proceed mechanically but critical behavior or evidence is missing.
- `P2 follow-up`: non-critical improvement that does not block the defined release target.

Assign one owner and one next action to each blocker. Split combined blockers when different systems or people own them. External review or processing remains a blocker or wait state until current provider evidence clears it.

## Evidence traps

- Account access does not prove the required role can save the configuration.
- Owner/admin role does not prove credentials or product mappings are complete.
- A form populated on screen does not prove it was saved successfully.
- A local file fix does not prove a public URL serves the fix.
- A successful site build does not prove deployment.
- A successful app build does not prove store upload or processing.
- An uploaded build does not prove it is selected for the release.
- TestFlight or a testing track does not prove App Review or production submission.
- Store metadata marked complete does not prove monetization or device QA.
- Device QA on a local bundle does not prove the uploaded store artifact behaves identically.
- A version marked “prepare” or “finalize before submission” is not submitted.
