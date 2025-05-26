import { firestore } from './firebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import type { UserProfile } from '@/types/userProfile';

export async function createUserProfile(profile: UserProfile) {
  if (!firestore) throw new Error('Firestore not initialized');
  const ref = doc(firestore, 'users', profile.uid);
  await setDoc(ref, profile, { merge: true });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!firestore) throw new Error('Firestore not initialized');
  const ref = doc(firestore, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as UserProfile) : null;
}
