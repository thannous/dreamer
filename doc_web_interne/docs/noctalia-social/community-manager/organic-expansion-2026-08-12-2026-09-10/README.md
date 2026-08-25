# Noctalia — Extension organique sur 30 jours

- Période : 12 août au 10 septembre 2026 inclus.
- Propriétaire : Community Manager Noctalia.
- Statut : **EN COURS D’EXÉCUTION — MANDAT ET COMPTES CONFIRMÉS**.
- Canaux d'extension mandatés : YouTube Shorts, Facebook Reels et Pinterest.
- Communautés préparées sous gate distincte : DreamViews, puis Reddit.
- Snapchat : **OPEN-PENDING-ACCOUNT** — porte levée le 24 août 2026 par
  override propriétaire ; aucun compte live, aucune publication tant que le
  handle et la session n'existent pas.

## Objectif

Étendre la distribution organique sans créer une seconde source de vérité pour
les assets. Chaque jour, un seul **hero asset** est repris du créneau 1 du
[calendrier social principal](../2026-08-us-europe-publication-plan.md), puis
adapté nativement pour YouTube Shorts, Facebook Reels et Pinterest. Reddit et
DreamViews servent d'abord à écouter, répondre et construire de la confiance ;
ils ne reçoivent pas une publication promotionnelle quotidienne.

Objectifs opérationnels à J30 :

1. publier une vidéo hero quotidienne sur YouTube Shorts, Facebook Reels et
   Pinterest, sous réserve que l'asset du jour et les comptes soient validés ;
2. produire sous le mandat confirmé des contributions manuelles, utiles et
   espacées sur DreamViews en premier ; ne commencer Reddit qu'après le gate
   DreamViews, puis création et maturation d'un compte Noctalia dédié ;
3. documenter toutes les URL publiques et les mesures à 24 heures et 7 jours ;
4. identifier deux formats capables de franchir la règle de victoire décrite
   dans [`04-METRICS-AND-SNAPCHAT-GATE.md`](./04-METRICS-AND-SNAPCHAT-GATE.md) ;
5. ne publier sur Snapchat qu'après création du compte, inscription au mandat
   avec une URL publique réelle et vérification de session (porte qualitative
   levée le 24 août 2026 ; le compte n'existe pas encore).

## Politique de rattrapage d'archives

Le hero quotidien reste prioritaire. Le stock historique ne doit jamais être
injecté brutalement dans les files. Les anciennes vidéos sont triées dans le
[registre par plateforme](../../PLATFORM-VIDEO-INVENTORY.md) avec les statuts
`À RATTRAPER`, `À EXCLURE` ou `DÉJÀ PUBLIÉE`.

Après analyse des performances, un créneau d'archive pourra diffuser au maximum
une vidéo supplémentaire par jour sur YouTube, Facebook et Pinterest. La
première vague mesurée est préflightée et ordonnée dans le registre. Le pilote documentaire retient
**12:30 Europe/Paris**, soit cinq heures avant Pinterest, cinq heures trente
avant YouTube et cinq heures quarante-cinq avant Facebook. Cet horaire ne devient
pas une programmation tant que l'absence de doublon, la capacité native et la
ligne exacte ne sont pas confirmées dans chaque plateforme. Le pilote commence
sur une seule archive et les trois canaux ne sont pas élargis si la cadence HERO
accumule du retard ou si les premières mesures montrent une cannibalisation.
L'ordre de rattrapage privilégie les meilleures vidéos, pas les plus anciennes.

## Sources de vérité et limites

- L'asset exact, sa date et son statut proviennent uniquement du
  [calendrier principal](../2026-08-us-europe-publication-plan.md).
- La présence locale ou Drive ne signifie ni validation, ni programmation, ni
  publication.
- Une ligne devient `PUBLIÉE` uniquement avec une URL publique vérifiée.
- Les comptes YouTube, Facebook et Pinterest figurent dans le
  [mandat des comptes](../ACCOUNTS-AND-MANDATE.md). Vérifier le compte exact et
  la session avant chaque action externe.
- DreamViews et Reddit restent distincts des six comptes sociaux. DreamViews
  `noctalia` / `108883` est mandaté pour des contributions manuelles utiles,
  espacées et sans lien promotionnel, après contrôle de la session, du fil et
  des règles. Reddit ne commence qu'après la maturation DreamViews prévue, puis
  création et maturation d'un compte Noctalia dédié par le propriétaire.
- Aucune dépense, publicité, boost, achat de contenu ou modification de sécurité
  n'est autorisé par ce programme.
- Aucun rêve, témoignage ou contenu utilisateur n'est réutilisé sans
  consentement explicite et anonymisation.

## Garde-fou local des fiches principales

Avant une publication Instagram directe ou un remplissage roulant TikTok,
exécuter `npm run social:preflight -- <fiche.md> [...]`. Le contrôle exige trois
créneaux distincts par fiche, un master local présent, un SHA-256 exact, une
vidéo verticale H.264 à 24 fps avec audio AAC et une légende anglaise contenant
`#Noctalia`, sans `@mention` ni texte littéral `AI-generated`. Ce contrôle local
ne prouve ni connexion, ni programmation native, ni publication publique.

## Rythme quotidien initial — hypothèse à tester

Les horaires ci-dessous sont des points de départ, pas des « heures optimales »
universelles. Ils seront réévalués aux revues J7 et J14.

| Heure Paris | Action |
|---|---|
| 16:30 | Vérifier que le hero asset est public sur les réseaux principaux et qu'il n'existe pas déjà sur les nouveaux canaux. |
| 17:30 | Publier ou programmer le Pin du jour. |
| 18:00 | Publier ou programmer le YouTube Short. |
| 18:15 | Publier ou programmer le Facebook Reel. |
| 18:30–18:55 | Répondre aux commentaires et effectuer la mission Reddit/DreamViews du jour. |
| J+1 | Relever les mesures à 24 heures. |
| J+7 | Relever les mesures à 7 jours et consigner l'apprentissage. |

## Documents d'exécution

1. [`01-CALENDAR-30-DAYS.md`](./01-CALENDAR-30-DAYS.md) — affectation quotidienne,
   format testé et mission communautaire.
2. [`02-CHANNEL-PLAYBOOKS.md`](./02-CHANNEL-PLAYBOOKS.md) — préparation et
   publication native par canal.
3. [`03-REDDIT-DREAMVIEWS-PROGRAM.md`](./03-REDDIT-DREAMVIEWS-PROGRAM.md) —
   programme communautaire sans spam.
4. [`04-METRICS-AND-SNAPCHAT-GATE.md`](./04-METRICS-AND-SNAPCHAT-GATE.md) —
   mesures, revues hebdomadaires et porte Snapchat.
5. [`05-EXECUTION-LOG.md`](./05-EXECUTION-LOG.md) — journal des URL et des
   résultats réels.
6. [`06-TODAY-EXECUTION-CARD.md`](./06-TODAY-EXECUTION-CARD.md) — archive
   clôturée du 13 août ; ne plus l'utiliser comme fiche du jour malgré son nom.
7. [`07-NEXT-DAY-EXECUTION-CARD.md`](./07-NEXT-DAY-EXECUTION-CARD.md) — fiche
   opérationnelle active du 14 août, sans autorisation de publication anticipée.
8. [`08-COVERAGE-AND-ROLLING-REFILL.md`](./08-COVERAGE-AND-ROLLING-REFILL.md) —
   couverture prouvée par canal, dettes et ordre de remplissage roulant.
9. [`09-HERO-PACKAGES-2026-09-04-10.md`](./09-HERO-PACKAGES-2026-09-04-10.md) —
   packages validés, liens Drive, SHA-256, UTM et fiche native des sept heroes
   affectés du 4 au 10 septembre.
10. [`10-EXECUTION-CARD-2026-08-15.md`](./10-EXECUTION-CARD-2026-08-15.md) —
    fiche prête du 15 août avec masters durables, SHA-256, légendes intégrales
    et preuves natives déjà disponibles.
11. [`11-EXECUTION-CARD-2026-08-16.md`](./11-EXECUTION-CARD-2026-08-16.md) à
    [`14-EXECUTION-CARD-2026-08-19.md`](./14-EXECUTION-CARD-2026-08-19.md) —
    fiches prêtes des 16 au 19 août, avec les douze lignes TikTok relues dans la
    file native et les masters Instagram durables.
12. [`15-EXECUTION-CARD-2026-08-20.md`](./15-EXECUTION-CARD-2026-08-20.md) à
    [`19-EXECUTION-CARD-2026-08-24.md`](./19-EXECUTION-CARD-2026-08-24.md) —
    fiches prêtes des 20 au 24 août, avec les quinze programmations TikTok
    relues et les masters Instagram sortis du stockage temporaire.
13. [`20-EXECUTION-CARD-2026-08-25.md`](./20-EXECUTION-CARD-2026-08-25.md) à
    [`24-EXECUTION-CARD-2026-08-29.md`](./24-EXECUTION-CARD-2026-08-29.md) —
    fiches prêtes des 25 au 29 août ; les trois lignes TikTok du 29 sont
    programmées, dont C3 à 22:30 après libération de capacité le 13/08.
14. [`25-EXECUTION-CARD-2026-08-30.md`](./25-EXECUTION-CARD-2026-08-30.md) et
    [`26-EXECUTION-CARD-2026-08-31.md`](./26-EXECUTION-CARD-2026-08-31.md) —
    fiches prêtes des 30 et 31 août ; TikTok C1 et C2 du 30 août sont
    programmés, C3 du 30 août est la prochaine dette, puis les trois lignes du
    31 août restent à programmer au fil des capacités libérées.
15. [`27-EXECUTION-CARD-2026-09-01.md`](./27-EXECUTION-CARD-2026-09-01.md) à
    [`29-EXECUTION-CARD-2026-09-03.md`](./29-EXECUTION-CARD-2026-09-03.md) —
    fiches prêtes des 1er au 3 septembre avec neuf masters durables ; X est
    programmé sur les neuf lignes, TikTok attend le remplissage roulant après
    libération de capacité et Instagram reste direct à chaque heure.
16. [Registre vidéo multi-plateforme](../../PLATFORM-VIDEO-INVENTORY.md) — triage
   des archives et URL par réseau.
17. [`30-ARCHIVE-PILOT-CARD-2026-08-23-68-PRAIRIE.md`](./30-ARCHIVE-PILOT-CARD-2026-08-23-68-PRAIRIE.md) —
    fiche autonome du pilote archive : master, copies par plateforme, preuve
    Facebook, dettes YouTube/Pinterest et gates J+1/J+7.
18. [`31-ARCHIVE-CARD-2026-09-04-NEON-NOIR.md`](./31-ARCHIVE-CARD-2026-09-04-NEON-NOIR.md) et
    [`32-ARCHIVE-CARD-2026-09-05-DAY-AETHERPUNK.md`](./32-ARCHIVE-CARD-2026-09-05-DAY-AETHERPUNK.md) —
    cartes conditionnelles des réserves mesurées no 3 et no 4, avec masters
    locaux durables, copies natives et ordre strict après le pilote.
19. [`33-ARCHIVE-CARD-2026-09-06-03-SERPENT.md`](./33-ARCHIVE-CARD-2026-09-06-03-SERPENT.md) et
    [`34-ARCHIVE-CARD-2026-09-07-73-CAVERNES.md`](./34-ARCHIVE-CARD-2026-09-07-73-CAVERNES.md) —
    cartes conditionnelles narratives ; `03-serpent` passe avant `73-cavernes`
    selon les signaux d'engagement publics prouvés.
20. [`35-ARCHIVE-PILOT-METRICS-LOG.md`](./35-ARCHIVE-PILOT-METRICS-LOG.md) —
    grille J+1/J+7 distincte par plateforme et verdict de poursuite, attente ou
    suspension de la vague archive.
21. [`36-TODAY-PUBLIC-PROOF-2026-08-13.md`](./36-TODAY-PUBLIC-PROOF-2026-08-13.md) —
    matrice de clôture des douze preuves publiques du jour : neuf lignes du
    calendrier principal et trois lignes hero secondaires.
22. [`37-PUBLIC-PROOF-2026-08-14.md`](./37-PUBLIC-PROOF-2026-08-14.md) —
    matrice préparatoire des douze preuves du 14 août et empreintes reconfirmées
    des trois masters Instagram.
23. [`47-PUBLIC-PROOF-2026-08-12.md`](./47-PUBLIC-PROOF-2026-08-12.md) —
    clôture historique vérifiable du 12 août : douze URL publiques distinctes,
    soit neuf sorties principales et trois sorties hero secondaires.
24. [`48-COMMUNITY-MATURITY-REGISTER.md`](./48-COMMUNITY-MATURITY-REGISTER.md) —
    registre de preuve DreamViews puis Reddit : contributions, réponses
    organiques, incidents et gates anti-spam séparés.
25. [`50-PUBLIC-PROOF-2026-08-15.md`](./50-PUBLIC-PROOF-2026-08-15.md) —
    matrice préparatoire des douze preuves du 15 août, rattachée à la fiche
    d'exécution déjà préflightée.
26. [`51-PUBLIC-PROOF-2026-08-16.md`](./51-PUBLIC-PROOF-2026-08-16.md) —
    matrice préparatoire des douze preuves du 16 août, sans URL ni publication
    anticipée.
27. [`52-PUBLIC-PROOF-2026-08-17.md`](./52-PUBLIC-PROOF-2026-08-17.md) —
    matrice préparatoire des douze preuves du 17 août, reliée aux trois assets
    exacts et aux trois files hero déjà vérifiées.
28. [`53-PUBLIC-PROOF-2026-08-18.md`](./53-PUBLIC-PROOF-2026-08-18.md) à
    [`59-PUBLIC-PROOF-2026-08-24.md`](./59-PUBLIC-PROOF-2026-08-24.md) —
    sept matrices préparatoires continues, chacune avec neuf preuves
    principales et trois preuves hero secondaires.
29. [`60-PUBLIC-PROOF-2026-08-25.md`](./60-PUBLIC-PROOF-2026-08-25.md) à
    [`76-PUBLIC-PROOF-2026-09-10.md`](./76-PUBLIC-PROOF-2026-09-10.md) —
    dix-sept matrices qui prolongent la preuve jusqu'à la fin du programme en
    conservant les écarts réels : prêt, programmé, remplacement requis ou
    publication directe.

La commande `npm run social:proof:registers` découvre automatiquement tous les
registres `PUBLIC-PROOF-YYYY-MM-DD` du dossier. Elle exige exactement la fenêtre
du **12 août au 10 septembre 2026**, une clôture complète avec URL publique pour
chaque journée passée selon `Europe/Paris`, et laisse les registres du jour et
des dates futures en contrôle structurel. Une journée manquante, deux registres
pour la même date ou un registre hors campagne font échouer le contrôle.
Chaque ligne vérifie également le compte exact ; pour C1, C2 et C3, TikTok,
Instagram et X doivent référencer le même nom de master MP4.
Le hero secondaire déclaré doit reprendre exactement le master MP4 de C1 ; une
copie éditoriale différente par plateforme reste autorisée, pas un autre média.
Elle est incluse dans `npm run social:health` afin que l'ajout d'une nouvelle
journée ne dépende pas d'une liste de fichiers maintenue manuellement.

## Définition de terminé

Le programme est terminé lorsque les 30 journées sont documentées, que chaque
statut correspond à une preuve réelle, que les mesures J7 disponibles ont été
relevées et qu'une décision explicite est inscrite. Le 24 août 2026, le
propriétaire a levé la porte qualitative Snapchat (`OPEN-PENDING-ACCOUNT`) ;
cette décision ne crée pas de compte, n'autorise aucune publication Spotlight
et ne remplace pas la classification J30 des formats A et B.
