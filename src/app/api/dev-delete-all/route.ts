import { NextRequest, NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase/firebaseConfig';
import { collection, getDocs, deleteDoc } from 'firebase/firestore';

// Import admin SDK dynamically to avoid issues in client bundles
let admin: typeof import('firebase-admin') | null = null;
try {
  admin = require('firebase-admin');
} catch {}

// Initialize admin SDK if not already
if (admin && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export async function POST(req: NextRequest) {
  // Danger: Deletes ALL user accounts and usernames from Firestore and Firebase Auth
  try {
    // Delete all Firestore users and usernames
    const usersSnap = await getDocs(collection(firestore, 'users'));
    const usernamesSnap = await getDocs(collection(firestore, 'usernames'));
    for (const userDoc of usersSnap.docs) {
      await deleteDoc(userDoc.ref);
    }
    for (const usernameDoc of usernamesSnap.docs) {
      await deleteDoc(usernameDoc.ref);
    }

    // Delete all Firebase Auth users (admin SDK)
    if (admin) {
      const auth = admin.auth();
      let nextPageToken: string | undefined = undefined;
      do {
        const listResult = await auth.listUsers(1000, nextPageToken);
        for (const userRecord of listResult.users) {
          await auth.deleteUser(userRecord.uid);
        }
        nextPageToken = listResult.pageToken;
      } while (nextPageToken);
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to delete all accounts.' }, { status: 500 });
  }
}
