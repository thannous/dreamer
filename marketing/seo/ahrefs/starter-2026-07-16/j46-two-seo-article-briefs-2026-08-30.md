# J46 — briefs de deux nouveaux articles SEO

Date : 30 août 2026

Statut après le micro-gate du 1er septembre :

- `faux réveil` : `GO_PUBLISH_CANDIDATE`, cinq localisations actives ;
- `jet lag + rêves` : `HOLD_RESEARCH`, cinq brouillons archivés hors du build.

Aucun commit, push, déploiement, publication ni demande d'indexation n'a été
effectué.

Après la rédaction de ce brief, l'utilisateur a explicitement autorisé une
implémentation multi-agent. Cette décision lève `HOLD_WRITING` pour les brouillons
locaux, mais ne remplace pas la preuve de demande Ahrefs et ne vaut pas
autorisation de publication.

## Règle commune

Chaque concept doit rester un seul article éditorial localisé. Les cinq
versions EN/FR/ES/DE/IT partagent le même périmètre, mais leur rédaction doit
être réellement adaptée. Une localisation ne doit pas être publiée si elle ne
peut pas fournir une réponse complète et naturelle.

Les articles ne promettent ni interprétation certaine, ni diagnostic, ni
prédiction. Ils relient l'expérience du rêve à des observations vérifiables :
horaire, réveils, émotion, contexte récent et journalisation.

## Article 1 — Jet lag, sommeil et rêves

### Décision et preuve

Statut : `HOLD_RESEARCH / DRAFT_ARCHIVED`.

- le sujet figurait déjà dans le planning éditorial de juillet avec un score
  interne de `7,3/10`, mais le dossier prévu n'a jamais été créé ;
- aucun dossier `blog.jet-lag-sleep-dreams` ne reste dans
  `docs-src/content/blog` ; les cinq brouillons sont archivés sous
  `drafts/j46-jet-lag-sleep-dreams/` ;
- les mentions actuelles sont dispersées dans les contenus vacances,
  paralysie du sommeil, sommeil et rentrée ;
- les requêtes jet lag + rêves ne produisent aucune ligne dans GSC du 1er au
  28 août ; cela confirme l'absence de propriétaire, pas l'absence de demande ;
- Ahrefs US ne montre que `10` recherches mensuelles pour `jet lag dreams` et
  `10` pour `jet lag vivid dreams`, sans KD, TP, intention ni parent topic ;
- `jet lag sueños` et `desfase horario sueños` ne sont pas indexées dans la
  base Ahrefs Espagne.

### Contrat d'intention

L'article possède le croisement **voyage trans-fuseaux + rythme circadien +
rêves/rappel**. Il ne remplace pas :

- l'article vacances, propriétaire du changement de chambre et d'environnement ;
- l'article changement d'heure, propriétaire de l'heure d'été/hiver ;
- l'article réveils nocturnes, propriétaire de la capture du rêve après un réveil ;
- les pages médicales sur l'insomnie ou les troubles circadiens.

### Routes de travail

| Langue | Slug proposé | Title de travail |
|---|---|---|
| EN | `/en/blog/jet-lag-sleep-dreams` | `Jet Lag, Sleep and Dreams: What Changes?` |
| FR | `/fr/blog/decalage-horaire-sommeil-reves` | `Décalage horaire, sommeil et rêves : que change le voyage ?` |
| ES | `/es/blog/desfase-horario-sueno-suenos` | `Desfase horario, sueño y sueños: qué puede cambiar` |
| DE | `/de/blog/jetlag-schlaf-traeume` | `Jetlag, Schlaf und Träume: Was kann sich verändern?` |
| IT | `/it/blog/jet-lag-sonno-sogni` | `Jet lag, sonno e sogni: cosa può cambiare` |

Ces slugs ont été retirés du manifest, du contrat URL et du sitemap du candidat
J46. Les brouillons restent disponibles pour un futur gate fondé sur de
nouvelles données.

### Structure utile

1. réponse courte : le jet lag dérègle surtout l'horaire et fragmente parfois
   le sommeil ; cela peut modifier le moment où un rêve est rappelé sans lui
   donner une signification fixe ;
2. rythme circadien et pression de sommeil expliqués sans diagnostic ;
3. pourquoi les réveils près du REM peuvent rendre certains rêves plus faciles
   à retenir ;
4. avant, pendant et après le voyage : lumière, horaires, repos et prudence ;
5. protocole de journal sur trois nuits : heure locale, réveil, émotion,
   fragment du rêve et niveau de fatigue ;
6. cas où demander un avis médical, formulé sobrement ;
7. FAQ locale sans promesse de « régler » le jet lag grâce aux rêves.

### Maillage prévu

- entrants : vacances, sommeil et environnement, REM, réveils nocturnes ;
- sortants : journal de rêves, rappel des rêves, sommeil et santé ;
- ancre principale : `jet lag, sommeil et rêves`, jamais `signification du
  rêve de voyage`.

## Article 2 — Faux réveil : rêver que l'on s'est réveillé

### Décision et preuve

Statut : `GO_PUBLISH_CANDIDATE / HOLD_PUBLISH_UNTIL_USER_GO`.

- aucun article ou page dédiée aux faux réveils n'existe dans le dépôt ;
- les variantes `false awakening`, `faux réveil`, `falso despertar`,
  `falsches Erwachen` et `falso risveglio` ne produisent aucune ligne GSC du
  1er au 28 août ;
- le cluster voisin rêve lucide possède toutefois une surface mesurable :
  le guide EN reçoit `1 171` impressions sans clic à la position `26,56`, le
  guide ES `266` impressions et `3` clics à la position `21,38`, et le guide
  FR `83` impressions sans clic à la position `17,84` ;
- Ahrefs US confirme `false awakening` : intention informationnelle, KD `2`,
  volume `2 200`, volume global `4 900`, TP `1 900` et GTP `2 700` ;
- `false awakening dream` reste informationnelle avec KD `3`, volume US `80`
  et TP `250` ;
- Ahrefs Espagne confirme `falso despertar` : intention informationnelle,
  KD `0`, volume ES `40` et volume global `450`.

### Contrat d'intention

L'article répond à **« j'ai rêvé que je me réveillais, parfois plusieurs
fois : qu'est-ce qu'un faux réveil et que noter ? »**. Il ne remplace pas :

- le guide rêve lucide, propriétaire de `comment faire un rêve lucide` ;
- le guide paralysie du sommeil, propriétaire de l'immobilité au réveil et des
  hallucinations associées ;
- l'article réveils nocturnes, propriétaire des réveils réellement vécus ;
- l'incubation de rêves, propriétaire de la préparation intentionnelle d'un
  thème avant le sommeil.

### Routes de travail

| Langue | Slug proposé | Title de travail |
|---|---|---|
| EN | `/en/blog/false-awakening-dreams` | `False Awakenings: Dreaming You Woke Up` |
| FR | `/fr/blog/faux-reveil-reve` | `Faux réveil : rêver que l'on s'est réveillé` |
| ES | `/es/blog/falso-despertar-sueno` | `Falso despertar: soñar que te has despertado` |
| DE | `/de/blog/falsches-erwachen-traum` | `Falsches Erwachen: Träumen, man sei wach` |
| IT | `/it/blog/falso-risveglio-sogno` | `Falso risveglio: sognare di essersi svegliati` |

Les slugs ont passé les contrôles de registre, manifest, hreflang, liens et
sitemap local. Le contrôle de demande Ahrefs est positif.

### Structure utile

1. définition courte et différence entre faux réveil, rêve lucide,
   cauchemar et paralysie du sommeil ;
2. scénarios fréquents à décrire prudemment : routine matinale, boucle de
   réveils, chambre presque identique, détail incohérent ;
3. pourquoi l'expérience peut sembler réelle sans conclure à une cause unique ;
4. quoi faire après : se réorienter, noter les détails, reprendre le sommeil
   sans transformer l'épisode en présage ;
5. grille de journal : heure, nombre de boucles, détail révélateur, émotion,
   sommeil récent et niveau de lucidité ;
6. quand distinguer une expérience ponctuelle d'un problème de sommeil qui
   mérite un professionnel ;
7. FAQ locale, sans technique sensationnaliste « garantie cette nuit ».

### Maillage prévu

- entrants : rêve lucide débutant, paralysie du sommeil, réveils nocturnes ;
- sortants : rappel des rêves, journal de rêves, cauchemars ;
- ancre principale : `faux réveil` ou équivalent local ; éviter les ancres
  génériques `rêve lucide` et `paralysie du sommeil` vers ce nouvel article.

## Gate de publication fondée sur la demande

Le micro-lot Ahrefs de deux crédits a été exécuté le 1er septembre, avec les
requêtes groupées :

- US/EN : `jet lag dreams`, `jet lag vivid dreams`, `false awakening`,
  `false awakening dream` ;
- ES : `jet lag sueños`, `desfase horario sueños`, `falso despertar`,
  `soñar que te despiertas`.

Verdict par concept :

- `GO_WRITE` si la demande est non nulle, l'intention informationnelle et le
  propriétaire distinct ;
- `HOLD_RESEARCH` si les métriques sont trop faibles ou la SERP ambiguë ;
- `DROP` si l'intention est médicale, transactionnelle ou déjà possédée par une
  URL Noctalia existante.

Résultat : `faux réveil` passe le gate et `jet lag + rêves` reste en
`HOLD_RESEARCH`. Avant commit, push et publication du seul lot positif,
demander une autorisation séparée `GO publication J46`.
