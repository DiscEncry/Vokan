import { firestore } from './firebaseConfig';
import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import { getAuth, deleteUser, listUsers } from 'firebase-admin/auth';

/**
 * Danger: Deletes ALL user accounts and usernames from Firestore and Firebase Auth.
 * For development/testing only. Not for production!
 */
export async function devDeleteAllAccountsAndAuth() {
  // Delete all Firestore users and usernames
  const usersSnap = await getDocs(collection(firestore, 'users'));
  const usernamesSnap = await getDocs(collection(firestore, 'usernames'));
  for (const userDoc of usersSnap.docs) {
    await deleteDoc(userDoc.ref);
  }
  for (const usernameDoc of usernamesSnap.docs) {
    await deleteDoc(usernameDoc.ref);
  }

  // Delete all Firebase Auth users (requires admin SDK)
  // This part is only possible in a server environment (API route or server action)
  // Example for server-side (Node.js):
  // const auth = getAuth();
  // let nextPageToken: string | undefined;
  // do {
  //   const listResult = await auth.listUsers(1000, nextPageToken);
  //   for (const userRecord of listResult.users) {
  //     await auth.deleteUser(userRecord.uid);
  //   }
  //   nextPageToken = listResult.pageToken;
  // } while (nextPageToken);
}
