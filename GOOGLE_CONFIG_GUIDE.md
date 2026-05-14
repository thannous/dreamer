# Guide de Configuration Google Sign-In - Étape par Étape

Ce guide vous accompagne dans la configuration complète de Google Sign-In pour votre application Dream Journal.

## ✅ Checklist de Configuration

- [x] **Étape 1** : Créer/configurer le projet Google Cloud Console
- [ ] **Étape 2** : Configurer l'écran de consentement OAuth
- [ ] **Étape 3** : Créer Web OAuth Client ID
- [ ] **Étape 4** : Obtenir SHA-1 pour Android
- [ ] **Étape 5** : Créer Android OAuth Client ID
- [ ] **Étape 6** : Configurer Google provider dans Supabase
- [ ] **Étape 7** : Ajouter les credentials à `.env.local`
- [ ] **Étape 8** : Mettre à jour `app.json`
- [ ] **Étape 9** : Créer un development build
- [ ] **Étape 10** : Tester la connexion Google

---

## 📋 Étape 1 : Google Cloud Console - Créer le Projet

### Actions à effectuer :

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Cliquer sur le sélecteur de projet en haut de la page
3. Cliquer sur **"New Project"** ou utiliser un projet existant
4. Remplir :
   - **Project name** : `Dream Journal` (ou votre choix)
   - **Organization** : Laisser par défaut (No organization)
5. Cliquer **Create**
6. Attendre que le projet soit créé (quelques secondes)
7. Sélectionner le projet nouvellement créé

### ✅ Validation :
- [x] Le projet est créé et sélectionné
- [x] Vous voyez le nom du projet dans la barre de navigation en haut

---

## 📋 Étape 2 : Configurer l'Écran de Consentement OAuth

### Actions à effectuer :

1. Dans le menu de gauche, aller à **APIs & Services** > **OAuth consent screen**
2. Sélectionner **External** (sauf si vous avez Google Workspace)
3. Cliquer **Create**
4. Remplir le formulaire **OAuth consent screen** :

   **App information:**
   - **App name** : `Dream Journal`
   - **User support email** : Votre email
   - **App logo** : (optionnel, peut être ajouté plus tard)

   **App domain** (optionnel pour dev) :
   - Peut être laissé vide pour l'instant

   **Developer contact information:**
   - **Email addresses** : Votre email

5. Cliquer **Save and Continue**

6. Page **Scopes** :
   - Cliquer **Add or Remove Scopes**
   - Sélectionner :
     - ✅ `openid`
     - ✅ `.../auth/userinfo.email`
     - ✅ `.../auth/userinfo.profile`
   - Cliquer **Update**
   - Cliquer **Save and Continue**

7. Page **Test users** :
   - Cliquer **Add Users**
   - Ajouter votre email de test (le vôtre pour commencer)
   - Cliquer **Add**
   - Cliquer **Save and Continue**

8. Page **Summary** :
   - Vérifier les informations
   - Cliquer **Back to Dashboard**

### ✅ Validation :
- [ ] L'écran de consentement est configuré
- [ ] Le statut est "Testing" (normal pour un nouveau projet)
- [ ] Votre email est dans la liste des test users

---

## 📋 Étape 3 : Créer Web OAuth Client ID

### Actions à effectuer :

1. Dans le menu de gauche, aller à **APIs & Services** > **Credentials**
2. Cliquer **+ Create Credentials** (en haut)
3. Sélectionner **OAuth client ID**
4. Dans **Application type**, sélectionner **Web application**
5. Remplir :
   - **Name** : `Dream Journal Web Client`

   **Authorized JavaScript origins** :
   - Cliquer **+ Add URI**
   - Ajouter : `https://usuyppgsmmowzizhaoqj.supabase.co`

   **Authorized redirect URIs** :
   - Cliquer **+ Add URI**
   - Ajouter : `https://usuyppgsmmowzizhaoqj.supabase.co/auth/v1/callback`
   - Cliquer **+ Add URI** à nouveau
   - Ajouter : `http://localhost:3000/auth/v1/callback`

6. Cliquer **Create**

7. **IMPORTANT** : Une popup s'affiche avec votre Client ID et Client Secret
   - **Copier le Client ID** (format : `xxxxx.apps.googleusercontent.com`)
   - **Copier le Client Secret**
   - Garder ces valeurs pour plus tard (Étape 6 et 7)

### ✅ Validation :
- [x] Le Web OAuth client ID est créé
- [x] Vous avez copié et sauvegardé :
  - Client ID : `___________________.apps.googleusercontent.com`
  - Client Secret : `___________________`

---

## 📋 Étape 4 : Obtenir SHA-1 pour Android

### Actions à effectuer :

1. Ouvrir un terminal dans le dossier du projet
2. Exécuter la commande :
   ```bash
   eas credentials
   ```

3. Sélectionner :
   - **Platform** : `Android`
   - Choisir votre projet si demandé

4. Naviguer vers :
   - **Keystore: Manage everything related to your Keystore**
   - Vous devriez voir les informations du Keystore

5. **Copier le SHA-1 fingerprint** affiché
   - Format : `XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX`

#### Empreinte de production (Play Console)

Une fois un premier build soumis sur la Play Console (piste Internal Testing suffit) :

1. Ouvrir **Play Console** > **Release** > **Setup** > **App Integrity**
2. Dans la carte **App signing**, copier l’empreinte **SHA-1 certificate fingerprint**
3. Conserver cette empreinte : elle doit être ajoutée en plus du SHA-1 de développement

### Alternative si EAS credentials ne fonctionne pas :

Pour un keystore local de développement :
```bash
# Sur macOS/Linux
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Sur Windows
keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

### ✅ Validation :
- [x] Vous avez obtenu le SHA-1 fingerprint
- [x] SHA-1 : `C1:1F:90:62:27:B9:78:C4:21:CA:AC:5B:7D:7C:F2:75:3B:86:ED:7F`

---

## 📋 Étape 5 : Créer Android OAuth Client ID

### Actions à effectuer :

1. Retourner à **APIs & Services** > **Credentials**
2. Cliquer **+ Create Credentials**
3. Sélectionner **OAuth client ID**
4. Dans **Application type**, sélectionner **Android**
5. Remplir :
   - **Name** : `Dream Journal Android`
   - **Package name** : `com.tanuki75.noctalia` ⚠️ IMPORTANT : Ne pas modifier !
   - **SHA-1 certificate fingerprint** : Coller le SHA-1 de l'Étape 4 (développement)

6. Cliquer **Create**

7. Noter le **Client ID** généré (il sera différent du Web Client ID)

8. Après avoir obtenu l’empreinte SHA-1 de production (Étape 4), retourner sur ce **même client Android** dans Google Cloud
   Console, cliquer **Edit** et ajouter l’empreinte de production en plus de celle de développement, puis **Save**

   Empreinte Play App Signing extraite de l'APK universel Play `com.tanuki75.noctalia` versionCode 24 :
   - **SHA-1 Play** : `BC:CF:C2:96:38:47:81:D6:8C:B7:B6:5A:BA:84:CB:B3:8C:85:E0:59`
   - **SHA-256 Play** : `6A:8C:B2:E2:CD:D2:C1:FD:D7:C5:CF:CF:00:D7:C3:CC:58:61:C2:CD:3F:AF:49:F6:9A:31:25:35:A4:4F:EE:0F`

   Note : `gcloud iam oauth-clients list --project gen-lang-client-0336445544 --location=global`
   renvoie `[]` pour les clients OAuth Android classiques. La presence de ce SHA-1 doit donc etre
   confirmee dans **Google Cloud Console > APIs & Services > Credentials**.

### ✅ Validation :
- [x] L'Android OAuth client ID est créé
- [x] Package name : `com.tanuki75.noctalia`
- [x] SHA-1 ajouté
- [ ] SHA-1 Play App Signing ajouté/verifié dans Google Cloud Console
- [x] Android Client ID : `359653779023-b2ehl3qp5eas6b8ncu4cenjbtb3ivqfp.apps.googleusercontent.com`

---

## 📋 Étape 6 : Configurer Google Provider dans Supabase

### Actions à effectuer :

1. Aller sur [Supabase Dashboard](https://app.supabase.com/)
2. Sélectionner votre projet : `usuyppgsmmowzizhaoqj`
3. Dans le menu de gauche, aller à **Authentication** > **Providers**
4. Trouver **Google** dans la liste et cliquer dessus pour le développer
5. Activer le toggle **Enable Sign in with Google**

6. Remplir le formulaire :

   **Client ID (for OAuth)** :
   - Coller votre **Web Client ID** de l'Étape 3

   **Client Secret (for OAuth)** :
   - Coller votre **Web Client Secret** de l'Étape 3

   **Authorized Client IDs** :
   - Coller les deux Client IDs séparés par une virgule :
   ```
   VOTRE_WEB_CLIENT_ID.apps.googleusercontent.com,VOTRE_ANDROID_CLIENT_ID.apps.googleusercontent.com
   ```

   **⚠️ TRÈS IMPORTANT : Skip nonce check**
   - ✅ **Cocher cette case** (requis pour `signInWithIdToken`)

7. Cliquer **Save**

8. Aller à **Authentication** > **URL Configuration**
9. Dans **Site URL**, mettre :
   ```
   https://dream.noctalia.app
   ```
10. Dans **Redirect URLs**, ajouter :
   ```
   https://dream.noctalia.app
   noctalia://google-auth
   ```
11. Cliquer **Save**

Note: pour le web, `redirectTo` utilise l'origin courante. Si elle n'est pas
autorisee, Supabase retombe sur la Site URL.

### ✅ Validation :
- [X] Google provider activé dans Supabase
- [X] Client ID et Secret ajoutés
- [X] **Skip nonce check** est COCHÉ ✅
- [X] Authorized Client IDs contient Web + Android
- [X] Site URL `https://dream.noctalia.app` definie
- [X] Redirect URLs `https://dream.noctalia.app` + `noctalia://google-auth` ajoutees

---

## 📋 Étape 7 : Ajouter les Credentials à .env.local

### Actions à effectuer :

1. Copier le template :
   ```bash
   cp .env.google.template .env.local
   ```

2. Ouvrir `.env.local` dans votre éditeur

3. Remplacer les valeurs :
   ```bash
   # Supabase (déjà ok)
   EXPO_PUBLIC_SUPABASE_URL=https://usuyppgsmmowzizhaoqj.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=***REMOVED***
   EXPO_PUBLIC_API_URL=https://usuyppgsmmowzizhaoqj.functions.supabase.co/api

   # Google OAuth Client IDs - REMPLACER PAR VOS VRAIES VALEURS
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=VOTRE_WEB_CLIENT_ID.apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=VOTRE_IOS_CLIENT_ID.apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=VOTRE_ANDROID_CLIENT_ID.apps.googleusercontent.com
   ```

4. Sauvegarder le fichier

### ✅ Validation :
- [x] `.env.local` créé avec les bonnes valeurs
- [x] Les 3 Client IDs Google sont remplis
- [x] Le fichier est sauvegardé

---

## 📋 Étape 8 : Mettre à Jour app.json

### Actions à effectuer :

**Note** : Cette étape est optionnelle pour l'instant car vous allez d'abord tester sur Android. L'iOS URL scheme n'est nécessaire que pour iOS.

Pour Android seulement, vous pouvez sauter cette étape pour l'instant.

Si vous voulez configurer iOS :

1. Ouvrir `app.json`
2. Trouver le plugin Google Sign-In (ligne ~58) :
   ```json
   [
     "@react-native-google-signin/google-signin",
     {
       "iosUrlScheme": "com.googleusercontent.apps.YOUR-IOS-CLIENT-ID-REVERSED"
     }
   ]
   ```

3. Remplacer `YOUR-IOS-CLIENT-ID-REVERSED` par votre iOS Client ID inversé

   **Exemple** :
   - iOS Client ID : `123456-abc.apps.googleusercontent.com`
   - Inversé : `com.googleusercontent.apps.123456-abc`

4. Sauvegarder

### ✅ Validation :
- [ ] `app.json` mis à jour (ou skip si Android seulement)

---

## 📋 Étape 9 : Créer un Development Build

### Actions à effectuer :

⚠️ **Attention** : Google Sign-In nécessite un development build, **Expo Go ne fonctionne pas** !

1. Ouvrir un terminal dans le dossier du projet

2. Créer un development build pour Android :
   ```bash
   eas build --profile development --platform android
   ```

3. Attendre la fin du build (peut prendre 5-15 minutes)

4. Une fois terminé, vous recevrez :
   - Un lien pour télécharger l'APK
   - Ou un QR code si vous avez un compte EAS configuré

5. Installer l'APK sur votre appareil Android :
   - Télécharger l'APK depuis le lien fourni
   - Transférer sur votre téléphone Android
   - Installer (autorisez l'installation depuis des sources inconnues si demandé)

### ✅ Validation :
- [ ] Development build créé avec succès
- [ ] APK téléchargé et installé sur un appareil Android physique
- [ ] L'application se lance sans erreurs

---

## 📋 Étape 10 : Tester la Connexion Google

### Actions à effectuer :

1. Démarrer le serveur de développement :
   ```bash
   npm start
   ```

2. Sur votre appareil Android avec le development build installé :
   - Ouvrir l'app Dream Journal
   - Scanner le QR code affiché dans le terminal

3. Une fois l'app lancée :
   - Aller dans l'onglet **Settings**
   - Vous devriez voir le bouton **"Continue with Google"**

4. Taper sur **"Continue with Google"**

5. Sélectionner votre compte Google (celui que vous avez ajouté comme test user)

6. Autoriser l'application

7. Vérifier que :
   - La connexion réussit
   - Vous êtes redirigé vers l'écran Settings
   - Votre email s'affiche dans la section "Account"
   - Le message "You're signed in and syncing" apparaît

### En cas d'erreur :

**Erreur `DEVELOPER_ERROR`** :
- Vérifier que le SHA-1 dans Google Cloud Console correspond à celui d'EAS
- Vérifier que le package name est bien `com.tanuki75.noctalia`

**Erreur `No user data received from Supabase`** :
- Vérifier que "Skip nonce check" est bien coché dans Supabase
- Vérifier que les Client IDs sont corrects dans Supabase

**Autres erreurs** :
- Consulter [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md) section Troubleshooting

### ✅ Validation :
- [ ] Le bouton "Continue with Google" apparaît
- [ ] La popup de connexion Google s'ouvre
- [ ] La connexion réussit
- [ ] L'email s'affiche dans Settings
- [ ] Vous pouvez vous déconnecter et reconnecter

---

## 🎉 Félicitations !

Si vous avez complété toutes les étapes avec succès, Google Sign-In est maintenant fonctionnel dans votre application Dream Journal !

### Prochaines étapes :

1. **Tester la déconnexion** :
   - Appuyer sur "Sign Out"
   - Vérifier que vous êtes bien déconnecté
   - Reconnecter avec Google

2. **Tester la persistance** :
   - Se connecter avec Google
   - Fermer complètement l'app
   - Rouvrir l'app
   - Vérifier que vous êtes toujours connecté

3. **Pour la production** :
   - Consulter [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md) section "Production Build"
   - Important : Obtenir le SHA-1 de production depuis Google Play Console

---

## 🆘 Besoin d'Aide ?

- **Documentation complète** : [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md)
- **Troubleshooting** : Voir la section Troubleshooting du guide complet
- **Logs Supabase** : Dashboard > Authentication > Logs
- **Logs Google** : Google Cloud Console > Logging > Logs Explorer

Bonne chance avec votre implémentation ! 🚀
