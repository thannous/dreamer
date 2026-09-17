# J52 — hospital local, diagnostic rentrée et articles à améliorer

7 septembre 2026. Autorisation : reprendre hospital, traiter le diagnostic rentrée et proposer des solutions pour les articles faibles. **Aucune publication, aucun commit/push, aucun crédit Ahrefs supplémentaire, aucune demande d'indexation.**

## Hospital : prêt localement

- Branche `codex/seo-j52-hospital-diagnostics`, créée depuis `origin/master` `77f49c0b458ffa190cb0a3494e2dec1aea8834f1`. Les deux documents de plan J52 préexistants et la sauvegarde historique sont préservés ; aucun report global de l'ancienne branche.
- Seul fichier produit modifié : `data/dream-symbols.json`, objet `hospital.es`, deux ajouts :
  - `documentTitle`: `Soñar con un hospital: estar allí o verlo lleno` ; rendu avec suffixe ` | Noctalia` = 58 caractères.
  - `documentMetaDescription`: `¿Qué significa soñar con un hospital? Compara estar allí, verlo lleno de gente, enfermos o personal médico según tu emoción y contexto, sin predicciones.` = 153 caractères.
- Aucun changement de corps, FAQ, H1, slug, autres langues, `seoTitle`, liens ou date `modifiedAt` du 17 juillet.
- Vérification structurelle : après retrait de ces deux ajouts, le JSON complet est strictement identique à HEAD. HTML généré : title avec suffixe de marque, description exacte, canonical propre vérifiés. L'assertion initiale omettait le suffixe de marque ; elle a été corrigée, pas le générateur.
- `npm run docs:build` PASS ; `npm run docs:check` PASS : 1 261 URL sitemap, zéro erreur/avertissement et zéro lien interne cassé. `git diff --check` PASS.
- Revue indépendante finale : PASS. Diff de deux champs confirmé, rendu metadata/canonical validé et FAQ inchangées. Le générateur expose quatre FAQ JSON-LD par comportement préexistant ; aucune extension de ce contrat dans le lot.
- Le build local a régénéré des bundles d'expérience hors périmètre ; seules ces sorties de cette exécution ont été remises à leur état initial/exclues. Contrôles `docs:check` repassés ensuite. Aucun fichier `docs/` édité manuellement ou ajouté à Git.
- Prochaine étape : **GO publication hospital**, puis commit borné, CI, déploiement et preuve publique distincte. Cette note ne prouve pas une publication.

## Rentrée : diagnostic actualisé des dix URL

Inspections API terminées le **7 septembre à 20:51:08 UTC**. Ce relevé remplace les deux inspections antérieures du plan J52 : EN enfants est désormais détecté, sans que cette évolution puisse être attribuée à notre lecture.

| Lot | EN | FR | DE | ES | IT |
|---|---|---|---|---|---|
| Retour à l'école adulte | Détectée, non indexée | Détectée, non indexée | Détectée, non indexée | Inconnue de Google | Détectée, non indexée |
| Cauchemars rentrée enfants | Détectée, non indexée | Détectée, non indexée | Détectée, non indexée | Détectée, non indexée | Détectée, non indexée |

**Preuves publiques sur les 10 URL :** HTTP200, canonical propre, meta robots index/follow, pas de X-Robots-Tag bloquant, présence exacte dans `https://noctalia.app/sitemap.xml`. Robots public autorise les pages et référence ce sitemap. Les neuf inspections « détectée » reconnaissent le sitemap ; aucun `lastCrawlTime` n'est fourni. Aucun statut « crawled — not indexed » observé : ne pas attribuer le blocage à une évaluation de qualité démontrée.

**Maillage vérifié, pas de pages orphelines dans le graphe public contrôlé :** chaque URL reçoit au moins trois sources publiques distinctes dans sa langue, toutes HTTP200, liens HTML `<a href>` présents : index blog, hub signification, plus article examens (adultes) ou guide rêves des enfants (enfants). Les liens de sélecteur de langue et liens répétés ne sont pas comptés comme sources distinctes. Exemples EN :

- `/en/blog/exam-dreams-meaning` → `/en/blog/back-to-school-dreams-meaning` ; ancre `back-to-school dreams`.
- `/en/blog/children-dreams-guide` → `/en/blog/back-to-school-nightmares-children`.
- `/en/blog/dream-meanings` et `/en/blog/` → les deux articles.

**Décision : ne modifier ni sitemap, ni canonical, ni liens déjà présents, ni articles pour ce diagnostic.** Les contrôles écartent ces causes simples ; ils ne prouvent pas l'absence de filtrage spécifique Googlebot ou la raison de la sélection de crawl par Google.

Suite proposée : examiner les logs/événements CDN disponibles pour les dix chemins, avec Googlebot authentifié, rechercher passages/403/429/5xx et distinguer absence de passage de refus. Logs non consultés ici, cause profonde encore indéterminée. Nouvelle lecture GSC proposée sous 48–72 h, sans automatisation créée ni demande d'indexation. Google précise qu'un crawl peut prendre quelques jours à quelques semaines et qu'une demande ne garantit pas l'indexation : [documentation officielle](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).

Preuves brutes temporaires : `/private/tmp/noctalia-j52-rentree-results.json`, `/private/tmp/noctalia-j52-rentree-links.json`. Graphe généré local puis sources entrantes vérifiées publiquement ; fichiers temporaires non archivés Drive. Ne pas confondre inspection du statut Google et test live Googlebot.

## Articles réellement faibles : recommandations, pas modifications

GSC Web du 9 août au 5 septembre (28 jours finalisés), comparaison 12 juillet au 8 août. Export réalisé dans le tour précédent le même jour ; aucune nouvelle extraction de performance dans ce tour. URL exactes sans fragments, tous pays/appareils ; CTR calculé sur ces lignes. Requêtes visibles partielles/anonymisées, pas un total réconciliable avec la page.

| Priorité | Article existant | Clics / impressions / CTR / position | Proposition bornée |
|---|---|---|---|
| P1-1 | EN `/en/blog/dream-interpretation-history` | 6 / 3 650 / 0,164 % / 14,08 | Révision sourcée du corps : vérifier le « roughly 65% », séparer traditions, faits historiques et hypothèses scientifiques. Chronologie déjà présente : améliorer plutôt que recréer. Ancienne position16,44 : progression, pas chute démontrée. |
| P1-2 | ES `/es/blog/suenos-de-caer` | 0 / 1 519 / 0 % / 9,34 | Remplacer réponse rapide promotionnelle par réponse directe sur chute d'un bâtiment/lieu élevé ; distinguer rêve et sensation d'endormissement. Vérifier le70% et l'attribution Walker, retirer ce qui n'est pas étayé. Aucun nouvel article. |
| P2-1 | ES `/es/blog/suenos-ser-perseguido` | 6 / 2 050 / 0,293 % / 8,70 | Title/intro centrés poursuite et fuite, accès clair aux scénarios, remplacer « significado oculto » et certitude d'évitement par questions contextualisées. Fiche `/es/simbolos/persecucion` reste résumé, article scénarios. |
| P2-2 | EN `/en/blog/death-dreams-meaning` | 2 / 2 019 / 0,099 % / 25,70 | Revue de fond : incohérence «5 Hidden Meanings»/six dans le corps, citations à vérifier, scénarios et deuil sans décodage certain. Pas de simple title-only ; préserver les propriétaires deuil/cimetière. |
| P2-3 | FR `/fr/blog/reves-dents-qui-tombent` | 10 / 1 344 / 0,744 % / 23,18 | Révision prudente car position passée de39,30 à23,18 : préciser source/échantillon du39%, vérifier citation Zadra, distinguer hypothèses corporelles et sens personnel. Ne pas fusionner avec la fiche dents. |

Preuves de requêtes utiles : chute ES `que significa soñar que caes de un lugar alto` 37 impressions/0clic/position9,11 ; chute d'un immeuble35/0/10,03. Mort EN `dreams about death`31/0/39,65 et `death dream meaning`27/0/39,56 : le cluster principal est plus faible que la moyenne page. Dents FR `rever de perdre ses dents`96impressions/1clic/23,34 sur article contre8/0/64,25 sur fiche. Poursuite ES `soñar con persecución`66/0/10,20 sur article contre1/0/9 sur fiche : chevauchement observé, pas preuve de cannibalisation.

### Ne pas toucher automatiquement

- DE article récurrent : 42→14clics, position6,46→8,17 ; modifié le12août. Diagnostic de cohortes de requêtes et ownership avant rollback, car les fenêtres chevauchent le changement.
- EN precognitive : 34 555impressions, CTR0,017%, position7,21. Conserver gate récent ; segmenter pays/appareils/requêtes et confirmer date publique avant J+28.
- EN flying : 7→38clics, position14,44→11,23. Progression et expérience récente : mesure, pas correction automatique parce que position>10.
- Travail EN1sept / FRDEESIT6sept, arbol/pidocchi2sept et scuola naturelle restent hors lot. Dette guide journal EN (assertions50%/90%) à inventorier séparément, sans l'intégrer à cette demande.

**Ordre recommandé après hospital : histoire EN, puis chute ES, un lot à la fois.** Pour chacun : tableau affirmation/source, diff de contenu borné, revue, contrôle FAQ/JSON-LD/dates/maillage, validation publication puis baseline et J+7/J+28. La faiblesse observée justifie une amélioration de réponse et crédibilité, pas la promesse d'un meilleur classement.

Compétence audit SEO : priorité découverte/ownership et preuves. Audit des articles indépendant par agent GPT-6 Astra ; aucun auteur n'a réécrit ces articles. Astra Advisor et sa configuration ne sont pas présents sur cette base master, aucune orchestration simulée.
