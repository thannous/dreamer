# Lisibilité de l'onboarding Lucid en Morning

Le texte sombre Morning était posé directement sur les illustrations nocturnes.
Les titres, sous-titres, indicateurs d'étape, libellés et horaires manquaient de
contraste. La même composition concerne le thème Light.

Le correctif utilise la surface opaque existante de chaque palette derrière les
blocs de lecture et le footer. Les illustrations restent visibles entre les blocs.
Les cartes existantes, tokens, animations et styles Dark/Afterglow sont conservés.
Le sélecteur d'horaires est inclus : protéger seulement les titres ne suffisait
pas à rendre les deux valeurs horaires lisibles.

Validation locale : 11 tests du parcours onboarding, types application et lint
ciblé verts ; revue indépendante du diff final acceptée. Prévisualisation web
mock à 390×844 : quatre étapes parcourues, sélection objectif/expérience,
modales d'horaires, sensibilité aux réveils, plan et écran sans compte. Les
surfaces de lecture sont présentes et les contrôles restent accessibles par
scroll. Aucun compte ni achat n'a été créé.

Cette preuve web n'est pas une qualification du binaire Android ni une mesure
exhaustive de contraste sur tous les appareils. Le lot suit le correctif de
contrat de marque PR #119 ; il ne modifie pas le chargement du Journal TI-519.
