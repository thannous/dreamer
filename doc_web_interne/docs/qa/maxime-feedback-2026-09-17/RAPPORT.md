# Retours de Maxime — reproduction et corrections Android

Source : conversation « Noctalia amélioration », 16 septembre 2026, 22:14–22:30.
Tickets : TI-604, TI-605, TI-606, TI-607, TI-608.
Branche conservée : `codex/illustration-quality-20260916`.

## Environnement

- Émulateur `emulator-5554`, Android API 36, arm64, 1080 × 2340, densité 440.
- Application existante `com.tanuki75.noctalia`, 3.1.0 / versionCode 54, debuggable, installateur null.
- Aucune installation, désinstallation ou suppression de données.
- Serveur existant 8081 laissé actif ; serveur dédié démarré avec `npm run start:mock -- --port 8082 --localhost`, accessible par `adb reverse`.
- Reproduction et vérification en français, tailles système 100 % et 150 %. Taille initiale 150 %, restaurée après les essais.
- Rêves fictifs du profil mock Plus ; réponses et persistance simulées. Aucun résultat ne qualifie le backend réel, le binaire Play, iOS ou la production.

## Constats et correctifs

| Ticket | Reproduction | Correction |
| --- | --- | --- |
| TI-604 | À 100 %, les indicateurs occupaient quatre/cinq colonnes étroites ; « 0 jours » passait sur deux lignes. À 150 %, la disposition verticale existante était déjà lisible. | Suppression de `min-w-0`, qui annulait la largeur minimale de 140. Les indicateurs passent désormais sur plusieurs rangées. |
| TI-605 | À 150 %, les descriptions de Récap hebdo, Alerte de série et Retour en douceur étaient tronquées. Apparence et Langue présentaient également des coupures. | Suppression de la limite de deux lignes des descriptions ; libellé et valeur des préférences empilés sur petit écran / texte agrandi. |
| TI-606 | La formulation signalée était toujours présente dans la source. | Texte français précisant l’aide au rappel, le rêve déjà enregistré et le caractère facultatif. Action « Explorer mes souvenirs ». Carte vérifiée après enregistrement d’un récit fictif. |
| TI-607 | Clavier ouvert et brouillon multiligne : la réponse IA restait visible à travers le champ. | Fond opaque issu du thème sur Android ; flou réservé à iOS. Brouillon lisible après correction, puis envoi explicite vérifié. |
| TI-608 | Le rêve fictif Ocean of Stars avait un seul angle traité. « Continuer ma réflexion » ajoutait automatiquement la question sur les symboles et passait à 2/3. | Reprise sans paramètre déclenchant une question ou une synthèse ; quota de navigation nul. Les sujets rapides restent proposés tant qu’un angle manque. |

Défauts similaires traités : cartes des angles trop étroites (libellés complets, retour sur plusieurs rangées et empilement à 150 %) ; date du rêve non contrainte pouvant empiéter sur l’heure (largeur flexible et espacement).

## Parcours vérifiés

- Tendances avec profil vide avant correction, puis données fictives et cinq indicateurs après correction à 100 %.
- Reprise de la conversation à 1/3 puis 2/3 sans ajout automatique de message.
- Choix explicite Symboles puis Croissance : les réponses simulées font progresser à 3/3.
- Nouvelle reprise à 3/3 : le bouton « Générer la synthèse 360° » est visible ; aucune synthèse n’est déclenchée par la navigation.
- Champ multiligne au-dessus du clavier à 150 %, brouillon lisible et envoi explicite fonctionnel.
- Enregistrement d’un récit fictif puis lecture de la nouvelle carte facultative à 100 %.
- Descriptions complètes des trois rituels et préférences Apparence/Langue lisibles à 150 %.
- Cartes des angles empilées et entièrement lisibles à 150 % ; date et heure sans recouvrement dans le détail du rêve.

Les captures et arbres UI voisins documentent ces observations. Le logcat filtré a confirmé un appel automatique à 00:02:51 avant correction ; les appels à 00:11:52 et 00:13:21 correspondent ensuite aux choix explicites Symboles et Croissance. Aucun appel supplémentaire à la reprise à 3/3. Les logs temporaires restent hors du commit.

## Validation locale

- 108 tests distincts réussis sur 7 suites ciblées : dreamUsage, reflectionNavigation, statisticsScreen, SettingsFieldGroup, Composer, journalDetailSavedConfirmation, journalReflectionCriteria.
- `npm run typecheck:app` et `npm run typecheck:tests` réussis.
- Lint des fichiers touchés : aucune erreur ; avertissements React préexistants dans les routes Journal et Chat, hors lignes modifiées.
- `git diff --check` réussi sur le périmètre du correctif. Le contrôle global signale une ligne vide finale dans le WIP préexistant de `recordingScreen.test.tsx`, laissé intact.

## Limites et préservation

Un changement de taille système effectué pendant que l’application tournait a produit une erreur native Expo Compose (`LifecycleRegistry ... already destroyed`). Les essais suivants ont changé la taille après arrêt de l’application et redémarré le même binaire. Ce défaut de cycle de vie natif n’est pas qualifié ni corrigé par ce lot UI.

Les modifications préexistantes de Capture, icônes, traductions de Capture, `.mcp.json`, autres preuves QA et sorties temporaires sont exclues du commit. Seules les trois clés françaises `dream_recall.offer.*` de ce lot sont incluses depuis le fichier de traduction partagé.

Avant le correctif, la PR existante #176 avait déjà un échec `ci/circleci: noctalia-quality`. Les autres vérifications affichées étaient réussies. Aucun merge ni déploiement de production n’est effectué dans ce lot.
