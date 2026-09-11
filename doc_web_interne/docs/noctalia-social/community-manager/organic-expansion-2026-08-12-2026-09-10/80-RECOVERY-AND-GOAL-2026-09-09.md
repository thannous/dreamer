# Noctalia — remise en état du pilotage, 9 septembre 2026

Statut : EN COURS, aucune résolution de publication revendiquée.

## Objectif corrigé

Fiabiliser la diffusion des deux mêmes vidéos quotidiennes sur TikTok, Instagram et X, aux horaires du calendrier validé ; conserver une HERO secondaire quotidienne autorisée ; réconcilier les publications réelles, les files natives et les métriques avec le dépôt et Drive. Rattraper uniquement les vidéos réellement absentes, sans doublon et avec au moins deux heures entre les deux TikTok de rattrapage. Ne pas élargir la cadence ni relancer une exception datée sans créneau de reprise explicite.

Le goal natif du fil a été lu le 09/09 : PAUSED, objectif historique encore orienté diffusion complète et expansion communautaire. L'outil disponible ne permet ni de modifier son objectif ni de le reprendre. Ce document est une spécification de correction, pas un nouveau goal natif activé. Ne pas marquer l'ancien objectif atteint pour le remplacer.

## Autorité

- Mandat : `../ACCOUNTS-AND-MANDATE.md`.
- Hiérarchie, calendrier et miroir Drive : document 78 du même dossier.
- Calendrier du 11–24/09 : document 79 ; 28 lignes bloquées tant que masters, SHA, copies et contrôles ne sont pas affectés.
- Preuve finale : URL publique exacte ouverte. Une file native prouve seulement la programmation.
- Absence de preuve = ÉTAT RÉEL INCONNU, jamais preuve de non-publication. Garder les échecs d'exécution distincts des échecs de collecte.
- Drive : https://docs.google.com/spreadsheets/d/1acoGpbZCg89Wy3SR4JioJg0_exyNyVqp3R5QagdQTTs/edit ; avertissement et plan correctif copiés dans `Pilotage agents!A2` (note), date en B3 ; relecture par connecteur effectuée le 09/09. Mise en page native non vérifiée.

## Défauts vérifiés et travaux restants

1. Les derniers passages ont répété les contrôles locaux sans vérifier les plateformes. Ce n'est pas une exécution du mandat. Chaque run doit tenter une vérification native ciblée ou consigner un blocage concret ; ne pas recycler un ancien constat comme observation fraîche.
2. `check-social-public-proof.js` attend 12 lignes et trois créneaux ; `check-social-due-proof.js` ignore les dates après le 10/09. Adapter et tester le nouveau cycle à neuf lignes (six principales et trois HERO), sans supprimer la validation historique.
3. `check-social-proof-registers.js` s'arrête au premier défaut. Diagnostic corrigé le 09/09 : le fichier concerné est désormais indiqué ; 18 tests Jest passés. Premier défaut : `72-PUBLIC-PROOF-2026-09-06.md`, ligne 7 TikTok C3. L'audit des jours précédents reste à terminer ; ne pas transformer les statuts en succès pour obtenir du vert.
4. Le validateur d'automation vérifie des chaînes et heures nominales, pas les déclenchements réels. Les événements fournis montrent notamment 15:25 UTC = 17:25 Paris. Vérifier le fuseau effectif du planificateur avant toute correction horaire ; ne pas compenser aveuglément deux heures.
5. Réconcilier les 06–08/09 et le jour courant sur les comptes exacts, puis reporter les URL et métriques vérifiées dans les registres et Drive. Valeurs indisponibles laissées vides.
6. C1 TikTok du 06/09 : publication propriétaire observée dans Studio, ID 7682526851385855254 ; ne pas republier. Ouvrir la page publique pour terminer la preuve. C2 CLOCKPUNK : tentative du 07/09 bloquée avant envoi ; contrôler l'anti-doublon avant tout nouveau créneau de reprise.
7. Vérifier l'accès Chrome Noctalia indépendamment pour chaque réseau. Une autre session X ne démontre pas un blocage Instagram ou TikTok. Ne jamais modifier le compte tiers ni saisir d'identifiants.
8. Tant que la cadence principale est défaillante, aucune expansion communautaire ou archive supplémentaire. Les mandats historiques restent conservés, sans nouvelle dispersion.

## Critères de clôture

- Calendriers, vérificateurs et déclenchements cohérents dans Europe/Paris, tests de transition et de changement de date passés.
- Journées passées auditées avec preuves ou incidents explicites ; incidents non résolus toujours visibles.
- Deux prochaines lignes validées et exécutables, avec preuve native de programmation lorsqu'elle est utilisée.
- Dépôt et Drive synchronisés, preuve de lecture du miroir ; aucune permission de partage élargie.
- Goal natif corrigé/repris via une fonctionnalité autorisée, ou blocage produit explicitement remis au propriétaire.
- Contrôles locaux et preuve publique distingués dans tout bilan. Aucune promesse de publication basée uniquement sur un réveil automatique.
