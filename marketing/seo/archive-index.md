# Archives SEO Noctalia

Migration du 4 septembre 2026, autorisée par l'utilisateur : transfert complet des fichiers retenus par l'audit et suppression de leurs copies locales après vérification.

## Vérification du transfert

191 fichiers source sont présents dans les dossiers cibles, sans doublon d'identifiant, avec taille distante conforme. 185 fichiers ont une empreinte SHA-256 identique après relecture du contenu Drive. Les six `summary.json`, non rendus en texte par le connecteur, ont été téléchargés intégralement vers une référence de fichier et vérifiés par taille ; leur empreinte distante n'a pas été comparée. Le manifeste distingue ces deux niveaux de contrôle.

L'inventaire technique est également sauvegardé sur Drive et sa relecture SHA-256 est conforme. Les refus automatiques initiaux ont été levés après confirmation explicite de l'utilisateur et vérification de l'identité du compte, des permissions des sous-dossiers et du contenu agrégé du dernier JSON. Aucun partage public n'a été ajouté.

## Emplacements

- [Manifeste de migration sur Drive](https://drive.google.com/file/d/11D6H8Vc6jxQ-tHV40fp3EjD5Zf46w-Ww/view?usp=drivesdk).
- [Archive privée](https://drive.google.com/drive/folders/1dZO9n8VbFIjkXwcvKeR3zuwqvJXJwwv1).
- [Rapports d'autorité](https://drive.google.com/drive/folders/1aQUMcpWbL3C4MJU_j652YM_BJYzc9ZqP).
- [Rapports Ahrefs historiques](https://drive.google.com/drive/folders/1Jlz7YC0qnvV1QrEvOFl5Bo0Y-v2bVYVl).
- [Exports GSC, séparés par type et période](https://drive.google.com/drive/folders/1cEPAWEhbMV1auTi6iwBlGkjNnZbf87JF).
- [Inventaire avant migration](https://drive.google.com/file/d/1oAMuVrnu5rrqvUvtUjyQu0Q24er4otjO/view?usp=drivesdk).

Les permissions ont été lues dans Drive : le nouveau dossier et les six sous-dossiers GSC appartiennent au compte connecté et ne sont pas partagés. L'ancien dossier `03_SEO` est accessible par lien ; il n'a pas été modifié. Les nouveaux fichiers sont conservés dans l'archive privée séparée.

## Répartition et conservation

Nettoyage local vérifié : 172 fichiers retirés (114 rapports et 58 exports), soit 24 688 059 octets. Dix-huit liens Markdown ont été remplacés par leurs destinations Drive ; aucun lien Markdown local restant ne pointe vers ces fichiers supprimés. Les sept notes GSC conservées portent un lien vers leur dossier d'exports. Les six fichiers source et scripts SEO protégés par empreinte restent inchangés. `git diff --check` passe.

Le lot contient 133 rapports historiques et 58 exports GSC, soit 191 fichiers source. Dix-neuf documents décisionnels sont sauvegardés mais conservés aussi dans Git : priorisation J10, contrôle des facteurs confondants J18, décision et preuves J24, brief cemetery, lots J34–J39, tableau de décisions d'autorité, contrôle préalable aux relances et journal d'exécution 90 jours.

Les autres registres, autorisations, dossiers actifs, travaux locaux et expériences restent dans le dépôt. Le lot hospital J50 n'est pas publié par ce rangement. Les métriques historiques ne deviennent pas des valeurs actuelles du fait de leur archivage.

## Restauration et usage

Le [manifeste de migration](drive-migration-manifest-2026-09-04.csv) associe chaque chemin d'origine à son identifiant Drive, son URL, son empreinte SHA-256 source et la méthode de vérification distante. Télécharger le fichier dans son format d'origine, vérifier son empreinte avec `shasum -a 256`, puis le replacer au chemin indiqué si une analyse a besoin de l'export local. Ne pas convertir les CSV en Google Sheets pour cette restauration.

Les futurs exports CSV/JSON datés sous `search-console/` sont ignorés par Git ; les plans et notes Markdown restent suivables. Les scripts d'analyse acceptent un répertoire d'entrée : restaurer les exports nécessaires avant de rejouer une analyse historique.

Une sauvegarde de récupération avant nettoyage existe aussi localement : `/private/tmp/noctalia-seo-before-cleanup-2026-09-04.tar.gz`, SHA-256 `a6e27e577f8e5d1ef7bfa664db7c37eff1c1a7cabadf0d8965c9f3417a91d2c1`. Cette copie temporaire complète l'archive Drive et ne la remplace pas.

Retirer un fichier suivi du worktree ne l'efface pas des anciens commits Git. Aucun nettoyage d'historique, changement de partage, commit, push ou déploiement n'est inclus dans cette migration.
