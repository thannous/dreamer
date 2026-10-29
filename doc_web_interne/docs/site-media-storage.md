# Stockage des images du site

Le site garde son hébergement Cloudflare Pages. Les images de `docs-src/static/img/`
deviennent des entrées binaires versionnées dans Cloudflare R2, diffusées par le
CDN `https://media.noctalia.app`. Git conserve leur inventaire, les configurations,
les outils et les preuves ; Drive conserve les archives d'origine et de secours.
Quinze petites images aussi embarquées dans l'accueil mobile restent suivies dans
Git à leur chemin initial : 238 750 octets, listés dans `bundledPaths`.

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

Le build convertit les références web vers les URL du snapshot CDN vérifié :
images, préchargements, variantes responsives, métadonnées, données de textures,
CSS et sitemap. Le bundle de l’accueil résout son poster avant le calcul des
empreintes. Les chemins inconnus et les URL d’autres domaines restent inchangés.
Les catalogues sources et `content/symbols/atlas-v1.json` conservent les chemins
mobiles. Les anciennes URL `/img/*` et les anciens snapshots R2 restent disponibles.

Le 29 octobre 2026, le réglage global Cloudflare « Browser Cache TTL » de quatre
heures remplaçait le cache des alias prévu par le staging. Une règle ciblée active,
« Noctalia legacy images — respect 300s origin TTL », respecte désormais le TTL
origine uniquement pour `http.host eq "noctalia.app"` et un chemin commençant par
`/img/`. Les trois alias contrôlés renvoient un 302 avec `max-age=300` ; les objets
CDN restent immuables un an. La règle ne modifie pas le TTL global des autres
ressources. Les navigateurs ayant déjà mis l’ancien 302 en cache peuvent le garder
jusqu’à son expiration : une purge Cloudflare ne vide pas leur cache local.
La modification de la génération des pages demande toujours un déploiement autorisé.

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
Elle retire seulement les chemins vérifiés hors `bundledPaths` de l'index Git,
sans `--force`, puis
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

Le parcours CDN est passé à 2560×1440 et 390×844 après cette correction :
peintures, trois variantes sélectionnables, pixels alpha et deux effets mobiles.
L'empreinte navigateur est lue directement sur l'URL CDN immuable correspondant
à chaque image sélectionnée ; les images de la page utilisent encore les adresses
historiques avec redirection. La lecture JavaScript directe de ces anciennes URL
à travers la redirection a été refusée lors du diagnostic local ; aucun code du
site ne dépend de ce fetch d'image. La lecture directe CDN et les canvas passent.
Le futur passage aux URL CDN directes évitera aussi ce détour.

La validation locale `verify:pr` du premier commit `6995ae2fa` a passé ses
16 contrôles, dont une restauration fraîche des 14 239 images depuis la copie
Git isolée. Cette preuve est réutilisable pour le transfert inchangé ; la
correction HTML ultérieure demande une nouvelle preuve sur la tête finale.
La revue indépendante a confirmé les corrections de gel des encodeurs, de
staging isolé, d'écriture depuis le tampon vérifié et du traitement CORS picture.

À ce stade, les originaux et secours sont sur Drive, les images sont présentes
sur R2 et le domaine CDN est actif. La publication de `noctalia.app` reste une
étape distincte, régie par `AGENTS.md` : fusion autorisée explicitement, preuve
`verify:release:site` sur `master` puis commande de déploiement gardée. Aucune
réécriture de l'historique Git ni suppression de sauvegarde n'est incluse.

Le lot de régression sur `15104dc84` a passé les six parcours ciblés CDN,
portrait sans moteur, tigre dans les six langues, texture cassée et vignette
cassée. Les 36 peintures du parcours atlas ont également passé leurs contrôles
avant une assertion historique sur le cerf « sans pack ». Le cerf possède
maintenant son pack complet depuis PR #499 ; cette attente obsolète est remplacée
par un contre-exemple vérifiant sa plaque, ses trois scènes et ses deux effets.
Le mécanisme de repli en cas de script ou texture manquants reste couvert par
les autres parcours inchangés. Aucun contrôle de pixels n'a été supprimé.

Les huit parcours ciblés ont passé sur `0eab1b75a`, avec les 36 atlas, le tigre
dans les six langues, les deux tailles cadeau et les replis texture/script.
Artefact canonique local :
`tools/e2e/.e2e/site-web/1792629950656-79696-e257d142-abe8-4972-8ed3-b428c2eaf04a`.
La preuve `verify:pr` de cette tête a passé : 6 contrôles rejoués et 10 réutilisés.
L'aperçu hébergé initial `7b32891f.noctalia.pages.dev` confirme les vrais 302,
les SHA-256 de cinq surfaces/effets et le moteur chargé avec ses textures.

Cette lecture des en-têtes a révélé qu'une règle historique mettait aussi les
302 `/img/*` en cache immuable pendant un an. Le staging CDN remplace uniquement
ce Cache-Control par `public, max-age=300, must-revalidate`, sans modifier les
autres en-têtes ni le cache CSS. Les objets R2 versionnés restent immuables un an.
Le repli local conserve ses règles existantes. Cela permet à une nouvelle version
ou à un retour arrière de changer la destination d'un alias en cinq minutes.

L'audit des imports mobiles a identifié 15 fichiers utilisés par `require()`
dans `components/onboarding/` : ils restent donc dans Git, aux mêmes chemins et
avec les mêmes octets que `origin/master`. Les 14 239 fichiers sont tous sauvegardés
et diffusables sur R2 ; **14 224 sortent du suivi Git, soit 1 120 886 442 octets**.
`detach` exige que les fichiers `bundledPaths` restent suivis avant toute opération.
Aucun code, chemin d'import ou rendu natif ne change. Pour de nouveaux médias
exclusivement mobiles, préférer le dossier d'assets de l'application ; un média
partagé à embarquer doit être ajouté à cette liste et suivi explicitement dans Git.
