# Noctalia Content Planning - fin juin / juillet 2026

Source de verite editoriale: `docs-src/content/blog/`.
Sortie generee: `docs/`.
Langues suivies: FR, EN, ES, DE, IT.
Derniere version live observee: `86f0ad3eb034`.
Controle live du 2026-07-16: le sitemap live contient 1165 URLs et les 25 URLs de juillet repondent 200.

## Etat editorial au 16 juillet 2026

| Phase | Statut | Notes |
|---|---|---|
| 20 juin - Article canicule / heatwave | Publie dans les 5 langues | Present dans le sitemap live et indexe. |
| 20 juin - Article confidentialite IA | Publie dans les 5 langues | Present dans le sitemap live et indexe. Le DE est maintenant au-dessus de 500 mots cote source. |
| 21 juin - Refresh reves et creativite | Publie dans les 5 langues | Bloc juin 2026 en ligne apres deploy `20260623-112558`. |
| 21 juin - Refresh controle des reves / resolution de problemes | Publie dans les 5 langues | Bloc TMR / journalisation en ligne apres deploy `20260623-112558`. |
| 21 juin - Hub reve lucide | Publie dans les 5 langues | Bloc corpus 55 000 reves en ligne. `lastmod` sitemap corrige cote source pour la prochaine generation. |
| 23 juin - Deploy production | Fait | Cloudflare Pages version `20260623-112558`. |
| 24 juin - Search Console | Fait | Sitemap soumis, 25 URLs prioritaires inspectees; re-check API: `Submitted and indexed` pour les 25. |
| 6 juillet - Article vacances / vacation sleep dreams | Publie dans les 5 langues | Live en prod `65a8d2c0ac15`, present dans le sitemap live avec `lastmod` `2026-07-06`. |
| 9 juillet - Search Console vacances | En suivi | Reinspection API 19:55 CEST: EN/DE `Submitted and indexed`; FR/IT `Discovered - currently not indexed`; ES `URL is unknown to Google`. Demande manuelle confirmee pour FR/ES/IT. |
| 8 juillet - Article bruit nocturne / night noise | Publie dans les 5 langues | Live en prod `20260708-130244`; 5 URLs 200, presentes dans le sitemap live. |
| 8 juillet - Article reveil nocturne / night waking | Publie dans les 5 langues | Live en prod `20260708-130244`; 5 URLs 200, presentes dans le sitemap live. |
| 9 juillet - Search Console vague juillet | En suivi | 15 URLs reinspectees: 4 indexees, 10 demandes manuelles confirmees, 1 `Crawled - currently not indexed`. Le sitemap n'a pas ete resoumis: le `204` du 8 juillet reste la derniere soumission. |
| 9 juillet - Controle live | Fait | Les 15 URLs juillet repondent 200 et sont presentes dans le sitemap live, qui contient 1150 URLs. Le marqueur live `version.txt` est incoherent avec la publication SEO connue. |
| 10 juillet - Search Console vague juillet | En suivi leger | 14 URLs sur 15 sont `Submitted and indexed`. Seule l'URL ES du reveil nocturne reste `Crawled - currently not indexed`; aucune URL n'est encore `unknown` ou `discovered`. |
| 10 juillet - Controle live | Fait | Les 15 URLs juillet repondent 200 et sont presentes dans le sitemap live, qui contient 1155 URLs. `version.txt` renvoie `20260710-010011`. |
| 10 juillet - Cauchemars chaleur/stress | Publie par anticipation dans les 5 langues | Commit `5afeeb4f1`, prod `20260710-171822`, 5 URLs 200 et sitemap live a 1160 URLs. |
| 10 juillet - Search Console cauchemars | En suivi | Sitemap resoumis avec reponse 204. Reinspection finale: FR exploree non indexee, EN/ES/DE detectees, IT inconnue. FR placee en file prioritaire, puis quota quotidien atteint sur EN. EN/ES/DE/IT a redemander le 11 juillet si elles ne progressent pas. |
| 12 juillet - Search Console vague juillet | En suivi leger | Les 15 URLs de la vague initiale sont maintenant `Submitted and indexed`. Pour les cauchemars, FR/EN sont indexees; ES/IT restent inconnues et DE exploree non indexee. Les demandes manuelles ES/DE/IT ont ete confirmees dans l'UI. |
| 12 juillet - Controle live | Fait | Les 20 URLs juillet repondent 200 et sont presentes dans le sitemap live, qui contient 1160 URLs. Apres le deploy `13c70708`, `version.txt` renvoie `2866f3066c1f`. |
| 13 juillet - Search Console vague juillet | Fait | Les 20 URLs juillet sont `Submitted and indexed`. ES/DE/IT de l'article cauchemars ont ete explorees le 12 juillet apres les demandes manuelles; aucune nouvelle demande n'est necessaire. |
| 13 juillet - Controle live | Fait | Les 20 URLs juillet repondent 200 et sont presentes dans le sitemap live, qui contient 1160 URLs. `version.txt` renvoie toujours `2866f3066c1f`. |
| 14 juillet - Search Console vague juillet | Fait | Les 20 URLs juillet restent `Submitted and indexed`; fetch Google reussi, robots autorise et canonical Google conforme pour chaque URL. Aucune demande manuelle n'est necessaire. |
| 14 juillet - Controle live | Fait | Les 20 URLs juillet repondent 200 et sont presentes dans le sitemap live, qui contient 1160 URLs. `version.txt` renvoie toujours `2866f3066c1f`. |
| 14 juillet - Programmation fin juillet | Fait | Priorites 5 a 10 definies a partir de l'export GSC du 15 juin au 12 juillet et d'une veille scientifique primaire: deux nouvelles vagues multilingues, trois refreshs cibles et une cloture mesure/maillage. |
| 15 juillet - Etude reves/emotions | Publie dans les 5 langues | Prod `20260715-100211`, sitemap live porte a 1165 URLs et resoumis a Search Console avec reponse 204. |
| 16 juillet - Search Console vague initiale | Fait | Les 15 URLs vacances/bruit nocturne/reveil nocturne restent `Submitted and indexed`; fetch reussi, robots autorises et canonical Google conforme pour les 15. |
| 16 juillet - Search Console etude reves/emotions | En suivi | 0/5 indexee: FR inconnue, EN exploree non indexee, ES/DE/IT detectees non indexees. Les cinq demandes manuelles ont ete confirmees dans la file d'exploration prioritaire. |
| 16 juillet - Controle live | Fait | Les 25 URLs juillet repondent 200 et sont presentes dans le sitemap live, qui contient 1165 URLs. `version.txt` renvoie `86f0ad3eb034`. |

Les 6 URLs de juin qui avaient demande une indexation manuelle ne sont plus bloquantes. Les 20 URLs des priorites 1 a 4 restent indexees. Les cinq URLs de l'etude reves/emotions sont en file d'exploration prioritaire; aucune nouvelle demande ne doit etre envoyee avant une nouvelle reinspection.

## URLs publiees et indexation

### Article canicule / heatwave

| Langue | URL | Date source | Indexation |
|---|---|---:|---|
| FR | https://noctalia.app/fr/blog/canicule-sommeil-reves | 2026-06-20 | Submitted and indexed |
| EN | https://noctalia.app/en/blog/heatwave-sleep-dreams | 2026-06-20 | Submitted and indexed |
| ES | https://noctalia.app/es/blog/ola-calor-sueno-suenos | 2026-06-20 | Submitted and indexed |
| DE | https://noctalia.app/de/blog/hitzewelle-schlaf-traeume | 2026-06-20 | Submitted and indexed |
| IT | https://noctalia.app/it/blog/ondata-calore-sonno-sogni | 2026-06-20 | Submitted and indexed |

### Article confidentialite IA / AI dream journal privacy

| Langue | URL | Date source | Indexation |
|---|---|---:|---|
| FR | https://noctalia.app/fr/blog/confidentialite-ia-journal-reves | 2026-06-20 | Submitted and indexed |
| EN | https://noctalia.app/en/blog/ai-dream-journal-privacy | 2026-06-20 | Submitted and indexed |
| ES | https://noctalia.app/es/blog/privacidad-ia-diario-suenos | 2026-06-20 | Submitted and indexed |
| DE | https://noctalia.app/de/blog/ki-traumtagebuch-datenschutz | 2026-06-20 | Submitted and indexed |
| IT | https://noctalia.app/it/blog/privacy-ia-diario-sogni | 2026-06-20 | Submitted and indexed |

### Article vacances / vacation sleep dreams

| Langue | URL | Date source | Etat live | Search Console au 2026-07-10 |
|---|---|---:|---|---|
| FR | https://noctalia.app/fr/blog/vacances-sommeil-reves | 2026-07-06 | 200 + sitemap live | Submitted and indexed |
| EN | https://noctalia.app/en/blog/vacation-sleep-dreams | 2026-07-06 | 200 + sitemap live | Submitted and indexed |
| ES | https://noctalia.app/es/blog/vacaciones-sueno-suenos | 2026-07-06 | 200 + sitemap live | Submitted and indexed |
| DE | https://noctalia.app/de/blog/urlaub-schlaf-traeume | 2026-07-06 | 200 + sitemap live | Submitted and indexed |
| IT | https://noctalia.app/it/blog/vacanze-sonno-sogni | 2026-07-06 | 200 + sitemap live | Submitted and indexed |

Le sitemap live a ete soumis a Search Console le 2026-07-08. Les cinq URLs vacances sont maintenant indexees; aucune nouvelle demande UI n'est necessaire.

### Refresh creativite, resolution de problemes, reve lucide

| Cluster | FR | EN | ES | DE | IT | Indexation |
|---|---|---|---|---|---|---|
| Reves et creativite | `/fr/blog/reves-et-creativite` | `/en/blog/dreams-and-creativity` | `/es/blog/suenos-y-creatividad` | `/de/blog/traeume-und-kreativitaet` | `/it/blog/sogni-e-creativita` | Submitted and indexed |
| Controle des reves / problem solving | `/fr/blog/controler-reves-resolution-problemes` | `/en/blog/dream-control-problem-solving` | `/es/blog/controlar-suenos-resolucion-problemas` | `/de/blog/traumkontrolle-problemloesung` | `/it/blog/controllare-sogni-risoluzione-problemi` | Submitted and indexed |
| Hub reve lucide | `/fr/blog/reve-lucide` | `/en/blog/lucid-dreaming` | `/es/blog/suenos-lucidos` | `/de/blog/klares-traeumen-anleitungen-und-techniken` | `/it/blog/sogni-lucidi-guide-e-tecniche` | Submitted and indexed |

## Publications juillet 2026

| Priorite | Fenetre cible | Sujet | Statut | Intention SEO | Langues | Maillage interne prevu | Validation |
|---:|---|---|---|---|---|---|---|
| 1 | 1-3 juillet, publie le 6 juillet | Reves et sommeil en vacances | Publie/live; 5/5 indexees | Saisonnier ete, voyage, changement de lit, reveil nocturne | FR, EN, ES, DE, IT | Heatwave, sleep-day-environment, dream journal, dream recall | Build/check faits dans le sprint; sitemap live OK |
| 2 | 4-7 juillet, rattrape le 8 juillet | Bruit nocturne, sommeil et reves | Publie/live; 5/5 indexees | Requetes pratiques appartement, voisinage, ville, vacances | FR, EN, ES, DE, IT | Sleep-day-environment, vivid dreams, stress dreams, dream journal, vacation | Build/check/release-check faits; sitemap live OK |
| 3 | 8-11 juillet, produit le 8 juillet | Reveil nocturne et rappel des reves | Publie/live; 5/5 indexees | Capture rapide, journal vocal, sommeil fragmente | FR, EN, ES, DE, IT | Voice dream journal, how to remember dreams, REM sleep, privacy article | Build/check/release-check faits; sitemap live OK |
| 4 | 12-15 juillet, anticipe le 10 juillet | Cauchemars en periode de chaleur ou stress | Publie/live; 5/5 indexees | Angle ete + anxiete, utile pour maillage cauchemars/canicule | FR, EN, ES, DE, IT | Nightmares guide, heatwave, anxiety dreams, mental health | Build/check/release-check/crosslinks passes; sitemap live 1160 URLs |
| 5 | 14-17 juillet, publie le 15 juillet | Les reves regulent-ils nos emotions ? Ce que montre une etude 2026 | Publie/live; 0/5 indexee, demandes manuelles 5/5 confirmees le 16 juillet | Actualite scientifique publiee dans `Sleep` en mai 2026; angle distinct des articles IA et MÖBIUS existants | FR, EN, ES, DE, IT | Cauchemars chaleur/stress, confidentialite IA, sante mentale, anxiete, journal | 5 sources relues, canonical/hreflang/JSON-LD valides, index a 46; build/check/crosslinks/release-check passes; sitemap live 1165 URLs |
| 6 | 18-20 juillet | Refresh `Suenos de agua`: inondation, maison, eau propre/sale | Programme | Quick win SERP: 41 017 impressions, CTR 0,99 %, position 5,3 | ES cible | Symboles eau/inondation/maison/mer + journal de reves | Refaire title/meta, reponse courte, FAQ et ancres; mesurer a J+14 |
| 7 | 21-23 juillet | Refresh `Flying dreams meaning` | Programme | Reprendre `dream about flying`, `dream of flying` et variantes: 1 948 impressions, position 19,1 | EN cible | Dream meanings, lucid dreaming, falling dreams, dream journal | Recentrer l'intention, enrichir les scenarios utiles et renforcer les liens internes |
| 8 | 24-25 juillet | Refresh guide debutant des reves lucides | Programme | Requetes `como tener suenos lucidos`: 1 029 impressions, CTR 0,29 %, position 14,5 | ES cible | Hub reve lucide, rappel des reves, journal, controle des reves | Reponse en 5 etapes, FAQ, preuves prudentes et CTA journal naturel |
| 9 | 26-29 juillet, publication cible le 29 | Jet lag, sommeil et reves | Programme - nouvel article | Saisonnier voyage + forte adequation produit; combler un angle seulement mentionne dans les contenus existants | FR, EN, ES, DE, IT | Vacation, REM sleep, sleep environment, dream recall, dream journal | 5 sources, hreflang/canonical/JSON-LD, index blog, build/check/crosslinks/release-check |
| 10 | 30-31 juillet | Cloture SEO, maillage et mesure | Programme | Eviter la surpublication; verifier indexation, deltas CTR/position et liens internes avant aout | Toutes | Priorites 5 a 9 + hubs concernes | Export GSC, inspection des 10 nouvelles URLs, controle live et decision aout |

### Direction editoriale du 15 au 31 juillet

Le programme combine trois leviers: gagner des clics sur des pages deja visibles, rapprocher les contenus du produit Noctalia et publier deux clusters multilingues reellement distincts: une actualite scientifique a duree de vie longue et un guide saisonnier. Les refreshs sont volontairement limites a la langue ou le signal GSC est etabli; les nouvelles publications restent multilingues pour conserver le contrat editorial du site.

| Priorite | Impact audience (40 %) | Adequation produit (30 %) | Potentiel recherche (20 %) | Faisabilite (10 %) | Score |
|---:|---:|---:|---:|---:|---:|
| 5 - Etude reves/emotions, 5 langues | 8 | 9 | 7 | 7 | 8,1 |
| 6 - Eau / inondation ES | 9 | 8 | 10 | 9 | 8,9 |
| 7 - Reves de vol EN | 7 | 8 | 7 | 8 | 7,4 |
| 8 - Reve lucide debutant ES | 8 | 9 | 7 | 8 | 8,1 |
| 9 - Jet lag et reves, 5 langues | 7 | 9 | 6 | 6 | 7,3 |

Objectifs de mesure, a evaluer sans promettre un classement:

- Priorite 5: obtenir 5/5 URLs indexees et les premieres impressions sur les requetes liees aux reves, aux emotions et a l'humeur matinale, sans surinterpreter l'etude.
- Priorite 6: faire progresser le CTR global de `https://noctalia.app/es/blog/suenos-de-agua` au-dessus de 1,2 % ou consolider une position moyenne sous 5 a J+14/J+28.
- Priorite 7: rapprocher `https://noctalia.app/en/blog/flying-dreams-meaning` du top 15 et obtenir un premier CTR superieur a 0,4 % sur une fenetre comparable.
- Priorite 8: rapprocher `https://noctalia.app/es/blog/guia-suenos-lucidos-principiantes` du top 12 et doubler le CTR actuel sans titre sensationnaliste.
- Priorite 9: obtenir 5/5 URLs indexees, leurs premieres impressions et un maillage reciproque complet avant d'evaluer le ranking.

### Brief de la vague scientifique reves et emotions

Dossier source: `docs-src/content/blog/blog.dream-emotion-regulation-study/`.

| Langue | Angle/titre de travail | Slug cible |
|---|---|---|
| FR | Les reves regulent-ils nos emotions ? Ce que montre une etude 2026 | `reves-regulation-emotions-etude-2026` |
| EN | Do dreams regulate emotions? What a 2026 study found | `dreams-emotion-regulation-study-2026` |
| ES | Los suenos regulan las emociones? Lo que hallo un estudio de 2026 | `suenos-regulacion-emociones-estudio-2026` |
| DE | Regulieren Traeume unsere Gefuehle? Was eine Studie von 2026 zeigt | `traeume-emotionsregulation-studie-2026` |
| IT | I sogni regolano le emozioni? Cosa mostra uno studio del 2026 | `sogni-regolazione-emozioni-studio-2026` |

Source primaire: Baber et al., `Testing affect regulation theories of dreaming`, *Sleep*, volume 49, mai 2026, DOI `10.1093/sleep/zsag046`. L'article doit rapporter les 536 participants et 4 715 journees, distinguer continuite emotionnelle et regulation, expliquer les resultats peur/joie sans causalite, et exposer les limites: donnees observationnelles auto-rapportees, echantillon a 85,6 % feminin, contexte COVID et absence de mesures objectives du sommeil.

### Brief de la nouvelle vague jet lag

Dossier source prevu: `docs-src/content/blog/blog.jet-lag-sleep-dreams/`.

| Langue | Angle/titre de travail | Slug cible |
|---|---|---|
| FR | Decalage horaire, sommeil et reves: retrouver son rythme | `decalage-horaire-sommeil-reves` |
| EN | Jet lag, sleep and dreams: reset your rhythm | `jet-lag-sleep-dreams` |
| ES | Desfase horario, sueno y suenos: recuperar el ritmo | `desfase-horario-sueno-suenos` |
| DE | Jetlag, Schlaf und Traeume: den Rhythmus wiederfinden | `jetlag-schlaf-traeume` |
| IT | Jet lag, sonno e sogni: ritrovare il ritmo | `jet-lag-sonno-sogni` |

Structure minimale: reponse courte, mecanisme circadien explique sans surpromesse medicale, effet possible des reveils et du REM sur le rappel, routine avant/pendant/apres le voyage, methode de journalisation rapide, FAQ et sources primaires recentes. Chaque version doit etre adaptee a la langue et non traduite litteralement.

Regles de qualite pour toute la fin du mois:

- Ne pas allonger un article uniquement pour ajouter des mots; supprimer les repetitions et repondre d'abord a l'intention.
- Conserver un ton prudent sur la sante, distinguer association et causalite, et privilegier les sources primaires ou institutionnelles.
- Pour les refreshs, modifier seulement la langue justifiee par GSC et mesurer avant de generaliser aux cinq langues.
- Pour les nouvelles vagues, synchroniser `publishedTime`, `modifiedTime`, canonical, hreflang, JSON-LD, index blog et maillage reciproque.
- Ne pas lancer une troisieme nouvelle vague en juillet: la priorite 10 est reservee a la mesure et au choix du programme d'aout.

## Publication realisee - 6 juillet

Sujet publie: reves et sommeil en vacances.
Dossier source: `docs-src/content/blog/blog.vacation-sleep-dreams/`.

| Langue | Slug | URL live |
|---|---|---|
| FR | `vacances-sommeil-reves` | https://noctalia.app/fr/blog/vacances-sommeil-reves |
| EN | `vacation-sleep-dreams` | https://noctalia.app/en/blog/vacation-sleep-dreams |
| ES | `vacaciones-sueno-suenos` | https://noctalia.app/es/blog/vacaciones-sueno-suenos |
| DE | `urlaub-schlaf-traeume` | https://noctalia.app/de/blog/urlaub-schlaf-traeume |
| IT | `vacanze-sonno-sogni` | https://noctalia.app/it/blog/vacanze-sonno-sogni |

Maillage fait:

- Nouvel article vers canicule / heatwave, journee-sommeil-environnement / sleep-day-environment, guide journal de reves, comment se souvenir de ses reves.
- Articles canicule / heatwave et sleep-day-environment vers le nouvel article, avec contexte ete/voyage.
- Index blog de chaque langue mis a jour; `ItemList` JSON-LD resynchronise.

## Publications realisees - 8 juillet

### Bruit nocturne, sommeil et reves

Dossier source: `docs-src/content/blog/blog.night-noise-sleep-dreams/`.

| Langue | Slug | URL live | Search Console au 2026-07-10 |
|---|---|---|---|
| FR | `bruit-nocturne-sommeil-reves` | https://noctalia.app/fr/blog/bruit-nocturne-sommeil-reves | Submitted and indexed |
| EN | `night-noise-sleep-dreams` | https://noctalia.app/en/blog/night-noise-sleep-dreams | Submitted and indexed |
| ES | `ruido-nocturno-descanso-suenos` | https://noctalia.app/es/blog/ruido-nocturno-descanso-suenos | Submitted and indexed |
| DE | `naechtlicher-laerm-schlaf-traeume` | https://noctalia.app/de/blog/naechtlicher-laerm-schlaf-traeume | Submitted and indexed |
| IT | `rumore-notturno-sonno-sogni` | https://noctalia.app/it/blog/rumore-notturno-sonno-sogni | Submitted and indexed |

### Reveil nocturne et rappel des reves

Dossier source: `docs-src/content/blog/blog.night-waking-dream-recall/`.

| Langue | Slug | URL live | Search Console au 2026-07-10 |
|---|---|---|---|
| FR | `reveil-nocturne-rappel-reves` | https://noctalia.app/fr/blog/reveil-nocturne-rappel-reves | Submitted and indexed |
| EN | `night-waking-dream-recall` | https://noctalia.app/en/blog/night-waking-dream-recall | Submitted and indexed |
| ES | `despertares-nocturnos-recordar-suenos` | https://noctalia.app/es/blog/despertares-nocturnos-recordar-suenos | Submitted and indexed; derniere exploration 2026-07-11 12:33 UTC |
| DE | `naechtliches-erwachen-traumerinnerung` | https://noctalia.app/de/blog/naechtliches-erwachen-traumerinnerung | Submitted and indexed |
| IT | `risveglio-notturno-ricordo-sogni` | https://noctalia.app/it/blog/risveglio-notturno-ricordo-sogni | Submitted and indexed |

Maillage fait:

- Nouveaux articles visibles dans les index blog FR/EN/ES/DE/IT, avec `ItemList` JSON-LD resynchronise a 44 items par langue.
- Chaine editoriale mise a jour: vacances -> bruit nocturne -> reveil nocturne -> confidentialite IA.
- Liens contextuels ajoutes depuis vacances, sleep-day-environment, how-to-remember-dreams et REM sleep vers les nouveaux articles.

Prochaine action editoriale: reinspecter l'etude reves/emotions le 17 juillet sans renvoyer de demande manuelle, puis ouvrir la priorite 6, refresh ES eau/inondation, le 18 juillet. La vague `Jet lag, sommeil et reves` reste ciblee pour le 29 juillet.

Verification post-deploy 2026-07-08:

- Version live: `20260708-130244`.
- Les 10 URLs ci-dessus repondent 200.
- Sitemap live: 1150 URLs, incluant les 10 URLs du rattrapage.
- Search Console: sitemap soumis via API avec reponse 204; les nouvelles URLs sont en `URL is unknown to Google` ou `Discovered - currently not indexed`, normal juste apres publication. Reinspection a faire dans 24-48h.

Reinspection live et Search Console 2026-07-09:

- Les 15 URLs juillet repondent 200 et sont toutes presentes dans le sitemap live.
- Sitemap live: 1150 URLs, HTTP 200, `application/xml`.
- Search Console: 4 URLs `Submitted and indexed`; 10 URLs `unknown` ou `discovered` placees manuellement dans la file d'exploration prioritaire; 1 URL ES `Crawled - currently not indexed` a reinspecter sans nouvelle demande immediate.
- `version.txt` live renvoie `65a8d2c0ac15`, alors que `HEAD` et `origin/master` portent `20260708-130244`. Les deploys Cloudflare `3ab25163`, `1eecd869` et `4630cd15`, tous associes a la source `38d0bac`, servent ce marqueur ancien; le deploy precedent `4545dfab` sert bien `20260708-130244`. Le sitemap reste a 1150 URLs dans chaque deploy controle.
- Aucun nouvel article publie: la fenetre `Cauchemars en periode de chaleur ou stress` ouvre le 12 juillet; sa preparation est lancee ci-dessous sans deploy anticipe.

Reinspection live et Search Console 2026-07-10 a 16:08 CEST:

- Les 15 URLs juillet repondent 200 et sont toutes presentes dans le sitemap live.
- Sitemap live: 1155 URLs, HTTP 200, `application/xml`.
- Search Console: 14 URLs `Submitted and indexed`; seule l'URL ES `/es/blog/despertares-nocturnos-recordar-suenos` reste `Crawled - currently not indexed`, avec une derniere exploration le 2026-07-09 a 11:47 UTC.
- Le reliquat ES est techniquement sain: fetch Google reussi, robots autorise, canonical auto-reference et 6 hreflang reciproques dont `x-default`.
- Les 10 URLs placees en file prioritaire le 9 juillet sont maintenant indexees. Aucune URL ne reste `unknown` ou `discovered`; aucune nouvelle demande manuelle n'a ete envoyee.
- `version.txt` live renvoie `20260710-010011`. Aucun deploy n'a ete declenche par ce run.
- Aucun nouvel article produit: la fenetre `Cauchemars en periode de chaleur ou stress` ouvre le 12 juillet.

Reinspection live et Search Console 2026-07-12:

- Les 20 URLs juillet repondent 200 et sont toutes presentes dans le sitemap live.
- Sitemap live: 1160 URLs, HTTP 200, `application/xml`; apres le deploy Cloudflare `13c70708` de la source `863c4ba`, `version.txt` renvoie `2866f3066c1f`.
- Les 15 URLs de la vague initiale sont maintenant `Submitted and indexed`, y compris l'URL ES du reveil nocturne, exploree le 2026-07-11 a 12:33 UTC.
- Pour l'article cauchemars, FR/EN sont `Submitted and indexed`; ES/IT sont `URL is unknown to Google` et DE reste `Crawled - currently not indexed`, avec fetch reussi et robots autorise.
- Les demandes manuelles ES/DE/IT ont toutes ete confirmees dans l'UI Search Console et ajoutees a la file d'exploration prioritaire.
- Aucun nouvel article produit: l'article de la fenetre 12-15 juillet est deja live et le planning ne definit pas encore de priorite 5.

Reinspection live et Search Console 2026-07-13:

- Les 20 URLs juillet repondent 200 et sont toutes presentes dans le sitemap live.
- Sitemap live: 1160 URLs, HTTP 200, `application/xml`; `version.txt` renvoie toujours `2866f3066c1f`.
- Les 15 URLs de la vague initiale restent `Submitted and indexed`.
- Les cinq URLs de l'article cauchemars sont maintenant `Submitted and indexed`: ES et DE ont ete explorees le 2026-07-12 a 07:07:24 UTC, IT a 07:09:25 UTC.
- Aucune demande manuelle n'est necessaire. Aucun nouvel article n'est produit tant qu'une priorite 5 n'est pas definie.

Reinspection live et Search Console 2026-07-14:

- Les 20 URLs juillet repondent 200 et sont toutes presentes dans le sitemap live.
- Sitemap live: 1160 URLs, HTTP 200, `application/xml`; `version.txt` renvoie toujours `2866f3066c1f`.
- Les 20 URLs restent `Submitted and indexed`; pour chaque URL, le fetch Google reussit, les robots sont autorises et le canonical Google correspond au canonical declare.
- Aucune demande manuelle n'est necessaire. Les priorites 5 a 10 sont maintenant definies ci-dessus; commencer par l'article scientifique reves/emotions, puis le refresh ES eau/inondation.

Publication et reinspection live/Search Console 2026-07-15:

- Les 20 URLs deja publiees en juillet restent `Submitted and indexed`; fetch Google reussi, robots autorises et canonical Google conforme pour les 20.
- La priorite 5 est publiee en FR/EN/ES/DE/IT sur `master`; les cinq nouvelles URLs repondent 200 et sont presentes dans le sitemap live.
- Sitemap live: 1165 URLs, HTTP 200, `application/xml`; `version.txt` renvoie `20260715-100211`. Le sitemap a ete resoumis a Search Console avec une reponse 204.
- Inspection initiale des cinq nouvelles URLs: FR/EN/ES/DE `URL is unknown to Google`; IT `Discovered - currently not indexed`. Aucune demande manuelle le jour de publication; reinspecter apres 24-48 h, les 16-17 juillet.
- Validations passees: `docs:build`, `docs:check`, `docs:check-crosslinks` et `docs:release-check`, avec 0 lien casse et 0 avertissement de profondeur.
- Rapport: `marketing/seo/search-console/2026-07-15-july-url-inspection.md`.

Reinspection live et Search Console 2026-07-16:

- Les 15 URLs de la vague vacances/bruit nocturne/reveil nocturne restent `Submitted and indexed`; pour chacune, le fetch Google reussit, les robots sont autorises et le canonical Google correspond au canonical declare.
- Les cinq URLs de l'etude reves/emotions ne sont pas encore indexees: FR `URL is unknown to Google`, EN `Crawled - currently not indexed`, ES/DE/IT `Discovered - currently not indexed`.
- Les demandes manuelles FR/EN/ES/DE/IT ont toutes ete confirmees dans l'UI Search Console et ajoutees a la file d'exploration prioritaire.
- Les 25 URLs juillet repondent 200 et sont toutes presentes dans le sitemap live.
- Sitemap live: 1165 URLs, HTTP 200, `application/xml`; `version.txt` renvoie `86f0ad3eb034`.
- Aucun article produit: la priorite 6, refresh ES `Suenos de agua`, ouvre le 18 juillet.

Preparation editoriale de la priorite 5 le 2026-07-14:

- Worktree propre: `/private/tmp/dreamer-noctalia-dream-emotions-20260715`, branche `codex/noctalia-dream-emotions-20260715`, base `origin/master` `d54ffe2bd`.
- Cinq sources FR/EN/ES/DE/IT redigees et relues avec les passes `copywriting` et `copy-editing`; 966 a 1 261 mots selon la langue, reponse courte, methode, resultats, limites, journalisation, quatre FAQ, CTA et sources scientifiques.
- Source primaire: Baber et al., *Sleep* 2026, DOI `10.1093/sleep/zsag046`; l'article distingue continuite et regulation emotionnelles, association et causalite, et reprend les limites de l'editorial scientifique associe.
- Metadonnees SEO: titres de 52 a 59 caracteres, descriptions de 145 a 158 caracteres; dates synchronisees au 15 juillet. Le rendu en memoire confirme canonical auto-reference, six hreflang, `BlogPosting`, `FAQPage`, `datePublished` et `dateModified` dans les cinq langues.
- Maillage reciproque ajoute depuis les articles chaleur/stress et confidentialite IA; cartes placees en position 12 dans les cinq index et `ItemList` synchronise a 46 entrees.
- `npm run docs:check-crosslinks` passe. `npm run docs:build` bloque volontairement le 14 juillet car le gate refuse `publishedTime` et `modifiedTime` futurs; ne pas avancer les dates. Relancer build, check, crosslinks et release-check le 15 juillet avant publication.

Preparation editoriale anticipee le 2026-07-10:

- Worktree propre: `/private/tmp/dreamer-noctalia-nightmares-20260712`, branche `codex/noctalia-nightmares-20260712`, base `origin/master` `27d78bd71`.
- Cinq sources FR/EN/ES/DE/IT redigees sous `docs-src/content/blog/blog.heat-stress-nightmares/`; publication avancee au 10 juillet sur autorisation explicite de l'utilisateur.
- Angle valide: la chaleur peut fragmenter le sommeil et faciliter le rappel d'un cauchemar; elle n'est pas presentee comme une cause directe. Le stress est traite comme une association potentiellement bidirectionnelle.
- Maillage prepare depuis les articles canicule et guide cauchemars dans les cinq langues; cartes d'index en position 11 et `ItemList` portes a 45 items.
- Controle source passe: 1004 a 1170 mots selon la langue, quatre FAQ rendues en JSON-LD, canonical auto-reference et six hreflang verifies par rendu en memoire. `docs:check-crosslinks` passe avec les trois suggestions symboles non bloquantes connues.
- Dates `publishedTime` et `modifiedTime` avancees au 10 juillet dans les cinq langues et les pages de maillage; le contrat editorial passe sans exception.

Publication anticipee le 2026-07-10:

| Langue | URL live | Search Console au 2026-07-13 |
|---|---|---|
| FR | https://noctalia.app/fr/blog/cauchemars-chaleur-stress | Submitted and indexed; derniere exploration 2026-07-10 15:25:52 UTC |
| EN | https://noctalia.app/en/blog/heat-stress-nightmares | Submitted and indexed; derniere exploration 2026-07-10 16:59:27 UTC |
| ES | https://noctalia.app/es/blog/pesadillas-calor-estres | Submitted and indexed; derniere exploration 2026-07-12 07:07:24 UTC |
| DE | https://noctalia.app/de/blog/albtraeume-hitze-stress | Submitted and indexed; derniere exploration 2026-07-12 07:07:24 UTC |
| IT | https://noctalia.app/it/blog/incubi-caldo-stress | Submitted and indexed; derniere exploration 2026-07-12 07:09:25 UTC |

- Commit publie sur `master`: `5afeeb4f1`.
- Version Cloudflare Pages: `20260710-171822`.
- Les cinq URLs repondent 200 avec canonical auto-reference; le sitemap live contient 1160 URLs et les cinq nouvelles entrees.
- `npm run docs:build`, `npm run docs:check`, `npm run docs:check-crosslinks` et le `docs:release-check` de production passent. Controle externe: 0 lien casse, avec deux erreurs reseau transitoires ignorees par le gate.
- Sitemap resoumis a Search Console via API avec reponse 204. La demande FR a ete confirmee dans l'UI; Google a ensuite refuse la demande EN pour quota quotidien depasse.

## Ordre d'execution pour chaque nouvel article

1. Creer ou modifier uniquement `docs-src/content/blog/<article>/fr.md`, `en.md`, `es.md`, `de.md`, `it.md`.
2. Ajouter `publishedTime`, `modifiedTime`, canonical, hreflang, JSON-LD `datePublished` et `dateModified`.
3. Relier le nouvel article depuis au moins deux articles existants et ajouter un lien retour contextuel dans le nouvel article.
4. Mettre a jour les index blog par langue si le nouvel article doit etre visible dans la grille.
5. Lancer `npm run docs:build`, puis `npm run docs:check`, puis `npm run docs:check-crosslinks`.
6. Verifier `docs/sitemap.xml` pour les 5 URLs.
7. Apres deploy, soumettre les 5 URLs et le sitemap dans Search Console si elles ne passent pas automatiquement en `Submitted and indexed`.

## A surveiller

- Le marqueur live observe est `86f0ad3eb034`; le sitemap contient 1165 URLs. Ne pas deployer depuis le worktree principal actuellement tres charge; isoler explicitement les prochains changements editoriaux.
- Les 25 URLs de juin sont indexees; ne pas les retraiter comme blocantes.
- Le hub reve lucide doit afficher `lastmod` `2026-06-21` dans le sitemap genere.
- Les 20 URLs des priorites 1 a 4 sont indexees; ne plus les retraiter comme bloquantes et ne pas envoyer de nouvelle demande manuelle sans regression constatee.
- Les cinq URLs de la priorite 5 ont ete demandees manuellement le 16 juillet; reinspecter leur progression sans les resoumettre.
- Les priorites 5 a 10 couvrent desormais le 14 au 31 juillet. Respecter les fenetres, ouvrir le refresh ES eau/inondation le 18 juillet, publier la vague jet lag le 29 juillet et reserver les 30-31 juillet a la mesure plutot qu'a une nouvelle vague.
- Les suggestions non bloquantes de liens symboles dans les pages generiques EN/FR/ES peuvent rester hors sprint sauf si un run est dedie au maillage fin.
