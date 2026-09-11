# Quatre priorités UI — 11 septembre 2026

Lot approuvé après le dogfooding Motorola du matin. Base Git : `effc06cfed0d797e515f730d8a953be4cc207c94`.

## Résultat

- Fiche : titre limité à deux lignes, type symbolique par défaut masqué avant analyse, ajout de thème présenté comme une action. Les données enregistrées restent intactes et modifiables.
- Journal : invitation au compte compacte, après les rêves, refermable pour la session du composant ; recherche au libellé court.
- Capture : suppression de la jauge ambiguë ; « Brouillon conservé sur cet appareil » distinct de « Ajouter au journal ». Crédits en vérification, inconnus ou épuisés explicités sur la fiche avant l’action.
- Accessibilité : champ de transcription, sauvegarde et retours des guides nommés ; actions Annuler / Enregistrer visibles en édition. La zone défilante de capture est placée sous la barre système, y compris au clavier. Traductions FR/EN/ES/DE/IT/PT.
- Régression découverte pendant la vérification : l’intention d’onboarding `analysis_confirmation` renvoyait toute nouvelle capture vers le premier rêve non analysé. Le retour explicite au Journal ferme cette confirmation optionnelle pour ce rêve. Une analyse déjà demandée conserve sa reprise.

## Vérification locale

- 5 suites ciblées : 94 tests réussis (fiche, journal compact, guides, capture, statut du brouillon).
- CircleCI a élargi la sélection à 97 suites / 867 tests : deux assertions de traduction attendaient les anciens mots « saved / enregistrer ». Assertions mises à jour pour vérifier le fragment ajoutable au journal et le brouillon conservé sur l’appareil, sans imposer le verbe précédent.
- `npm run typecheck:app` et `npm run typecheck:tests` : PASS.
- Lint des fichiers touchés : 0 erreur ; 12 avertissements sur du code préexistant. Relecture du diff et `git diff --check` : PASS.
- Dépendance HealthKit déjà présente dans le checkout de qualification réutilisée via un lien local ignoré pour le typecheck ; aucun manifeste modifié.

## Motorola — 09:45 à 09:54, Europe/Paris

Application de base `com.tanuki75.noctalia`, client Expo local 3.1.0 (54), Android 16, thème clair, invité. Bundle Metro rechargé pour vérifier les dernières modifications ; ce n’est pas une validation Play.

1. [Fiche compacte et crédits épuisés](after-detail.png) : titre sur deux lignes, thème actionnable, disponibilité annoncée.
2. [Journal](after-journal.png) : récit avant la proposition de compte. [Fermeture](after-journal-dismissed.png) vérifiée dans l’arbre Android.
3. [Édition](after-edit-transcript.png) : ajout temporaire `CANCEL_TEST`, puis Annuler ; récit initial retrouvé sans cet ajout.
4. [Capture au clavier](after-capture-keyboard.png) : compteur, statut du brouillon et bouton visibles ; aucun contenu dans la barre système. Brouillon synthétique ensuite effacé avec le bouton prévu ; le rêve de test initial est conservé.
5. [Liste des guides](after-guides.png) et [lecture](after-guide-detail.png) : bouton nommé « Retour » dans l’arbre Android.
6. Après retour de la fiche non analysée au Journal, Capturer ouvre de nouveau une saisie vide. App laissée sur Capture, brouillon vide, Metro actif.

Pas d’analyse IA ni d’achat déclenché pendant cette vérification. TalkBack audio, tailles de texte agrandies, paysage, mode sombre et build Play restent non qualifiés par cette passe. Le bouton flottant gris appartient au client Expo.

## Livraison

La PR porte sur le code mobile, ses traductions/tests et les captures ci-dessus. Les fichiers de configuration sensibles et les autres travaux locaux sont exclus. Aucun déploiement mobile, build EAS ou envoi Store.

Lecture API Cloudflare du 11 septembre : projet `noctalia`, branche de production `master`, déploiements activés, inclusion `*`, aucune exclusion. Une fusion republierait donc le site ; conformément à AGENTS.md, cette étape attend une autorisation de publication.
