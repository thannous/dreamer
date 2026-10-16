# Apparence native et palettes dynamiques — 16 octobre 2026

Responsable : fil `popup-native-theme`, PR #382. Périmètre : cohérence du thème
natif de Dreamer et observation de la confirmation Apple StoreKit. Aucune
publication demandée. La fusion de la PR est ensuite autorisée par le propriétaire.

## Résultat observé sur iPhone

Le 16 octobre à **19:26, heure de Paris**, la confirmation « Tout est prêt /
Votre achat a bien été effectué / Environment: Sandbox » a été capturée en
**sombre, avec titre blanc**, après sélection du thème dynamique et chargement
du correctif. Le texte, le bouton bleu OK et la forme restent ceux d’Apple.
La capture initiale de référence avait un fond clair ; son réglage d’apparence
au moment de l’achat n’a pas été enregistré. La comparaison qualifie le rendu
observé après correction, pas tous les modes ni une causalité contrôlée avant/après.

Le client physique est Noctalia **3.5.0 (13)**, installé pour le développement,
iOS **27.0.1**. Sa révision native compilée est inconnue. Le JS contrôlé vient de
`8dcdb38d1c9ad6579da29959dee16fbd8eeef734` (préparation TesterArmy),
servi depuis le worktree de cette PR sur Metro **4521**. Aucune réinstallation,
aucun effacement de données, compte nouveau ou reset billing. Cette observation
ne qualifie pas un binaire Release/TestFlight ultérieur.

## Cause contrôlée par l’app

Uniwind 1.12.2 remet `Appearance` en mode système pour les palettes personnalisées
`morning` et `afterglow`. Avec un système clair et la palette du soir sombre,
le style natif pouvait donc rester clair. Après `Uniwind.setTheme`,
[ThemeContext](../../../context/ThemeContext.tsx) applique le mode clair/sombre
de la palette dynamique sur les plateformes natives. L’option `auto` conserve
le suivi du système. Références :
[React Native Appearance](https://reactnative.dev/docs/appearance) et
[WWDC25, StoreKit](https://developer.apple.com/videos/play/wwdc2025/241/).

## Parcours physique et limites

- Le reçu mensuel précédent a expiré naturellement ; aucun achat n’a été lancé
  pendant ses renouvellements automatiques. API et identité native fraîche
  contrôlées avant la nouvelle tentative.
- Le wrapper versionné vérifie source propre, profil stable, worktree Metro,
  correspondance nom/UDID et version du client. Un seul worker ; e2e 0.21.1,
  mobile 0.12.1 et agent-device 0.21.25. DevToolsSecurity est resté activé selon
  l’autorisation durable du propriétaire.
- Premier run arrêté avant l’achat : le thème existant était **Sombre**, alors
  que le contrôle exigeait Dynamique. Le run suivant a mémorisé ce choix et
  sélectionné temporairement **Dynamique** par l’interface réelle.
- Préparation TesterArmy : **1/1 passed**, jusqu’à un seul appui Acheter et sa
  capture. Cette réussite ne prétend pas qualifier une transaction terminée.
- La feuille Apple a été lue visuellement : « À des fins de test uniquement »
  et absence de débit, bon produit mensuel. Le propriétaire a confirmé avec le
  bouton latéral et laissé l’alerte finale ouverte, selon sa réponse dans ce fil.
- Le vérificateur existant relie la tentative, cette confirmation humaine, une
  transaction native **Sandbox / PURCHASE** (pas RENEWAL), son compte, son
  produit et le reçu RevenueCat **app_store / is_sandbox=true**, avec le même
  identifiant de transaction et une date cohérente. Aucun deuxième achat.
- La capture et l’arbre natif montrent ensuite l’alerte reconnue et son bouton
  OK. Acquittement après capture ; restauration du réglage initial Sombre.
  Le suivi récurrent est désactivé une fois l’observation obtenue.

Cette preuve est composée : préparation automatisée, geste physique du
propriétaire, transaction/reçu concordants et inspection visuelle. Ce n’est pas
un unique rejeu automatisé de tout le cycle d’achat, ni une nouvelle qualification
des quotas, du renouvellement, de la restauration ou d’un binaire de distribution.

## Artefacts et relance

Preuves privées, hors Git :

- `tools/e2e/.e2e/native-alert-iphone-20261016/` : capture finale
  `completion-alert.png`, préflight, état, attestations, preuve de transaction,
  journaux et traces agent-device. Ne pas publier emails, JWS ou clés.
- `tools/e2e/.e2e/owner-iphone-sandbox-1792171186281/` : échec du premier
  prérequis de thème, sans achat.
- `tools/e2e/.e2e/owner-iphone-sandbox-1792171395451/` : préparation passée,
  trace, capture du thème choisi et feuille Apple.

Relance : profil privé `.env.ios-sandbox.local` pointant sur les preuves de ce fil,
le pilote signé existant, le compte validé et Metro 4521. Lire le runbook
[RevenueCat QA](../revenuecat-qa-workflow.md). Une tentative déjà amorcée doit être
reprise sans acheter à nouveau. La préparation actuelle exige Dynamique déjà
sélectionné sans le modifier ; si une préparation manuelle le change, restaurer
le choix initial après le contrôle.

```sh
CI=1 EXPO_NO_METRO_LAZY=1 mise exec -- npm run start -- --profile .env.ios-sandbox.local --dev-client --lan --port 4521
mise exec -- node tools/e2e/run-iphone-sandbox-local.mjs --check
# Uniquement après expiration du reçu et en l’absence de tentative en attente :
mise exec -- node tools/e2e/run-iphone-sandbox-local.mjs --grep 'prepares Sandbox confirmation visual inspection' --allow-sandbox-purchase
```

## Corrections de revue avant fusion

La revue du head `038e1be40d` a identifié trois points corrigés avant fusion :

- React Native expose le mode forcé de l’app, sans API publique pour lire le mode
  système sous cet override. `systemMode` est désormais inconnu (`null`) sur
  natif hors Auto ; l’option Auto garde sa description générale sans annoncer
  un faux mode système. Son indication réapparaît quand le système est suivi.
  Le navigateur conserve sa vraie préférence `matchMedia`.
- La préparation physique ne sélectionne plus de thème : elle exige Dynamique
  déjà coché et referme le sélecteur même si ce prérequis échoue. Aucun réglage
  personnel modifié à restaurer par ce test. La restauration manuelle observée
  dans la preuve historique ci-dessus reste un fait de cette ancienne exécution.
- Une assertion attend une mention Sandbox/test sur la feuille Apple avant la
  capture et avant de déclarer la préparation réussie. Une absence de feuille
  échoue ; la tentative reste enregistrée pour ne jamais acheter une seconde fois.

Les assertions isolées ont reproduit le faux mode système avant correction,
avec l’absence d’indication trompeuse après correction : **10/10** tests de
contexte/préférences et typecheck TesterArmy passés. Cette exception isolée couvre
la frontière native que les parcours navigateur ne peuvent pas observer.
La dernière préparation avec assertion StoreKit n’a pas été rejouée sur iPhone :
aucun achat supplémentaire pour la fusion. L’effet appliquant le mode natif est
inchangé ; la capture physique reste attribuée à `8dcdb38d1c9a`, sans prétendre
qualifier une exécution fraîche du nouveau test.

## Autres contrôles du correctif

Sur `e79f04ad0f77685566723d5184de98b4b9ee0f20` : 5/5 tests ThemeContext et
2/2 parcours web FR frais (choix clair/sombre, persistance et retour à auto),
services simulés, aucun modèle. Les deux nouveaux contrôles isolés reproduisaient
`dark` attendu / `light` obtenu avant correction ; ils couvrent soir/matin et la
libération du style en revenant à auto. Exception : le navigateur ne lit pas
Appearance natif ; ces mocks protègent la frontière API sans prouver un rendu iOS.
Ces entrées applicatives sont inchangées dans le candidat physique.

Artefact web canonique :
`tools/e2e/.e2e/dreamer-web/1792167875157-73998-ee4bbe16-5c5f-4f2f-bb2f-957e8227e047/`.
Le premier lancement avait refusé un lien de dépendances non ignoré
(`SOURCE_SYMLINK`), corrigé dans la préparation locale sans modifier les gardes.
Le contrôle CDP optionnel du 16 octobre avait échoué faute d’Origin ; il ne
constitue pas une preuve native et n’a pas été nécessaire au résultat StoreKit.

```sh
mise exec -- npm run test:testerarmy:typecheck
mise exec -- npm run test:file -- context/__tests__/ThemeContext.native.test.tsx context/__tests__/ThemeContext.test.tsx
E2E_WEB_PORT=4520 E2E_WEB_LOCALE=fr-FR mise exec -- node tools/e2e/run.mjs dreamer web run --grep 'grouped settings preserve'
mise exec -- npm run verify:pr
```
