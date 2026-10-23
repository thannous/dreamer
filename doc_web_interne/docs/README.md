# Documentation essentielle

[AGENTS.md](../../AGENTS.md) définit les règles du dépôt ;
[package.json](../../package.json) et le [catalogue des scripts](../../scripts/README.md)
font foi pour les commandes. Démarrage local : [README](../../README.md#development).

## Développer et livrer

| Besoin | Guide de référence |
| --- | --- |
| Trouver les sources, configurations et artefacts | [Plan du dépôt](repository-layout.md) |
| Démarrer, préparer le natif, publier | [Opérations du dépôt](repository-operations.md) |
| Choisir les contrôles et prouver un commit avant push | [Validation proportionnée](validation-proportionnee.md) |
| Exécuter les parcours web, natifs et backend | [E2E](../../tools/e2e/README.md), [backend local](e2e-backend-qualification.md) |
| Préparer une version mobile | [Versions et livraison](MOBILE_VERSIONING.md), [compteurs EAS](mobile-build-version-sync.md) |
| Tester les achats et abonnements | [QA RevenueCat](revenuecat-qa-workflow.md) |
| Travailler sur iPhone | [Build local, Fast Refresh et Tailscale](ios-local-tailscale-ota.md) |
| Vérifier la sécurité mobile | [Audit](mobile-security-audit.md), [contrôles Release](mobile-security-release-checklist.md) |

## Comprendre le produit et ses données

| Sujet | Contrat ou point d'entrée |
| --- | --- |
| Dreamer, Lucid et Meditation | [Contrat de marque](../../specs/noctalia-brand-contract.md), [Lucid](../../specs/noctalia-lucid-trainer.md), [Meditation](../../apps/meditation/AGENTS.md) |
| Capture et dictée | [Sauvegarde](recording-screen-implementation.md), [transcription](speech-to-text-integration.md) ; `app/recording.tsx` |
| Journal et lecture | [Stockage](storage-kv-store.md), [apparence](../../components/journal/README.md) ; `app/(tabs)/journal.tsx`, `app/journal/[id].tsx` |
| Progression et badges | [Guides](guide-reading-progression.md), [règles des badges](../../lib/badges/README.md) |
| Authentification et mode invité | [Google](google-sign-in.md), [récupération du compte](password-recovery-rollout.md), [quotas invités](rg/guest.md) |
| Backend, droits et migrations | [Backend](../../README_BACKEND.md), [configuration](supabase-setup.md), [frontières d'architecture](architecture/README.md) |
| Site, contenus et symboles | [Sources du site](../../docs-src/README.md), [charte éditoriale](charte-editoriale.md), [Atlas](symbol-atlas-guidelines.md), [suivi des symboles](suivi-symboles/README.md) |

## Garder la documentation courte

Mettre à jour le guide propriétaire du sujet et faire un lien vers lui. Le code
et les commandes exécutables font foi ; ne pas recopier leurs inventaires.
Les résultats d'une campagne vont dans son reçu canonique sous `outputs/` ou dans
la sortie du runner, avec révision, verdict et limites. Ne conserver dans les
guides que les procédures réutilisables et les décisions encore utiles.

Les anciens audits, plans et rapports retirés du checkout restent dans
[l'historique avant simplification](https://github.com/thannous/dreamer/tree/c0de9eae92b0f4c43220ca07cf690955dc2419c5/doc_web_interne/docs).
Pour consulter un document retiré localement :
`git show c0de9eae92b0f4c43220ca07cf690955dc2419c5:chemin/du/document.md`.
Une preuve historique ne qualifie pas la version actuelle.
