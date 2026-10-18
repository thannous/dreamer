# Corrections du dogfooding iPhone — 18 octobre 2026

Périmètre : les sept constats IPH-01 à IPH-07 de l’exploration physique du 18 octobre. L’utilisateur demande explicitement de plafonner le compteur affiché à la limite, même si la consommation réelle la dépasse. Aucun changement de consommation, de compte, d’achat ou de production.

## Comportement corrigé

- L’ouverture explicite du rappel place le champ au-dessus du dock avant le premier toucher. Le clavier masque ensuite le dock d’analyse et le défilement ramène la réponse de rappel en vue, y compris après l’ajout d’une première réponse.
- Les détails acceptés restent lisibles pendant le rappel et après Terminer ou Passer. Ils sont lus dans le stockage local existant, sans recopier ou remplacer le récit d’origine. Cette correction de restitution n’ajoute pas de synchronisation du stockage de rappel.
- Une consommation de 9 avec une limite de 3 est affichée `3 / 3`. La limite métier et les données reçues du serveur restent intactes.
- La recherche sans résultat utilise un état vide compact pendant la saisie et réserve l’espace du clavier sur iOS ; Effacer reste accessible.
- Le lien d’information sur la suppression de compte est distingué du bouton destructif. Le mécanisme de confirmation n’est pas modifié.
- Les compteurs de symboles et de caractères ont une forme singulière.
- Les guides pratiques français, les introductions/conclusions des quatre guides de symboles embarqués et les résumés signalés utilisent le tutoiement. Ce lot ne constitue pas une réécriture des articles longs et FAQ publiés sur le site.

## Méthode et limites

Client physique existant Noctalia 3.6.0 (11), `builtByDeveloper=true`, bundle `com.tanuki75.noctalia`, iPhone 17 Pro Max. Chargement du JavaScript corrigé par Metro dédié sur le port 8093, profil réel conservé. Aucun remplacement du binaire ni effacement des données personnelles. Le candidat de base est `e04a1d976a69d43d9d4b28fbed47a4fe534964dc` ; les ajouts natifs Siri arrivés ultérieurement sur master ne font pas partie de cette qualification du client installé.

La campagne `tools/e2e/e2e.iphone-dogfood.config.ts` utilise un seul worker, commence chaque test par `app.open()` et ne réalise aucun achat ni suppression de compte. Le parcours de rappel crée son propre rêve synthétique, refuse d’écraser un brouillon préexistant et vérifie le marqueur avant nettoyage. Les captures privées restent dans `tools/e2e/.e2e/` ; ne pas publier les données du compte.

Commande, depuis la racine du checkout, après avoir chargé le candidat dans le client iPhone :

```sh
E2E_OWNER_IPHONE_DOGFOOD=approved \
E2E_IPHONE_DEVICE_NAME='<iPhone autorisé>' \
E2E_OUTPUT='.e2e/iphone-dogfood-<run>' \
E2E_IPHONE_CANDIDATE_URL='exp+noctalia://expo-development-client/?url=<URL Metro encodée>' \
npx --prefix tools/e2e e2e run --config tools/e2e/e2e.iphone-dogfood.config.ts
```

Utiliser la configuration locale existante du helper Apple signé et libérer sa propre session d’exploration avant d’allouer le worker. Une session déjà propriétaire du téléphone est un blocage de préparation, pas un bug de Noctalia.

Les tests existants couvrent les erreurs de stockage et de dictée que cette courte campagne sur compte réel ne peut provoquer sans modifier l’environnement. Une ancienne assertion cachait volontairement les réponses précédentes : elle vérifie maintenant que l’ancienne réponse est lisible, tout en conservant l’assertion de champ suivant vide pour éviter le mélange des dictées.

La preuve native qualifie ces parcours du client développeur, pas Release/TestFlight, les achats, Siri, VoiceOver ni la synchronisation multiappareil. Les résultats finaux sont consignés dans le rapport privé de campagne et la PR.

## Vérifications locales

Les quatre premières suites ciblées existantes totalisent 68 assertions passées (dont 43 pour le rappel après adaptation de son attente historique). Lint ciblé : aucune erreur, 14 avertissements préexistants. Les deux mocks de route exposent maintenant KeyboardAvoidingView et le compteur attend le singulier : 42 assertions supplémentaires passent dans ces trois suites. Types des parcours TesterArmy : passés. Le typecheck applicatif passe avant la génération du fichier Expo ignoré ; avec `expo-env.d.ts` généré par Metro, 15 erreurs de styles Expo/React Native apparaissent dans trois fichiers inchangés. Une copie intacte du commit de base, avec les mêmes dépendances et le même fichier Expo, reproduit exactement ces 15 erreurs. Cette limite de la configuration générée reste distincte de la preuve du moteur de livraison.
