# Noctalia — passation Higgsfield / Seedance 2.5

Dernière vérification : 2026-08-10.

Ce document permet de reprendre la production Noctalia sur un autre ordinateur
qui possède déjà le dépôt `dreamer` sur `master`. Les médias ne sont pas stockés
dans Git : ils restent dans Google Drive et sont accessibles avec le même compte
connecté à Codex.

## Sources de vérité

- [Dossier principal Noctalia dans Google Drive](https://drive.google.com/drive/folders/1XcIaDxqf7KD-1hgZesDuNUcazIC9oxVW)
- [Inventaire Google Sheets des 32 paires](https://docs.google.com/spreadsheets/d/1rHw5WG4HVeiL-vDlV6TfSNVs5-1JW-scovcb0CZeMNk/edit)
- [`MEDIA-INVENTORY.md`](./MEDIA-INVENTORY.md) pour l'état éditorial et le QC
- [`HIGGSFIELD-GENERATION-MANIFEST-02.json`](./HIGGSFIELD-GENERATION-MANIFEST-02.json)
  pour la liste portable des assets et les réglages

Google Drive est la source des fichiers image et vidéo. Google Sheets est la
source de l'état des paires et de leurs liens. Git est la source des règles,
prompts, manifestes et procédures. Un fichier présent dans Drive n'est pas
automatiquement validé pour publication.

## Reprise sur le second ordinateur

1. Synchroniser le dépôt existant :

   ```bash
   git switch master
   git pull --ff-only
   ```

2. Ouvrir Codex avec le même compte, puis connecter Google Drive et Higgsfield.
   Les médias seront récupérés depuis Drive ; ne pas copier de cookies, tokens
   ou profils de navigateur depuis le premier ordinateur.
3. Vérifier que le dossier Drive et l'inventaire Sheets ci-dessus sont
   accessibles.
4. Dans Higgsfield, vérifier les réglages avant chaque lancement : Seedance 2.5,
   15 secondes, 9:16, 720p, bitrate High, audio activé et mode Unlimited.
5. Utiliser exactement une image de référence par vidéo afin de ne pas mélanger
   les thèmes.
6. Lancer une seule génération à la fois. Attendre sa fin, vérifier le résultat,
   le télécharger, le classer dans le dossier Drive du thème, puis mettre à jour
   l'inventaire avant de passer à la suivante.

## Capacité et surveillance

- moyenne observée : 10 à 12 minutes par vidéo ;
- fourchette habituelle : 6 à 15 minutes ;
- cas extrêmes observés : jusqu'à 16 minutes ;
- capacité de planification : réserver 15 minutes par vidéo ;
- contrainte : une seule génération vidéo à la fois.

Une vérification toutes les deux minutes est suffisante pendant une génération.
Avant chaque clic de lancement, confirmer visuellement que le bouton indique
`Unlimited`. En cas d'échec, confirmer le remboursement ou l'absence de débit
avant une nouvelle tentative.

## Convention de nommage

Format canonique :

```text
DAY|SUNSET|AFTERGLOW|NIGHT_<THEME>_<DESCRIPTION>_<SEQUENCE>
```

L'image et la vidéo associée partagent exactement le même nom de base. Les noms
sont en ASCII, en majuscules et séparés par des underscores. Les brouillons
16:9 portent le suffixe `_DRAFT_16x9` et ne sont pas publiables.

Le lot livré utilise la séquence `02`. Trois paires finales conservent leur
suffixe `_V2` :

- `SUNSET_AFROFUTURISM_SOLAR_CULTURAL_02_V2`
- `AFTERGLOW_NEON_NOIR_HOLOGRAPHIC_THRILLER_02_V2`
- `NIGHT_NEON_NOIR_HOLOGRAPHIC_THRILLER_02_V2`

## État de la passation

- 32 images et 32 vidéos livrées ;
- 32 correspondances image/vidéo vérifiées `OK` ;
- aucun job du lot `02` ne reste à générer ;
- les médias sont disponibles dans Drive ;
- les assets restent en attente de validation éditoriale avant publication ;
- le community manager a reçu la convention de nommage et la règle de capacité.

Pour une nouvelle vague, dupliquer le manifeste, incrémenter la séquence, créer
les quatre moments `DAY`, `SUNSET`, `AFTERGLOW`, `NIGHT`, puis ajouter chaque
paire à l'inventaire Sheets dès que son téléchargement Drive est vérifié.
