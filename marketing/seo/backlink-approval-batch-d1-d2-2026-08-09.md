# Backlink approval batch D1–D2 — 2026-08-09

This batch contains the two highest-confidence external actions after the
22:06 CEST public and mailbox refresh. It is approval-ready only. No email,
contact form, account, publication, payment or backlink was created.

## Decision summary

| Code | Route | Current evidence | Expected value | Risk | Status |
| --- | --- | --- | --- | --- | --- |
| D1 | Reply to Dan Kennedy at Elsewhere in the existing Gmail thread | Human editor asked about iOS and export; the thread still has only the initial message and his reply; the live press kit answers the current product limits | Preserve the warm editorial relationship for the next comparison, expected around 2027 | No immediate backlink; an inaccurate roadmap answer would damage trust | Ready after explicit send authorization |
| D2 | One factual correction to Marika Pech through the published mailbox or official form | Live index-follow article still attributes the incorrect 40–60 % statement to Noctalia in plain text; corrected Noctalia source is live; named French operator and official route remain public | Correct a public source error and potentially reclaim an existing unlinked mention | Link policy and acceptance are unknown | Ready after explicit send authorization |

## Authorization boundaries

Approval for one code does not authorize the other.

### D1

> J'autorise l'envoi, dans le fil Gmail Elsewhere existant, de la réponse
> factuelle D1 préparée dans
> `marketing/seo/editorial-response-elsewhere-2026-08-09.md`, sans demande de
> lien, placement, paiement ou engagement de roadmap iOS.

### D2

> J'autorise l'envoi unique à Marika Pech, par l'adresse publiée
> `contact@marikapech.com`, de la correction factuelle D2 préparée dans
> `marketing/seo/brand-mention-reclamation-marikapech-2026-08-09.md`, sans
> paiement, relance automatique ni demande de traitement `dofollow`.

## Immediate pre-send gates

1. D1: reopen the exact Gmail thread and stop if a newer message, reply, bounce,
   opt-out or existing Noctalia response appears.
2. D2: reopen the exact publisher article and stop if the number, attribution or
   link has changed; reconfirm the Noctalia source is HTTP 200.
3. Send each code at most once through its stated official route.
4. Record only the authoritative sent state. Do not infer delivery, acceptance,
   publication, a live backlink or DR movement.
5. If either recipient replies, stop automation and review the human response.

## Measurement boundary

The batch prepares two relationship actions, not two backlinks. A result enters
the backlink register only after a public page exposes a clickable Noctalia URL
and its status, canonical, indexability and link attributes are independently
verified.
