# Règle commune de livraison, v2

**Statut** : adoptée par le propriétaire le 9 octobre 2026, avec Q9 et Q10 validées le même jour. Mise en œuvre : une PR par dépôt (§8).
**Date** : 9 octobre 2026.
**Décideur** : le propriétaire.
**Dépôts concernés** : shapier, skillcodex, clawdeals, bodylab, dreamer.
**Historique** : la v1 a été relue le 9 octobre. Les corrections sont listées en §9, et le diff du deuxième commit de cette PR les montre.

## 0. Consignes aux agents relecteurs

- Commentez par numéro de section (§2.3, §7…).
- Marquez chaque remarque **bloquant** ou **suggestion**.
- Vérifiez la ligne de la §4 qui concerne votre dépôt. Corrigez-la si elle est fausse, preuve à l'appui (fichier et ligne).
- Ne modifiez aucun dépôt pendant la relecture. La mise en œuvre vient après validation (§8).

## 1. Objectif

**Payer moins et livrer plus vite.** Chaque point de la règle doit faire baisser un coût (minutes, crédits, déploiements) ou une attente. Sinon, il n'a rien à faire ici.

La règle tient en une phrase :

> **Push rapide ; contrôles locaux proportionnés avant fusion ; publication vérifiée pour la cible livrée ; CI distante à la demande et sans attente obligatoire.**

## 2. La règle

Ce fichier est la source canonique. Chaque `AGENTS.md` en reprend le résumé (§6).

1. **Push rapide.**
   - Pousser souvent ne coûte rien, et les PR en brouillon sont permises.
   - Le hook `pre-push` dure quelques secondes et ne lance aucune suite lourde (§3).
   - Il est interdit aux agents de contourner le hook ou de le désactiver.
2. **Contrôles proportionnés avant fusion.**
   - Avant de fusionner, l'auteur lance `verify:pr`. Ce contrôle est choisi selon ce qui a changé :
     - lint ciblé et mis en cache ;
     - vérification des types ;
     - tests concernés ;
     - contrôles spécialisés (base de données, navigateur, mobile, corpus) quand leurs entrées changent.
   - Le contrôle tourne sur une copie isolée du commit (`git worktree`), pas dans l'arbre de travail. Il n'oblige donc pas à ranger un travail en cours.
   - Il produit une **preuve** liée à l'**arbre vérifié** (le *tree hash* git), pas seulement au commit. Il y note les contrôles lancés, leur résultat et l'environnement : versions de Node et du gestionnaire de paquets.
   - Les variables d'environnement qui réduisent ce qu'un contrôle lance sont retirées avant les contrôles : `JEST_CHANGED_SINCE`, `TURBO_SCM_BASE`, `TURBO_SCM_HEAD`, `CI_BASE_REVISION`, `GITHUB_BASE_SHA`, et celles que la config d'un dépôt ajoute dans `stripEnv`. Un contrôle qui a besoin de l'une d'elles la fixe dans son propre `env`.
   - **D'où peut venir une preuve spécialisée.** Quand la machine de l'agent ne peut pas lancer un contrôle spécialisé (Docker absent pour une base Supabase locale, par exemple), la preuve vient d'un pipeline CircleCI lancé à la main ou de la machine du propriétaire. Si ce contrôle est exigé avant la fusion, la PR attend cette preuve. Elle le cite dans `## Local proof`. Le moteur n'accepte `--external` que pour un contrôle spécialisé qui ne peut pas tourner sur cette machine (sa sonde `requires` échoue), et seulement avec une preuve qui donne le lien `https://` de l'exécution (ou commence par `owner-machine:`) et cite exactement un commit : le SHA vérifié ou un commit de même arbre. Une entrée externe n'est jamais réutilisée par une autre preuve.
3. **La PR et sa fusion.**
   - Avant fusion, la section `## Local proof` cite la preuve : commande, commit et arbre vérifiés, résultat, contrôles spécialisés lancés ou jugés hors périmètre. Ce titre anglais et la ligne du SHA du commit restent inchangés : le contrôle de fusion automatique des agents les lit.
   - Conditions de fusion, communes aux cinq dépôts :
     - la PR n'est plus en brouillon ;
     - le `Commit SHA` de la preuve est la tête de la PR ;
     - aucun fil de discussion n'est ouvert ;
     - il n'y a pas de conflit ;
     - la relecture du CTO n'a pas de point bloquant.
   - C'est le CTO qui fusionne, en squash. Les relecteurs ne poussent jamais sur la branche de l'auteur.
   - Une PR qui modifie `verify-local.config.mjs`, le moteur et ses tests, `.githooks/`, les scripts de contrôle que la config liste dans `deliveryFiles`, un `package.json` hors dépendances et version (ses `scripts`, ou la configuration d'outil qu'il porte) ou la configuration d'un outil de contrôle (ESLint, TypeScript, Jest, Vitest, Playwright, Babel, Turbo, Prettier, Deno, pytest, configs e2e, `pnpm-workspace.yaml`) change ses propres contrôles : elle demande en plus la relecture du propriétaire, et `## Local proof` le signale (« Delivery checks changed »).
4. **Intégration : recalculer, ne pas tout rejouer.**
   - Si la branche de base a avancé, l'auteur compare l'arbre déjà prouvé à l'arbre fusionné.
   - Il ne rejoue que les contrôles dont les entrées ont changé.
   - Si les deux arbres sont identiques, la preuve reste valable telle quelle.
5. **Publication vérifiée pour la cible livrée.**
   - Avant de publier, `verify:release` s'exécute sur le commit livré.
   - Il ne réutilise aucun résultat : chaque contrôle de publication tourne sur le commit livré, dans une copie isolée, même si la PR l'a déjà passé sur le même arbre. Les contrôles qu'une PR ne lance que si leurs chemins changent (`when`) tournent aussi : sur le commit livré de `main`, rien n'a changé depuis `origin/main`, et la publication prouve le commit, pas un diff. La réutilisation par entrées identiques reste réservée à `verify:pr` : une publication ne repose jamais sur une exécution antérieure.
   - Il refait ce qui dépend vraiment du commit livré : l'intégration, le build de la cible, l'identité (SHA et version embarqués).
   - Ensuite, il faut vérifier la production (santé, pages touchées) et noter le SHA et le déploiement.
6. **Aperçus à la demande.** Aucun déploiement d'aperçu n'est déclenché systématiquement par un push. On lance un aperçu quand on en a besoin.
7. **CI distante à la demande, sans attente obligatoire.**
   - Elle sert de preuve sur une machine propre avant une version risquée, ou de signal après fusion quand elle est gratuite.
   - Elle ne bloque jamais rien par elle-même, et aucune fusion n'attend un lancement automatique. Elle peut toutefois fournir une preuve spécialisée qu'un dépôt exige avant fusion, quand la machine locale ne peut pas la produire (§2.2).
   - Aucune protection GitHub ne doit exiger un statut de CI (§4.4) : une règle écrite dans `AGENTS.md` ne retire pas un statut obligatoire côté serveur.
8. **Propre à chaque dépôt**, dans sa section de l'`AGENTS.md` :
   - la technique, les conventions et la langue ;
   - la table des commandes `verify:pr` et `verify:release` ;
   - les contrôles spécialisés et le moment où ils deviennent nécessaires.

## 3. Contrat du hook pre-push

| Cas | Comportement exigé |
| --- | --- |
| Durée | Quelques secondes. Si c'est plus long, on optimise le contrôle ou on le déplace vers `verify:pr` ; on ne crée jamais un faux succès |
| Suppression de branche ou de tag, ou rien de nouveau | Ne rien lancer, sortie 0 |
| Contenu | Uniquement des contrôles quasi instantanés : fichiers interdits, secrets, contrat `.gitignore`/`.easignore` quand il existe |
| Preuve | Afficher s'il existe une preuve pour l'arbre poussé. Une preuve absente n'est pas bloquante (brouillons, travail en cours) |
| Installation | Par `prepare`. Ne jamais faire échouer une installation. Ne rien faire hors d'un dépôt git (EAS, archives) |

## 4. État actuel (relevé du 9 octobre 2026, corrigé après relecture)

### 4.1 Durée des hooks actuels : tous trop lents pour la cible v2

| Dépôt | Ce que le hook lance | Durée mesurée dans les PR |
| --- | --- | --- |
| shapier | `corepack pnpm verify` (contrats et workspaces touchés) | environ 2 min 45 (#410) |
| skillcodex | `pnpm ci:affected:check <merge-base>` | 6 à 9 min (#188) |
| clawdeals | `npm run test:ci` | 50 à 80 s (#9) |
| bodylab | `npm run verify:fast` | environ 2 min (#10) |
| dreamer | `npm run verify:fast` | 1 à 1,5 min (#275) |

Ces contrôles ne disparaissent pas : ils passent du hook à `verify:pr`.

### 4.2 Les commandes de vérification

| Dépôt | `verify:pr` serait | `verify:release` serait |
| --- | --- | --- |
| shapier | `corepack pnpm verify`. Une PR qui touche `supabase/migrations`, les règles RLS ou pgTAP doit aussi avoir une preuve de base de données (`corepack pnpm test:db`) **avant fusion**, venue de CircleCI lancé à la main ou de la machine du propriétaire (pas de Docker sur la machine partagée) | `corepack pnpm verify:full`, qui écrit déjà une preuve (#411, liée au commit), plus les tests navigateur du site (seulement avant une publication du site) et Gym selon le périmètre |
| skillcodex | `pnpm ci:affected:check` | `SKILLCODEX_RELEASE_TARGET=web pnpm release:fast:check`, plus le corpus historique |
| clawdeals | `npm run test:ci`, plus le lint ciblé | `test:ci`, puis le corpus historique (`node e2e/testerarmy/run-historical.mjs run`) |
| bodylab | `npm run verify:fast` | `npm run verify`, `npm run verify:web`, puis `npm run publish:check` |
| dreamer | `npm run verify:fast` | La recette complète existe déjà dans `doc_web_interne/docs/circleci-migration.md` (« Validation complète locale ») ; il reste à la regrouper en une commande |

### 4.3 CI distante, monitoring et aperçus

| Dépôt | CI et monitoring | Aperçus |
| --- | --- | --- |
| shapier | CircleCI au lancement manuel seulement (`equal: [api, << pipeline.event.name >>]`, `.circleci/config.yml`) | Vercel coupé pour l'app web (`apps/web/vercel.json`). Site public : côté dépôt, publication manuelle par `site:deploy` seulement, `workers_dev: false`, et la CI n'a pas le droit de lancer `wrangler deploy`. Il ne reste qu'à vérifier l'absence de connexion Git dans le tableau de bord Cloudflare |
| skillcodex | `Validation` et `source-links` au lancement manuel seulement. **`production-health.yml` garde un déclenchement toutes les 15 minutes, un autre toutes les heures et un sur chaque statut de déploiement**, soit environ 120 exécutions par jour. Il est désactivé à la main depuis le 19 août et ne coûte donc rien aujourd'hui, mais il redémarrerait s'il était réactivé (environ 3 600 min par mois estimées dans #180) | Vercel coupé |
| clawdeals | **CI relancée à chaque push sur `main` depuis #10**, comme signal après fusion, jamais comme condition. Dépôt public : les minutes sur runner standard sont gratuites. Les tags de publication des SDK sont inchangés | Vercel coupé |
| bodylab | GitHub Actions au lancement manuel seulement | à vérifier |
| dreamer | CircleCI au lancement manuel seulement (`pipeline.event.name`, `pipeline.trigger.type`, et `pipeline.trigger_source`, qui est **déprécié**) | Vercel coupé sur toutes les branches (#280). **Cloudflare Pages (noctalia) déploie encore un aperçu par branche** |

### 4.4 Protections GitHub

D'après les constats des agents, aucun dépôt n'exige de statut de CI pour fusionner :

- **shapier, skillcodex, bodylab** (privés) : l'API de protection et celle des règles renvoient 403 « Upgrade to GitHub Pro ». Aucune règle n'est possible sur ces dépôts avec l'offre actuelle, donc aucun statut ne peut être exigé ;
- **clawdeals** (public) : ni protection ni règle sur `main` (#6) ;
- **dreamer** (public) : la règle de `master` n'exige aucun statut (#275). **À confirmer** dans Settings → Rules.

### 4.5 Arbre modifié

Dreamer (`scripts/run-jest-changed.js`) et clawdeals refusent un arbre modifié avant le push. Les hooks de shapier, skillcodex et bodylab se contentent d'avertir. Chez shapier, `verify:full` tourne quand même sur un arbre modifié mais n'écrit alors aucune preuve, et c'est `site:deploy` qui refuse un arbre modifié (contrôle `clean-tree` de `scripts/check-deploy-proof.mjs`). La v2 règle la question autrement : le contrôle tourne sur une copie isolée du commit (§2.2), donc l'état de l'arbre de travail n'a plus d'importance.

## 5. Modèle de PR commun (section obligatoire avant fusion)

Le titre `## Local proof` et les lignes `Commands`, `Commit SHA` et `Result` restent tels quels, en anglais. Le contrôle de fusion du CTO lit le SHA pour le comparer à la tête de la PR. Chez shapier, `scripts/verify-shapier-deployment-config.mjs` vérifie aussi ces quatre chaînes dans `.github/pull_request_template.md` : si on les change, ce test casse le contrôle avant push. Un renommage devrait donc modifier en une seule PR le modèle, ce test et le contrôle du CTO. Les lignes ajoutées par la v2 viennent en dessous.

```markdown
## Local proof
- Commands: `…`
- Commit SHA: `…`
- Result: …
- Tree (`git rev-parse <sha>^{tree}`): `…`
- Specialised checks (database, browser, mobile, corpus): run: … / out of scope: …
- Integration: base unchanged / base moved, checks replayed: …
```

## 6. Source canonique et synchronisation

- **Source canonique** : ce fichier, dans le dépôt shapier, versionné (v2, v3…).
- Chaque `AGENTS.md` contient :
  - la phrase de la §1 ;
  - un lien vers ce fichier et son numéro de version ;
  - la table locale des commandes.

  Le texte complet n'est pas recopié cinq fois.
- **Moteur commun** : `scripts/verify-local.mjs` et ses tests `scripts/test-verify-local.mjs` sont identiques octet pour octet dans les cinq dépôts. Ils portent le hook, `verify:pr`, `verify:release`, la preuve et la garde de déploiement. Chaque dépôt ne décrit que ses contrôles, dans `verify-local.config.mjs`. Une correction du moteur se fait dans les cinq dépôts à la fois, jamais dans un seul. Ses tests vérifient l'empreinte du moteur (`ENGINE_SHA256`) : une modification faite dans un seul dépôt les fait échouer.
- Une nouvelle version n'oblige pas à ouvrir cinq PR le même jour. Chaque dépôt met à jour son numéro de version quand il s'aligne.
- Un test de présence du texte ne prouve rien sur le comportement. Chaque dépôt teste plutôt :
  - la durée et les cas du hook (§3) ;
  - la réutilisation d'une preuve quand l'arbre est identique ;
  - le fait que `verify:pr` et `verify:release` lancent bien les contrôles annoncés.

## 7. Décisions

| Question | Réponse |
| --- | --- |
| Q1 : Arbre modifié | Vérification sur une copie isolée du commit ; on ne touche pas au travail en cours |
| Q2 : Langue | Français pour le texte commun ; chaque dépôt garde sa langue pour le reste |
| Q3 : Source de vérité | Ce fichier dans shapier, avec une version identifiée |
| Q4 : Durée du hook | Quelques secondes. Les contrôles ordinaires ont une cible mesurée ; un dépassement entraîne une optimisation ou un déplacement, jamais un faux succès |
| Q5 : Lint | Ciblé et mis en cache quand du code change. Pas de lint global ajouté seulement pour uniformiser |
| Q6 : Dependabot | Retirée de la règle commune. La règle déjà en vigueur dans les dépôts reste valable : on ne fusionne jamais une PR Dependabot. La changer serait une décision séparée du propriétaire |
| Q7 : Aperçus | À la demande ; on supprime les déclenchements systématiques |
| Q8 : Signal CircleCI | Utiliser uniquement les champs supportés par la doc CircleCI (pas `pipeline.trigger_source`, déprécié) et vérifier un lancement manuel réel |
| Q9 : Format de la preuve | Validée le 9 octobre 2026, telle que détaillée ci-dessous |
| Q10 : Dépendances de la copie isolée | Validée le 9 octobre 2026 : lier l'installation existante quand le lockfile est identique, sinon installer ; le mode de chaque dépôt est choisi sur mesure (ci-dessous) |

Détail de Q9 et Q10 :

- **Q9 : format et emplacement de la preuve**, commun aux cinq dépôts :
  - **Emplacement** : `$(git rev-parse --git-common-dir)/verify-proofs/<tree>.json`. Ce dossier est hors de l'arbre, donc rien à ajouter aux fichiers d'exclusion. Il est partagé par les worktrees et n'est jamais commité.
  - **Contenu** : on garde les noms de la preuve de shapier (#411, `scripts/verify-full-proof.mjs`) : `version`, `sha`, `clean`, `startedAt`, `finishedAt`, `command`, `node`. On y ajoute `tree`, `kind` (`pr` ou `release`), `checks` (nom et résultat de chacun) et `packageManager`. Ces ajouts font passer `PROOF_FORMAT_VERSION` à 2. Dans shapier, le garde-fou de déploiement doit changer dans la même PR. Le format 3 ajoute la garde de `--external` (§2.2) : une entrée externe n'est jamais réutilisée, la garde de déploiement la revérifie, et une preuve d'un format antérieur est ignorée.
  - **Identité du déploiement** : la preuve garde le commit **et** l'arbre. Pour un déploiement, le garde-fou de shapier conserve ses conditions : `HEAD == origin/main`, arbre propre, preuve liée à ce commit. Une preuve n'est réutilisée par correspondance d'arbre que si `HEAD` est encore `origin/main`. Seule une preuve `kind: release` satisfait le garde-fou de déploiement ; une preuve `kind: pr` ne débloque jamais une publication. Le dossier commun des worktrees règle aussi un défaut actuel : `.shapier/verify-full-proof.json` est écrit dans chaque worktree, donc la copie qui déploie ne le voit pas.
  - **Transmission** : la preuve locale ne survit pas à une autre session. La section `## Local proof` de la PR recopie le commit, l'arbre, la commande et le résultat, et c'est elle qui fait foi entre sessions. `node scripts/verify-local.mjs proof-block` l'imprime.
  - **Pas de recul** : une exécution qui échoue ou reste incomplète ne remplace jamais une preuve réussie du même arbre, et une preuve `pr` ne remplace jamais une preuve `release` réussie. La tentative est notée à côté (`<tree>.<kind>-attempt.json`), et ses contrôles réussis restent réutilisables.
  - **Confiance** : la preuve est un fichier JSON local, non signé. La confiance s'arrête à la machine qui l'a écrite ; la relecture vérifie que le `Commit SHA` est la tête de la PR.
- **Q10 : dépendances dans la copie isolée.** Mode `link` : le moteur lie les `node_modules` du checkout quand le lockfile est identique ; les liens de paquets du workspace pointent vers la copie, et un sous-projet qui a son propre lockfile n'est lié que si ce lockfile est identique. Mode `install` : la copie installe. Un contrôle qui refuse les liens (build Turbopack) demande sa propre installation (`install: true`). Chaque copie a son propre `TMPDIR`, supprimé avec elle : partagé, le cache de Metro resservait des fichiers construits pour une autre copie. Mesures du 9 octobre 2026, machine partagée chargée :

  | Dépôt | Mode | Copie prête |
  | --- | --- | --- |
  | shapier | `install` (`corepack pnpm install --frozen-lockfile --offline`, store partagé) : un workspace pnpm lie ses paquets un par un | checkout de 1,9 Go en 45 s à froid, installation de 15 à 32 s |
  | skillcodex | `install` (`pnpm install --frozen-lockfile --offline`, avec le store `.pnpm-store` du checkout) : un workspace pnpm | checkout en 1,1 s, installation de 11 à 21 s (50 s à froid) ; les fichiers sont des liens physiques vers le store |
  | clawdeals | `link` ; le build de release réinstalle (`npm ci`, environ 57 s et 1,4 Go) | environ 1,3 s |
  | bodylab | `link`, plus une génération minimale de `src/generated/` (environ 8 s) | 1,6 à 1,8 s |
  | dreamer | `link` | checkout de 353 Mo en environ 20 s, liens en 0,1 s |

## 8. Mise en œuvre après validation

Une PR par dépôt, qui :

1. **rend le hook rapide** : déplace les suites vers `verify:pr` et garde les contrôles instantanés et l'affichage de la preuve ;
2. **ajoute les commandes** `verify:pr` et `verify:release`, avec la copie isolée et la preuve liée à l'arbre ; pour shapier, faire évoluer la preuve de #411 du commit vers l'arbre ;
3. **met à jour** l'`AGENTS.md` (§6) et le modèle de PR (§5). Chez shapier, `scripts/verify-shapier-deployment-config.mjs` (ligne 214) vérifie la ligne exacte `Commands: \`corepack pnpm verify\`` du modèle. Si `verify:pr` devient la commande par défaut, le modèle et ce test changent ensemble. Pour shapier, réécrire `AGENTS.md:38`, qui dit aujourd'hui « fusionner `main`, relancer `verify`, mettre la preuve à jour », pour qu'il ne contredise pas la §2.4 ; et garder en phase `docs/release/shapier-approval-gates.md:68`.

Corrections ciblées en plus :

- **skillcodex** : passer `production-health.yml` au lancement manuel seulement, ou le supprimer, pour qu'une réactivation ne coûte rien par surprise ;
- **dreamer** : regrouper la recette complète dans `verify:release` ; retirer `pipeline.trigger_source` de la condition CircleCI ;
- **plateformes**, à faire par le propriétaire :
  - couper les aperçus automatiques Cloudflare Pages de dreamer ;
  - vérifier qu'aucune connexion Git Cloudflare ne publie le site de shapier ;
  - confirmer la règle de `master` de dreamer ;
  - lancer un pipeline CircleCI à la main sur shapier et sur dreamer. Seul le propriétaire peut le faire : la machine partagée n'a pas de jeton CircleCI.

**Critères d'acceptation** :

- Le hook prend moins de 10 secondes dans chaque dépôt, mesuré.
- Le squash d'une PR à jour réutilise sa preuve sans rien rejouer.
- Après une avance de la base, seuls les contrôles dont les entrées ont changé sont relancés.
- Un vrai lancement manuel de CircleCI est observé.

## 9. Changements par rapport à la v1 (réponse à la relecture)

| Section v1 | Avis | Ce qui change en v2 |
| --- | --- | --- |
| §2.1 et §2.2 : tests avant chaque push | Bloquant | Le hook ne fait plus que des contrôles de quelques secondes ; les suites passent dans `verify:pr`, une fois avant fusion (§2.1, §2.2, §3) |
| §2.4 : base avancée ⇒ tout rejouer | Bloquant | On recalcule l'impact et on ne rejoue que ce dont les entrées changent (§2.4) |
| §2.5 : vérification complète après chaque squash | Bloquant | On réutilise la preuve si l'arbre est identique et on ne refait que ce qui dépend du commit livré (§2.5) |
| §3 / Q1 : refus d'un arbre modifié | Suggestion | Vérification sur une copie isolée du commit (§2.2, §4.5) |
| §6 : cinq copies, cinq PR | Suggestion | Une source canonique versionnée et un résumé court ; des tests de comportement plutôt que de présence du texte (§6) |
| §4 : écarts | Corrigé | Monitoring de skillcodex, CI de clawdeals sur `main`, recette de dreamer, protections GitHub (§4.3, §4.4) |
| Brouillons interdits | Corrigé | Brouillons permis (§2.1) |
| §5 (relecture CTO de la v2) | Bloquant | Le titre `## Local proof` et la ligne `Commit SHA` sont conservés, car le contrôle de fusion les lit ; l'arbre et les contrôles spécialisés viennent en dessous (§2.3, §5). Q9 reçoit une proposition concrète |
| Relecture owner de la v2 | Bloquant ×3 | `## Local proof` conservé (déjà fait) ; Q6 retirée, car la règle « ne jamais fusionner Dependabot » reste ; une preuve spécialisée peut venir de CircleCI lancé à la main ou de la machine du propriétaire, et pgTAP est exigé avant la fusion d'une PR `supabase/` (§2.2, §2.7, §4.2) |
| Relecture owner de la v2 | Suggestions | Faits shapier corrigés (§4.3, §4.4, §4.5) ; conditions de fusion complètes (§2.3) ; preuve gardant commit et arbre pour le déploiement (Q9) ; précisions pnpm (Q10) ; lignes d'AGENTS.md à réécrire (§8) |
| Suivi owner (sur `5e7b00b`) | Suggestions | Preuve `kind: pr` jamais acceptée pour un déploiement ; noms des champs de #411 conservés, ajouts en version 2 (Q9) ; modèle de PR et test de shapier à changer ensemble (§8) |
| Adoption (9 octobre 2026) | Décision | Aucun point bloquant restant chez le CTO ni chez le propriétaire sur `de61a0a`. La v2 est adoptée ; la mise en œuvre suit la §8 après validation de Q9 et Q10 |
| Validation de Q9 et Q10 (9 octobre 2026) | Décision | Format de preuve commun et dépendances de la copie isolée validés ; moteur commun `scripts/verify-local.mjs` identique dans les cinq dépôts (§6) ; mesures de Q10 par dépôt (§7) |
| Revues des PR de mise en œuvre (9 octobre 2026) | Bloquant et suggestions | `--external` limité aux contrôles spécialisés indisponibles et lié au SHA ou à l'arbre (§2.2) ; relecture du propriétaire pour toute PR qui modifie ses propres contrôles (§2.3) ; garde d'empreinte du moteur (§6) ; preuve locale non signée (§7) ; analyse des secrets du hook bloquante si git ne lit pas les fichiers ; réutilisation liée à la base pour les contrôles qui choisissent leur travail d'après le diff (`perBase`) |
| Décision du propriétaire, déléguée (9 octobre 2026) | Décision | À la publication, seuls les résultats obtenus sur le même arbre sont réutilisés (§2.5) ; la réutilisation par entrées identiques reste réservée aux PR |
| Relecture CTO du moteur `04f3b1cd` (9 octobre 2026) | Bloquant | Tout changement d'un `package.json` hors dépendances et version est signalé, car un bloc `jest` ou `eslintConfig` peut affaiblir un contrôle ; les configurations d'outils signalées couvrent aussi Deno, pytest, les setups Jest et Vitest, les configs e2e et `pnpm-workspace.yaml` (§2.3) |
| Revue du propriétaire sur `a37f2c68`, ajout de périmètre du CTO (9 octobre 2026) | Bloquant | `verify:release` ne réutilise plus aucun résultat, même obtenu sur le même arbre : chaque contrôle de publication tourne sur le commit livré (§2.5). Les variables d'environnement qui réduisent le périmètre d'un contrôle sont retirées (§2.2) |
| Revue Codex de clawdeals#17 sur `7c778a1` (9 octobre 2026) | Correction | Une publication lance aussi les contrôles limités par `when` : sans réutilisation, ils étaient écartés sur `main` (§2.5) |

## 10. Local d'abord : processus commun, dépôts indépendants (9 octobre 2026, soir)

**Décision du propriétaire du 9 octobre 2026.** Cette section complète les précédentes et l'emporte sur elles en cas de désaccord, notamment sur la §2.2 (origine d'une preuve spécialisée), la §2.7 (CI distante), la §6 et la Q3 (source canonique).

1. **Processus commun, pas code commun.** Chaque dépôt possède sa copie du moteur, sa config, ses hooks et ce document. Un dépôt se vérifie seul : aucun contrôle, aucune empreinte et aucun lien vers un autre dépôt n'est nécessaire. Le texte commun est recopié à l'identique dans chaque dépôt ; seule la sous-section « Propre à ce dépôt » de la §13 change. La copie de ce dépôt est celle qui fait foi pour lui.
2. **La CI externe ne tourne jamais par défaut.** GitHub Actions, CircleCI, GitLab CI, EAS Workflows et les builds Git de Vercel ou de Cloudflare ne se lancent que sur demande explicite, et seulement là où un client, un partenaire ou un registre l'exige. Chaque cas est listé dans la table de la §13 ; sans ligne dans cette table, aucune CI externe n'est attendue.
3. **La preuve ordinaire est locale ou auto-hébergée.** Rôles des machines :
   - **machine partagée (box)** : `verify:pr` et les relectures du CTO ;
   - **PC Tanuki** : Docker, Supabase local, e2e navigateur (Playwright, TesterArmy) et `verify:release` web ;
   - **Mac mini** : Expo, Maestro, simulateur iOS, émulateur Android et `verify:release` mobile.
4. **Étapes communes**, chaque dépôt avec ses propres commandes :

   | Étape | Commande | Machine | Bloque |
   | --- | --- | --- | --- |
   | S0 push | hook `pre-push` | celle qui pousse | le push |
   | S1 PR | `verify:pr`, preuve collée dans `## Local proof` | machine partagée | la fusion (SHA de la preuve = tête de la PR) |
   | S2 contrôles spécialisés | contrôles qui portent `requires` dans la config | PC Tanuki ou Mac mini | la fusion, quand la PR touche leurs chemins (§12) |
   | S3 relecture | relecture du CTO sur l'échelle de la §11 | CTO | la fusion |
   | S4 fusion | squash par le CTO | GitHub | |
   | S5 après fusion | `verify:pr` facultatif sur le SHA de `main` | machine partagée | rien : signal seulement |
   | S6 publication | `verify:release` sur le commit livré | PC Tanuki (web), Mac mini (mobile) | la publication, qui reste une décision explicite |

5. **Ce qui n'est pas de la CI reste tel quel** : crons d'exécution (Vercel Cron, crons d'un Worker), sauvegardes, mises à jour de sécurité Dependabot.

## 11. Échelle de relecture

Chaque remarque de relecture porte un niveau :

| Niveau | Sens | Ce que fait l'auteur |
| --- | --- | --- |
| **bloquant** (blocker) | doit être corrigé avant la fusion | corrige, puis répond sur le fil avec le SHA de la correction |
| **à corriger** (should-fix) | à traiter dans cette PR | corrige dans cette PR, ou répond avec une raison, ou avec un suivi tracé (ticket ou issue) |
| **détail** (nit) | facultatif | corrige, ou décline par une réponse courte |

Chaque fil reçoit une réponse. Aucune PR n'est fusionnée avec un fil sans réponse.

## 12. Preuve des contrôles spécialisés

- **D'abord la machine du propriétaire.** Quand la machine qui lance `verify:pr` ou `verify:release` ne peut pas exécuter un contrôle spécialisé (sa sonde `requires` échoue), on le lance sur la machine du propriétaire qui convient (§10.3), puis on le cite :

  ```
  --external <contrôle>="owner-machine: <hôte> <note> on <SHA>"
  ```

- **Une CI externe seulement si elle est retenue pour ce dépôt.** Une preuve `https://` d'une exécution de CI n'est valable que si ce workflow figure dans la table de la §13 pour ce dépôt.
- La PR cite chaque preuve spécialisée dans sa section `## Specialised checks`, ou y écrit « none / out of scope ».

## 13. CI externe

Ce qui peut tourner hors des machines locales, qui l'exige et comment le lancer. Par défaut : rien.

| Workflow | Qui l'exige | Déclenchement | Notes |
| --- | --- | --- | --- |
| none | personne | | aucune CI externe par défaut |

### 13.1 Propre à ce dépôt (dreamer)

Cette sous-section est la seule partie de ce document qui diffère d'un dépôt à l'autre. Aucune CI externe n'est exigée ici : la ligne « none » ci-dessus s'applique. Les outils ci-dessous existent dans le dépôt et ne se lancent que sur demande explicite ; aucun n'est une condition de fusion ni de publication.

| Workflow | Qui l'exige | Déclenchement | Notes |
| --- | --- | --- | --- |
| CircleCI (`.circleci/config.yml`, `.circleci/continue.yml`) | personne | API ou bouton Trigger Pipeline seulement (`pipeline.event.name` ou `pipeline.trigger.type` à `api`, ou `force_full_validation: true`) | exécution sur machine propre, sur demande ; la livraison du webhook GitHub est coupée par le propriétaire dans les réglages du projet CircleCI |
| EAS Workflows `e2e-test-android.yml`, `e2e-test-ios.yml` | personne | `workflow_dispatch` seulement (`eas workflow:run .eas/workflows/<fichier>`) | build EAS et Maestro ; un build EAS demande le feu vert explicite du propriétaire |
| EAS Workflows `android-release-smoke.yml`, `android-release-qualification.yml` | personne | `workflow_dispatch` seulement, plus de déclenchement sur tag `v*` | qualification de release sur demande ; même feu vert pour le build EAS |
| Cloudflare Pages `noctalia` (intégration Git) | personne | aucun : publication manuelle (`npm run docs:deploy:prod`), aperçu sur demande (`npm run docs:deploy:preview`) | le propriétaire coupe les aperçus Git et la production automatique dans le tableau de bord |
| Vercel (`vercel.json`, `git.deploymentEnabled: false`) | personne | CLI seulement | aucun déploiement Git |

Ce document vit dans `doc_web_interne/docs/` et non dans `docs/` : dans ce dépôt, `docs/` est la sortie générée du site public (ignorée par git et publiée sur noctalia.app).
