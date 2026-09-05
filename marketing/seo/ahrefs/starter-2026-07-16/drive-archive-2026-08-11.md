# Noctalia — archive Drive des rapports Ahrefs Starter

Synchronisation vérifiée le 13 août 2026.

Actualisation du 4 septembre : pour les fichiers du [manifeste de migration](../../drive-migration-manifest-2026-09-04.csv), l'[archive privée](../../archive-index.md) devient l'emplacement principal des rapports retirés du dépôt. Les documents décisionnels marqués `keep_local=true` restent aussi dans Git. Les emplacements et règles ci-dessous décrivent la synchronisation historique du 13 août, pas les permissions du nouveau dossier privé.

## Emplacement

```text
Noctalia/
└── 03_SEO/
    └── Ahrefs Starter - Dossier maître - 2026-08-02/
        ├── 05 - Clôture J25-J27 - 2026-08-11/
        ├── 06 - Ownership Misabueso GSC - 2026-08-11/
        └── 99 - Preuves brutes/
```

- Dossier Noctalia : <https://drive.google.com/drive/folders/1XcIaDxqf7KD-1hgZesDuNUcazIC9oxVW>
- Dossier SEO : <https://drive.google.com/drive/folders/1nnOpNuAan4atNGDBWuozWZYh_2csgOAa>
- Dossier maître Ahrefs Starter : <https://drive.google.com/drive/folders/1kHn8p9u9i_CyVzbsraXGJVXCobeDt7wo>
- Clôture J25–J27 : <https://drive.google.com/drive/folders/1FzKUu-9DuuAHZPKt_JHzvvHz8vGRNjxi>
- Ownership Misabueso GSC : <https://drive.google.com/drive/folders/1SyyLgUxu4QU6rf-Zp6o_rEvpXFue09Rr>
- Preuves brutes : <https://drive.google.com/drive/folders/1tMjVFlMooFpI1UZyiyGlP810_JOLJo15>

## Périmètre synchronisé

### Clôture J25–J27

Le sous-dossier de clôture contient les 15 livrables durables `j25-*`, `j26-*` et `j27-*` présents dans ce dossier Git au commit source `06cec17be9228b23e5d8de23c5bd2008d3266aba`, le journal d'exécution du ranking au commit source `670e7fd210af5e3a3a93fed02b30338813faaf52`, le rapport de tri GSC J28 au commit source `b2384a4e63965c2d3dda394f78545ef858b9e6ad`, puis le rapport d'exécution des leviers J28 au commit source `236f32bfd1c0358dd36e30255e39c365d8d5b032` : douze fichiers Markdown et six fichiers CSV.

La vérification Drive après ajout du rapport J29 a confirmé sa présence unique
dans le dossier cible. `j29-authority-recovery-2026-08-13.md` porte
l'identifiant Drive `1pBHvbx25DtwkBS6Qf1RfRTA_b0IjP-Is` et l'empreinte
SHA-256 locale
`c48c70510fcb7e8bae00986d1542f302deab003841462f04fad555ae0dbde557`.
Le registre détaillé des 19 fichiers, avec identifiant Drive, URL et empreinte
locale, est conservé dans
[`drive-sync-manifest-2026-08-11.csv`](./drive-sync-manifest-2026-08-11.csv).

### Ownership Misabueso GSC

Le sous-dossier dédié contient les deux livrables du contrôle d'ownership espagnol présents au commit source `4917bbac7c1969e8ce310ade96353a038fb8e91f` : un rapport Markdown et une matrice CSV.

La liste Drive après téléversement a confirmé exactement deux fichiers, avec leurs noms et formats d'origine. Le registre détaillé est conservé dans [`drive-sync-manifest-misabueso-2026-08-11.csv`](./drive-sync-manifest-misabueso-2026-08-11.csv).

### Preuves brutes

Le dossier brut existant n'a pas été modifié pendant cette synchronisation. L'archive GSC des 254 URL, SHA-256 `515e55b94bb2195ebc90ea0e9d443518ef0addb0bb369ddea52f76a559c24bfb`, reste locale : le connecteur a refusé son téléversement en raison du risque de données sensibles. Son ajout nécessite une autorisation explicite dédiée au payload brut et à ce dossier.

## Autorité et confidentialité

1. Git reste la source de vérité des rapports durables ; Drive en est une copie de consultation et de sauvegarde.
2. Les noms et formats d'origine sont conservés pour permettre une comparaison directe avec Git.
3. Les exports bruts Ahrefs/GSC, captures, archives privées et données détaillées de requêtes ne sont pas inclus dans ce sous-dossier.
4. Le partage du dossier maître n'a pas été modifié pendant cette synchronisation.
5. Une nouvelle synchronisation doit mettre à jour un fichier existant par son identifiant Drive ou créer un nouveau sous-dossier daté ; elle ne doit pas téléverser silencieusement un doublon portant le même nom.
6. Chaque synchronisation doit être vérifiée par une liste du dossier cible, puis documentée avec le commit source et les empreintes locales.
