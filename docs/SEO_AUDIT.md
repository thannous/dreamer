# Audit SEO (docs/) — Noctalia

**Date:** 2026-02-02  
**Portée:** site complet (home + blog + guides + symboles) — EN/FR/ES/DE/IT  
**Hébergement cible:** Cloudflare Pages (source de vérité: `_headers`, `_redirects`)  
**Domaine canonique:** `https://noctalia.app`

---

## Résumé (état de santé)

Le site statique `docs/` est globalement **solide** sur les fondamentaux SEO techniques:

- Crawlabilité: `robots.txt` permissif + `sitemap.xml` présent.
- Indexation: URLs propres (sans `.html`) + canonicals + hreflang cohérents.
- Maillage interne: pas de liens internes cassés détectés localement.
- Données pSEO: symboles/catégories/curations générés de manière cohérente (5 langues).

**Correctifs appliqués dans ce repo lors de l’audit (P0):**
- Alignement de `data/dream-symbols.json` (`meta.totalSymbols`) avec la réalité (57 symboles).
- Renforcement de `scripts/check-site.js`:
  - validation complète EN/FR/ES/DE/IT (pas seulement EN/FR/ES),
  - parsing robuste des attributs HTML (canonical/hreflang/meta robots),
  - vérifications supplémentaires: `<title>`, meta description, canonical manquants (hors pages noindex/utilitaires).

---

## Méthodologie & commandes de validation

### Gate local (recommandé avant chaque déploiement)
```bash
node scripts/check-site.js
```

Sortie attendue:
- `errors: 0`
- `warnings: 0` idéalement (sinon: à trier/corriger avant release)

Le script valide notamment:
- liens internes (href/src) + ancres,
- canonicals vs URL attendue,
- hreflang -> fichiers réels,
- pages symboles/catégories/curation attendues selon les données,
- cohérence `sitemap.xml` -> fichiers réels.

---

## Constats techniques

### 1) Crawlabilité

**robots.txt**
- `Allow: /` + `Sitemap: https://noctalia.app/sitemap.xml` ✅

**Sitemap**
- `sitemap.xml` contient des URLs sur les 5 langues (top dirs: `en`, `fr`, `es`, `de`, `it`) ✅
- Les URLs pointent vers des chemins “clean” (pas de `.html`) ✅

### 2) Redirects & normalisation (Cloudflare Pages)

**`_redirects`**
- Redirections `.html` -> URLs propres (301) ✅
- Normalisation http/www -> https non-www (quand supporté) ✅
- Redirects legacy (diacritiques FR, slugs historiques) ✅

### 3) Headers (Cloudflare Pages)

**`_headers`**
- Cache-control cohérent (assets immutables versionnés, HTML revalidé) ✅
- `X-Robots-Tag: noindex` sur pages utilitaires (ex: `/templates/*`, `/auth/callback/*`, `/404*`) ✅
- Headers de sécurité de base (`nosniff`, `SAMEORIGIN`, `Referrer-Policy`) ✅

**Recommandation (P2):**
- Ajouter HSTS uniquement si tout le trafic est strictement HTTPS et si la config est gérée au bon niveau (Cloudflare / Pages).

---

## Constats on-page

### 1) Titles & meta descriptions

- Présence de `<title>` sur les pages indexables ✅
- Présence de meta description sur les pages indexables ✅
- Unicité globale détectée (pas de duplicats évidents) ✅

### 2) Canonicalisation & hreflang

- Canonicals présents et alignés avec les URLs attendues (`https://noctalia.app/<lang>/...`) ✅
- Hreflang présents et résolvables vers des fichiers existants ✅
- `x-default` présent ✅

**Note:**
- La page racine `index.html` est un stub de redirection langue et est `noindex, follow` (cohérent si l’objectif est d’éviter l’indexation du sélecteur).

---

## Structured data (JSON-LD)

Constat par échantillonnage:
- Home: `Organization`, `WebSite`, `FAQPage` ✅
- Blog index: `Blog` + `ItemList` ✅
- Pages symboles: `DefinedTerm` + `Article` + `BreadcrumbList` + `FAQPage` ✅

**Recommandations (P1):**
- Valider un échantillon via Rich Results Test / Schema Validator (hors repo).
- Vérifier que la FAQ visible correspond toujours au JSON-LD (éviter FAQ “cachée”).

---

## Qualité pSEO & maillage interne

Points positifs:
- Pages symboles/catégories/curations structurées et reliées (hub-and-spoke) ✅
- Variantes + interprétation enrichie disponibles (via `data/dream-symbols-extended.json`) ✅

Recommandations (P1/P2):
- Éviter toute “thin page” (garder une interprétation substantielle par symbole et par langue).
- Renforcer les liens contextuels depuis le blog vers des symboles pertinents (quand absence de liens).

---

## Plan d’actions (priorisé)

### P0 — Bloquants / intégrité
- [x] Mettre `meta.totalSymbols` en cohérence avec `symbols.length` (`data/dream-symbols.json`).
- [x] Renforcer `scripts/check-site.js` et l’utiliser comme gate avant déploiement.

### P1 — Impact ranking/CTR
- [ ] Vérifier via Search Console: indexation, erreurs couverture, performances, hreflang (hors repo).
- [ ] Mesurer CWV (PageSpeed / WebPageTest) sur: home, blog index, 2 articles, 2 pages symboles.
- [ ] Confirmer que la page `x-default` (sélecteur) ne nuit pas au cluster hreflang (monitoring GSC).

### P2 — Maintenabilité / clarté
- [ ] Documenter clairement la “source de vérité” de déploiement (Cloudflare Pages) vs `vercel.json` (si conservé).
- [ ] Clarifier/déprécier les scripts ponctuels d’édition sitemap au profit d’un workflow unique.
