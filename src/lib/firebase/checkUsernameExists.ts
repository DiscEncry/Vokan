// Utility to check if a username already exists in Firestore
import { firestore } from './firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function checkUsernameExists(username: string): Promise<boolean> {
  if (!firestore) throw new Error('Firestore not initialized');
  const q = query(collection(firestore, 'users'), where('username', '==', username));
  const snap = await getDocs(q);
  return !snap.empty;
}
