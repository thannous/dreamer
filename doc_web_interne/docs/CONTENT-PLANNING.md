# Noctalia Content Planning - fin juin / juillet 2026

Source de verite editoriale: `docs-src/content/blog/`.
Sortie generee: `docs/`.
Langues suivies: FR, EN, ES, DE, IT.
Derniere prod connue: Cloudflare Pages `20260708-130244` via commit `d4f2e2d4e`.

## Etat editorial au 8 juillet 2026

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
| 8 juillet - Search Console vacances | En suivi | Sitemap soumis via API: `204`. Reinspection API 12:44 CEST: EN `Submitted and indexed`; FR/ES/DE/IT `Discovered - currently not indexed`. |
| 8 juillet - Article bruit nocturne / night noise | Publie dans les 5 langues | Live en prod `20260708-130244`; 5 URLs 200, presentes dans le sitemap live. |
| 8 juillet - Article reveil nocturne / night waking | Publie dans les 5 langues | Live en prod `20260708-130244`; 5 URLs 200, presentes dans le sitemap live. |
| 8 juillet - Search Console rattrapage juillet | En suivi | Sitemap soumis via API: `204`. Rapport local: `marketing/seo/search-console/2026-07-08-july-catchup-url-inspection.md`. |

Les 6 URLs qui avaient demande une indexation manuelle ne sont plus bloquantes. Les verifier seulement en spot-check Search Console si un futur deploy change leur contenu.

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

| Langue | URL | Date source | Etat live | Search Console au 2026-07-08 |
|---|---|---:|---|---|
| FR | https://noctalia.app/fr/blog/vacances-sommeil-reves | 2026-07-06 | 200 + sitemap live | Discovered - currently not indexed |
| EN | https://noctalia.app/en/blog/vacation-sleep-dreams | 2026-07-06 | 200 + sitemap live | Submitted and indexed |
| ES | https://noctalia.app/es/blog/vacaciones-sueno-suenos | 2026-07-06 | 200 + sitemap live | Discovered - currently not indexed |
| DE | https://noctalia.app/de/blog/urlaub-schlaf-traeume | 2026-07-06 | 200 + sitemap live | Discovered - currently not indexed |
| IT | https://noctalia.app/it/blog/vacanze-sonno-sogni | 2026-07-06 | 200 + sitemap live | Discovered - currently not indexed |

Le sitemap live a ete soumis a Search Console le 2026-07-08. EN sert de reference saine. Pour FR/ES/DE/IT, l'API ne permet pas de demander l'indexation manuelle: si besoin, utiliser l'UI Search Console "Request indexing", puis reinspecter dans 24-48h.

### Refresh creativite, resolution de problemes, reve lucide

| Cluster | FR | EN | ES | DE | IT | Indexation |
|---|---|---|---|---|---|---|
| Reves et creativite | `/fr/blog/reves-et-creativite` | `/en/blog/dreams-and-creativity` | `/es/blog/suenos-y-creatividad` | `/de/blog/traeume-und-kreativitaet` | `/it/blog/sogni-e-creativita` | Submitted and indexed |
| Controle des reves / problem solving | `/fr/blog/controler-reves-resolution-problemes` | `/en/blog/dream-control-problem-solving` | `/es/blog/controlar-suenos-resolucion-problemas` | `/de/blog/traumkontrolle-problemloesung` | `/it/blog/controllare-sogni-risoluzione-problemi` | Submitted and indexed |
| Hub reve lucide | `/fr/blog/reve-lucide` | `/en/blog/lucid-dreaming` | `/es/blog/suenos-lucidos` | `/de/blog/klares-traeumen-anleitungen-und-techniken` | `/it/blog/sogni-lucidi-guide-e-tecniche` | Submitted and indexed |

## Publications juillet 2026

| Priorite | Fenetre cible | Sujet | Statut | Intention SEO | Langues | Maillage interne prevu | Validation |
|---:|---|---|---|---|---|---|---|
| 1 | 1-3 juillet, publie le 6 juillet | Reves et sommeil en vacances | Publie/live; GSC en suivi | Saisonnier ete, voyage, changement de lit, reveil nocturne | FR, EN, ES, DE, IT | Heatwave, sleep-day-environment, dream journal, dream recall | Build/check faits dans le sprint; sitemap live OK |
| 2 | 4-7 juillet, rattrape le 8 juillet | Bruit nocturne, sommeil et reves | Publie/live; GSC en suivi | Requetes pratiques appartement, voisinage, ville, vacances | FR, EN, ES, DE, IT | Sleep-day-environment, vivid dreams, stress dreams, dream journal, vacation | Build/check/release-check faits; sitemap live OK |
| 3 | 8-11 juillet, produit le 8 juillet | Reveil nocturne et rappel des reves | Publie/live; GSC en suivi | Capture rapide, journal vocal, sommeil fragmente | FR, EN, ES, DE, IT | Voice dream journal, how to remember dreams, REM sleep, privacy article | Build/check/release-check faits; sitemap live OK |
| 4 | 12-15 juillet | Cauchemars en periode de chaleur ou stress | A venir | Angle ete + anxiete, utile pour maillage cauchemars/canicule | FR, EN, ES, DE, IT | Nightmares guide, heatwave, anxiety dreams, mental health | `npm run docs:build`, `npm run docs:check`, `npm run docs:check-crosslinks` |

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

| Langue | Slug | URL live | Search Console au 2026-07-08 |
|---|---|---|---|
| FR | `bruit-nocturne-sommeil-reves` | https://noctalia.app/fr/blog/bruit-nocturne-sommeil-reves | URL is unknown to Google |
| EN | `night-noise-sleep-dreams` | https://noctalia.app/en/blog/night-noise-sleep-dreams | URL is unknown to Google |
| ES | `ruido-nocturno-descanso-suenos` | https://noctalia.app/es/blog/ruido-nocturno-descanso-suenos | Discovered - currently not indexed |
| DE | `naechtlicher-laerm-schlaf-traeume` | https://noctalia.app/de/blog/naechtlicher-laerm-schlaf-traeume | Discovered - currently not indexed |
| IT | `rumore-notturno-sonno-sogni` | https://noctalia.app/it/blog/rumore-notturno-sonno-sogni | Discovered - currently not indexed |

### Reveil nocturne et rappel des reves

Dossier source: `docs-src/content/blog/blog.night-waking-dream-recall/`.

| Langue | Slug | URL live | Search Console au 2026-07-08 |
|---|---|---|---|
| FR | `reveil-nocturne-rappel-reves` | https://noctalia.app/fr/blog/reveil-nocturne-rappel-reves | URL is unknown to Google |
| EN | `night-waking-dream-recall` | https://noctalia.app/en/blog/night-waking-dream-recall | Discovered - currently not indexed |
| ES | `despertares-nocturnos-recordar-suenos` | https://noctalia.app/es/blog/despertares-nocturnos-recordar-suenos | URL is unknown to Google |
| DE | `naechtliches-erwachen-traumerinnerung` | https://noctalia.app/de/blog/naechtliches-erwachen-traumerinnerung | Discovered - currently not indexed |
| IT | `risveglio-notturno-ricordo-sogni` | https://noctalia.app/it/blog/risveglio-notturno-ricordo-sogni | URL is unknown to Google |

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

## Ordre d'execution pour chaque nouvel article

1. Creer ou modifier uniquement `docs-src/content/blog/<article>/fr.md`, `en.md`, `es.md`, `de.md`, `it.md`.
2. Ajouter `publishedTime`, `modifiedTime`, canonical, hreflang, JSON-LD `datePublished` et `dateModified`.
3. Relier le nouvel article depuis au moins deux articles existants et ajouter un lien retour contextuel dans le nouvel article.
4. Mettre a jour les index blog par langue si le nouvel article doit etre visible dans la grille.
5. Lancer `npm run docs:build`, puis `npm run docs:check`, puis `npm run docs:check-crosslinks`.
6. Verifier `docs/sitemap.xml` pour les 5 URLs.
7. Apres deploy, soumettre les 5 URLs et le sitemap dans Search Console si elles ne passent pas automatiquement en `Submitted and indexed`.

## A surveiller

- La prod connue est `20260708-130244`; ne plus utiliser `65a8d2c0ac15` ou `20260623-112558` comme reference courante hors historique.
- Les 25 URLs de juin sont indexees; ne pas les retraiter comme blocantes.
- Le hub reve lucide doit afficher `lastmod` `2026-06-21` dans le sitemap genere.
- Les URLs vacances FR/ES/DE/IT et les 10 URLs du rattrapage 8 juillet doivent etre reinspectees dans Search Console 24-48h apres la resoumission sitemap du 2026-07-08.
- Les suggestions non bloquantes de liens symboles dans les pages generiques EN/FR/ES peuvent rester hors sprint sauf si un run est dedie au maillage fin.
