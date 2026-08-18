# Noctalia 3.1.0 — notes de version Google Play

Dernière lecture Play Console : **18 août 2026 ~20:05 Europe/Paris**.

Package `com.tanuki75.noctalia`. Version name inchangée : `3.1.0`.
`app.json` reste en `android.versionCode` **54** (binaire live, pas le candidat 57).

## État Production

| versionCode | Nom | Statut Console | Preuve |
| --- | --- | --- | --- |
| **54** | 3.1.0 | **Live** — Disponible sur Google Play, déploiement complet. Sortie **9 août 2026 à 23:47**. Canal : 176 pays/régions, 38 installations. | [Release 16](https://play.google.com/console/u/0/developers/8905604954685629948/app/4972936220543906437/tracks/4697380643650052343/releases/16/details) |
| **57** | 3.1.0 | **Pas encore envoyé pour examen.** Release 17 créée le 18 août 2026, bundle 57 attaché, 54 désactivé dans cette release, déploiement complet prévu. Publication gérée **désactivée**. | [Release 17](https://play.google.com/console/u/0/developers/8905604954685629948/app/4972936220543906437/tracks/4697380643650052343/releases/17/details) |
| 53 | 3.1.0 | Remplacée. Bundle désactivé depuis la mise en prod de 54. | Release 16, app bundles désactivés |

La 57 n’est **pas** live. L’étape restante est
[Envoyer 1 modification pour examen](https://play.google.com/console/u/0/developers/8905604954685629948/app/4972936220543906437/publishing)
(`3.1.0 — Lancer le déploiement complet`). Après approbation Google, la
publication est automatique.

Les notes internes antérieures au 18 août qui disaient « Production = 53 » ou
« hotfix 54 pas soumis » sont **périmées**.

## Binaire 57 (pas le HEAD actuel)

- EAS Android production AAB `19882836-72ec-42dd-820e-8fef246fdb93`
- `appBuildVersion` 57, `appVersion` 3.1.0, profil `production`
- Git `fc93b2e1ce9aee6ae2f3bd3f508e88183430f7d0` (`docs(seo): record editorial discovery wave 48`, 13 août 2026 ~03:17 +0200)
- Artifact : `https://expo.dev/artifacts/eas/2ePJgFxHK2k77-fwyyus_1ruuY7L0zRym3uzF8ZuH_o.aab`

Contenu vs live 54 : attente d’analyse lunaire + haptique, navigation 320 dp,
préparation pt-BR in-app, erreurs d’achat Play plus claires. Le correctif
clavier du panneau Compte est **déjà** dans 54. Les correctifs web du 17 août
(PR 74) **ne sont pas** dans ce binaire.

## Ce qui a été ajouté dans la 3.1 (53, toujours vrai en 54)

- Une page Statistiques enrichie avec le rythme du journal et, pour les membres
  Plus, les émotions dominantes et l’évolution des thèmes dans le temps.
- Un démarrage Android plus rapide et plus stable, avec une meilleure
  compatibilité selon les capacités de l’appareil.
- Une navigation plus robuste, des repères plus lisibles et plusieurs
  améliorations d’accessibilité.

Les changements SEO, sociaux, analytiques et les outils internes ne sont pas
présentés comme des nouveautés de l’application dans la fiche Play.

## Textes Google Play — 54 live (hotfix clavier)

Le What’s New public FR au 18 août 2026 commence par le correctif clavier, puis
reprend le texte 3.1. Console a confirmé le même correctif en EN et DE.

### Français (fr-FR) — fiche publique

Cette mise à jour corrige le panneau Compte sur Android : le mot de passe et
les boutons de connexion ou de création de compte restent accessibles lorsque
le clavier est ouvert. Explore tes rêves dans la durée avec les nouvelles
Statistiques : ton rythme de journal et, avec Plus, tes émotions dominantes et
l’évolution de tes thèmes. Profite aussi d’un démarrage Android plus fluide,
d’une navigation plus stable et de nombreuses améliorations d’accessibilité et
de fiabilité.

### English (en-US) — 3.1 de base (le préfixe clavier est aussi en prod)

Explore how your dreams evolve with richer Statistics: your journaling rhythm
and, with Plus, dominant emotions and themes over time. Noctalia 3.1 also brings
faster Android startup, more stable navigation, and accessibility and
reliability improvements.

### Español (es-ES)

Explora cómo evolucionan tus sueños con nuevas Estadísticas: el ritmo de tu
diario y, con Plus, tus emociones dominantes y temas a lo largo del tiempo.
Noctalia 3.1 también ofrece un inicio más rápido en Android, una navegación más
estable y mejoras de accesibilidad y fiabilidad.

### Deutsch (de-DE)

Entdecke mit den erweiterten Statistiken, wie sich deine Träume entwickeln:
deinen Tagebuchrhythmus sowie mit Plus dominante Emotionen und Themen im
Zeitverlauf. Noctalia 3.1 bietet außerdem einen schnelleren Android-Start,
stabilere Navigation und Verbesserungen bei Barrierefreiheit und Zuverlässigkeit.

### Italiano (it-IT)

Scopri come evolvono i tuoi sogni con nuove Statistiche: il ritmo del diario e,
con Plus, le emozioni dominanti e i temi nel tempo. Noctalia 3.1 offre inoltre un
avvio Android più rapido, una navigazione più stabile e miglioramenti di
accessibilità e affidabilità.

## Textes Google Play — 57 (enregistrés dans la release 17, pas encore publics)

Ces cinq textes ont été enregistrés dans Play Console le 18 août 2026. Ils
remplaceront le What’s New public seulement après examen et publication de 57.

### English (en-US)

Analysis wait is clearer, with a lunar loading animation and haptic feedback at
each step. Navigation fits small screens better. This release also prepares
Brazilian Portuguese and shows Play purchase errors more clearly.

### Deutsch (de-DE)

Das Warten auf die Analyse ist klarer, mit einer Mond-Animation und haptischem
Feedback bei jedem Schritt. Die Navigation passt besser auf kleine Bildschirme.
Diese Version bereitet außerdem Portugiesisch (Brasilien) vor und zeigt
Kauf-Fehler von Play deutlicher.

### Español (es-ES)

La espera del análisis es más clara, con una animación lunar y respuesta háptica
en cada paso. La navegación cabe mejor en pantallas pequeñas. Esta versión
también prepara el portugués de Brasil y muestra con más claridad los errores de
compra de Play.

### Français (fr-FR)

L’attente d’analyse est plus claire, avec une animation lunaire et un retour
haptique à chaque étape. La navigation tient mieux sur les petits écrans. Cette
version prépare aussi le portugais (Brésil) et affiche plus clairement les
erreurs d’achat Play.

### Italiano (it-IT)

L’attesa dell’analisi è più chiara, con un’animazione lunare e un feedback
aptico a ogni passaggio. La navigazione sta meglio sugli schermi piccoli. Questa
versione prepara anche il portoghese del Brasile e mostra più chiaramente gli
errori di acquisto Play.

## Fiche Brésil (pt-BR)

La fiche pt-BR reste un **brouillon** (`marketing/aso/google-play-pt-br-2026-08-09.md`).
Le hotfix 54 est déjà public : l’activation du pays n’est plus bloquée par
l’attente d’un binaire 54. Aucune activation Brésil n’a été faite le 18 août
2026.
