# Qualification TalkBack sur Motorola

Protocole court pour le Journal Noctalia. Il complète les quatre étapes du guide
[AGENTS.md](../../AGENTS.md) et la [validation proportionnée](validation-proportionnee.md).
Une demande de correction doit aller jusqu'au correctif et au retest autorisé ;
un rapport de défaut ne termine pas cette correction. Un audit peut conclure à
un échec, en distinguant défaut produit et preuve indisponible.

## 1. Définir un résultat observable

Commencer par la régression précise, puis seulement élargir au parcours concerné.
Exemple : « après confirmer ou annuler un rituel, le focus TalkBack revient sur
Changer de rituel ». Une formulation vocale équivalente est acceptable.

Séparer les preuves : tests du code, interaction native, annonces vocales,
parcours gestuel, livraison. Ne jamais déduire une ligne des autres. Pour les
défauts de focus asynchrones, reproduire dans un test le retard de fermeture
native, la réouverture, le départ de l'écran et l'absence de restauration tardive.
Un délai arbitraire augmenté ne remplace pas l'événement de cycle de vie attendu.

## 2. Préparer une seule fois

- Lire `git status --short`, isoler le lot et préserver les autres travaux.
- Terminer le correctif, les types/lint et `npm run test:prepush` sur le commit
  propre. Réutiliser ces preuves si seul le rapport change.
- Préparer un seul candidat compatible avec le binaire ciblé. Relever source,
  version/build, installateur, runtime et updateId effectivement exécuté.
  Un bundle exporté ou un manifeste serveur ne prouve pas son chargement.
- Réutiliser les autorisations déjà données pour leur périmètre exact. Préparer
  l'artefact avant de demander une autorisation externe encore manquante ;
  publication OTA, build, Store et réinstallation conservent les règles du dépôt.
- Acquérir le verrou appareil existant. Vérifier le Motorola physique et le
  package `com.tanuki75.noctalia` avec le profil Dreamer existant. Aucun `.qa`.
  Si USB/Wi-Fi change, confirmer l'identité physique avant de reprendre.
- Relever seulement les réglages qui pourraient être modifiés : services
  d'accessibilité, activation, exploration tactile, police et agrandissement.
  Préparer leur restauration, y compris la distinction valeur absente / zéro.
  Utiliser un parcours vide ou des données synthétiques ; aucun récit privé.

## 3. Valider la méthode avant la recette

Faire un pilote de 20 à 30 secondes sur deux contrôles connus. Vérifier ensemble
le déplacement du focus, une activation et la méthode d'écoute/enregistrement.
Une tentative corrigée suffit si le pilote échoue ; ensuite changer explicitement
de méthode ou demander la manipulation physique nécessaire. Ne pas dérouler une
longue série de gestes, installer plusieurs outils ou transcrire du silence.

- Le service TalkBack doit être **lié**, avec exploration tactile active.
- Un balayage injecté par ADB n'est pas automatiquement un geste TalkBack.
  Observer le déplacement avant de poursuivre. Tab/Entrée et taps par coordonnées
  peuvent aider au diagnostic, mais restent des preuves clavier/coordonnées.
- Ne pas lancer un `uiautomator dump` standard pendant TalkBack : une session
  UiAutomation peut supprimer les autres services d'accessibilité. Utiliser les
  captures du focus ou un outil dont la coexistence est vérifiée.
- L'audio système peut être enregistré avec scrcpy déjà disponible. Le mode
  `--audio-source=output` détourne le son du téléphone ; `--no-playback` le rend
  également inaudible sur le Mac. **Ne pas demander à l'utilisateur s'il entend
  le téléphone dans cette configuration.** Pour l'écoute sur le téléphone,
  arrêter cette capture. Le mode playback/dup peut laisser entendre le téléphone,
  mais son absence de capture ne prouve pas que TalkBack est muet.
- Une transcription locale aide à indexer l'audio. Rejeter le silence, les textes
  répétitifs incohérents et les segments sans parole ; l'ASR seul ne valide pas
  une écoute humaine. Ne pas envoyer d'audio privé à un service tiers.

Si le test exige des gestes physiques, préparer une seule consigne courte à
l'opérateur : un doigt pour avancer, double appui pour activer, puis les quelques
actions exactes du scénario. Attendre son retour avant d'attribuer cette preuve.
Pendant cette attente, continuer les vérifications indépendantes.

## 4. Recette ciblée, preuve et restauration

Pour le rituel, procéder dans cet ordre :

1. Atteindre Changer de rituel par balayage et l'activer par double appui.
2. Vérifier l'entrée du focus et la boucle dans le panneau ; écouter les trois
   noms/descriptions et la distinction entre le choix actuel et celui coché.
3. Changer puis confirmer ; vérifier le résultat enregistré, l'annonce et le
   focus final stabilisé sur le déclencheur.
4. Choisir un autre brouillon puis annuler ; vérifier la conservation du choix
   enregistré et le même retour du focus.
5. Si le périmètre le demande, vérifier les cinq destinations et leur état
   sélectionné, Réglages, Guides/Symboles et le retour vers Explorer.

Un défaut reproductible donne une correction et un retest ciblé ; ne pas rejouer
les vérifications déjà valides sans raison. Distinguer une impossibilité de
mesurer d'une action réellement inaccessible. Ne pas clôturer le ticket tant
qu'un critère bloquant est en échec ou non qualifié.

Restaurer le rituel et tous les réglages modifiés, les relire pour comparaison,
arrêter les captures, retirer uniquement les fichiers temporaires créés pour la
session et libérer le verrou. Exécuter cette restauration aussi après un échec
ou une interruption. Ne jamais désinstaller/effacer pour faciliter la recette.

Conserver **un seul compte rendu** par candidat, puis reporter son verdict dans
le ticket. Une preuve documentaire peut être versionnée ; les sons, captures et
journaux temporaires ne sont pas ajoutés automatiquement à un dépôt public.

## Fiche à réutiliser

```markdown
# Ticket — candidat — date
Objectif observable :
Source / commit :
Motorola / Android / package :
Version-build / installateur / runtime / updateId exécuté :
Autorisations existantes et étape externe restant à autoriser :
Pilote : méthode, focus observé, écoute/capture exploitable :

| Critère | Méthode réelle | Résultat | Preuve | Suite précise |
| --- | --- | --- | --- | --- |
| Régression ciblée | | PASS / FAIL / INDETERMINATE | | |
| Annonces vocales | | | | |
| Gestes physiques | | | | |

Défauts reproductibles :
Couverture restante :
Restauration relue / verrou libéré :
Verdict et prochaine action :
```

Références techniques : [AppState Android](https://reactnative.dev/docs/appstate),
[UiAutomation](https://developer.android.com/reference/android/app/UiAutomation),
[audio scrcpy](https://github.com/Genymobile/scrcpy/blob/master/doc/audio.md).
