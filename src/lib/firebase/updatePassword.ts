import { auth } from './firebaseConfig';
import { updatePassword as firebaseUpdatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';

/**
 * Updates the current user's password. If the user session is too old, throws an error to trigger re-authentication.
 * @param newPassword The new password to set
 * @param currentPassword (optional) The user's current password, for re-authentication if needed
 */
export async function updatePassword(newPassword: string, currentPassword?: string): Promise<void> {
  if (!auth || !auth.currentUser) throw new Error('Not authenticated.');
  try {
    await firebaseUpdatePassword(auth.currentUser, newPassword);
  } catch (err: any) {
    // If re-authentication is required
    if (err.code === 'auth/requires-recent-login' && currentPassword) {
      const cred = EmailAuthProvider.credential(auth.currentUser.email!, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await firebaseUpdatePassword(auth.currentUser, newPassword);
    } else {
      throw err;
    }
  }
}
