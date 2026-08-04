# Editorial discovery wave 27 — Italian editorial recheck and Everyeye

Evidence date: 2026-08-04 (Europe/Paris). The qualification pass was read-only until the user's explicit authorization to send the prepared Everyeye message. The message was transmitted at 18:49 CEST; Russian-language sites and Russian-operated routes remain excluded.

## Decisions

| Candidate | Current evidence | Decision |
| --- | --- | --- |
| [AndroidAyuda Italian dream-journal article](https://it.androidayuda.com/applicazioni/liste/Le-migliori-app-per-tenere-un-diario-dei-sogni-lucidi-basate-sui-cicli-REM/) | The current Italian page is HTTP 200, dated 27/03/2026, authored by Lorena Figueredo and focused on lucid-dream recording and REM cycles. Its [contact page](https://it.androidayuda.com/contatto/) exposes the same `androidayuda@googlegroups.com` route used by the English/Spanish outreach. The legal notice identifies AB Internet Networks 2008 SL in Spain. | Keep the existing `hard_bounce_closed` state. Zimbra already recorded a 03/08/2026 delivery-status notification saying the Google Group may not exist or may not accept posts. The fresh Italian article does not justify retrying the same failed route; no new message was sent. |
| [Everyeye article on keeping a diary](https://tech.everyeye.it/notizie/dovremmo-tenere-diario-segreto-assolutamente-si-perche-769312.html) | The Italian tech article is HTTP 200, dated 07/01/2025 and authored by Giuseppe Occhiuto. It explicitly describes the dream diary as a journaling use case. The official [staff page](https://www.everyeye.it/staff/) names Alessio Ferraiuolo as Tech and Cinema lead and Saimon Paganini as PR & Marketing; the site footer identifies HIDE DESIGN S.R.L. with Italian VAT `05619350720`. | Keep as a P1 initial-outreach editorial feature route. The article is relevant but is not an app roundup; a future Noctalia mention and any outbound link remain editorial decisions. One factual message was sent after a fresh duplicate search and did not request a link. |

## Everyeye message and transmission

Suggested recipient: `a.ferraiuolo@everyeye.it`

Suggested subject: `Suggerimento editoriale: diario dei sogni Android con cattura vocale`

```text
Buongiorno Alessio,

ho letto il vostro articolo «Dovremmo tutti tenere un diario segreto?» e il passaggio dedicato al diario dei sogni.

Noctalia è un'app Android per registrare un sogno con la voce o con il testo, conservarne il racconto originale ed esplorare simboli, emozioni e domande di riflessione. È pensata per journaling e benessere; non è un dispositivo medico e non offre diagnosi o predizioni.

Se in futuro preparaste un approfondimento su app, strumenti o metodi per ricordare e annotare i sogni, posso fornire una scheda tecnica, schermate e un accesso di prova. La scheda stampa italiana è qui:
https://noctalia.app/it/stampa

La scelta editoriale e qualsiasi eventuale collegamento restano interamente a vostra discrezione.

Grazie,
Thanh Chau
Noctalia
contact@noctalia.app
```

## Result

One new P1 opportunity remains in `initial_sent_waiting` in `marketing/seo/backlink-prospects-2026-07-31.csv`, keeping the register at 170 opportunities (2 P0, 58 P1, 109 P2 and 1 P3). A fresh `Tout le courrier` search for `everyeye.it` returned `Aucun résultat`; the message was sent from `contact@noctalia.app` at 18:49 CEST, Zimbra displayed `Le mail a été envoyé` and `Envoyés` listed the exact subject with the `a.ferraiuolo` recipient alias. Transmission is not delivery, publication, a referring domain, a backlink or a Domain Rating gain. The first conditional follow-up is due no earlier than 2026-08-09 and must stop on a reply, bounce, opt-out or live citation.
