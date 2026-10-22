# Stockage des images du site

Le site garde son hébergement Cloudflare Pages. Les images de `docs-src/static/img/`
deviennent des entrées binaires versionnées dans Cloudflare R2, diffusées par le
CDN `https://media.noctalia.app`. Git conserve leur inventaire, les configurations,
les outils et les preuves ; Drive conserve les archives d'origine et de secours.

## État constaté le 22 octobre 2026

- Compte Cloudflare existant : projet Pages `noctalia`, production `master`,
  publication automatique désactivée et aperçus Git désactivés (lecture API).
- R2 déjà actif avant cette migration. Un bucket distinct `noctalia-site-media`
  a été créé en stockage Standard, région Western Europe.
- Snapshot initial : **14 239 fichiers, 1 121 125 192 octets**. Aucun réencodage.
  L'inventaire `docs-src/config/site-media.json` conserve chaque chemin, taille
  et SHA-256. Son digest détermine le préfixe immuable `releases/<digest>/img/`.
- Sauvegarde supplémentaire des mêmes octets en treize ZIP privés sur
  [Drive](https://drive.google.com/drive/folders/1jTbLxmyNAFHmk9d_VkJwzb5icahBYExA).
  `RESTORE-IMAGES-SITE-20261022.json` y donne les liens, les empreintes des ZIP
  et l'inventaire complet. Les ZIP ont été relus et contrôlés localement ;
  la lecture Drive confirme les identités, tailles et emplacement. Le connecteur
  ne retourne pas d'empreinte distante pour ces fichiers.
- Les originaux natifs des précédents lots restent dans leurs dossiers Drive.
  Les six packs hérités dont les PNG natifs manquent restent signalés dans le
  suivi : cette migration conserve leurs dérivés et ne recrée pas leur provenance.
- Accord utilisateur obtenu pour `media.noctalia.app` et une clé Object Read &
  Write limitée au seul bucket, du 22 au 29 octobre. Aucune clé dans Git ou Drive.

## Choix retenu et alternatives

| Solution | Intérêt | Limite |
| --- | --- | --- |
| **R2 + domaine CDN dédié (retenu)** | Réutilise Cloudflare, sort les binaires de Git et du paquet Pages, conserve les fichiers et leurs adresses historiques grâce à une redirection. | R2 devient une entrée nécessaire aux nouvelles reconstructions ; le cache local permet de travailler hors ligne ensuite. |
| R2 comme source, CDN Pages pour la diffusion | Conserve les réponses directes aux URL actuelles ; aucune redirection. | Les images doivent encore être téléchargées et envoyées à chaque nouveau déploiement Pages. |
| Vercel Blob | Convient si la bibliothèque doit ensuite être gérée avec les déploiements Vercel. | Ajoute un stockage au site Cloudflare et une tarification de transfert distincte. |
| Git LFS | Garde une interface Git pour les médias. | Ajoute des quotas et la récupération LFS au build ; le déploiement emporte encore les fichiers. |

Au tarif R2 consulté le 22 octobre, Standard inclut 10 Go-mois, un million
d'opérations A et dix millions d'opérations B par mois ; les sorties R2 ne sont
pas facturées. Le snapshot de 1,12 Go et son transfert initial entrent dans ces
volumes, sous réserve des autres usages du compte et du trafic. Il ne s'agit
pas d'une promesse de gratuité illimitée.
[Tarifs R2](https://developers.cloudflare.com/r2/pricing/),
[domaine public et cache](https://developers.cloudflare.com/r2/buckets/public-buckets/),
[Vercel Blob](https://vercel.com/docs/vercel-blob/public-storage).

## Reconstruire et publier

`npm run docs:build` restaure uniquement les images absentes depuis le snapshot
CDN et vérifie les tailles, types et SHA-256. Une image locale modifiée bloque la
restauration ; elle n'est jamais remplacée silencieusement. Une réponse HTML,
corrompue ou incomplète ne devient pas un fichier image.

En présence du manifeste, le build **ne lance aucun encodeur d'images** : un
changement de police ou de version de l'encodeur ne doit pas modifier les peintures
pendant une migration ou un déploiement. Sans configuration média, le comportement
historique de génération reste disponible.

Après les vérifications habituelles, le staging de `docs:deploy:preview` ou
`docs:deploy:prod` omet les fichiers `img/` et ajoute une seule redirection 302 :

```text
/img/* https://media.noctalia.app/releases/<digest>/img/:splat 302
```

Les adresses existantes, y compris celles utilisées par les applications installées,
restent donc valides. Le site garde ses compositions, formats, transparences,
scènes et deux effets. La validation navigateur de la migration ne constitue
pas une nouvelle qualification des applications natives.

Le staging exige un reçu de vérification CDN complet pour le même digest et
la même origine. Les contrôles de liens ne reconnaissent que les chemins exacts
de cet inventaire lorsqu'une redirection correspondante existe ; un chemin
d'image inventé reste une erreur. Les gardes de publication de `master` restent
inchangées. Un build Git hébergé qui déposerait directement `docs/` ne passe pas
par ce staging : conserver les publications manuelles canoniques.

## Ajouter ou remplacer des illustrations

```sh
# Préserver d'abord les originaux natifs, prompts et provenance sur Drive.
# Utiliser le packer habituel pour les peintures et leurs variantes.
mise exec -- npm run docs:media -- refresh
mise exec -- npm run docs:media -- status
# Les identifiants sont dans un fichier privé ignoré ou dans l'environnement.
NOCTALIA_MEDIA_CREDENTIALS=/chemin/prive/credentials.json mise exec -- npm run docs:media -- upload
mise exec -- npm run docs:media -- verify
mise exec -- npm run docs:build
mise exec -- npm run docs:check
```

`refresh` appelle les générateurs existants, puis écrit un nouvel inventaire.
`upload` conserve les anciennes versions, utilise des écritures conditionnelles
sans écrasement et relit chaque objet S3. Une reprise vérifie les objets déjà
présents au lieu de les remplacer. `verify` lit ensuite **chaque objet depuis
le domaine CDN**, vérifie le type, la taille et le SHA-256, puis écrit le reçu
`docs-src/config/site-media-verification.json`. Une nouvelle version invalide
donc automatiquement le reçu précédent. Les mises à jour se font par snapshot
complet ; surveiller la croissance cumulée avant de multiplier les versions.

## Retrait de Git et retour arrière

```sh
mise exec -- npm run docs:media -- detach
```

Cette commande exige le reçu CDN complet et les octets locaux correspondants.
Elle retire seulement les chemins vérifiés de l'index Git, sans `--force`, puis
les ignore. Aucun fichier local, archive Drive, objet R2 ou historique Git n'est
supprimé. Une reconstruction depuis un checkout neuf doit être validée avant
la livraison ; `verify:pr` l'effectue dans sa copie isolée.

Pour revenir à une diffusion intégrée à Pages, mettre `delivery` à `local`,
reconstruire et utiliser le déploiement canonique. Le build contient toujours
les images restaurées, donc ce retour ne nécessite pas de remettre les binaires
dans Git. Pour une restauration hors CDN, les treize ZIP peuvent restituer
exactement `docs-src/static/img/`.

Le retrait allège l'arbre courant et évite les nouveaux binaires dans Git.
**Il ne réduit pas l'historique déjà présent** : le réécrire demanderait une
opération distincte, une sauvegarde Git complète et une coordination des clones.
Un clone superficiel permet déjà de récupérer seulement la nouvelle version.

## Améliorations possibles après la migration

- Réutiliser les objets identiques entre snapshots pour limiter la croissance R2.
- Émettre directement les URL du CDN dans les pages pour éviter la première
  redirection, tout en gardant celle-ci pour les anciens liens et applications.
- Ajouter une alerte de budget au compte ; ne pas présenter une alerte comme un
  plafond de dépenses bloquant.
- Retirer les variantes devenues inutilisées uniquement après inventaire des
  références du site, des applications et des anciennes adresses ; les conserver
  auparavant dans les archives.

## Preuve de migration

- R2 : 14 239 objets envoyés puis relus intégralement avec taille et SHA-256.
- Domaine public : 14 239 GET contrôlés, 1 121 125 192 octets identiques,
  reçu du 22 octobre 2026 à 00:32 UTC dans `site-media-verification.json`.
- La première passe publique a été interrompue après plus de 10 500 fichiers
  par une erreur de transport. Aucun reçu de succès n'a été produit. La seconde
  passe complète, avec trois tentatives bornées uniquement sur les interruptions
  réseau et HTTP 429/5xx, est passée. Les erreurs de contenu restent bloquantes.
- Domaine actif, TLS minimal 1.2, accès `r2.dev` désactivé ; CORS public limité
  aux lectures GET/HEAD. Une seconde lecture identique a obtenu un cache HIT.
- Les contrôles de restauration/retrait d'index et staging passent (44 assertions,
  avec les contrôles de déploiement existants). Le typage TesterArmy est passé ;
  son ancien type Sharp a été corrigé pour l'export par défaut installé.

Le rendu via CDN, la reconstruction sans binaires Git et la livraison sont
qualifiés séparément dans la suite du relevé ; ces contrôles ne constituent
pas une publication en production.

La première exécution navigateur sur `6995ae2fa` a détecté un canvas non lisible
sur l'illustration détourée : le `<picture>` sélectionnait une source CDN, alors
que son `<img>` de secours était un GIF intégré et ne recevait pas CORS.
Le transformateur HTML commun couvre désormais aussi ce cas, sans charger la
plaque masquée sur mobile. Le parcours existant contrôle les pixels réels des
textures et du masque ; cet échec est conservé dans son artefact.
