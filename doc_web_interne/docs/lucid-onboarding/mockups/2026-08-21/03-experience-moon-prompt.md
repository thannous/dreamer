# Asset lunaire — étape 3

Asset final : `assets/images/lucid/onboarding/experience-moon.png`

Mode : génération d’image intégrée, puis extraction du fond en transparence réelle. Le PNG source RGBA a été redimensionné en `512x512` pour l’application.

## Prompt de génération

Créer une lune volumétrique isolée correspondant aux sphères de la maquette : globe lunaire anthracite avec relief de cratères réaliste, croissant ivoire éclairé depuis le coin supérieur gauche et très léger reflet cyan sur le bord inférieur. Composition centrée, éclairage nocturne cinématique et rendu premium sur fond réellement transparent. État neutre uniquement : aucun anneau, halo de sélection, badge, socle, texte, pictogramme, étoile ou décor.

## Correction de transparence

Supprimer entièrement le damier blanc et gris de la première génération, conserver exactement la lune et produire un PNG RGBA avec alpha réel, bords anticrénelés et aucun fond rectangulaire.

L’anneau et le halo sélectionnés restent dessinés dans `LucidOnboardingChoices.tsx`; ils ne sont jamais intégrés à l’asset.
