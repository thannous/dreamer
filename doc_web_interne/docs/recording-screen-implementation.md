# Dreamer : capture et sauvegarde d'un rêve

Guide de l'implémentation actuelle, relu le 23 octobre 2026. La source est
[l'écran de capture](../../app/recording.tsx) ; les anciennes descriptions de
maquette et de première sauvegarde ne définissent plus son comportement.

## Parcours

1. Le brouillon est hydraté avant de pouvoir démarrer ou sauvegarder. La saisie
   texte reste distincte de la dictée et de ses permissions.
2. La capture vocale passe par [useRecordingSession](../../hooks/useRecordingSession.ts).
   Les limites et différences Android/iOS/web sont décrites dans le
   [guide de transcription](speech-to-text-integration.md).
3. L'aide à la restitution et la relecture utilisent
   [useCaptureConversation](../../hooks/useCaptureConversation.ts) et
   [CaptureReviewPanel](../../components/recording/CaptureReviewPanel.tsx).
4. La sauvegarde arrête la dictée, valide le texte et attend `addDream` avant de
   vider le brouillon. Une nouvelle tentative conserve l'identité du rêve après
   une erreur de persistance. Un texte trop long reste disponible pour correction.
5. La catégorisation facultative intervient après la sauvegarde et exige le
   consentement IA. Elle ne retarde pas la conservation du récit.
6. L'écran ouvre le rêve enregistré via la séquence de sauvegarde ; la réduction
   des animations ouvre directement la destination. L'entrée en lecture dépend
   du choix enregistré et du contexte de capture, pas d'une analyse obligatoire.

## Points d'entrée

| Responsabilité | Source |
| --- | --- |
| Brouillon, reprise et sortie | [useRecordingDraftPersistence](../../hooks/useRecordingDraftPersistence.ts) |
| Capture, validation et navigation après sauvegarde | [recording.tsx](../../app/recording.tsx), notamment `handleSaveDream` |
| Édition et original de la capture | [CaptureDraftEditor](../../components/recording/CaptureDraftEditor.tsx), [CaptureOriginal](../../components/recording/CaptureOriginal.tsx) |
| Persistance du journal | [DreamsContext](../../context/DreamsContext.tsx), [useDreamPersistence](../../hooks/useDreamPersistence.ts) |
| Couleurs et mouvement | [procédure partagée](repository-operations.md#styling-and-motion) |

Pour une modification fonctionnelle, vérifier le parcours affecté : texte →
sauvegarde → réouverture, brouillon après sortie, ou erreur de sauvegarde →
nouvelle tentative sans doublon. La dictée et les permissions réelles demandent
une preuve sur la plateforme concernée. Utiliser le [guide E2E](../../e2e/README.md)
pour choisir la commande ; cette relecture documentaire n'est pas une exécution.
