# Noctalia — Espace Community & Social Media Manager

Créé le 2026-07-29. Mandat mis à jour le 2026-08-13.

Ce dossier est mon espace de travail opérationnel pour le community management et
le social media management organiques de Noctalia. Le registre éditorial officiel
reste [`../PUBLICATION-PLAN.md`](../PUBLICATION-PLAN.md) : un brouillon présent ici
n'est ni validé, ni planifié, ni publié.

## Contrôles reproductibles avant action native

- `npm run social:health` : contrôle les 87 créneaux principaux, les cartes
  d'archives, l'inventaire anti-doublon par plateforme et les packages roulants
  Pinterest. Un master `BLOQUÉ QA` doit être explicitement bloqué dans sa ligne
  et dans le statut global. Ce contrôle est local et ne prouve aucune
  programmation ni publication.
- `npm run social:proof -- <registre-du-jour.md>` : valide la structure et les
  domaines des preuves déjà collectées sans exiger que la journée soit close.
- `npm run social:proof:close -- <registre-du-jour.md>` : ne doit passer qu'en
  fin de journée, lorsque les 12 lignes sont `PUBLIÉES` avec 12 URL publiques
  distinctes sur les domaines attendus.
- `npm run social:proof:registers` : découvre automatiquement les registres
  `PUBLIC-PROOF-AAAA-MM-JJ.md`; toute date antérieure à aujourd'hui
  (`Europe/Paris`) doit être strictement close, tandis qu'aujourd'hui et les
  dates futures restent validées en mode structure sans publication anticipée.
- `npm run social:proof:due` : applique au registre du jour les passages de
  contrôle réels (`16:05`, `16:45`, `17:55`, `18:15`, `18:45`, `20:05`,
  `20:45`, `23:05`, `23:45`). Une ligne encore sans statut `PUBLIÉ` et URL
  publique après son checkpoint rend `social:health` rouge ; avant le premier
  checkpoint, ce contrôle reste un no-op vérifié.
- `npm run social:automation:check` : contrôle localement les deux heartbeats
  actifs, leurs 14 passages principaux, leurs 6 passages secondaires, les
  horaires minimums attendus, les gates DreamViews/Reddit et l'absence de
  chevauchement. Ce contrôle dépend des automations Codex de la machine et
  reste séparé de `social:health` pour ne pas simuler une preuve native.

Une commande verte n'autorise jamais une publication anticipée et ne remplace
pas le contrôle du compte, du master, de l'heure et de l'absence de doublon
dans la plateforme native.

## Mission

- piloter la diffusion principale de trois vidéos distinctes par jour sur
  TikTok, Instagram et X, puis la vidéo hero quotidienne sur YouTube Shorts,
  Facebook Reels et Pinterest ;
- résorber progressivement le retard des plateformes d'extension avec une file
  `ARCHIVE` séparée, limitée à une ancienne vidéo supplémentaire par jour et
  strictement contrôlée par plateforme ;
- développer la communauté dans l'ordre validé : DreamViews d'abord, puis
  Reddit seulement après création et maturation d'un compte Noctalia dédié ;
- transformer le positionnement et les contenus de Noctalia en idées sociales
  adaptées à chaque plateforme ;
- préparer les briefs, légendes, scripts, variantes et recommandations de
  publication ;
- organiser la veille, le tri des commentaires et les propositions de réponse ;
- suivre les résultats après publication et documenter les apprentissages ;
- protéger la cohérence de la marque, la confidentialité des utilisateurs et le
  positionnement non médical de Noctalia.

## Périmètre actuel

- Marque : Noctalia.
- Plateformes sociales gérées : TikTok, Instagram, X, YouTube Shorts, Facebook
  Reels et Pinterest.
- DreamViews est autorisé sous mandat communautaire distinct pour des
  contributions manuelles, utiles, espacées et sans lien, après contrôle de la
  session et du fil. Reddit reste hors mandat jusqu'à la création et la
  maturation d'un compte Noctalia dédié. Snapchat reste bloqué par sa porte de
  performance.
- Audience : adultes curieux de leurs rêves, du journal de rêves, de la
  connaissance de soi et du rêve lucide.
- Langues du produit : français, anglais, espagnol, allemand et italien.

Les profils autorisés et les limites du mandat sont consignés dans
[`ACCOUNTS-AND-MANDATE.md`](./ACCOUNTS-AND-MANDATE.md). Toute nouvelle plateforme
ou tout autre profil doit d'abord être explicitement ajouté à ce registre.

## Voix de marque

La voix Noctalia est onirique, bienveillante et poétique, tout en restant claire,
prudente et rassurante.

- Inviter à observer et à réfléchir, sans imposer une interprétation universelle.
- Ne jamais présenter Noctalia comme un outil médical, diagnostique ou
  thérapeutique.
- Ne pas promettre de résultat psychologique, de santé ou de rêve lucide.
- Ne jamais réutiliser un rêve, un message privé ou une donnée personnelle sans
  consentement explicite.
- Adapter chaque version à sa langue et à sa culture au lieu de traduire
  littéralement.

## Circuit de travail

1. Rassembler le brief, l'objectif, l'audience, la plateforme et l'action
   recherchée.
2. Préparer ici le brouillon et ses variantes avec un statut explicite.
3. Soumettre le contenu à validation.
4. Après décision réelle de planification, mettre à jour le registre officiel.
5. Après preuve de publication, ajouter les URL publiques et les mesures à
   24 heures puis à 7 jours.

Statuts de travail :

- `BROUILLON` : proposition interne modifiable ;
- `À VALIDER` : prête pour arbitrage ;
- `VALIDÉ` : contenu approuvé, mais non planifié ;
- `PLANIFIÉ` : créneau confirmé ;
- `PUBLIÉ` : URL publique vérifiée.

## Règles d'autorisation

Le mandat permanent accordé le 2026-07-31 autorise la gestion organique courante
des profils inscrits dans
[`ACCOUNTS-AND-MANDATE.md`](./ACCOUNTS-AND-MANDATE.md). Dans ce périmètre, le
community manager peut consulter les tableaux de bord, préparer les contenus,
planifier et publier les contenus validés, assurer la veille, répondre aux
interactions courantes et documenter les résultats.

Une autorisation spécifique reste requise pour :

- lancer une campagne payante, engager une dépense ou commander une génération
  payante ;
- modifier les identifiants, la sécurité, les rôles administrateurs, le nom du
  compte, la biographie ou le lien principal ;
- supprimer définitivement une publication, un média, un commentaire ou un
  compte ;
- prendre un engagement juridique, médical, commercial ou partenarial ;
- utiliser ou transmettre des données personnelles, des messages privés ou un
  témoignage sans consentement explicite.

La publication organique reste soumise au circuit `VALIDÉ` → `PLANIFIÉ` →
`PUBLIÉ`. Ne jamais annoncer un contenu comme publié sans URL publique vérifiée.
Le droit de gérer un compte ne prouve pas à lui seul qu'une session technique
authentifiée est disponible : cet accès doit être vérifié au moment de l'action.

## Classement futur

Créer les documents seulement lorsqu'ils deviennent utiles :

- `YYYY-MM-DD-campagne.md` pour un brief, des contenus et leurs variantes ;
- `YYYY-MM-DD-community-inbox.md` pour une synthèse anonymisée des interactions ;
- `YYYY-MM-DD-reporting.md` pour les mesures, enseignements et prochaines
  hypothèses.

Chaque document doit indiquer sa date, son propriétaire, son statut et ses
plateformes. Les données sensibles, identifiants et contenus privés ne doivent pas
être copiés dans le dépôt.

## Exclusion d’asset — 2026-08-06

`HIGGS_2026-08-05_140043_POPBOT_1068d59d.mp4` est exclu de la sélection
éditoriale Noctalia. Sa définition `2160×3840` (et sa durée de 8 secondes) ne
correspond pas au profil des masters retenus pour la campagne, contrôlés en
`1080×1920` avec une durée d’environ 12 secondes.

Statut : **EXCLU — ni validé, ni planifié, ni publié**. La copie source Drive
est conservée à des fins d’archive et n’est pas supprimée :
[POPBOT dans le dossier Drive](https://drive.google.com/file/d/1Gnii1vUzoUYeRSM2d3do8If0hBoL45bJ/view?usp=drivesdk).
Une éventuelle version `1080×1920` devra repasser par la validation éditoriale
avant toute utilisation.

## Convention de nommage des exports vidéo Drive — 2026-08-08

Les prochains exports vidéo Noctalia doivent utiliser le format :

`PREFIX_DESCRIPTION_DE_MEGALOPOLE_NUMERO.ext`

Le préfixe décrit l'ambiance ou le moment (`NIGHT`, `SUNSET`, `AFTERGLOW`,
`DAY`, ou équivalent), puis vient le type de mégalopole et le numéro de
séquence. L'image source et la vidéo correspondante conservent le même nom de
base. Les brouillons portent un suffixe explicite, par exemple
`_DRAFT_16x9`.

Exemples de référence :

- `NIGHT_ANCIENT_ROME_MEGALOPOLIS_01.mp4`
- `SUNSET_ANCIENT_ROME_MEGALOPOLIS_02.mp4`
- `AFTERGLOW_ANCIENT_ROME_MEGALOPOLIS_03.mp4`
- `DAY_ANCIENT_ROME_MEGALOPOLIS_04.mp4`

Cette convention s'applique aux prochains dépôts et exports Drive ; elle ne
renomme pas rétroactivement les fichiers déjà publiés ou archivés.

## Plans actifs

- [`2026-08-us-europe-publication-plan.md`](./2026-08-us-europe-publication-plan.md) :
  calendrier validé du 31 juillet au 15 août 2026 pour Instagram, TikTok et X,
  ciblé États-Unis et Europe. Depuis le 6 août, la cadence opérationnelle est
  de trois vidéos par jour aux créneaux documentés ; le statut vérifié de chaque
  file est tenu dans le document.
- [`organic-expansion-2026-08-12-2026-09-10/`](./organic-expansion-2026-08-12-2026-09-10/) :
  programme opérationnel de 30 jours pour YouTube Shorts, Facebook Reels,
  Pinterest et la participation Reddit/DreamViews. Les nouveaux comptes restent
  à configurer et à ajouter au mandat avant publication ; Snapchat reste bloqué
  jusqu'à identification de deux formats gagnants.
- [`../MEDIA-INVENTORY.md`](../MEDIA-INVENTORY.md) : inventaire des masters
  locaux, des lots Drive, des noms historiques, des propositions de migration
  et de l'historique de publication vérifié.

## Références

- [`ACCOUNTS-AND-MANDATE.md`](./ACCOUNTS-AND-MANDATE.md) : comptes autorisés et
  mandat opérationnel actif.
- [`../README.md`](../README.md) : règles et statuts du registre social.
- [`../PUBLICATION-PLAN.md`](../PUBLICATION-PLAN.md) : calendrier et état réel des
  contenus.
- [`../../CONTENT-PLANNING.md`](../../CONTENT-PLANNING.md) : planning éditorial du
  site et sujets réutilisables.
- [`../../../../README.md`](../../../../README.md) : positionnement produit,
  confidentialité et langues.
