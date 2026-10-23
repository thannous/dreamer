# Architecture : contrats essentiels

Le [plan du dépôt](../repository-layout.md) situe les sources. Utiliser les
contrats ci-dessous pour un changement transversal ; consulter l'historique Git
pour les anciens plans et comptes rendus de qualification.

| Sujet | Référence |
| --- | --- |
| Responsabilités des trois applications | [Contrat de marque](../../../specs/noctalia-brand-contract.md), [frontières des dépendances](NOCTALIA-DEPENDENCY-BOUNDARIES.md) |
| Capture, stockage et synchronisation du journal | [Capture](../recording-screen-implementation.md), [stockage](../storage-kv-store.md), [pagination](NOCTALIA-TI521-PAGINATION.md) |
| Commandes IA, quotas et droits | [Backend](../../../README_BACKEND.md), [commandes serveur](ai-call-hardening/implementation/server-owned-ai-command.md), [contexte IA](DREAM-TRANSCRIPT-AI-LIMITS.md) |
| Schéma et migrations | [Configuration backend](../supabase-setup.md), [contrat DB](../../../supabase/db-contract.manifest.json) |
| Lucid autonome, sessions et import volontaire | [Spécification](../../../specs/noctalia-lucid-trainer.md), [autonomie](NOCTALIA-LUCID-AUTONOMY-ADR.md), [sessions](TI522-PRODUCT-SESSION-INTEGRATION.md), [autorisation d'import](TI560-JOURNAL-IMPORT-GRANTS.md) |
| Abonnements | [QA facturation](../revenuecat-qa-workflow.md), `services/subscriptionSyncService.ts` |
| Permissions et données par produit | [Matrice de capacités](NOCTALIA-CAPABILITIES-2026-09-08.md) |
| Couleurs partagées | [Contrat des tokens](NOCTALIA-BRAND-TOKEN-CONTRACT.md) |
