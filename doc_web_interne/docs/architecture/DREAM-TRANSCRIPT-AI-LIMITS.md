# Récit original et contexte IA

Décision produit validée le 9 septembre 2026 : **10 000 caractères de récit dans la copie transmise à l’IA**, au lieu de 6 000.

- Le récit original reste la source de vérité, intégral et rééditable. Ce seuil n’est pas un `maxLength` du champ de saisie ni une troncature du stockage.
- Jusqu’à 10 000 caractères, la copie IA contient tout le récit. Au-delà, le mécanisme existant conserve un extrait des 10 000 premiers caractères et signale sa troncature au modèle ; aucun résumé automatique n’est ajouté par ce changement.
- Analyse synchrone, worker d’analyse, contexte du chat et contexte de récit utilisé pour les illustrations partagent `DREAM_CONTEXT_TRANSCRIPT_MAX_CHARS` dans `supabase/functions/api/lib/prompts.ts`. Le chat invité utilise cette même constante avant construction du prompt.
- La limite technique des requêtes contenant un récit reste 100 000 caractères (`AI_REQUEST_LIMITS.transcriptRequestChars`). Les autres limites (message de chat, interprétation, prompt d’image, audio) restent distinctes.
- « Caractères » suit la mesure JavaScript existante (`String.length`, unités UTF-16), après suppression des espaces périphériques ; certains emoji comptent donc pour plusieurs unités.

Cette décision étend le contexte disponible, sans garantir qu’un modèle utilisera chaque détail. Le contexte maximal peut augmenter le coût et la latence des récits dépassant l’ancien seuil. Aucun changement de quota ni de modèle.

Livraison du code et déploiement Supabase sont deux étapes distinctes : cette modification ne constitue pas une preuve de mise en production.
