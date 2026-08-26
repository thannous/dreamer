# Unlinked brand mention reclamation — Marika Pech — 2026-08-09

This dossier converts a current plain-text attribution into a factual source
correction and possible editorial backlink. The initial 2026-08-09 state was
review-only and used no external contact route. The current state is recorded
in the 2026-08-24 reconciliation below: one message was sent on 2026-08-23 and
must not be duplicated.

## Decision

| Gate | Evidence | Result |
| --- | --- | --- |
| Existing mention | [Rêves prémonitoires : ce que la science dit (et ce qu'elle laisse ouvert)](https://www.marikapech.com/blog/reves-premonitoires/) says, “Entre 40 et 60 % des personnes déclarent avoir vécu au moins un rêve qu'elles ont perçu comme prémonitoire. […] (Source : Noctalia, 2026).” | Pass: explicit Noctalia attribution already exists. |
| Link gap | The live article contains the plain text `Source : Noctalia`, but no anchor to `noctalia.app`. | Pass: genuine unlinked brand/source mention. |
| Public page | The exact article returns HTTP 200, declares `follow, index` and is self-canonical. It was published on 2026-03-03 and shows a 2026-04-09 modification date in page metadata. | Pass. |
| Accountable operator | [Legal notice](https://www.marikapech.com/mentions-legales/) identifies Marika Pech, a French auto-entrepreneur in Castelnau-le-Lez, and OVH in France as host. | Pass: named French operator; no Russian signal found. |
| Contact route | [Official contact page](https://www.marikapech.com/contact/) exposes an Elementor contact form. The legal notice also publishes `contact [at] marikapech.com`. | Pass, but unused. |
| Citation policy | No external editorial source anchor was found on the exact article. The only obvious external destination is Spotify; other external links are social or site-service links. | Unknown link policy; do not claim likely acceptance or followed treatment. |
| Brand accuracy | The publisher turns the old Noctalia figure into a broad statement about lived “premonitory” dreams and uses it to support an intuitive framing. Noctalia's cited page did not adequately distinguish belief, self-reported experience and experimental evidence. | Correction must come before the backlink request. |

## 22:06 CEST stop-gate refresh

- The exact publisher article still returns HTTP 200, is self-canonical and
  declares `follow, index`.
- It still publishes the `40–60 %` experience claim and the plain-text
  attribution `(Source : Noctalia, 2026)`; its rendered HTML still contains no
  `noctalia.app` anchor.
- The legal notice still names Marika Pech, a French auto-entrepreneur in
  Castelnau-le-Lez, with OVH France as host. The official contact page still
  exposes a collaboration form, and the legal notice still publishes
  `contact [at] marikapech.com`.
- The corrected Noctalia source returns HTTP 200, is self-canonical and
  `index, follow`, removes the old `40–60 %` statement and exposes the 55–70 %
  belief range, the belief-versus-experience distinction, Valášek and Watt and
  DOI `10.1016/j.paid.2015.07.028`.
- No Russian operator or jurisdiction signal was found. The route remains ready
  for one factual correction request after explicit authorization.

## Noctalia source correction

Noctalia's cited French article has been updated in source to:

- remove the unsupported `40–60 %` experience claim;
- remove an unverifiable direct quotation attributed to Caroline Watt;
- distinguish belief from self-reported experience;
- cite the peer-reviewed [Valášek and Watt (2015) record](https://www.research.ed.ac.uk/en/publications/individual-differences-in-prophetic-dream-belief-and-experience-e/) and its [DOI](https://doi.org/10.1016/j.paid.2015.07.028);
- state plainly that self-reported experiences are not proof that dreams predict future events.

The accepted manuscript reports that 55–70% believed in precognitive dreams
across three representative British, Icelandic and Swedish samples cited in its
introduction, with about half as many reporting such an experience. It also
describes controlled findings as inconsistent. The article itself studied 672
participants and measured belief, experience and frequency separately.

## Proposed correction on the publisher page

> Dans trois échantillons représentatifs britanniques, islandais et suédois
> cités par Valášek et Watt (2015), 55 à 70 % des répondants croyaient à la
> possibilité de rêves prémonitoires, tandis qu'environ deux fois moins
> déclaraient en avoir vécu un. Ces réponses auto-rapportées ne prouvent pas que
> les rêves prédisent l'avenir. (Source : Noctalia, 2026)

Requested source destination:

`https://noctalia.app/fr/blog/reves-premonitoires-science`

## Original unsent French contact copy

**Objet :** Source Noctalia à préciser dans votre article sur les rêves
prémonitoires

Bonjour Marika,

Merci d'avoir cité Noctalia dans votre article « Rêves prémonitoires : ce que
la science dit (et ce qu'elle laisse ouvert) ».

En revérifiant la source académique, nous avons corrigé le passage dont provient
le chiffre de 40–60 %. Il faut distinguer croyance et expérience auto-rapportée :
dans trois échantillons représentatifs cités par Valášek et Watt (2015), 55 à
70 % des répondants croyaient à la possibilité de rêves prémonitoires et environ
deux fois moins déclaraient en avoir vécu un. Ces réponses ne prouvent pas qu'un
rêve prédit l'avenir.

Pourriez-vous mettre à jour votre passage avec cette nuance et relier « Source :
Noctalia » à la page corrigée ?

https://noctalia.app/fr/blog/reves-premonitoires-science

La référence évaluée par les pairs et son DOI figurent sur cette page.

Merci,

Thanh Chau
Fondateur de Noctalia

## 01:11 CEST readiness refresh — 2026-08-10

Real Chrome confirmed that the publisher article is still self-canonical and
`index, follow`, contains the old 40–60% wording and exactly one plain-text
`Noctalia` mention, and exposes zero `noctalia.app` anchors. The corrected
Noctalia source is live on the custom domain with the belief-versus-experience
distinction and the Valášek and Watt sources. The current legal notice still
names the French operator and publishes the official mailbox; the contact page
still exposes its collaboration form. An exact authenticated Zimbra search for
`contact@marikapech.com` returns no result. No message was sent; every required
check must be repeated immediately after explicit D2 authorization.

## 2026-08-13 public refresh

Real Chrome reconfirmed the exact article as HTTP-rendered, self-canonical and
`follow, index`. It still contains the two `40–60 %` statements, exactly one
plain-text `Noctalia` attribution and zero `noctalia.app` anchors. The corrected
Noctalia source remains self-canonical and `index, follow`; it publishes the
55–70 % belief range, the belief-versus-experience distinction, the Valášek and
Watt record and DOI `10.1016/j.paid.2015.07.028`. The current legal notice still
names Marika Pech in Castelnau-le-Lez, OVH as host and
`contact [at] marikapech.com` as the official mailbox.

The connected Gmail account contains no matching Marika Pech message. At
01:27 CEST, the authenticated `contact@noctalia.app` Zimbra session returned
`Aucun résultat` from `Tout le courrier` for the exact recipient and prepared
subject. No prior send, reply, bounce, opt-out, draft or delivery warning was
visible. D2 remains unsent and must not be transmitted until the user explicitly
authorizes it and the public and mailbox gates are repeated immediately.

## 2026-08-22 authorization-ready refresh

The public article still contains the two `40–60 %` formulations, exactly one
plain-text `(Source : Noctalia, 2026)` attribution and no `noctalia.app` link.
It remains self-canonical and `follow, index`. The corrected Noctalia source is
still public with the 55–70% belief range, the belief-versus-self-reported-
experience distinction and DOI `10.1016/j.paid.2015.07.028`.

The official recipient remains `contact@marikapech.com`. A fresh authenticated
Gmail search across all mail found no matching send, draft, reply, bounce or
opt-out. No message or draft was created. The prepared copy is ready for at
most one factual correction request, but browser policy requires the user's
confirmation immediately before the external send.

## External-action stop gate

Before any transmission:

1. verify that the corrected Noctalia article is live on the custom domain;
2. reopen the exact Marika Pech page and stop if the wording or link has already
   changed;
3. use only the official contact form or published mailbox;
4. send only after the user's explicit authorization;
5. do not ask for payment, ranking language, anchor-text manipulation or a
   followed link attribute.

## Measurement boundary

The mention is currently unlinked. Preparing this dossier and publishing the
corrected Noctalia source create no backlink, referring domain, indexation
event, referral session or DR movement. A result can be recorded only after a
public clickable source link is independently verified, including its
indexability, canonical and link attributes.

## 2026-08-24 send reconciliation

The authenticated `contact@noctalia.app` Zimbra mailbox contains one sent
message to `contact@marikapech.com`, dated 2026-08-23 at 16:45 CEST, with the
subject `Petite précision concernant votre article sur les rêves
prémonitoires`. The message requests the factual belief-versus-experience
correction and, if editorially relevant, a link from `Source : Noctalia` to
`https://noctalia.app/fr/blog/reves-premonitoires-science`.

The conversation contains one message and no visible reply. On 2026-08-24 the
publisher page still displayed the old `40–60 %` formulation and the plain-text
attribution `Source : Noctalia, 2026`, with no clickable `noctalia.app` link.
Decision: no duplicate outreach. Monitor the existing conversation and the
public page before considering any follow-up.
