import { firestore } from './firebaseConfig';
import { doc, setDoc, getDoc, runTransaction } from 'firebase/firestore';
import type { UserProfile } from '@/types/userProfile';

export async function createUserProfile(profile: UserProfile) {
  if (!firestore) throw new Error('Firestore not initialized');
  const ref = doc(firestore, 'users', profile.uid);
  await setDoc(ref, profile, { merge: false });
}

export async function updateUserProfile(profile: UserProfile) {
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

// Atomic registration: create user profile and username lock
export async function registerUserWithUsername(profile: UserProfile) {
  if (!firestore) throw new Error('Firestore not initialized');
  const userRef = doc(firestore, 'users', profile.uid);
  const usernameRef = doc(firestore, 'usernames', profile.username.toLowerCase());
  await runTransaction(firestore, async (transaction) => {
    const usernameSnap = await transaction.get(usernameRef);
    if (usernameSnap.exists()) {
      throw new Error('Username already taken');
    }
    transaction.set(userRef, profile, { merge: false });
    transaction.set(usernameRef, { uid: profile.uid, username: profile.username.toLowerCase() });
  });
}
