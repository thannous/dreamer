# Google Sign-In : configuration et diagnostic

Guide maintenu pour les développeurs de Dreamer et Lucid. Revue du code et des
références le 23 octobre 2026 ; ce document ne certifie pas les réglages distants
ni une connexion réelle. Ce guide remplace les anciens documents Google à la racine.

## Choisir le parcours

| Plateforme | Implémentation actuelle | Configuration utilisée |
| --- | --- | --- |
| Android | [lib/auth.ts](../../lib/auth.ts) : `GoogleSignin.signIn()`, puis `supabase.auth.signInWithIdToken()` | Client Web pour le jeton ; client Android correspondant au package et au certificat du binaire |
| iOS | Même échange natif | Clients Web et iOS ; schéma URL iOS du plugin Expo |
| Web | [lib/auth.web.ts](../../lib/auth.web.ts) : popup OAuth, callback de même origine, échange du code PKCE | Provider Google Supabase et URL de retour exacte ; pas de dépendance aux client IDs natifs |

Le mode mock simule la connexion. Utiliser un binaire intégrant le module natif
pour qualifier Android/iOS ; Expo Go ne contient pas ce module.
Voir le [guide Expo du SDK](https://react-native-google-signin.github.io/docs/setting-up/expo).

## Configuration locale

Les profils sont chargés en mémoire par [expo-safe-runner](../../scripts/expo-safe-runner.js).
`start:real` charge `.env.real` ; `start:supabase` charge `.env.supabase`.
Ces profils désactivent le chargement automatique Expo de `.env.local`.
Ajouter les valeurs au profil privé réellement utilisé, sans copier un autre profil :

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://<projet-autorise>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<cle-publique-du-projet>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<client-web>.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<client-ios>.apps.googleusercontent.com
```

Tous les `EXPO_PUBLIC_*` sont visibles dans le client. Le secret OAuth Web reste
côté Supabase ; ni ce secret ni une clé `service_role` ne doivent entrer dans l'app.
`lib/auth.ts` passe `webClientId` et, sur iOS, `iosClientId` à `GoogleSignin.configure`.
Il ne consomme pas `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` pour cet appel : ajouter
cette variable ne corrige pas une association package/certificat incorrecte.

Dreamer déclare son plugin et `iosUrlScheme` dans [app.json](../../app.json).
Lucid les résout dans [app.config.ts](../../app.config.ts) : les clients Web et iOS
doivent être tous deux présents ou tous deux absents ; le schéma est dérivé du
client iOS. Employer les identifiants de la variante construite.
Une modification du schéma ou du plugin nécessite une reconstruction native
isolée selon les [procédures du dépôt](repository-operations.md#native-journeys-and-inspection).

## Réglages distants à vérifier

Toute modification de provider, d'accès ou de publication reste soumise aux
limites d'autorisation du dépôt. Pour un diagnostic, relever d'abord les valeurs
existantes sans les modifier.

1. Dans Google, sélectionner le projet et l'audience autorisés. Le client Android
   doit correspondre au package **et au SHA-1 du certificat signant le binaire
   installé**. Chaque combinaison nécessaire a son client : signature locale,
   signature EAS et signature Play peuvent différer. Le client iOS correspond au
   bundle ID. Voir la [configuration du SDK](https://react-native-google-signin.github.io/docs/setting-up/get-config-file).
2. Dans le client Web Google, distinguer l'origine de l'app et le callback
   Supabase `https://<projet>.supabase.co/auth/v1/callback`.
3. Dans le provider Google de Supabase, vérifier le client Web et son secret,
   ainsi que les audiences natives utilisées ; si plusieurs client IDs sont
   configurés, placer celui du Web en premier.
4. Dans les redirect URLs Supabase, autoriser l'URL exacte envoyée par le code :
   `<origine-app>/auth-callback.html`, par exemple
   `https://dream.noctalia.app/auth-callback.html`. Pour le développement, employer
   l'origine et le port du serveur testé. Le callback Google → Supabase et le
   callback Supabase → app sont deux URLs différentes.

La [référence Supabase Google](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
explique audiences, redirects et nonce. L'emploi de `signInWithIdToken` ne suffit
pas à justifier l'activation de « Skip nonce check ». Le client natif actuel transmet
le jeton sans nonce explicite ; en cas d'erreur de nonce, diagnostiquer le couple
SDK/jeton et la configuration avant toute modification de cette protection.

## Vérifier le résultat

Sur le candidat et le compte QA existants : ouvrir la connexion, choisir Google,
constater le compte attendu, rouvrir l'app et vérifier la session, puis vérifier
l'annulation et la déconnexion. Sur le web, vérifier aussi le retour de popup et
sa fermeture sans session. Conserver plateforme, SHA, build, profil et résultat
sans jeton, secret ni contenu personnel.

| Symptôme | Premier contrôle |
| --- | --- |
| Option Google indisponible sur natif | `isGoogleSignInAvailable()` : client Web présent, et client iOS sur iOS |
| `DEVELOPER_ERROR` Android | Package installé, certificat réel et client Android associé |
| Retour web au mauvais endroit | URL exacte `/auth-callback.html` autorisée pour l'origine testée |
| Popup refusée ou fermée | Ouverture depuis l'action utilisateur, réglages du navigateur, annulation attendue |
| Jeton sans session Supabase | Projet cible, audience du jeton et erreur Auth expurgée ; ne pas publier le jeton |

Une réussite mock ne qualifie pas Google. Une réussite locale ne qualifie pas la
signature Play ni un autre binaire iOS. Builds EAS et publication suivent le
[guide mobile](MOBILE_VERSIONING.md), sans lancement automatique depuis cette procédure.
