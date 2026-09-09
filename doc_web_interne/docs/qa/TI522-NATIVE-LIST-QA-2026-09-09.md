# TI-522 — qualification native bornée de la liste, 9 septembre 2026

## Identité et méthode

PR #163, arbre produit df2ebebf2 annoncé par le parent. Route testée SHA256 `74dca7e19845cba4d3834591797a05ed721e7a1c9cddf1d2f3af0bd3d3a491ad`, identique octet par octet à /private/tmp/noctalia-import-list/app/lucid/journal-import.tsx. LucidUI SHA256 `4897279b84bd7cb83924b715f79232b40194771eba6b5be1c6091c3b0780752e`; ScreenContainer `81c185c39ca9dc724b550357d37ecaeba387e80c1b47edd2f91ac754c9857ca2`.

AVD existant shapier_360dp_api36, emulator-5554, Android36, 1080x2340; préservé, sans wipe ni installation. Binaire déjà installé com.tanuki75.noctalia.lucid DEBUGGABLE version3.1.0 code54, mis à jour le22août. Exécution JavaScript via le script canonique `npm run start:lucid:mock -- --port 8082`, copie QA /private/tmp/noctalia-ti522-native-qa. Aucun rebuild natif : ce résultat qualifie cette combinaison JS/binairedebug, pas un nouveau binaire release.

Seul le hook useLucidJournalImport est remplacé dans la copie QA par une fixture React en mémoire, 0/1/2501 copies synthétiques. Aucun appel OAuth, aucune lecture/écriture du stockage d'import ni modification de jetons. Production route et composants inchangés. Les métadonnées sont synthétiques. Toute modification du nombre a été chargée avec Reload explicite du menu devclient (Fast Refresh désactivé), puis réouverture du deep link noctalia-lucid://lucid/journal-import. Les premières captures préliminaires sont exclues de l'acceptation finale.

## Résultats

- 0 : état No local copies yet., sans crash, preuve ti522-zero.xml/png.
- 1 : copie0001 et pied de liste Delete all copies accessibles après défilement. Suppression individuelle avec dialogue natif de confirmation ; retour à l'état vide, fixture absente. Preuves ti522-one.xml, ti522-delete-confirm.xml, ti522-one-deleted.xml.
- 2501 : ouverture sans crash, titre et consentement visibles ; défilement natif depuis la première copie jusqu'aux copies0004/0005, au-delà des4 initiales. Preuves ti522-2501-final-header.xml/png et ti522-2501-final-scroll.xml.
- Édition copie0005 : champ ouvert et texte QA_EDIT entré au clavier natif. Preuves ti522-2501-final-edit.xml/png et ti522-2501-final-saved.xml. Malgré son nom, ce dernier fichier montre encore un EditText focalisé et le bouton Save locally : il ne prouve pas la sauvegarde ni le retour à la carte. La sauvegarde native reste non qualifiée dans cette passe.
- Texte150% : header final avec espace entre cartes, texte et boutons sur plusieurs lignes sans coupe ; liste défilable jusqu'aux copies. Preuves ti522-2501-final-large.png et ti522-2501-final-large-scroll.xml/png. Font scale restauré à1.0 et relu.

## Limites

La2501e copie n'a pas été atteinte par défilement manuel. Aucun saut programmatique ni instrumentation scrollToEnd n'a été ajouté; ne pas annoncer une preuve native d'exhaustivité jusqu'au dernier élément. Le fixture contient2501 objets, mais ce test ne compte pas les vues React montées et ne mesure ni FPS, CPU ou gain mémoire. Les tests automatisés de virtualisation sont une autre preuve.

Pas de qualification OAuth réel, SQLite/SecureStore, persistance après relance, changements de compte réels, import réseau ou hors ligne. Aucun appareil Motorola connecté. Aucun test TalkBack, Bluetooth ou lecteur Meditation dans cette session.

Un avertissement ExpoRouter React state update before mount est apparu après rechargement/configuration de police pendant la préparation, sans blocage durable. Le parcours final après Reload a affiché la liste et fonctionné; la capture finale150% ne contient plus cet avertissement. Ce n'est pas une validation de démarrage release.

Tous les artefacts sont sous /private/tmp. Aucun changement produit ou Git par QA. Aucun secret copié. Le verrou Noctalia physique était vide; protocole ignore les émulateurs. AVD lancé seulement après absence vérifiée de processus concurrent. Nettoyage ressources effectué par QA à la fin (font1.0, reverse8082 retiré, Metro/AVD propres arrêtés).


Les preuves retenues sont sauvegardées dans [ti522-native-list-2026-09-09](ti522-native-list-2026-09-09/). Les chemins /private/tmp ci-dessus décrivent le contexte d’exécution.
