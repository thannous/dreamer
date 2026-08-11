# Noctalia — J27 validation GSC et Keyword Explorer

Date : 11 août 2026

Projet Ahrefs : `9361004`

Mode : lectures Ahrefs et GSC uniquement. Aucun crawl manuel, changement Rank Tracker, achat, add-on, demande d'indexation, édition de contenu ou publication.

## Verdict exécutif

Le cluster multilingue **chaussures** passe de `PENDING_GSC_ABSENCE` à `GO_CONTENT_BRIEF`.

- GSC ne renvoie aucun clic ni aucune impression pour `scarpe|schuhe|chaussures|zapatos`, sur les 28 jours complets du 13 juillet au 9 août 2026 et sur la fenêtre « 12 mois » disponible du 5 décembre 2025 au 9 août 2026.
- Les quatre rapports Keyword Explorer confirment une demande locale, une difficulté `KD 0–1` et des SERP compatibles avec une fiche de symbole définitionnelle.
- Aucun terme correspondant n'existe dans les trois inventaires `data/dream-symbols*.json` ni leurs copies statiques générées.

Cette convergence autorise la préparation d'un brief et d'un lot d'implémentation séparé. Elle n'autorise pas à inventer un contenu, à publier immédiatement quatre pages ni à contourner la revue éditoriale et les contrôles du générateur.

Le cluster **crocodile** reste derrière chaussures. Ahrefs confirme son potentiel, mais GSC montre déjà deux propriétaires très faibles dans les guides animaux. Le statut est `HOLD_OWNER_REVIEW` afin d'éviter de créer une fiche sans différencier clairement son rôle du hub.

## Préflight live

| Indicateur | Valeur vérifiée |
|---|---:|
| Plan interface Ahrefs | Starter, facturé mensuellement |
| Crédits généraux avant lot | 70 |
| Crédits généraux après lot | 76 |
| Coût réel du lot | 6 crédits |
| Rank Tracker | 50/50, inchangé |
| Site Audit workspace | 3 627/10 000, inchangé |
| Remise à zéro et facturation | 16 août 2026 à 00:00 UTC |
| Dernier jour GSC complet | 9 août 2026 |

Le connecteur Ahrefs gratuit a de nouveau exposé la couche API comme `Trial, billed monthly` avec zéro unité API. Cette couche ne remplace pas le plan Starter ni le compteur général de l'interface.

## Fenêtre GSC fraîche

La fenêtre standard de 28 jours est maintenant le 13 juillet–9 août 2026 :

- 4 273 clics ;
- 491 150 impressions ;
- CTR affiché 0,9 % ;
- position moyenne affichée 7,3 ;
- dernière mise à jour affichée : environ quatre heures avant la lecture.

Le 9 août apporte donc une journée complète supplémentaire au relevé J26 arrêté au 8 août. Cela ne suffit toujours pas à juger la vague metadata `casa`–`ragno`–`perro` publiée le 8 août ; son gate J+7 reste le 15 août. `scuola` reste une expérience séparée et non publiée.

## Cluster chaussures

### Validation GSC

Filtre regex : `scarpe|schuhe|chaussures|zapatos`.

| Fenêtre | Clics | Impressions | Propriétaire visible |
|---|---:|---:|---|
| 13 juillet–9 août 2026 | 0 | 0 | aucun |
| 5 décembre 2025–9 août 2026 | 0 | 0 | aucun |

GSC avertit que les totaux filtrés peuvent être incomplets. Le résultat est donc une absence dans les données exposées, pas une preuve que Google n'a jamais traité aucune variante anonymisée.

### Preuve Ahrefs payante

| Marché | Requête | Date de la SERP Ahrefs | Volume visible | KD | Traffic Potential | Lecture SERP |
|---|---|---|---:|---:|---:|---|
| IT | `sognare scarpe` | 5 août 2026 | 700 | 1 | 1,7 K | fiches et articles interprétatifs ; une page DR 1 sans liens est 5e |
| DE | `traumdeutung schuhe` | 24 juillet 2026 | 300 | 0 | 100 | résultats définitionnels ; pages spécialisées 2e, 3e et 5e |
| FR | `rêver de chaussures` | 15 juillet 2026 | 100 | 0 | 250 | fiches définitionnelles ; variante non accentuée visible à 300 |
| ES | `soñar con zapatos` | 13 juillet 2026 | 450 dans la carte pays/parent | 0 | 400 | guides dédiés 3e à 6e ; volume global visible 3,9 K |

Les dates de SERP et les variantes diffèrent des rapports concurrents J26 ; les écarts de volume ne sont pas additionnés et aucune valeur n'est reconstruite.

### Décision chaussures

`GO_CONTENT_BRIEF`, avec propriétaires prospectifs conformes aux routes existantes :

- `/it/simboli/scarpe` ;
- `/de/traumsymbole/schuhe` ;
- `/fr/symboles/chaussures` ;
- `/es/simbolos/zapatos`.

Le lot d'implémentation devra être une seule unité contrôlée dans `data/` et les sources associées, jamais dans `docs/`. Il devra :

1. définir une intention « symbole et scénarios de chaussures » distincte des pages produit et des guides génériques ;
2. exclure loto, Smorfia, religion et commerce de chaussures comme intentions principales ;
3. couvrir au minimum chaussures neuves, perdues, cassées, trop grandes/petites et sans chaussures, sans empiler des variantes artificielles ;
4. ajouter des liens depuis les dictionnaires ou hubs pertinents avec des ancres localisées explicites ;
5. lancer une baseline GSC et un gel de 28 jours séparé des expériences existantes.

## Cluster crocodile

### GSC query × page

Filtre regex : `coccodrill|krokodil`.

- 28 jours : 0 clic, 0 impression.
- Fenêtre disponible « 12 mois » : 0 clic, 3 impressions, position moyenne 2,3.
- `traumdeutung krokodil verfolgt mich` : 2 impressions, propriétaire `/de/guides/tier-traumsymbole`.
- `sognare coccodrilli significato` : 1 impression, propriétaire `/it/guides/simboli-sogni-animali`.

### Ahrefs

| Marché | Requête | Date de la SERP Ahrefs | Volume | KD | Traffic Potential |
|---|---|---|---:|---:|---:|
| IT | `sognare coccodrilli` | 5 août 2026 | 700 | 0 | 600 |
| DE | `traumdeutung krokodil` | 24 juillet 2026 | 500 | 0 | 200 |

Décision : `HOLD_OWNER_REVIEW`. Le signal est prometteur, mais une future fiche devrait recevoir l'intention courte et les scénarios précis, tandis que les guides animaux resteraient des hubs. Il faut vérifier les passages et ancres actuels avant de créer les propriétaires `/it/simboli/coccodrillo` et `/de/traumsymbole/krokodil`.

## Ordre de travail recommandé le 11 août

1. Conserver ce relevé et le backlog J27 dans Git.
2. Rédiger puis revoir le brief chaussures multilingue ; aucune publication dans le même mouvement que la collecte.
3. Auditer localement les passages crocodile des deux guides avant une décision de split.
4. Capturer la baseline Rank Tracker mobile et desktop sans modifier les 50 suivis.
5. Terminer par le compteur Ahrefs, le dernier Site Audit et la recommandation d'abonnement.

## Recommandation d'abonnement provisoire

Le verdict reste `LEAN_FREE`. Starter a produit rapidement une opportunité éditoriale solide, mais la décision décisive vient de la combinaison GSC + inventaire local + SERP. Le besoin est démontré pour une rafale de recherche, pas encore pour un renouvellement mensuel récurrent. La décision de facturation reste à l'utilisateur.

## Frontière Git

Pendant la collecte, un `pull --rebase` externe a avancé le worktree détaché de `7e0dc2f5` à `03cb684da` et a laissé `README.md` en état non fusionné, sans marqueur dans le contenu de travail. Aucun fichier n'a été écrasé. Toute livraison doit conserver les trois documents J26 déjà présents sur `master`, les sept livrables J26 locaux et les deux livrables J27, puis vérifier un push fast-forward sur le `master` distant courant.
