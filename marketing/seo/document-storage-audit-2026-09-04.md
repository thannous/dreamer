# Audit documentaire SEO et préparation du rangement

Suite exécutée après autorisation de l'utilisateur : voir l'[index d'archive](archive-index.md) et le [manifeste de migration](drive-migration-manifest-2026-09-04.csv). 191 fichiers transférés et vérifiés, 172 copies locales retirées ; 19 documents décisionnels conservés aussi dans le dépôt. Le reste de ce document décrit l'audit initial avant transfert.

État : AUDIT_STRUCTUREL_TERMINE / RANGEMENT_PREPARE / AUCUN_TRANSFERT.
Périmètre : fichiers présents dans le worktree `1cba`, branche `codex/seo-j42-flying-evidence`, HEAD `f710f2d99`. Aucun fetch ni changement de branche. Cet inventaire n'est pas une vérification du master distant actuel.

## Constat

Avant ajout de cet audit : 337 fichiers, 26 452 443 octets (26,45 Mo décimaux), dont 273 suivis et 64 non suivis. Aucun doublon strict SHA-256 entre les 337 fichiers. Les doublons sémantiques restent à examiner.

Le README historique Ahrefs compte 434 lignes et mélange index, chronologie et états successifs. La racine SEO ne possédait pas de README : un point d'entrée court est maintenant préparé. L'objectif principal est la lisibilité, pas le gain disque.

## Classement proposé

| Classe CSV | Fichiers | Octets | Traitement |
| --- | ---: | ---: | --- |
| REFERENCE | 50 | 511426 | Conserver : registres, autorisations, baselines, inspections, décisions, provenance et procédures. |
| WIP | 17 | 154996 | Conserver les documents locaux modifiés ou non suivis, dont hospital J50. |
| RECENT | 10 | 54657 | Conserver les lots récents jusqu'à clôture et vérification des mesures. |
| ARCHIVE_CANDIDATE | 133 | 685973 | Rapports datés candidats, à relire et condenser avant toute migration. |
| REVIEW | 69 | 855352 | Dossiers mixtes : déterminer ce qui reste actif avant de décider. |
| RAW | 58 | 24190039 | Exports CSV/JSON GSC : destination privée Drive proposée, revue de confidentialité et de dépendances requise. |

Le classement est prudent et fondé sur les chemins, noms, formats et statut Git, avec lecture ciblée des registres, du guide Drive et d'un rapport de prospection. Ce n'est pas une relecture exhaustive des 337 contenus. L'ancienneté ne prouve pas la clôture. Les 133 candidats ne sont donc pas une liste de suppressions validées.

L'inventaire donne pour chaque fichier le chemin exact, la taille, SHA-256, statut Git, classe et nombre de fichiers suivis contenant son chemin ou son nom. 296 fichiers ont au moins une référence détectée. Cette recherche textuelle couvre les fichiers texte suivis jusqu'à 2 Mo hors docs générés et fichiers lock ; elle ne résout pas tous les liens et ne couvre pas les dépendances externes ou les autres worktrees.

## Priorités concrètes

1. Conserver les contrats et traces de publication des expériences, les registres d'autorisation et le journal d'outreach. Une archive de prospection ne doit pas faire perdre les refus, relances déjà envoyées ou restrictions.
2. Traiter les 58 exports GSC comme premier lot de transfert privé. Huit exports image sont déjà suivis dans Git ; cinquante exports web sont non suivis. Les rapports Markdown présents à côté sont classés séparément et conservés. La règle actuelle `.gitignore` ne couvre pas les exports imbriqués sous `search-console/web/` ; une correction ciblée est à préparer avec le prochain lot technique, sans ignorer les rapports durables.
3. Relire les séries `editorial-discovery-wave-*`, `backlink-measurement-check-*` et les rapports quotidiens Ahrefs candidats. Extraire leurs décisions encore valides dans un registre compact avant transfert du détail.
4. Conserver les 69 dossiers mixtes en place tant que leur statut métier n'est pas réconcilié. Ne pas déduire qu'un brouillon, une autorisation ou une opportunité a expiré.

## Organisation Drive proposée

Réutiliser le [dossier SEO existant](https://drive.google.com/drive/folders/1nnOpNuAan4atNGDBWuozWZYh_2csgOAa), dont l'identifiant provient du registre versionné. Accès et contenu actuels non vérifiés pendant cet audit.

- Dossier maître Ahrefs existant : conserver les lots déjà archivés, puis créer des archives datées pour les lots ultérieurs réellement clôturés.
- `Archives autorité/2026-07_2026-08/` : rapports de recherche et contrôles clôturés, après extraction des décisions et restrictions.
- `99 - Preuves brutes/GSC/{web,image}/{début}_to_{fin}/` : exports dans leur format original, avec fenêtre et type de recherche conservés.

Ce sont des destinations proposées, pas des dossiers créés. Ne pas verser les nouveaux lots dans « Clôture J25-J27 » par défaut.

## Conditions de migration

La politique existante dans `drive-archive-2026-08-11.md` désigne Git comme source de vérité des rapports durables et Drive comme copie. Elle devra être mise à jour explicitement pour les rapports historiques dont Drive deviendrait l'emplacement principal ; les registres décisionnels resteront dans Git.

Le registre ancien documente aussi un refus de transfert de données GSC brutes pour confidentialité. Aucun envoi brut n'est effectué par cet audit. Le prochain transfert devra préciser les payloads et le dossier privé et respecter cette restriction.

Pour chaque lot approuvé :

1. Relire les candidats et confirmer leur clôture ; identifier leurs dépendances et préserver les décisions actives.
2. Vérifier le dossier Drive et ses permissions ; rapprocher les fichiers existants des identifiants des deux manifestes de synchronisation. Ne pas créer de doublons par nom.
3. Transférer les versions retenues sans modifier le partage ; vérifier taille et contenu/empreinte, et rouvrir les fichiers de contrôle.
4. Enregistrer chemin d'origine, version Git ou statut local, SHA-256, identifiant Drive, URL et date de vérification.
5. Remplacer les références par l'index d'archive avant de retirer les copies locales approuvées. Vérifier aussi les références dans les autres worktrees concernés.
6. Isoler la modification documentaire de hospital et des autres lots SEO. Aucun nettoyage d'historique Git : retirer un fichier suivi ne l'efface pas des anciens commits.

## Limites et résultat

Aucune suppression, déplacement, mutation Drive, dépense Ahrefs, publication, commit ou push. Les sources du site et le WIP initial sont conservés.

L'audit structurel et la proposition de rangement sont prêts. Restent la relecture métier des candidats, la vérification live de Drive et l'autorisation du lot de transfert exact. Aucun rapport n'est déclaré sauvegardé sur la seule base d'un lien historique.
