# Analyse Search Console - Noctalia

**Date:** 2026-03-06  
**Source:** export Google Search Console `Les 3 derniers mois`  
**Fichiers analysés:** `Graphique.csv`, `Pages.csv`, `Requêtes.csv`, `Pays.csv`, `Appareils.csv`

## Résumé exécutif

Noctalia gagne en visibilité, mais pas encore en clics.

- Total site (graph export): **162 clics**, **66 230 impressions**, **CTR 0,24%** sur les 3 derniers mois.
- L'explosion de visibilité s'est faite surtout en **janvier et février 2026**, mais le CTR reste très bas.
- La traction la plus nette vient de **l'espagnol** en volume, du **français** en CTR, et de quelques pages **EN science/education** qui génèrent beaucoup d'impressions mais presque aucun clic.
- Le site a un socle technique correct, mais Search Console fait remonter deux vrais freins:
  - **CTR/snippets trop faibles** sur des pages déjà visibles en page 1.
  - **consolidation incomplète entre URLs propres et URLs `.html`**.

## Contexte et limites de lecture

- Les exports **pages** et **requêtes** sont séparés par Google Search Console. Les recoupements page <-> requête ci-dessous sont donc **des inférences**, pas des appariements exacts.
- Les totaux diffèrent légèrement selon l'export:
  - `Graphique.csv`: 162 clics / 66 230 impressions
  - `Pages.csv`: 163 clics / 67 113 impressions
- Cette différence est normale sur les exports GSC.

## Vue d'ensemble

### Evolution mensuelle

| Mois | Clics | Impressions | CTR | Position moyenne pondérée |
| --- | ---: | ---: | ---: | ---: |
| 2025-12 | 15 | 2 706 | 0,55% | 23,14 |
| 2026-01 | 55 | 30 774 | 0,18% | 13,29 |
| 2026-02 | 76 | 27 610 | 0,28% | 19,75 |
| 2026-03 | 16 | 5 140 | 0,31% | 17,09 |

Lecture:

- La visibilité a fortement décollé après décembre.
- La prochaine étape n'est plus seulement l'indexation: c'est la **conversion impression -> clic**.

### Par appareil

| Appareil | Clics | Impressions | CTR | Position |
| --- | ---: | ---: | ---: | ---: |
| Mobile | 115 | 33 946 | 0,34% | 10,0 |
| Ordinateur | 46 | 30 447 | 0,15% | 24,4 |
| Tablette | 1 | 1 837 | 0,05% | 12,1 |

Lecture:

- Le site est clairement **plus performant sur mobile**.
- Le desktop a une visibilité élevée, mais une position moyenne beaucoup plus faible.

### Par langue d'apres l'export pages

| Langue | Clics | Impressions | CTR |
| --- | ---: | ---: | ---: |
| ES | 65 | 25 861 | 0,25% |
| EN | 32 | 31 659 | 0,10% |
| FR | 52 | 5 659 | 0,92% |
| IT | 11 | 2 814 | 0,39% |
| DE | 3 | 1 094 | 0,27% |

Lecture:

- **Espagnol**: meilleur levier de croissance en volume.
- **Français**: faible volume mais bien meilleur CTR. C'est le meilleur terrain de quick wins.
- **Anglais**: énorme visibilité, mais CTR très faible. Le problème est surtout un problème d'intention/snippet.

## Ce qui fonctionne deja

### 1. Les clusters "interpretation de reves" en espagnol

Les pages qui performent le mieux confirment la strategie editoriale historique sur les sujets de reves courants:

| Page | Clics | Impressions | CTR | Position |
| --- | ---: | ---: | ---: | ---: |
| `https://noctalia.app/es/simbolos/puerta` | 6 | 1 443 | 0,42% | 8,84 |
| `https://noctalia.app/es/simbolos/hospital` | 6 | 1 308 | 0,46% | 8,26 |
| `https://noctalia.app/es/blog/suenos-de-volar` | 5 | 1 704 | 0,29% | 9,67 |
| `https://noctalia.app/es/guides/diccionario-simbolos-suenos` | 6 | 750 | 0,80% | 10,51 |
| `https://noctalia.app/es/blog/historia-interpretacion-suenos` | 4 | 942 | 0,42% | 8,77 |

Conclusion:

- Les **pages symboles**, les **guides dictionnaire**, et les **articles d'interpretation grand public** sont les formats qui convertissent le mieux la visibilite en clics.

### 2. Le francais convertit mieux

Le FR confirme qu'il y a un vrai potentiel de CTR quand l'intention est bien couverte:

| Page | Clics | Impressions | CTR | Position |
| --- | ---: | ---: | ---: | ---: |
| `https://noctalia.app/fr/` | 10 | 164 | 6,10% | 7,48 |
| `https://noctalia.app/fr/blog/` | 6 | 50 | 12,00% | 4,66 |
| `https://noctalia.app/fr/blog/histoire-interpretation-reves` | 5 | 189 | 2,65% | 11,30 |
| `https://noctalia.app/fr/blog/reves-dents-qui-tombent` | 5 | 201 | 2,49% | 22,33 |

Conclusion:

- Le FR est aujourd'hui le meilleur terrain pour faire progresser vite le CTR sur des pages deja visibles.

### 3. Les contenus education/science rankent, mais captent mal le clic

Exemple principal:

| Page | Clics | Impressions | CTR | Position |
| --- | ---: | ---: | ---: | ---: |
| `https://noctalia.app/en/blog/precognitive-dreams-science` | 1 | 12 213 | 0,01% | 8,51 |

Conclusion:

- Le site a deja la capacite de se positionner sur des sujets plus "research".
- En revanche, ces pages ne transforment pas la visibilite en trafic.

## Requetes qui tirent la visibilite

L'export requetes montre une tres forte dispersion:

- **987 requetes ont 0 clic**
- **13 requetes ont 1 clic**

Cela signifie que le site est deja visible sur beaucoup de longues traines, mais sans encore dominer assez fort pour capter le clic.

### Requetes a fort potentiel

Ce sont les meilleures opportunites: beaucoup d'impressions, positions correctes, CTR nul.

| Requete | Impressions | CTR | Position |
| --- | ---: | ---: | ---: |
| `confirmation bias in precognitive dreams` | 220 | 0,00% | 7,30 |
| `percentage of people who report precognitive dreams` | 189 | 0,00% | 7,15 |
| `confirmation bias precognitive dreams` | 126 | 0,00% | 7,50 |
| `precognitive dreams confirmation bias` | 72 | 0,00% | 7,28 |
| `percentage of people who report precognitive dreams surveys` | 65 | 0,00% | 6,97 |
| `soñar que se caen las muelas` | 68 | 0,00% | 1,00 |
| `que significa soñar que vuelas en el aire` | 48 | 0,00% | 1,00 |
| `que significa cuando sueñas con tu ex` | 46 | 0,00% | 5,00 |
| `porque sueño con mi ex` | 41 | 0,00% | 5,88 |
| `que significa soñar que te inundas` | 42 | 0,00% | 1,00 |
| `psicoanálisis de soñar con hospital` | 37 | 0,00% | 6,97 |
| `simbolos de sueños` | 29 | 0,00% | 8,66 |

Lecture:

- Le cluster **precognitive dreams** a un vrai volume SEO en EN.
- Les requetes ES sont tres bien placees, parfois **en position 1**, mais le snippet n'incite pas assez au clic.

## Pages sous-performantes

### Pages avec beaucoup d'impressions mais trop peu de clics

| Page | Clics | Impressions | CTR | Position | Diagnostic |
| --- | ---: | ---: | ---: | ---: | --- |
| `/en/blog/precognitive-dreams-science` | 1 | 12 213 | 0,01% | 8,51 | Intention mal captee. Le SERP semble chercher des stats / preuves / biais cognitifs. |
| `/es/blog/suenos-de-muerte` | 0 | 3 978 | 0,00% | 2,08 | Tres bien classee mais snippet trop faible ou trop vague. |
| `/en/blog/dream-journal-guide` | 0 | 1 940 | 0,00% | 14,81 | Sujet valide, mais page trop basse et peu differenciee. |
| `/es/blog/suenos-con-ex` et `/es/blog/suenos-con-ex.html` | 1 | 1 797 cumulees | 0,06% | 1,44 a 13,83 | Fort probleme de duplication et de formulation du snippet. |
| `/es/blog/suenos-de-agua` et `/es/blog/suenos-de-agua.html` | 0 | 1 484 cumulees | 0,00% | 4,33 a 4,72 | Sujet visible, mais angle trop generique. |
| `/es/blog/como-recordar-suenos` | 1 | 1 154 | 0,09% | 9,71 | Bon sujet, mais le snippet ne repond pas assez directement a la requete. |
| `/es/blog/suenos-de-caer` | 0 | 1 091 | 0,00% | 6,99 | Fort potentiel SEO, mais faible promesse en SERP. |
| `/en/blog/dream-interpretation-history` | 8 cumules | 2 944 cumulees | 0,27% | 10,17 a 11,66 | Bon levier top-of-funnel, mais le title peut coller davantage a la requete. |

### Signal technique prioritaire: duplication `.html`

L'export pages fait remonter un probleme de consolidation:

- **37 groupes dupliques** entre URL propre et URL `.html`
- **3 067 impressions** et **11 clics** sur les seules variantes `.html`
- Les groupes touches representent **19 610 impressions** et **52 clics** cumules

Exemples notables:

| URL normalisee | Impressions cumulees | Impressions sur `.html` |
| --- | ---: | ---: |
| `/es/blog/suenos-con-ex` | 1 797 | 1 146 |
| `/fr/blog/comment-se-souvenir-de-ses-reves` | 744 | 429 |
| `/es/blog/suenos-de-agua` | 1 484 | 356 |
| `/en/blog/lucid-dreaming-beginners-guide` | 925 | 209 |
| `/en/blog/dream-interpretation-history` | 2 944 | 132 |

Interpretation:

- Le fichier [`docs/_redirects`](../_redirects) contient bien des regles `.html -> URL propre`.
- Search Console montre cependant que Google traite encore ces variantes comme des URLs visibles dans les resultats.
- Il faut donc considerer ce point comme **un sujet SEO actif**, pas comme un detail purement theorique.

## Plan d'action SEO

## P0 - 7 jours

### 1. Consolider les URLs `.html`

Actions:

- Verifier dans Search Console l'inspection d'URL sur les pages dupliquees les plus visibles:
  - `/es/blog/suenos-con-ex.html`
  - `/es/blog/suenos-de-agua.html`
  - `/fr/blog/comment-se-souvenir-de-ses-reves.html`
  - `/en/blog/dream-interpretation-history.html`
- Confirmer que la version `.html` fait bien un **301 unique** vers l'URL propre.
- Verifier qu'aucun lien interne, hreflang ou asset ne renvoie encore vers une version `.html`.
- Resoumettre le sitemap apres validation.

Impact attendu:

- Recuperer une partie des impressions et clics aujourd'hui fragmentes.

### 2. Refaire les snippets des pages deja visibles en page 1

Priorite immediate:

- `/es/blog/suenos-de-muerte`
- `/es/blog/suenos-con-ex`
- `/es/blog/suenos-de-agua`
- `/es/blog/suenos-de-caer`
- `/es/blog/como-recordar-suenos`
- `/en/blog/precognitive-dreams-science`

Impact attendu:

- C'est le levier le plus rapide pour transformer la visibilite deja acquise en trafic.

## P1 - 14 jours

### 3. Ajouter des H2/FAQ qui reprennent les requetes exactes

Exemples:

- `¿Qué significa soñar con tu ex?`
- `¿Por qué sueño con mi ex?`
- `¿Qué significa soñar que te inundas?`
- `¿Qué significa soñar que vuelas en el aire?`
- `How common are precognitive dreams?`
- `What percentage of people report precognitive dreams?`
- `What is confirmation bias in precognitive dreams?`

Impact attendu:

- Meilleur alignement avec l'intention visible dans Search Console.
- Plus de chances d'obtenir des snippets plus saillants et des FAQ enrichies.

### 4. Renforcer le maillage vers les winners SEO

Le document [`LINK_OPPORTUNITIES_2026-03-06.md`](./LINK_OPPORTUNITIES_2026-03-06.md) est directionnellement bon, mais il faut concentrer le jus SEO sur les pages deja visibles:

- pousser plus fort `/es/blog/suenos-de-volar`
- pousser `/es/blog/suenos-de-agua`
- pousser `/es/blog/suenos-con-ex`
- pousser `/en/blog/dream-journal-guide`

Actions:

- Ajouter des liens contextuels depuis les pages symboles proches.
- Ajouter depuis les hubs guides et blog index des liens plus visibles vers ces pages.
- Ajouter des liens depuis la home vers quelques symboles/pages a fort potentiel, comme suggere dans [`INTERNAL_LINKING.md`](./INTERNAL_LINKING.md).

## P2 - 30 jours

### 5. Traiter le cluster "precognitive dreams" comme un cluster editorial a part

Aujourd'hui, le sujet ranke deja, mais ne convertit pas.

Deux options:

- **Option acquisition SEO:** assumer que ce sujet sert le top-of-funnel et optimiser l'article autour des requetes stats/biais cognitifs.
- **Option focus produit:** garder le sujet en second plan si ces visiteurs convertissent mal vers l'app.

Si vous gardez l'option acquisition:

- ajouter un bloc "What studies say"
- ajouter des donnees, pourcentages, syntheses de surveys
- expliciter "confirmation bias", "law of large numbers", "how common is it?"

### 6. Renforcer l'E-E-A-T sur science / sante mentale / sommeil

Le constat de [`EEAT_TRUST_SIGNALS.md`](./EEAT_TRUST_SIGNALS.md) est coherent avec les pages EN qui impressionnent mais ne convainquent pas:

- pas d'auteur personne visible
- pas de "reviewed by"
- peu de signaux editoriaux visibles en SERP

Actions:

- ajouter auteur humain
- ajouter bio courte
- ajouter "reviewed by" sur les pages les plus sensibles
- renforcer les citations directement dans le corps de texte

## Recommandations concretes de titles/meta

### Pages prioritaires

| Page | Proposition de title | Proposition de meta description |
| --- | --- | --- |
| `/en/blog/precognitive-dreams-science` | `Precognitive Dreams: Science, Statistics, and Confirmation Bias | Noctalia` | `Can dreams predict the future? Explore what studies, surveys, and confirmation bias actually show, plus how common precognitive dreams really are.` |
| `/es/blog/suenos-de-muerte` | `¿Qué significa soñar con la muerte? Cambio, miedo y transformación | Noctalia` | `Descubre por qué soñar con la muerte rara vez anuncia algo literal y qué revela sobre cambios, ansiedad y transformación personal.` |
| `/es/blog/suenos-con-ex` | `¿Qué significa soñar con tu ex? 7 interpretaciones psicológicas | Noctalia` | `Entiende por qué sueñas con tu ex, qué emociones pendientes puede reflejar y cómo interpretar el contexto exacto de tu sueño.` |
| `/es/blog/suenos-de-agua` | `¿Qué significa soñar con agua, inundaciones o ahogarse? | Noctalia` | `Analiza el significado de soñar con agua, mar, inundaciones o ahogarte y qué relación tiene con tus emociones, el estrés y los cambios.` |
| `/es/blog/suenos-de-caer` | `¿Qué significa soñar que caes al vacío? | Noctalia` | `Descubre por qué sueñas que caes, qué relación tiene con inseguridad, pérdida de control y estrés, y cómo leer las variaciones del sueño.` |
| `/es/blog/como-recordar-suenos` | `Cómo recordar tus sueños: 10 técnicas que funcionan | Noctalia` | `Aprende 10 técnicas para recordar tus sueños al despertar, desde un diario onírico hasta cambios simples en tu rutina nocturna.` |
| `/en/blog/dream-journal-guide` | `How to Start a Dream Journal Tonight | Noctalia` | `Learn exactly what to write in a dream journal, when to record your dreams, and how journaling improves dream recall week after week.` |
| `/en/blog/dream-interpretation-history` | `History of Dream Interpretation: From Ancient Egypt to Neuroscience | Noctalia` | `Explore how dream interpretation evolved from temple rituals to modern sleep science, with the key theories that still shape it today.` |

### Remarques importantes

- La page `/es/blog/suenos-con-ex` a actuellement un title avec **"Suenos"** sans accent dans le head. Ce detail est mineur pour le ranking, mais negatif pour le CTR en SERP.
- Les pages ES doivent repondre plus souvent avec la formulation exacte **"¿Qué significa soñar...?"** car c'est visiblement la formulation que Google expose deja.

## Croisement avec la strategie existante

### 1. Ce que Search Console valide dans la strategie actuelle

Le document [`CONTENT-PLANNING.md`](../../doc_web_interne/docs/CONTENT-PLANNING.md) avait raison sur trois points:

- Les sujets **grand public / frequents** sont les meilleurs candidats SEO.
- Les **pages d'interpretation** et **guides pratiques** sont les meilleurs clusters.
- Les mots-cles ES de type `sonar que...` / `suenos de...` sont reellement ceux qui emergent.

Concretement, les pages qui marchent le mieux correspondent exactement a ces clusters:

- flying
- death
- water
- ex
- symbols dictionary
- hospital / puerta

### 2. Ce que Search Console corrige dans la strategie actuelle

La strategie technique et structurelle etait bonne, comme montre dans [`SEO_AUDIT.md`](../SEO_AUDIT.md) et [`INTERNAL_LINKING.md`](./INTERNAL_LINKING.md).  
Mais Search Console montre que le vrai goulot d'etranglement n'est plus l'architecture:

- c'est **la qualite du snippet**
- c'est **l'alignement exact avec l'intention de recherche**
- c'est **la consolidation des URLs**

Autrement dit:

- le site est deja crawlable
- le site est deja indexable
- le site est deja visible
- il faut maintenant **gagner le clic**

### 3. Ce qu'il faut renforcer dans la strategie

- Prioriser **ES** comme moteur de croissance.
- Utiliser **FR** pour gagner vite du CTR.
- Traiter **EN science/education** soit comme un vrai cluster acquisition, soit comme un cluster secondaire.
- Redistribuer le maillage interne vers les pages qui sont deja entre positions 2 et 10.

## Priorites recommandees

1. Corriger la consolidation `.html`.
2. Refaire les titles/meta des 6 pages a plus fort potentiel.
3. Ajouter des H2/FAQ alignes avec les requetes exactes.
4. Renforcer le maillage vers les pages ES deja visibles.
5. Ajouter des signaux E-E-A-T sur les contenus science / sante mentale.

## Conclusion

Noctalia n'a pas un probleme de presence dans Google.  
Noctalia a maintenant surtout un probleme de **capture du clic**.

Le socle SEO existant fonctionne:

- architecture
- hubs
- contenus multilingues
- maillage

La phase suivante est plus fine:

- consolider les URLs
- reformuler les snippets
- caler les contenus sur les vraies requetes visibles dans Search Console
- pousser plus fort les gagnants espagnols

