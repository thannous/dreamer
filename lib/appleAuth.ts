import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

export type AppleIdentityCredential = {
  identityToken: string;
  nonce: string;
  authorizationCode?: string;
};

export function isAppleSignInSupported(): boolean {
  return Platform.OS === 'ios';
}

/**
 * Acquire Apple's identity token plus the raw nonce that Supabase must receive.
 * The hashed nonce is sent to Apple; `signInWithIdToken` gets the original.
 */
export async function requestAppleIdentityCredential(): Promise<AppleIdentityCredential> {
  if (!isAppleSignInSupported()) {
    throw new Error('Sign in with Apple is only available on iOS.');
  }

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new Error('Sign in with Apple is not available on this device');
  }

  const nonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error('No identity token received from Apple');
  }

  return {
    identityToken: credential.identityToken,
    nonce,
    authorizationCode: credential.authorizationCode ?? undefined,
  };
}
