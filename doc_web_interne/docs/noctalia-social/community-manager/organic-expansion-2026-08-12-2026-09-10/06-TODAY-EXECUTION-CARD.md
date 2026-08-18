# Archive d'exécution — 13 août 2026

> **ARCHIVE CLÔTURÉE — NE PAS UTILISER COMME FICHE DU JOUR.** La fiche active
> du 14 août est
> [`07-NEXT-DAY-EXECUTION-CARD.md`](./07-NEXT-DAY-EXECUTION-CARD.md). Ce fichier
> conserve les preuves et décisions historiques du 13 août ; son ancien nom
> n'autorise aucune nouvelle action.

Fuseau : `Europe/Paris`. Compte Instagram obligatoire : `@noctaliadreams`.
Cette fiche ne constitue aucune publication anticipée.

La clôture des neuf lignes principales et des trois lignes hero secondaires est
centralisée dans
[`36-TODAY-PUBLIC-PROOF-2026-08-13.md`](./36-TODAY-PUBLIC-PROOF-2026-08-13.md).
Le total attendu est donc de **12 preuves publiques**, sans extrapoler un statut
entre plateformes.

Contrôle Instagram du 13/08 à 12:10 CEST : session authentifiée sur
`@noctaliadreams`, lien `Modifier le profil`, compteur `23 publications` et
zéro occurrence dans la grille chargée pour les trois hooks exacts du jour
(`An underwater city awakens in fire`, `Would you step into the light` et
`An ocean hangs above the clouds`). Ce contrôle prouve l'absence de doublon
visible à cet instant ; il doit être refait juste avant chaque partage.

## Contrôle invariant avant chaque Reel

1. Le profil ou le compositeur affiche exactement `noctaliadreams` et
   `Modifier le profil` ; abandonner si un autre compte apparaît.
2. Recharger la grille et chercher le début exact de la légende ; si le Reel
   est déjà visible, enregistrer son URL et ne pas importer le fichier.
3. Vérifier le nom, le SHA-256 et l'aperçu du master exact.
4. Ne cliquer sur `Partager` qu'après l'heure Instagram du créneau.
5. Après le partage, attendre le traitement, recharger le profil public et
   enregistrer l'URL exacte. Un clic, un upload ou un dialogue de succès ne
   suffit pas pour le statut `PUBLIÉ`.
6. Si aucune URL n'apparaît, conserver `EN ATTENTE` et ne pas cliquer une
   seconde fois sans nouvel anti-doublon.
7. Si le sélecteur de fichier Chrome ne s'ouvre pas ou si l'import échoue,
   fermer le compositeur sans brouillon, conserver la ligne `EN ATTENTE`,
   journaliser le blocage exact et le signaler immédiatement. Ne jamais
   convertir cet échec en `PROGRAMMÉ` ou `PUBLIÉ`, et ne toucher à aucune ligne
   TikTok ou X déjà programmée.
8. Pour les créneaux suivants, utiliser l'événement natif Chrome `filechooser`
   puis `setFiles(master exact)` immédiatement après le clic `Sélectionner sur
   l'ordinateur`. Ne jamais appeler une méthode de locator non prise en charge,
   et ne pas utiliser cette découverte pour retenter C1 depuis la même surface.

## Créneau 1

- TikTok : `15:30` — ligne déjà programmée
  `https://www.tiktok.com/@noctaliadreams/video/7672900166269046039`.
- Instagram : **pas avant `15:45`**.
- X : `16:15` — ligne programmée reconfirmée sur `@NoctaliaDreams`.
- Master Instagram durable :
  `output/video/noctalia-social-execution-2026-08-13/03-ville-engloutie-eruption.mp4`.
- SHA-256 :
  `6a0e69b2c7651ecd7d97e2c870e14c7c6a7b062a98535fd6fe115e21760cfe10`.
- Technique : H.264/AAC, `1080×1920`, `24 fps`, `15,092971 s`.
- Légende Instagram exacte :

```text
An underwater city awakens in fire. Would you explore it? #Noctalia #Dreamscape #DreamJournal
```

- Preuve attendue : URL publique Instagram, puis URL publique X après 16:15.

## Créneau 2

- TikTok : `19:30` — ligne déjà programmée
  `https://www.tiktok.com/@noctaliadreams/video/7669511356776844566`.
- Instagram : **pas avant `19:45`**.
- X : `20:15` — ligne programmée reconfirmée sur `@NoctaliaDreams`.
- Master Instagram durable :
  `output/video/noctalia-social-execution-2026-08-13/70-cathedrale-solaire.mp4`.
- SHA-256 :
  `bd93e4cec9879977b4b7f206e3ff37412876776cb31a5f48b26418c57d167090`.
- Technique : H.264/AAC, `1080×1920`, `24 fps`, `12,122667 s`.
- Légende Instagram exacte :

```text
Would you step into the light? #Noctalia #Dreamscape #DreamJournal
```

- Preuve attendue : URL publique Instagram, puis URL publique X après 20:15.

### Rattrapage contrôlé C1 après reprise de l'import

L'import natif ayant fonctionné pour C2, le Reel C1 manquant peut être repris
le 13/08 à **20:30**, après la preuve X C2, afin de ne pas publier deux Reels à
quelques minutes d'intervalle. Refaire l'anti-doublon sur le hook exact, utiliser
uniquement le master C1 et son SHA ci-dessus, activer le label natif IA puis
obtenir l'URL publique. Si le Reel est déjà visible, ne rien importer.

## Créneau 3

- TikTok : `22:30` — ligne déjà programmée
  `https://www.tiktok.com/@noctaliadreams/video/7672900511825415446`.
- Instagram : **pas avant `22:45`**.
- X : `23:15` — ligne programmée reconfirmée sur `@NoctaliaDreams`.
- Master Instagram durable :
  `output/video/noctalia-social-execution-2026-08-13/04-ocean-ciel-tempete.mp4`.
- SHA-256 :
  `898f8ec488835b7f83fa5d5bf178b8926640317b95e42c8885711eb1762534be`.
- Technique : H.264/AAC, `1080×1920`, `24 fps`, `15,092971 s`.
- Légende Instagram exacte :

```text
An ocean hangs above the clouds. Would you enter the storm? #Noctalia #Dreamscape #DreamJournal
```

- Preuve attendue : URL publique Instagram, puis URL publique X après 23:15.

## Héros des plateformes secondaires

- Pinterest : `17:30`, titre exact
  `How to Remember Dreams: Name Three Details Before Moving` — **PUBLIÉ** ;
  URL `https://fr.pinterest.com/pin/1127940669217775129/`.
- YouTube : `18:00`, titre exact
  `How to Remember Three Dream Details #Shorts` — **PUBLIÉ** ; URL
  `https://youtube.com/shorts/RNY9UIozIKE`.
- Facebook : `18:15`, légende commençant par
  `Before moving, name three details from your dream.` — **PUBLIÉ**, audience
  publique ; URL `https://www.facebook.com/reel/1544614401039270`.

Pour ces trois lignes, remplacer `PROGRAMMÉ` par `PUBLIÉ` seulement après
ouverture de l'URL publique exacte. Ne pas confondre l'URL future YouTube avec
une preuve de diffusion avant 18:00.

## Rattrapage et communauté

- `68-prairie-des-lanternes.mp4` : Facebook programmé le 23/08 à 12:30 ;
  YouTube `PRÊT` après anti-doublon des 21 Shorts et levée de la limite
  quotidienne ; Pinterest `PRÊT` après anti-doublon des 10 Pins et libération
  d'une place dans la file pleine du 13 au 22/08.
- DreamViews : la présentation publique reste vérifiée ; aucune deuxième
  contribution tant qu'un fil récent, non sensible et réellement utile n'est
  pas validé. La veille du 13/08 à 11:52 n'a trouvé aucune cible satisfaisant
  ces critères ; ce no-op qualitatif remplace l'ancien état `INDÉTERMINÉ`.
- Reddit : compte personnel hors mandat ; aucune action.
- Snapchat : bloqué par la porte qualitative.
