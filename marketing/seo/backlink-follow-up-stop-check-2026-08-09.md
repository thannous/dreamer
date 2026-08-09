# Backlink follow-up stop-check — 2026-08-09

Checked on 2026-08-09 (Europe/Paris). This is evidence gathering only. No email, form, account, publication or payment was sent or created.

## Global public baseline

`npm run seo:backlinks:check` rechecked the nineteen tracked public surfaces:

- 6 indexable followed pages;
- 4 indexable nofollow pages;
- 2 pages where the expected Noctalia link is missing;
- 3 non-indexable pages;
- 3 HTTP 403 pages that remain unverified;
- 1 HTTP 410 retired page.

The distribution is unchanged from the 2026-08-03 public verification. This does not prove a current Ahrefs DR value because the authenticated Ahrefs dashboard was not reopened.

## Routes due on 2026-08-09

| Domain | Public-page stop gate | Mailbox stop gate | Decision |
| --- | --- | --- | --- |
| `xatakandroid.com` | Target returns HTTP 200. Current HTML and rendered search expose no `Noctalia` or `noctalia.app` citation. | Blocked: the real Chrome Zimbra tab currently shows the login screen instead of the authenticated `contact@noctalia.app` mailbox. | `follow_up_due_mailbox_gate_blocked`; do not send until Inbox and Spam are checked. |
| `andro4all.com` | The target now redirects to a La Razón article and exposes no Noctalia citation. The originally contacted Andro4all route no longer controls the verified target URL. | Not required for a follow-up decision because the public target migration invalidates the original route. | `closed_target_migrated_to_larazon`; do not follow up to `prensa@andro4all.com`. A future La Razón route would require fresh qualification and separate authorization. |
| `aitrendtool.com` | The free submission page returns HTTP 200, still describes human editorial review, and exposes no Noctalia citation. Exact public site search also found no Noctalia listing. | Blocked by the unauthenticated Zimbra state. | `follow_up_due_mailbox_gate_blocked`; do not send until Inbox and Spam are checked. |
| `everyeye.it` | The topical article returns HTTP 200. Current HTML and exact site search expose no `Noctalia` or `noctalia.app` citation. | Blocked by the unauthenticated Zimbra state. | `follow_up_due_mailbox_gate_blocked`; do not send until Inbox and Spam are checked. |

## Required next gate

After the user signs in to `https://zimbra1.mail.ovh.net/modern/` in the real Chrome browser, search each exact recipient and subject in Inbox and Spam. Close a route on any reply, decline, opt-out, bounce, delivery warning or already-live citation. If a route still passes, prepare one reply in the original thread and request explicit authorization before transmission.

## Overdue wave-2 public gate

The fifteen wave-2 targets were also rechecked on 2026-08-09. This does not clear the mailbox gate and does not authorize any send.

| Treatment | Domains | Evidence |
| --- | --- | --- |
| HTTP 200; no public Noctalia citation found | `allthingsai.work`, `gratitudegenie.com`, `androidpolice.com`, `goalsandprogress.com`, `penzu.com`, `atlasworkspace.ai`, `ilty.co`, `theverge.com`, `engadget.com`, `9to5google.com`, `sleepopolis.com` | Direct current HTML checks found no `Noctalia` or `noctalia.app`; exact public search also found no AllThingsAI listing. |
| Direct HTTP blocked, independently readable, no citation found | `androidheadlines.com`, `sleep.com` | Direct requests returned HTTP 403, but current search-rendered page copies were readable and contained no Noctalia match. |
| Access-unverified | `digitaltrends.com` | Direct and search fetches returned HTTP 403. Do not infer absence or publication; a rendered authenticated/user-browser check is still required. |
| Unlinked source mention remains | `kapanlagi.com` | The current page still prints the exact Noctalia source URL and names Noctalia, but no clickable `href` to `noctalia.app` is present. It remains source reclamation, not a backlink. |

The Verge remains deferred until 2026-08-11 because of the previously recorded automatic away reply. Every other wave-2 route remains `follow_up_due_mailbox_gate_blocked`; the public check alone is insufficient to send.

## Gmail wave-1 gate

The ten Gmail threads prepared in wave 1 were read directly on 2026-08-09. Nine remain open candidates and one was already closed:

- World of Lucid Dreaming, Mattress Miracle, Sleep Review, Tom's Guide, DeepJournal, Acuity, CortexOS and Dearly/Brooo each still contain only the original sent message.
- Holstee has only the previously recorded automatic helpdesk acknowledgment, not an editorial reply.
- Oneironaut was already closed after the 2026-08-03 live operator and authority recheck; it is excluded from follow-up.
- A fresh Gmail delivery-failure search found no matching bounce for the nine open candidates.
- Each of the nine current public target pages contains no Noctalia citation. World of Lucid Dreaming returned HTTP 403 to the direct request but its current search-rendered page was readable and contained no Noctalia match.

These nine routes are `followup_1_eligible_awaiting_explicit_authorization`. No reply was sent. The already-prepared copy in `marketing/seo/backlink-follow-up-wave-1-2026-08-05.md` remains the exact proposed batch.

The same Gmail failure search also found the final JournPad Delivery Status Notification (Failure) dated 2026-08-03. JournPad is now closed as `delivery_failed_permanent_closed`; no retry or alternative address is allowed.
