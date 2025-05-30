// Utility to check if a username already exists in Firestore
import { firestore } from './firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

export async function checkUsernameExists(username: string): Promise<boolean> {
  if (!firestore) throw new Error('Firestore not initialized');
  if (!username) return false;
  const normalizedUsername = username.toLowerCase();
  const usernameDocRef = doc(firestore, 'usernames', normalizedUsername);
  const docSnap = await getDoc(usernameDocRef);
  return docSnap.exists();
}
