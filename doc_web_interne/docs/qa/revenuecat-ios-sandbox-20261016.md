# iPhone physique — RevenueCat Apple Sandbox — 16 octobre 2026

L’achat Apple Sandbox réel, la restauration du nouveau reçu et le retour après connexion ont
été vérifiés sur l’iPhone du propriétaire. **Deux contrôles finaux e2e ont réussi**, après la
confirmation physique de l’achat ; une continuation Google distincte avait déjà réussi.
L’achat et le retour Google ont une preuve composée, pas un replay automatique sans interruption.

La [preuve structurée expurgée](revenuecat-ios-sandbox-20261016.receipt.json) conserve les identités
source/binaire, versions, empreintes des sources exécutées et rapports, assertions, échecs et limites.
Les rapports SDK et captures d’origine sont privés et immuables ; aucun email, UDID, mot de passe,
session ou reçu JWS brut n’est publié ici.

## Candidat réellement testé

- Source JavaScript : `ed9fb3ff9f244eec4e3a560eb6a91e07b525877f`, Metro local, `mock=false`.
- iPhone physique iOS 27.0.1 ; `com.tanuki75.noctalia`, **3.5.0 (13)**, client développeur Expo
  déjà installé. Révision native compilée inconnue. Aucune qualification Release/TestFlight.
- e2e **0.21.1**, `@e2e-dev/mobile` **0.12.1**, agent-device **0.21.25** ; un worker, zéro retry.
- Compte Noctalia existant ; nouveau testeur Apple Sandbox dédié, email validé, signé dans
  Réglages → Développement. Profil et signature locale conservés pour les campagnes suivantes.

## Résultats et preuve observée

| Parcours | Résultat | Preuve et limite |
| --- | --- | --- |
| Achat mensuel | Qualifié, preuve composée | Feuille Apple « À des fins de test uniquement. Vous ne serez pas débité », compte attendu, confirmation physique du propriétaire, transaction `PURCHASE` du 16:14:51 UTC, `Sandbox`, `noctalia_plus_monthly`, identité concordante, receipt POST HTTP 200, API `is_sandbox=true` / `app_store`, puis assertions e2e Plus actif et quota d’analyses illimité. |
| Restauration | Réussie sur le **nouveau reçu** | SDK restore terminé, receipt POST HTTP 200, aucune erreur native `noAccount`/App Store, toast succès et assertions Plus/quota ; aucun nouvel achat. |
| Retour après connexion | Qualifié, preuve composée | Offre invité puis Google effectué par le propriétaire ; retour au paywall Plus actif capturé, fermeture puis assertions e2e de reprise au premier plan sans réouverture du paywall. Le premier run a rencontré le watchdog XCTest. |

Run final : `01a1457f-095e-7fc0-a711-1317dffa0861`, **2/2 passés**, restauration et continuation
achat/Plus/quota. Continuation Google : `01a14541-69e0-7da8-9e37-38d20ab101a2`, **1/1 passé**.
L’alerte Apple finale « Tout est prêt / [Environment: Sandbox] / OK » a été identifiée en capture
puis acquittée via le pilote avant la suite des contrôles. La feuille StoreKit n’était pas exposée
dans l’arbre d’accessibilité de Noctalia : son assertion initiale reste en échec dans l’historique.

## Échecs utiles et corrections de méthode

- Un toast de restauration cachait initialement `StoreKitInternalError.noAccount`. Ce premier
  résultat UI n’a pas été qualifié ; le contrôle refuse désormais cette erreur, et les restaurations
  natives ultérieures ont été acceptées après connexion Sandbox effective.
- Un abonnement actif empêchait un nouvel achat. Après autorisation explicite et contrôle des
  historiques visibles, un testeur dédié a été créé et la fiche de facturation RevenueCat réinitialisée.
  L’historique Apple n’a pas été effacé. Ce reset exceptionnel n’est pas la procédure de reprise.
- Une réponse API est restée ancienne immédiatement après suppression ; le SDK a ensuite recréé
  le client (HTTP 201), l’app est passée Free, puis l’API a confirmé l’absence de droit.
  Une commande shell sans arrêt sur échec avait laissé poursuivre la chaîne ; le test gardait son
  propre préflight. Utiliser un arrêt effectif des opérations dépendantes.
- Avant validation de l’email, StoreKit a renvoyé une annulation sans nouveau reçu ; sa cause exacte
  n’est pas établie. Après validation, la feuille sans débit puis le nouveau reçu ont été observés.
- Les échecs de scroll, de cible QA Lab, de watchdog et de lecture AX restent dans les preuves
  d’origine. Ils ne sont pas transformés rétroactivement en passages verts.

## Sources livrées et vérification de livraison

Le prototype exécuté contenait des chemins et identifiants locaux. Ils sont externalisés dans
`.env.ios-sandbox.local`, dont le modèle expurgé est `.env.ios-sandbox.example`. La PR ajoute :

- le wrapper, sa configuration et les tests physiques ciblés ;
- une sélection explicite, un achat désactivé par défaut et un opt-in `--allow-sandbox-purchase` ;
- des refus avant geste pour un autre candidat, une identité différente ou un abonnement actif ;
- le traitement du retour à une offre Free **ou** un abonnement Plus déjà actif ;
- ce rapport et la [rétro/procédure de reprise](../revenuecat-qa-workflow.md#ios-physique--réutiliser-la-préparation-sandbox).

Les sources livrées passent types, lint ciblé, syntaxe, découverte SDK, contrôles de refus et
préflight candidat/Metro. Le rejeu natif de livraison a été refusé **avant toute ouverture de l’app**
par le verrou du pilote : l’iPhone était réservé au fil de correction de la pop-in. Aucune session
étrangère n’a été interrompue. Cette tentative n’est pas un nouveau passage natif : les preuves
réutilisées gardent les empreintes exactes du prototype exécuté. Aucun code applicatif n’a changé.
La branche intègre les changements de master ultérieurs au test, limités au site marketing.
La preuve `verify:pr` du commit livré figure dans la PR ; elle ne remplace pas les preuves appareil.

## Rejouer sans refaire la préparation

Depuis le checkout portant le profil privé existant, lancer Metro dans un terminal :

```sh
CI=1 EXPO_NO_METRO_LAZY=1 mise exec -- npm run start -- \
  --profile .env.ios-sandbox.local --dev-client --lan --port 4519
```

Dans un autre terminal :

```sh
mise exec -- node tools/e2e/run-iphone-sandbox-local.mjs --check
mise exec -- node tools/e2e/run-iphone-sandbox-local.mjs --list --grep 'restores receipt'
mise exec -- node tools/e2e/run-iphone-sandbox-local.mjs --grep 'restores receipt'
mise exec -- node tools/e2e/run-iphone-sandbox-local.mjs --grep 'inspects existing subscriber'
```

Préconditions : iPhone disponible/déverrouillé, identité et candidat compatibles, compte Sandbox
validé et connecté, profil privé, pilote signé, état du reçu approprié. Une restauration de Plus
requiert un abonnement encore actif. `inspects existing subscriber` ne rejoue pas le login invité.
`confirms fresh sandbox purchase` est uniquement la continuation d’un achat déjà lancé/horodaté.
Un nouvel achat nécessite le périmètre Sandbox approuvé, l’opt-in du wrapper et une feuille
explicitement sans débit ; ne pas retaper Acheter pendant un achat en attente.

Le propriétaire a ensuite autorisé le maintien durable de DevToolsSecurity activé sur son Mac de
développement pour supprimer les allers-retours d’authentification. Le réglage a été vérifié activé ;
les nettoyages suivants le conservent. Les comptes, profil et signature sont réutilisés.
Aucun paiement réel, aucune mise en production, soumission Store, réinstallation ou effacement
personnel n’a été effectué dans ce lot.
