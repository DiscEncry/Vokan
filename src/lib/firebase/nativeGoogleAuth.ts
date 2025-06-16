import { Plugins } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

export async function isNativeMobile() {
  // Capacitor 3+ detection
  return !!(window && (window as any).Capacitor && (window as any).Capacitor.isNativePlatform && (window as any).Capacitor.isNativePlatform());
}

export async function nativeGoogleSignIn() {
  try {
    // This will open the native Google sign-in flow and sign in to Firebase
    const result = await FirebaseAuthentication.signInWithGoogle();
    // result.credential contains the idToken and accessToken
    // result.user contains the Firebase user info
    return result;
  } catch (err) {
    throw err;
  }
}
