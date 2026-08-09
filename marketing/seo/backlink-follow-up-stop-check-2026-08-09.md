# Backlink follow-up stop-check — 2026-08-09

Checked on 2026-08-09 (Europe/Paris), with the authenticated Zimbra stop gate
completed at 18:21 CEST. This is evidence gathering only. No email, form,
account, publication or payment was sent or created.

## Global public baseline

`npm run seo:backlinks:check` rechecked the nineteen tracked public surfaces:

- 6 indexable followed pages;
- 4 indexable nofollow pages;
- 2 pages where the expected Noctalia link is missing;
- 3 non-indexable pages;
- 3 HTTP 403 pages that remain unverified;
- 1 HTTP 410 retired page.

The distribution is unchanged from the 2026-08-03 public verification. This does not prove a current Ahrefs DR value because the authenticated Ahrefs dashboard was not reopened.

## D3A refresh — 2026-08-10 00:31 CEST

The three DR-first routes were refreshed without sending or modifying any
message:

| Domain | Current public evidence | Current mailbox evidence | Result |
| --- | --- | --- | --- |
| `kapanlagi.com` | A direct HTTP 200 fetch of the current wallet-and-water article contains four `Noctalia` mentions and zero `noctalia.app` anchors. Current exact public search still exposes several KapanLagi pages citing the same Noctalia source URL. | The authenticated `contact@noctalia.app` Zimbra search contains exactly one result: the original sent message. | Unlinked source reclamation remains live; no reply, bounce or opt-out. |
| `penzu.com` | The current dream-journal guide returns HTTP 200 with zero `Noctalia` mentions and zero `noctalia.app` anchors. | The exact Zimbra search contains exactly one result: the original sent message. | No public inclusion; no reply, bounce or opt-out. |
| `allthingsai.work` | The current homepage returns HTTP 200 with zero `Noctalia` mentions and zero `noctalia.app` anchors; exact public site search exposes no Noctalia listing. | The exact Zimbra search contains exactly one result: the original sent message. | No public listing; no reply, bounce or opt-out. |

The Zimbra Spam folder contains the already-recorded AndroidAyuda delivery
failure and no KapanLagi, Penzu or AllThingsAI reply, bounce, opt-out or warning.
The public nineteen-page verifier was also rerun and remains at 6 followed,
4 nofollow, 2 missing-link, 3 non-indexable, 3 HTTP 403 and 1 HTTP 410. D3A
therefore remains eligible, but no transmission is authorized by this check.

## D3A execution — 2026-08-10 00:38–00:41 CEST

The user independently authorized one first reply in each existing D3A thread.
Immediately before transmission, the three public targets were fetched again:
KapanLagi returned HTTP 200 with four `Noctalia` mentions and zero
`noctalia.app` anchors; Penzu and AllThingsAI each returned HTTP 200 with zero
Noctalia mentions or anchors. Exact authenticated Zimbra searches still showed
one conversation containing only the original sent message for each recipient.
Spam contained no matching reply, bounce, opt-out or delivery warning.

| Domain | Existing thread | Authoritative Zimbra result | Recorded state |
| --- | --- | --- | --- |
| `kapanlagi.com` | `Re: Source attribution on your water-dream article` to `redaksi.kapanlagi@kly.id` | `Le mail a été envoyé`; Sent shows a two-message conversation at 2026-08-10 00:40 CEST. | `followup_1_sent_waiting` |
| `penzu.com` | `Re: Android-specific addition for your dream journal guide` to `info@penzu.com` | `Le mail a été envoyé`; Sent shows a two-message conversation at 2026-08-10 00:41 CEST. | `followup_1_sent_waiting` |
| `allthingsai.work` | `Re: Directory submission — Noctalia` to `info@allthingsai.work` | `Le mail a été envoyé`; Sent shows a two-message conversation at 2026-08-10 00:41 CEST. | `followup_1_sent_waiting` |

Each composer contained the approved factual copy and zero attachment chips.
No payment, tracking, reciprocal arrangement or guaranteed-link request was
added. The Sent state proves transmission only; it does not prove remote
delivery, human receipt, editorial acceptance, publication, a backlink or a DR
change. The conditional final check remains dated 2026-08-16 and must stop if a
reply, failure, opt-out or public citation appears first.

## D3A post-send monitor — 2026-08-10 00:52 CEST

A read-only public refresh found no change: the checked KapanLagi article still
returns HTTP 200 with four Noctalia mentions and zero `noctalia.app` anchors;
Penzu and AllThingsAI still return HTTP 200 with zero Noctalia mentions or
anchors. Exact authenticated Zimbra searches return one two-message
conversation for each recipient—the original message and the authorized first
reply—with no inbound response. Spam remains at three messages and contains
only the previously recorded AndroidAyuda campaign failure. No message or
mailbox state was modified by this monitor.

## D3A post-send monitor — 2026-08-10 01:11 CEST

The same three routes were checked again in real Chrome. KapanLagi remains
self-canonical and `index, follow`, with four `Noctalia` mentions and zero
`noctalia.app` anchors. Penzu and AllThingsAI still contain zero Noctalia
mentions and zero anchors. Exact authenticated Zimbra searches still return one
two-message conversation for each recipient and no inbound message. No public
link or mailbox state changed, so all three routes remain
`followup_1_sent_waiting` until the conditional 2026-08-16 check.

## Routes due on 2026-08-09

| Domain | Public-page stop gate | Mailbox stop gate | Decision |
| --- | --- | --- | --- |
| `xatakandroid.com` | Target returns HTTP 200. Current HTML and rendered search expose no `Noctalia` or `noctalia.app` citation. | Authenticated Zimbra `Tout le courrier` search returns one conversation containing only the original sent message. Spam contains no matching reply, bounce, opt-out or delivery warning. | `followup_1_eligible_awaiting_explicit_authorization`; do not send without a separate send authorization. |
| `andro4all.com` | The target now redirects to a La Razón article and exposes no Noctalia citation. The originally contacted Andro4all route no longer controls the verified target URL. | Not required for a follow-up decision because the public target migration invalidates the original route. | `closed_target_migrated_to_larazon`; do not follow up to `prensa@andro4all.com`. A future La Razón route would require fresh qualification and separate authorization. |
| `aitrendtool.com` | The free submission page returns HTTP 200, still describes human editorial review, and exposes no Noctalia citation. Exact public site search also found no Noctalia listing. | Authenticated Zimbra `Tout le courrier` search returns one conversation containing only the original sent message. Spam contains no matching reply, bounce, opt-out or delivery warning. | `followup_1_eligible_awaiting_explicit_authorization`; do not send without a separate send authorization. |
| `everyeye.it` | The topical article returns HTTP 200. Current HTML and exact site search expose no `Noctalia` or `noctalia.app` citation. | Authenticated Zimbra `Tout le courrier` search returns one conversation containing only the original sent message. Spam contains no matching reply, bounce, opt-out or delivery warning. | `followup_1_eligible_awaiting_explicit_authorization`; do not send without a separate send authorization. |

## Completed mailbox gate and remaining authorization gate

The real Chrome session is authenticated as `contact@noctalia.app`. Exact-domain
searches across `Tout le courrier` were run for the three due routes and all
wave-2 email routes. Each open route contains only the original sent message,
except The Verge's already-recorded automatic away reply and
BestForAndroid's already-closed paid offer. Spam contains the previously
recorded AndroidAyuda permanent failure and no new campaign reply, bounce,
opt-out or warning.

The public and mailbox stop gates therefore pass for Xataka Android,
AITrendTool and Everyeye. Their first replies may be prepared in the original
threads, but transmission still requires explicit authorization. The Andro4all
route remains closed because its target migrated to La Razón.

## Overdue wave-2 public gate

The fifteen wave-2 targets were also rechecked on 2026-08-09. This does not clear the mailbox gate and does not authorize any send.

| Treatment | Domains | Evidence |
| --- | --- | --- |
| HTTP 200 or fully rendered in real Chrome; no public Noctalia citation found | `allthingsai.work`, `digitaltrends.com`, `gratitudegenie.com`, `androidpolice.com`, `goalsandprogress.com`, `penzu.com`, `atlasworkspace.ai`, `ilty.co`, `theverge.com`, `engadget.com`, `9to5google.com`, `sleepopolis.com` | Direct current HTML checks found no `Noctalia` or `noctalia.app`; exact public search also found no AllThingsAI listing. Digital Trends' current article rendered in real Chrome with its July 27, 2026 title/byline and no Noctalia match, clearing the earlier HTTP-only access uncertainty. |
| Direct HTTP blocked, independently readable, no citation found | `androidheadlines.com`, `sleep.com` | Direct requests returned HTTP 403, but current search-rendered page copies were readable and contained no Noctalia match. |
| Unlinked source mention remains | `kapanlagi.com` | The current page still prints the exact Noctalia source URL and names Noctalia, but no clickable `href` to `noctalia.app` is present. It remains source reclamation, not a backlink. |

Authenticated Zimbra searches show only the original sent conversation for the
fourteen wave-2 routes other than The Verge. No new matching reply or bounce is
present in Spam. Those fourteen routes are now
`followup_1_eligible_awaiting_explicit_authorization`. The Verge remains
deferred until 2026-08-11 because of the previously recorded automatic away
reply. Eligibility is not permission to send.

## Gmail wave-1 gate

The ten Gmail threads prepared in wave 1 were read directly on 2026-08-09. Nine remain open candidates and one was already closed:

- World of Lucid Dreaming, Mattress Miracle, Sleep Review, Tom's Guide, DeepJournal, Acuity, CortexOS and Dearly/Brooo each still contain only the original sent message.
- Holstee has only the previously recorded automatic helpdesk acknowledgment, not an editorial reply.
- Oneironaut was already closed after the 2026-08-03 live operator and authority recheck; it is excluded from follow-up.
- A fresh Gmail delivery-failure search found no matching bounce for the nine open candidates.
- Each of the nine current public target pages contains no Noctalia citation. World of Lucid Dreaming returned HTTP 403 to the direct request but its current search-rendered page was readable and contained no Noctalia match.

These nine routes are `followup_1_eligible_awaiting_explicit_authorization`. No reply was sent. The already-prepared copy in `marketing/seo/backlink-follow-up-wave-1-2026-08-05.md` remains the exact proposed batch.

The same Gmail failure search also found the final JournPad Delivery Status Notification (Failure) dated 2026-08-03. JournPad is now closed as `delivery_failed_permanent_closed`; no retry or alternative address is allowed.
