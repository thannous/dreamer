# Suivi des 240 symboles dans les six langues

[Tableau Excel](suivi-240-symboles-6-langues.xlsx) · [CSV](symbol-rollout.csv) · [Passation](HANDOFF.md)

**240 packs complets, 0 à compléter, 1 440 pages** en FR, EN, ES, DE, IT et PT-BR. Chaque pack conserve trois scènes illustrées et deux éléments animés par surface visible. Aucun nouveau dessin ni changement de direction artistique dans cette mise à jour.

**240 QA actuelles** sur le master `674f752f62b3179c8a21300c7796024f5935efc1` : la campagne Release du site passe ses **267 parcours**, sans échec, ignoré, exclusion, interruption ou reprise instable. Elle contrôle le rendu à 2560×1440 et 390×844, les scènes, le mouvement dans le temps et les six langues. Les captures sont inspectées par échantillonnage. [Preuve et limites](../qa/symbols-240-site-readiness-20261022.json). L’Excel conserve ses 489 formules, son filtre A10:AC250, ses volets C11 et ses trois règles de couleur ; il est recalculé, exporté, rouvert et son compteur de publication est testé puis restauré.

**Thanh assure la publication.** Les 1 440 URL publiques répondent HTTP 200, mais ne correspondent pas exactement au build qualifié : attributs crossorigin et version du script d’animation différents. Le suivi ne déclare donc aucune nouvelle publication correspondante. QA, accord personnel et publication restent distincts : **240 / 0 / 0**. Aucun accord personnel n’est inventé.

L’archive native des six packs hérités (abeille, volcan, anneau, cascade, tortue, masque) est retrouvée et [sauvegardée sur le Drive privé](https://drive.google.com/file/d/1iZdMcaJxAugVTvqIEnTerhhHhOFSvui8/view?usp=drivesdk). Taille : 101 421 638 octets. SHA256 local : `52aeeaa3d81587f5f38e332388d22c9ede340cf0ccd9a42a336ade74a0bced69`. L’envoi, la taille, le dossier et la confidentialité sont vérifiés ; aucun hachage distant n’est revendiqué. Les anciennes sauvegardes de dérivés restent conservées.

## Sources et actualisation

- Profils : [scènes et effets](../../../docs-src/config/symbol-atlas-pilots.json), [images](../../../docs-src/config/symbol-atlas-six-assets.json), [six langues](../../../docs-src/config/symbol-atlas-locales.json).
- États : [registre actif](../../../docs-src/config/symbol-rollout.json). Le registre complet précédent est conservé à l’octet près dans [l’archive historique](../qa/symbol-rollout-history-through-20261022.json). Les derniers états par symbole, langue, étape et surface restent dans le fichier actif ; ne pas remettre tout l’historique dans ce fichier, limité à 10 Mio.
- Après un lot : générer le rapport canonique, ne réutiliser que les preuves dont les sources correspondent, actualiser ce classeur et son CSV ensemble, recalculer, rouvrir, inspecter et mettre à jour les empreintes de snapshot.json.
- Après la publication par Thanh : comparer la production au build publié, puis consigner seulement les publications correspondantes. Une disponibilité HTTP ou une capture ne prouve pas l’identité du build ni son mouvement.
- La QA navigateur ne qualifie aucun appareil physique, FPS ou application native. Aucune application mobile, fonction backend ou Store n’est déployé ici.

Copies privées existantes : [Excel](https://docs.google.com/spreadsheets/d/1TW79LHKvIa8cqX60VV8vI5sP-v43Saiv/edit) · [CSV](https://drive.google.com/file/d/1BQAjbuD2UWPlDfElaJQZ5qcv3ZIe1bau/view). Les métadonnées relues et empreintes figurent dans snapshot.json. Les reçus et publications historiques restent conservés, notamment [la livraison des 100 derniers packs](../qa/symbol-packs-final-100-20261022.md).
