# Noctalia Content Planning - fin juin / juillet 2026

Source de verite editoriale: `docs-src/content/blog/`.
Sortie generee: `docs/`.
Langues suivies: FR, EN, ES, DE, IT.
Derniere publication SEO connue: Cloudflare Pages `20260710-171822` via commit `5afeeb4f1`.
Controle live du 2026-07-10 apres publication anticipee: `version.txt` renvoie `20260710-171822`, le sitemap live contient 1160 URLs et les 5 nouvelles URLs repondent 200.

## Etat editorial au 10 juillet 2026

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

Les 6 URLs de juin qui avaient demande une indexation manuelle ne sont plus bloquantes. Pour juillet, les 10 demandes envoyees le 9 juillet ont abouti; reinspecter uniquement l'URL ES deja exploree avant la prochaine publication.

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
| 3 | 8-11 juillet, produit le 8 juillet | Reveil nocturne et rappel des reves | Publie/live; 4/5 indexees, 1 recheck ES | Capture rapide, journal vocal, sommeil fragmente | FR, EN, ES, DE, IT | Voice dream journal, how to remember dreams, REM sleep, privacy article | Build/check/release-check faits; sitemap live OK |
| 4 | 12-15 juillet, anticipe le 10 juillet | Cauchemars en periode de chaleur ou stress | Publie/live; sitemap soumis, FR en file prioritaire, 4 demandes en suivi | Angle ete + anxiete, utile pour maillage cauchemars/canicule | FR, EN, ES, DE, IT | Nightmares guide, heatwave, anxiety dreams, mental health | Build/check/release-check/crosslinks passes; sitemap live 1160 URLs |

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
| ES | `despertares-nocturnos-recordar-suenos` | https://noctalia.app/es/blog/despertares-nocturnos-recordar-suenos | Crawled - currently not indexed; derniere exploration 2026-07-09 11:47 UTC |
| DE | `naechtliches-erwachen-traumerinnerung` | https://noctalia.app/de/blog/naechtliches-erwachen-traumerinnerung | Submitted and indexed |
| IT | `risveglio-notturno-ricordo-sogni` | https://noctalia.app/it/blog/risveglio-notturno-ricordo-sogni | Submitted and indexed |

Maillage fait:

- Nouveaux articles visibles dans les index blog FR/EN/ES/DE/IT, avec `ItemList` JSON-LD resynchronise a 44 items par langue.
- Chaine editoriale mise a jour: vacances -> bruit nocturne -> reveil nocturne -> confidentialite IA.
- Liens contextuels ajoutes depuis vacances, sleep-day-environment, how-to-remember-dreams et REM sleep vers les nouveaux articles.

Prochaine publication editoriale: cauchemars en periode de chaleur ou stress, fenetre cible 12-15 juillet.

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

Preparation editoriale anticipee le 2026-07-10:

- Worktree propre: `/private/tmp/dreamer-noctalia-nightmares-20260712`, branche `codex/noctalia-nightmares-20260712`, base `origin/master` `27d78bd71`.
- Cinq sources FR/EN/ES/DE/IT redigees sous `docs-src/content/blog/blog.heat-stress-nightmares/`; publication avancee au 10 juillet sur autorisation explicite de l'utilisateur.
- Angle valide: la chaleur peut fragmenter le sommeil et faciliter le rappel d'un cauchemar; elle n'est pas presentee comme une cause directe. Le stress est traite comme une association potentiellement bidirectionnelle.
- Maillage prepare depuis les articles canicule et guide cauchemars dans les cinq langues; cartes d'index en position 11 et `ItemList` portes a 45 items.
- Controle source passe: 1004 a 1170 mots selon la langue, quatre FAQ rendues en JSON-LD, canonical auto-reference et six hreflang verifies par rendu en memoire. `docs:check-crosslinks` passe avec les trois suggestions symboles non bloquantes connues.
- Dates `publishedTime` et `modifiedTime` avancees au 10 juillet dans les cinq langues et les pages de maillage; le contrat editorial passe sans exception.

Publication anticipee le 2026-07-10:

| Langue | URL live | Search Console juste apres publication |
|---|---|---|
| FR | https://noctalia.app/fr/blog/cauchemars-chaleur-stress | Exploree, actuellement non indexee; derniere exploration 2026-07-10 15:25:52 UTC; demande manuelle confirmee |
| EN | https://noctalia.app/en/blog/heat-stress-nightmares | Detectee, actuellement non indexee; demande manuelle bloquee par le quota quotidien |
| ES | https://noctalia.app/es/blog/pesadillas-calor-estres | Detectee, actuellement non indexee; demande manuelle a retenter le 11 juillet si necessaire |
| DE | https://noctalia.app/de/blog/albtraeume-hitze-stress | Detectee, actuellement non indexee; demande manuelle a retenter le 11 juillet si necessaire |
| IT | https://noctalia.app/it/blog/incubi-caldo-stress | URL inconnue dans l'API; demande manuelle a retenter le 11 juillet si necessaire |

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

- Le marqueur live est passe a `20260710-171822` et le sitemap a 1160 URLs. Ne pas deployer depuis le worktree principal actuellement tres charge; isoler explicitement les prochains changements editoriaux.
- Les 25 URLs de juin sont indexees; ne pas les retraiter comme blocantes.
- Le hub reve lucide doit afficher `lastmod` `2026-06-21` dans le sitemap genere.
- Reinspecter l'URL ES `/es/blog/despertares-nocturnos-recordar-suenos`, actuellement `Crawled - currently not indexed`, le 11 juillet ou avant la publication suivante.
- Reinspecter les 5 URLs cauchemars le 11 juillet. Si EN/ES/DE/IT ne progressent pas, retenter leur demande manuelle apres reinitialisation du quota Search Console; ne pas redemander FR, deja en file prioritaire.
- Les suggestions non bloquantes de liens symboles dans les pages generiques EN/FR/ES peuvent rester hors sprint sauf si un run est dedie au maillage fin.
