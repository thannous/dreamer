# ADR-001 — Moteur de styling : NativeWind v4 ou Uniwind

**Date :** 2026-08-19 · **Statut :** ACCEPTÉ — option B, Uniwind
**Contexte :** lot L0 livré sous NativeWind v4 ; spike Uniwind réalisé à l'identique pour comparaison.

## Méthode

Le lot L0 (tokens Noctalia, kit UI, fond atmosphérique, écran de démonstration) a été
dupliqué puis porté sur Uniwind. **Aucun composant n'a été modifié** : seules la
configuration et le `ThemeProvider` diffèrent. Les deux applications ont été construites
et rendues dans un navigateur, en thème clair et sombre.

Le spike Uniwind a depuis été promu en projet principal
(`/Users/tanuki/Documents/noctalia-meditation`) et le dossier de spike supprimé.

## Mesures

| Critère | NativeWind 4.2.6 | Uniwind 1.11.0 |
|---|---|---|
| Version Tailwind | 3.4.19 | 4.3.3 |
| Export web à froid (`--clear`) | 45,2 s | **39,6 s** |
| Bundle JS | **2,3 Mo** | 2,4 Mo |
| CSS généré | **10 Ko** | 14 Ko |
| Paquets installés | 578 | **544** |
| `node_modules` | **662 Mo** | 696 Mo |
| Poids de la lib | **812 Ko** (+ 6,0 Mo tailwind) | 11 Mo (+ 872 Ko tailwind) |
| Fichiers de config styling | 5 | **4** |
| Babel requis | oui | **non** (Metro seul) |
| Licence | MIT | MIT |
| Âge du projet | ~3 ans | ~13 mois |

## Différences qualitatives constatées

### 1. Résolution des conflits de classes — décisive

Avec une chaîne de classes **strictement identique**
(`self-center … self-start`), les deux moteurs ne donnent pas le même résultat :

| Moteur | `alignSelf` obtenu |
|---|---|
| NativeWind | `center` — la classe de base gagne |
| Uniwind | `flex-start` — la dernière classe écrite gagne |

NativeWind tranche par **ordre dans la feuille de style** ; Uniwind par **ordre dans la
chaîne de classes**, comme on l'attend en écrivant du Tailwind.

C'est exactement la classe de bug qui a produit, pendant L0, un libellé ivoire sur fond
champagne (contraste très insuffisant) : `text-ivory` de la variante l'emportait
silencieusement sur `text-champagne-on` passé par le composant appelant. Sous NativeWind
il a fallu **concevoir autour** — séparer `tone` de `variant` dans le composant `Text` —
pour rendre l'erreur impossible. Sous Uniwind, l'override aurait simplement fonctionné.

### 2. Thème système

Uniwind gère `system` nativement et renvoie le thème **résolu** via `useUniwind()`.
NativeWind, avec `darkMode: 'class'`, n'applique pas la classe `.dark` quand on lui passe
`'system'` : il a fallu résoudre `auto` à la main via `Appearance` et un écouteur.
Le `ThemeProvider` Uniwind est plus court de 15 lignes et n'a pas d'écouteur à gérer.

### 3. Configuration

Uniwind supprime `babel.config.js` et `tailwind.config.js`. Les tokens vivent
intégralement dans `global.css` (`@theme` pour l'invariant, `@layer theme` + `@variant`
pour les valeurs par thème) — une seule source, plus de duplication entre le fichier CSS
et le fichier de config JS.

## Ce qui n'a PAS été mesuré

Les performances de rendu natif. L'argument commercial d'Uniwind (2× à 3,2× NativeWind)
porte sur le rendu iOS/Android, et le moteur C++ qui le sous-tend est une **option
payante** ; le tier gratuit est un moteur JavaScript. Vérifier cette affirmation
demanderait un build natif et un banc de mesure dédié. Les chiffres ci-dessus sont des
mesures de build web, qui n'en disent rien.

Cet écart de performance est de toute façon peu susceptible de mordre ici : les écrans
sont des listes courtes de cartes, et les animations lourdes (anneau de respiration,
artwork du lecteur) tournent dans des worklets Reanimated qui ne passent pas par la
résolution de classes.

## Options

**A. Rester sur NativeWind.** Maturité, conformité au brief et au template Zen, règles
Claude/Cursor du template directement applicables. Coût : la discipline `tone`/`variant`
doit être tenue partout, et le thème système reste résolu à la main.

**B. Basculer sur Uniwind.** Sémantique des classes conforme à l'intuition Tailwind,
moins de configuration, thème système natif, Tailwind v4. Coût : dépendance de 13 mois,
moteur rapide payant, écosystème Tailwind v4 encore jeune.

Le coût de bascule est aujourd'hui de **quatre fichiers et environ une heure**. Après les
lots L2 à L8, il se compte en jours. La décision doit donc être prise avant L1.


## Décision

**Option B retenue : Uniwind.** Motif principal : la résolution des conflits de classes,
qui supprime une classe entière de régressions de contraste silencieuses sur une
application dont la règle de contraste (`accent` jamais en texte) est précisément le
point fragile. La performance native n'a joué aucun rôle dans la décision — elle n'a pas
été mesurée et n'était pas jugée déterminante ici.

Risque accepté : jeunesse du projet (13 mois). Mitigation : les composants n'utilisent que
l'API `className` standard, commune aux deux moteurs ; un retour à NativeWind resterait un
changement de configuration, pas une réécriture.
