# Google Sign-In Configuration Guide

This guide explains how to configure Google Sign-In for the Dream Journal app with Supabase authentication.

## Prerequisites

- Google Cloud Console account
- Supabase project configured
- EAS Build setup (Google Sign-In requires a development build, not Expo Go)

## Overview

The app uses `@react-native-google-signin/google-signin` for native Google authentication on iOS and Android, integrated with Supabase Auth using the `signInWithIdToken` method.

## Step 1: Google Cloud Console Setup

### 1.1 Create a New Project (or use existing)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select your existing project
3. Note your project ID

### 1.2 Configure OAuth Consent Screen

1. Navigate to **APIs & Services** > **OAuth consent screen**
2. Select **External** user type (unless you have a Google Workspace organization)
3. Fill in the required information:
   - **App name**: Dream Journal
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Add scopes:
   - `openid`
   - `email`
   - `profile`
5. Add test users (for development/testing)
6. Save and continue

### 1.3 Create OAuth 2.0 Client IDs

You need to create **THREE** OAuth client IDs:

#### A. Web Client ID (Required for all platforms)

1. Navigate to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Select **Web application**
4. Configure:
   - **Name**: Dream Journal Web Client
   - **Authorized JavaScript origins**:
     ```
     https://usuyppgsmmowzizhaoqj.supabase.co
     ```
   - **Authorized redirect URIs**:
     ```
     https://usuyppgsmmowzizhaoqj.supabase.co/auth/v1/callback
     http://localhost:3000/auth/v1/callback
     ```
5. Click **Create**
6. **Save the Client ID and Client Secret** - you'll need these for Supabase

#### B. Android Client ID

1. Click **Create Credentials** > **OAuth client ID**
2. Select **Android**
3. Configure:
   - **Name**: Dream Journal Android
   - **Package name**: `com.tanuki75.noctalia`
   - **SHA-1 certificate fingerprint**: See section 1.4 below

#### C. iOS Client ID (if deploying to iOS)

1. Click **Create Credentials** > **OAuth client ID**
2. Select **iOS**
3. Configure:
   - **Name**: Dream Journal iOS
   - **Bundle ID**: Your iOS bundle identifier (from app.json)
4. Click **Create**
5. **Save the iOS Client ID** - you'll need it for app.json

### 1.4 Get SHA-1 Certificate Fingerprints (Android)

#### Development Build SHA-1

```bash
# Using EAS CLI
eas credentials

# Navigate to: Android > Keystore
# Copy the SHA-1 fingerprint displayed
```

#### Production Build SHA-1 (Important!)

**You need BOTH development and production SHA-1 fingerprints for production releases:**

1. Upload your first production build to Google Play Console (Internal Testing is fine)
2. Navigate to **Release** > **Setup** > **App Integrity**
3. Under **App signing**, copy the **SHA-1 certificate fingerprint**
4. Add this SHA-1 to your Android OAuth client in Google Cloud Console

**Why both?**
- Development SHA-1: For local development builds
- Production SHA-1: For builds signed by Google Play (required for production)

### 1.5 Add SHA-1 Fingerprints to Android OAuth Client

1. Go back to your Android OAuth client in Google Cloud Console
2. Click **Edit**
3. Add **ALL** SHA-1 fingerprints:
   - Development keystore SHA-1
   - Production (Google Play) SHA-1
4. Save

## Step 2: Supabase Configuration

### 2.1 Enable Google Provider

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Navigate to **Authentication** > **Providers**
3. Find **Google** and click to expand
4. Enable the provider
5. Configure:
   - **Client ID**: Paste your **Web Client ID** from Google Cloud Console
   - **Client Secret**: Paste your **Web Client Secret**
   - **Skip nonce check**: ✅ **ENABLE THIS** (required for `signInWithIdToken`)
   - **Authorized Client IDs**: Add both Web and Android Client IDs (comma-separated)
     ```
     YOUR_WEB_CLIENT_ID.apps.googleusercontent.com,YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com
     ```
6. Click **Save**

### 2.2 Configure Redirect URLs

1. Navigate to **Authentication** > **URL Configuration**
2. Set **Site URL** to:
   ```
   https://dream.noctalia.app
   ```
3. In **Redirect URLs**, add:
   ```
   https://dream.noctalia.app
   noctalia://google-auth
   ```
4. Save

Note: Web OAuth uses `redirectTo` with the current origin. If it is not allowlisted,
Supabase falls back to the Site URL.

## Step 3: Configure Environment Variables

Create or update your `.env.local` file in the project root:

```bash
# Supabase (should already be configured)
EXPO_PUBLIC_SUPABASE_URL=https://usuyppgsmmowzizhaoqj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Google OAuth Client IDs
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=YOUR_IOS_CLIENT_ID.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com
```

**Important:**
- Never commit `.env.local` to git (it's already in .gitignore)
- For EAS Build, set these variables in `eas.json` or use EAS Secrets

### 3.1 Configure EAS Secrets (Recommended for Production)

```bash
# Set secrets for EAS Build
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value YOUR_WEB_CLIENT_ID
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value YOUR_IOS_CLIENT_ID
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value YOUR_ANDROID_CLIENT_ID
```

## Step 4: Update app.json

Update the `@react-native-google-signin/google-signin` plugin configuration in `app.json`:

```json
{
  "expo": {
    "plugins": [
      // ... other plugins
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.YOUR-IOS-CLIENT-ID-REVERSED"
        }
      ]
    ]
  }
}
```

**Replace** `YOUR-IOS-CLIENT-ID-REVERSED` with your actual iOS Client ID in reverse DNS notation.

**Example:**
- iOS Client ID: `123456789-abcdefg.apps.googleusercontent.com`
- Reversed: `com.googleusercontent.apps.123456789-abcdefg`

## Step 5: Build and Test

### 5.1 Create Development Build

Google Sign-In requires a development build (Expo Go is not supported):

```bash
# Build for Android
eas build --profile development --platform android

# Build for iOS
eas build --profile development --platform ios

# Or both
eas build --profile development --platform all
```

### 5.2 Install Development Build

1. Download and install the development build on your physical device
2. Start the development server:
   ```bash
   npm start
   ```
3. Scan the QR code with your development build app

### 5.3 Test Google Sign-In

1. Navigate to **Settings** tab
2. Tap **Continue with Google**
3. Sign in with your Google account
4. Verify successful authentication

**Note:** Google Sign-In may not work in iOS Simulator or Android Emulator. Use a physical device for testing.

## Step 6: Production Build

### 6.1 Create Production Build

```bash
# Build for production
eas build --profile production --platform android
eas build --profile production --platform ios
```

### 6.2 Get Production SHA-1 (Android Only)

**Critical Step for Android:**

1. Upload the production build to Google Play Console (Internal Testing track)
2. Wait for Google Play to re-sign your app
3. Navigate to **Release** > **Setup** > **App Integrity**
4. Copy the **SHA-1 certificate fingerprint** under **App signing**
5. Add this SHA-1 to your Android OAuth client in Google Cloud Console
6. **Without this step, Google Sign-In will fail in production!**

### 6.3 Testing Production Build

Test the production build in Google Play Internal Testing before releasing to production.

## Troubleshooting

### Error: `DEVELOPER_ERROR` (Error Code 10)

**Cause:** SHA-1 fingerprint mismatch

**Solutions:**
1. Verify SHA-1 fingerprint in Google Cloud Console matches your build
2. For development: Use SHA-1 from `eas credentials`
3. For production: Add Google Play App Signing SHA-1
4. Make sure you've added BOTH development and production SHA-1s

### Error: `SIGN_IN_CANCELLED`

**Cause:** User closed the sign-in dialog

**Solution:** This is expected behavior - the app handles this gracefully

### Error: `PLAY_SERVICES_NOT_AVAILABLE`

**Cause:** Google Play Services not available or outdated (Android)

**Solution:** Ask user to update Google Play Services

### Error: `No ID token received from Google`

**Cause:** Google Sign-In configuration issue

**Solutions:**
1. Verify Web Client ID is correct in `.env.local`
2. Check that `initializeGoogleSignIn()` is called before sign-in attempt
3. Verify scopes include `openid`, `email`, `profile`

### Error: `No user data received from Supabase`

**Cause:** Supabase configuration issue

**Solutions:**
1. Verify "Skip nonce check" is enabled in Supabase Google provider settings
2. Check that Client ID and Secret are correct in Supabase dashboard
3. Verify Android Client ID is added to "Authorized Client IDs"

### Sign-In works in development but fails in production (Android)

**Cause:** Missing production SHA-1 fingerprint

**Solution:**
1. Get SHA-1 from Google Play Console (App Integrity)
2. Add it to your Android OAuth client in Google Cloud Console
3. Can take a few minutes to propagate

## Security Best Practices

1. **Never commit credentials**: Keep `.env.local` in .gitignore
2. **Use EAS Secrets**: For production builds, use EAS Secrets instead of hardcoded values
3. **Rotate secrets**: Periodically rotate OAuth client secrets
4. **Monitor auth logs**: Check Supabase auth logs for suspicious activity
5. **Enable 2FA**: Enable two-factor authentication for your Google Cloud and Supabase accounts

## Additional Resources

- [Google Sign-In for Android](https://developers.google.com/identity/sign-in/android)
- [Google Sign-In for iOS](https://developers.google.com/identity/sign-in/ios)
- [Supabase Auth with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [@react-native-google-signin/google-signin Documentation](https://github.com/react-native-google-signin/google-signin)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)

## Support

If you encounter issues not covered in this guide:

1. Check Supabase Auth logs: Dashboard > Authentication > Logs
2. Check Google Cloud Console logs: Logging > Logs Explorer
3. Review app console logs for detailed error messages
4. Ensure all environment variables are set correctly

## Summary Checklist

Before deploying to production, verify:

- [ ] Google Cloud project created with OAuth consent screen configured
- [ ] Web, Android, and iOS OAuth client IDs created
- [ ] Both development and production SHA-1 fingerprints added (Android)
- [ ] Google provider enabled in Supabase with correct credentials
- [ ] "Skip nonce check" enabled in Supabase
- [ ] Environment variables configured (locally and in EAS)
- [ ] `app.json` updated with iOS URL scheme
- [ ] Development build tested successfully
- [ ] Production build uploaded to Play Store Internal Testing
- [ ] Production SHA-1 obtained and added to Google Cloud Console
- [ ] Production build tested in Internal Testing track

Good luck with your Google Sign-In implementation!
