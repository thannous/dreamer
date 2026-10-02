# J79 — trois actions SEO ciblées (2 octobre 2026)

## Périmètre et état
Thanh a demandé « ok lance ces 3 action ciblés » après le diagnostic J79. Codex assure l’intégration dans `codex/seo-j79-targeted`, basée sur `7df7752d66bbca7e695c4763f63c1f581cc08ac7`. Le lancement explicite de ce lot applique la préférence permanente de livraison complète après validation (commit, push, publication). Une fusion sur master déclenchera Cloudflare production; vérifier le SHA, les contrôles distants et le contenu servi. À la rédaction de ce compte rendu, seule la validation locale est terminée; la publication reste à vérifier séparément.

1. **Scale IT** : title descriptif, introduction contextualisée, cinq variantes développées et exemple inventé explicitement identifié; lien vers la méthode du journal. Le guide des lieux contient déjà la carte Scale, pas de lien artificiel ajouté. Le H1 conserve le modèle partagé des symboles pour éviter un changement de générateur.
2. **Observation des lots récents** : revue du 6 octobre enrichie dans l’automatisation existante. Même cadence et échéance; dix perdantes suivies à requête/appareil constants, statut du spam update vérifié, aucun nouveau changement systématique sur les lots protégés. Le lot S2 garde son T0 du 1er octobre et ses fenêtres propres.
3. **FR/EN** : scénario et FAQ « maison en travaux », variante maison inconnue conservée, FAQ rendues moins affirmatives; un exemple fictif annoté dans l’article travail EN. Comparatif : six lignes corrigées (Noctalia, Oniri, Rosebud, Dreamz Journal, DreamStream, DreamNotes). Les cinq traductions, CSV et SVG partagent les mêmes faits, comptes et version; aucune nouvelle page concurrente.

## Sources vérifiées le 2 octobre
- Oniri : https://www.oniri.io/ et https://play.google.com/store/apps/details?id=io.oniri.oniriapp — Android public, voix/images/export et outils lucides annoncés.
- Rosebud : https://help.rosebud.app/tools-for-growth/voice-journaling et https://www.rosebud.app/ — saisie vocale annoncée; l’ancienne URL dédiée aux rêves redirige vers l’accueil.
- Dreamz Journal : https://dreamz-journal.com/ — images IA annoncées dans Premium, iOS et Android toujours annoncé.
- DreamStream : https://apps.apple.com/us/app/dreamstream-dream-journal/id6758463546 — fiche iPhone/iPad, images, rappels de réalité et exports annoncés; le statut « accès anticipé » est remplacé.
- DreamNotes : https://apps.apple.com/us/app/dreamnotes-dream-journal-app/id6474638398 — historique de version avec import/export; aucune affirmation d’audit de confidentialité.
- Noctalia : https://play.google.com/store/apps/details?id=com.tanuki75.noctalia et interface https://dream.noctalia.app/ — journal disponible dans le navigateur observé, sans saisie ni sauvegarde de données de test.
- DreamApp, Dreamiary et DreamKit : sources publiques relues, dates des lignes conservées en l’absence de révision complète de leurs champs. Dreamlab et DreamMirror non revérifiables par l’outil web dans cette revue : pas de nouvelle date ni de conclusion de fermeture.

Les fonctionnalités concurrentes sont des déclarations de leurs éditeurs, pas des mesures ou validations pratiques. Les cinq lignes non corrigées gardent leur date précédente. Les compteurs normalisés sont 10/11 pour l’IA, 8/11 pour la voix, 6/11 pour les images et 4/11 pour la structure lucide; ils incluent les anciennes déclarations DreamKit explicitement signalées.

## Validation
Node local 24.19.0, conforme à mise.toml; mise absent mais runtime déjà conforme. Dépendances du même commit réutilisées sans changement de lockfile.

Avant modification du comparatif, le contrat existant a été adapté pour dériver les comptes et la date du CSV. Risque couvert : chiffres HTML/SVG et version JSON-LD divergents dans une traduction, qu’une seule inspection visuelle EN ne détecterait pas. Pas de nouveau test unitaire. Les 11 cas existants passent avant et après la mise à jour des données.

- `npm run docs:build` et `npm run docs:check` : 1 264 pages, zéro erreur et zéro avertissement.
- `npm run test:file -- scripts/alternatives-page-contract.test.js --watchman=false` : 11 tests réussis.
- `git diff --check` et lint du contrat de comparaison : réussis.
- `npm run test:prepush` : prévu une seule fois sur le commit propre final avant le push.
- Interface locale `npm run docs:dev -- --port=8789` : Scale, maison, travail et comparatif EN inspectés à largeur de fenêtre 390 px (contenu 382 px après barre de défilement); aucun débordement de page. Lien italien vers le journal cliqué avec destination correcte. Exemple fictif visible. Tableau comparatif de 11 lignes, dates et limites visibles; graphique inspecté sur bureau.
- L’aperçu Wrangler local échoue avant démarrage sur son binaire workerd. La vérification via docs:dev couvre contenu et rendu; elle ne qualifie pas le runtime Wrangler ni une publication Cloudflare.

Captures, logs et contrôle de périmètre restent hors Git dans le dossier de preuves J79. Aucun build mobile ni gain SEO annoncé. La première mesure de chaque nouveau lot commencera seulement après sa publication réelle et la finalisation GSC.
