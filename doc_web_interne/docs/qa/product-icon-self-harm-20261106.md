# Icône 1024 px et réponse d’aide fixe — 6 novembre 2026

Demande propriétaire : deux décisions produit, icône principale en 1024 px et
réponse fixe accompagnée de ressources d’aide lorsqu’un message parle
d’automutilation. Travail local sur Dreamer, sans publication ni migration.

## Résultat

- `assets/images/icon.png`, déjà référencée par `app.json`, est un PNG opaque
  de 1024 × 1024 px. Création Imagegen à partir de l’icône 512 px, avec demande
  de conserver composition et couleurs ; contours recréés, puis mise à la
  dimension exacte. Ce n’est pas une conservation pixel pour pixel de l’original.
  Les couches adaptatives Android et les images de splash restent distinctes.
- `supabase/functions/api/lib/selfHarmSupport.ts` définit la détection explicite
  et le texte fixe EN/FR/ES/DE/IT/PT. Le chat réel et le mock partagent ce module.
  Les mentions explicites de suicide, d’automutilation et plusieurs formulations
  directes déclenchent la réponse, y compris dans un rêve, une citation, une
  négation ou à propos d’un tiers. Ce n’est ni un diagnostic ni une détection
  exhaustive des sous-entendus, fautes ou expressions possibles.
- `/chat` produit la réponse sans clé ni appel au modèle, en JSON ou en un
  événement SSE final. Il conserve les contrôles d’accès, l’admission, les quotas,
  la persistance atomique des comptes et la reprise des requêtes existants.
  Le client conserve donc aussi ses prérequis de consentement et de réseau.
  Cette modification concerne le chat de réflexion, pas la capture guidée,
  l’analyse du récit ou la disponibilité d’aide hors du chat.
- Le texte oriente vers une personne de confiance, les urgences en cas de danger
  immédiat et le 3114 explicitement en France. La langue ne détermine pas le pays.
  Numéro, gratuité, disponibilité et liens vérifiés avec l’outil de répertoire
  des lignes d’aide le 6 novembre 2026 ; référence : [3114](https://3114.fr/).

## Vérifications

- Dimensions et absence d’alpha confirmées avec `sips` ; référence Expo inchangée.
- 16 tests Deno réussis : corpus multilingue et contre-exemples, absence d’appel
  fournisseur, réponses JSON/SSE, écriture du message et chemin invité.
  Les transports base de données et IA sont simulés dans ces tests ; ils ne
  constituent pas une exécution sur Supabase hébergé.
- Types application et TesterArmy, lint ciblé, `git diff --check` réussis.
- Revue indépendante puis revue du delta : formes conjuguées ajoutées et faux
  positif sur la scarification de la pelouse corrigé ; aucun finding restant
  sur le delta relu.
- Parcours web mock : ressources et destinations des liens, réouverture par
  navigation dans la même session et reprise d’un échange ordinaire. Aucun
  appel téléphonique effectué. Qualification finale réussie : 2/2 parcours,
  code de sortie 0, sources stables, `applicationQualified: true`. Preuve :
  `tools/e2e/.e2e/dreamer-web/1793923239799-98820-f086bac7-d122-4e96-82d3-2fd946bd8b5a/`.

Commandes de relance depuis la racine :

```sh
mise exec -- deno test --config supabase/functions/deno.json --frozen --allow-env --allow-net=deno.land supabase/functions/api/lib/selfHarmSupport.test.ts supabase/functions/api/routes/chat.test.ts
mise exec -- npm run typecheck:app
mise exec -- npm run test:testerarmy:typecheck
mise exec -- npx eslint services/mocks/geminiServiceMock.ts tools/e2e/tests/dreamer-chat-category.web.e2e.ts
E2E_WORKERS=1 mise exec -- npm run test:e2e:web -- run --grep 'self-harm mentions|plus opens a symbols question once'
git diff --check
```

## Preuves et limites de livraison

Reçu canonique privé : `outputs/product-icon-self-harm-20261106/receipt.json`.
Master de l’image : `outputs/product-icon-self-harm-20261106/icon-master.png`.
Les traces et captures TesterArmy restent dans `tools/e2e/.e2e/`, référencées par
le reçu, sans copie des médias. Les deux premières exécutions officielles ont
réussi leurs 2 parcours mais sont refusées par le garde de stabilité : le fichier
indépendant `tools/e2e/simlock-native.test.mjs` a changé pendant chaque exécution.
Ces résultats ne sont pas une qualification valide.

Pas de build natif, de vérification Store, de push ou de déploiement effectué
pour cette tâche. Une nouvelle version mobile et le déploiement autorisé de
l’API sont nécessaires pour livrer ces changements aux utilisateurs.
