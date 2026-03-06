# Audit SEO organique Noctalia — 6 mars 2026

## Diagnostic global

- Problème principal business : **CTR / click capture** trop faible sur des pages déjà visibles.
- Problème technique principal : **consolidation incomplète entre clean URLs et `.html`**.
- ES = principal moteur de croissance.
- FR = meilleur terrain de quick wins CTR.
- EN science = potentiel réel, mais à rentabiliser avant d’étendre le cluster.

## Priorités pages

| Page | Requête cible principale | Problème | Action recommandée | Priorité | Impact |
|---|---|---|---|---|---|
| /es/blog/suenos-de-muerte | qué significa soñar con la muerte | Page 1, 0 clic, angle trop vague | Refaire title/meta, intro en réponse directe, H2 scénarios, liens depuis muerte/persona-fallecida | P0 | Très élevé |
| /es/blog/suenos-con-ex | qué significa soñar con tu ex / por qué sueño con mi ex | Split clean/.html + title trop abstrait | Consolider URL, retitle en question directe, FAQ exactes, liens depuis ex-pareja | P0 | Très élevé |
| /es/blog/suenos-de-agua | qué significa soñar que te inundas | Angle trop large, terme “inundas” absent | Ajouter H2 sur inundación/casa inundada/ahogarse, retitle plus exact, liens cluster eau | P0 | Élevé |
| /es/blog/suenos-de-caer | qué significa soñar que caes al vacío | Bonne base, promesse SERP trop faible | Renforcer title/meta, réponse directe en tête, liens depuis caída/acantilado/ascensor | P1 | Élevé |
| /es/blog/como-recordar-suenos | cómo recordar los sueños al despertar | Contenu bon mais promesse SERP perfectible | Accentuer “al despertar”, FAQ délai 1–2 semaines, lier au guide journal | P1 | Moyen+ |
| /es/blog/suenos-de-volar | qué significa soñar que vuelas en el aire | Intent bien couvert mais wording pas assez exact | Inclure “vuelas en el aire” dans title/FAQ, liens depuis avión/volar/pájaro | P1 | Moyen+ |
| /es/guides/diccionario-simbolos-suenos | símbolos de sueños | Cible correcte mais SERP très liste/dictionnaire | Renforcer “A–Z + 50+ símbolos”, ajouter module “símbolos más buscados” | P2 | Moyen |
| /en/blog/precognitive-dreams-science | confirmation bias / percentage of people… | Très forte visibilité, promesse trop “mystery” | Recentrer sur science/statistics/bias, tableau de surveys, H2 exacts, liens cluster science | P0 | Très élevé |
| /en/blog/dream-journal-guide | how to start a dream journal | Intent mixte + résidu `.html` + hub/guide flous | Laisser le hub porter “dream journal”, positionner le guide sur “how to start / what to write” | P1 | Moyen |
| /en/blog/dream-interpretation-history | history of dream interpretation | Bon support, pas un quick win CTR | Rewriter snippet, utiliser en soutien vers cluster science | P2 | Moyen |
| /en/blog/dream-incubation-guide | dream incubation techniques | Niche, plutôt page support | Garder, optimiser léger, lier vers precognitive + dream journal | P2 | Moyen-faible |
| /fr/blog/comment-se-souvenir-de-ses-reves | se souvenir de ses rêves / se rappeler | Clean URL sous-performe face au `.html` | Corriger consolidation, ajouter synonymes “se rappeler”, renforcer liens FR | P0 | Élevé |
| /fr/blog/guide-journal-reves | tenir un journal de rêves | Le head term devrait être porté par le hub FR | Repositionner le guide sur débutant/how-to, le hub sur head term | P1 | Moyen |

## Corrections `.html`

1. Vérifier tous les top duplicats en prod : single 301, pas de chaîne, destination finale canonique.
2. Purger toutes les références internes `.html` : nav, footer, cartes “related”, hreflang, templates.
3. Vérifier que sitemap et hreflang pointent uniquement vers les clean URLs.
4. Inspecter dans GSC les groupes prioritaires :
   - /es/blog/suenos-con-ex(.html)
   - /es/blog/suenos-de-agua(.html)
   - /fr/blog/comment-se-souvenir-de-ses-reves(.html)
   - /en/blog/dream-interpretation-history(.html)
5. Re-soumettre le sitemap après correction.
6. Monitorer 14 à 28 jours après correction.

## Plan de maillage interne

### ES
- /es/simbolos/muerte, /es/simbolos/persona-fallecida -> /es/blog/suenos-de-muerte
- /es/simbolos/ex-pareja -> /es/blog/suenos-con-ex
- /es/simbolos/agua, /es/simbolos/inundacion, /es/simbolos/oceano, /es/simbolos/nadar -> /es/blog/suenos-de-agua
- /es/simbolos/caida, /es/simbolos/acantilado, /es/simbolos/ascensor -> /es/blog/suenos-de-caer
- /es/simbolos/avion, /es/simbolos/volar, /es/simbolos/pajaro -> /es/blog/suenos-de-volar
- /es/blog/como-recordar-suenos <-> /es/blog/guia-diario-suenos <-> /es/blog/por-que-olvidamos-suenos

### EN
- /en/blog/why-we-dream-science, /en/blog/dream-interpretation-history, /en/blog/dream-incubation-guide -> /en/blog/precognitive-dreams-science
- /en/blog/how-to-remember-dreams, /en/blog/why-we-forget-dreams, /en/blog/dream-journal -> /en/blog/dream-journal-guide

### FR
- /fr/blog/journal-de-reves -> /fr/blog/guide-journal-reves
- /fr/blog/comment-se-souvenir-de-ses-reves -> /fr/blog/guide-journal-reves
- /fr/blog/guide-journal-reves -> /fr/blog/comment-se-souvenir-de-ses-reves

## Plan 30 / 60 / 90 jours

### 0–30 jours
- Corriger `.html`
- Réécrire 8 snippets prioritaires
- Ajouter H2/FAQ exactes sur ES/EN/FR prioritaires
- Ajouter 10–15 liens internes contextuels sur ES
- Relever baseline GSC par page

### 31–60 jours
- Mesurer CTR + position + clics
- Ajuster snippets sur base des requêtes qui bougent
- Repositionner clairement hubs vs guides FR/EN dream journal
- Renforcer E-E-A-T visible sur EN science

### 61–90 jours
- Décider si le cluster EN science mérite expansion
- Ouvrir 1 nouveau contenu max si les données le justifient encore
- Étendre le modèle gagnant ES aux meilleurs symboles / rêves récurrents
