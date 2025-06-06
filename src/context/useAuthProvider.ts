// src/context/useAuthProvider.ts
// Extracted provider sign-in logic from AuthContext for maintainability and clarity.
import { GoogleAuthProvider, signInWithPopup, EmailAuthProvider, linkWithCredential, fetchSignInMethodsForEmail, User } from 'firebase/auth';
import { getUserProfile, createUserProfile } from '@/lib/firebase/userProfile';

/**
 * Handles sign-in with OAuth providers (currently only Google).
 * Optionally links a password to the account if provided.
 * Returns user or onboarding info for new users.
 */
export async function signInWithProviderLogic({
  auth,
  providerType,
  passwordToLink
}: {
  auth: any,
  providerType: 'google',
  passwordToLink?: string
}): Promise<User | null | { isNewUser?: boolean; showWelcome?: boolean; email?: string; error?: string; uid?: string }> {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const email = result.user.email!;
    const uid = result.user.uid;
    // Check if user profile exists
    let profile = await getUserProfile(uid);
    let isNewUser = false;
    if (!profile) {
      // New user: create random username and profile
      isNewUser = true;
      const username = `user-${Math.random().toString(36).substring(2, 8)}`;
      profile = {
        uid,
        email,
        username,
        createdAt: new Date().toISOString(),
        provider: 'google',
      };
      await createUserProfile(profile);
    }
    // Optionally link password if provided
    if (passwordToLink) {
      await linkWithCredential(result.user, EmailAuthProvider.credential(email, passwordToLink));
    }
    // Always return showWelcome for new users
    if (isNewUser) {
      return { isNewUser: true, showWelcome: true, email, uid };
    }
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/account-exists-with-different-credential') {
      const email = error.customData?.email || error.email;
      const methods = await fetchSignInMethodsForEmail(auth, email);
      if (methods.includes('password')) {
        return {
          error: 'This email is registered with a password. Please sign in with your password, then link Google in your account settings.'
        };
      }
      return { error: 'This email is registered with another provider.' };
    }
    return { error: error.message || 'Authentication failed.' };
  }
}
