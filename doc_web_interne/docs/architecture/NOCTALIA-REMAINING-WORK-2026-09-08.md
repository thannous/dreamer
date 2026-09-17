# Suite de l'epic TI-513 — 8 septembre 2026

Références : master `f101aab9f`, premier lot TI-524 `ee591ed5e`. État Linear vérifié le 8 septembre ; ce registre distingue code livré et qualification restante.

| Tickets | Situation vérifiée | Suite |
| --- | --- | --- |
| TI-514 / TI-515 / TI-517 | Corrections déjà fusionnées par #113, statuts remis à Done | Conserver les limites natives dans TI-531 ; ne pas réimplémenter |
| TI-519 / TI-520 / TI-521 | Fusionnés #121 → #122 → #123 | Réutiliser leurs contrats et régressions |
| TI-524 | Première extraction PR #124 ; deuxième lot uploads/transitions préparé | Transport des mutations puis coordination durable, une responsabilité par lot |
| TI-516 | Droits/catalogue Meditation corrigés dans #113 | Démarrage sur build de test, droits connus/inconnus et reprise ; aucun achat réel |
| TI-518 | Autonomie runtime Lucid livrée dans #114 | Smoke natif et mesures de démarrage attribués au code testé |
| TI-528 | Journal réel qualifié sur base jetable | Admissions concurrentes, quotas, idempotence et leases des jobs ; rôles clients et service distingués |
| TI-531 | Lot Journal qualifié sur émulateur debug | Lucid/Meditation, accessibilité et scénarios propres aux lots ; aucune preuve Play inférée |
| TI-558 / TI-529 | Cadrage marque et spécifications à réconcilier | Matrice code/test/publication et parcours autonomes ; pas de renommage store |
| TI-559 | Réflexion proportionnée au récit à traiter | Contrat compatible, fixtures multilingues, grille d'évaluation ; ne pas assimiler mocks et qualité des réponses réelles |
| TI-525 / TI-526 | Optimisations du lecteur Meditation au backlog | Mesurer rendus et écritures séparément, préserver reprise et interruptions |
| TI-560 → TI-522 | Frontière serveur nécessaire avant import distant | Décider et prouver les droits interapps sans identité client déclarative falsifiable |
| TI-523 | Découverte facultative du Journal depuis Lucid | Respecter entraînement, sommeil et refus ; aucun partage implicite |
| TI-527 / TI-530 / TI-561 | Frontières/build/site liés au chantier CI distinct | Coordonner les propriétaires avant toute modification du pipeline ; pas de migration globale imposée |

## Ordre de travail retenu

Terminer les extractions bornées TI-524 et leurs régressions. Qualifier en parallèle les garanties backend restantes sans toucher à la production. Préparer ensuite la qualification native Lucid/Meditation et les optimisations du lecteur à partir de mesures. Le cadrage de marque et les autorisations interapps restent des décisions explicites du parent ; l'import distant attend sa preuve serveur.

Tous les tickets ouverts ne sont pas marqués « en cours » artificiellement. Les blocages, limites de preuve et dépendances restent visibles. Les changements de statut de TI-514/515/517 reposent sur les livraisons existantes et leurs rapports, sans présenter les anciens résultats comme des tests rejoués aujourd'hui.
