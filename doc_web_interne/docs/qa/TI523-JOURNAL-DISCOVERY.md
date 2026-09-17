# TI-523 — Découverte facultative du journal depuis Lucid

## Surface et frontières

Une seule carte secondaire à la fin des réglages Lucid, après les ressources. Aucun ajout au Morning, aux exercices, aux rituels ou à l’onboarding. Copie en anglais, français, espagnol, allemand et italien : conserver les récits et explorer ses propres associations ; Lucid demeure autonome. Aucun CTA d’import ou de connexion, aucun abonnement requis.

Le composant ne lit que `noctalia_lucid_discovery:journal_hidden_v1`, préférence locale à l’appareil, hors des états de compte, des exports et des files de synchronisation. Elle survit au changement de compte. Une lecture échouée ou une valeur inconnue supprime la promotion ; aucun flash avant hydratation. Le masquage ne disparaît visuellement qu’après écriture réussie ; une erreur affiche une invitation localisée à réessayer. Aucun événement analytique ajouté.

## Destinations vérifiées le 8 septembre 2026

- Natif : `noctalia://journal`, schéma `noctalia` dans `app.json`, route existante `app/(tabs)/journal.tsx`. Tentative directe, sans requête `canOpenURL` exigeant de nouvelles déclarations natives. Aucun paramètre, contenu, identifiant, jeton ou consentement transmis. Le mécanisme historique de handoff avec résumé d’exercice n’est pas utilisé.
- Repli et web : [site officiel Noctalia](https://noctalia.app/), consulté en direct le 8 septembre 2026. La page présente le journal, son éditeur TiMax et ses liens officiels de téléchargement. Aucune URL de store construite.
- Si le système ne peut pas ouvrir le lien natif, ouverture du site. Si cette ouverture échoue aussi, message localisé non bloquant et nouvelle tentative possible. Hors réseau, l’application installée peut ouvrir localement ; si le navigateur accepte une URL mais ne charge pas la page, son écran hors ligne lui appartient. L’app ne prétend pas détecter ce chargement distant.
- Aucune navigation interne, mutation de pratique, lecture Journal ou liaison de compte : cliquer puis revenir conserve le composant et l’état Lucid.

## Vérification

Tests automatisés : attente d’hydratation, masquage/remontage, erreur et corruption de lecture, échec d’écriture puis retry, application installée/absente, repli web réussi/échoué, contexte monté conservé, cinq langues. Les contrôles réutilisent `LucidButton` (libellés, état busy, hauteur minimale et texte extensible), sans limite de lignes ni hauteur fixe ; titre exposé comme en-tête, erreur comme alerte.

Ces tests ne remplacent pas la qualification native : vérifier sur appareil/émulateur le retour depuis l’app ou le navigateur, le grand texte, le lecteur d’écran et la carte masquée au redémarrage. Aucune preuve visuelle native ni publication Store n’est revendiquée ici.
