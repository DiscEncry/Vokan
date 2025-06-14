// Standalone script to delete all user data (except word cache) from Firestore and Firebase Auth, including subcollections
// Usage: node deleteAllUsers.js
require('dotenv').config({ path: '.env' });
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

// For recursive delete
let recursiveDelete;
try {
  recursiveDelete = require('firebase-tools').firestore.delete;
} catch (e) {
  console.warn('firebase-tools not installed. Install with: npm install -D firebase-tools');
}

// Initialize Firebase Admin SDK
initializeApp({
  credential: applicationDefault(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});

const db = getFirestore();
const auth = getAuth();

// List of collections to delete (except word cache)
const collectionsToDelete = [
  'users',
  'usernames',
  'userPreferences',
  // Add any other collections you want to wipe here
];

async function deleteCollectionRecursively(collectionName) {
  if (recursiveDelete) {
    // Use firebase-tools for recursive delete
    await recursiveDelete(collectionName, {
      project: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      recursive: true,
      yes: true,
      token: process.env.FIREBASE_TOKEN, // Optional: set FIREBASE_TOKEN for CI/CD
    });
    console.log(`Recursively deleted collection: ${collectionName}`);
  } else {
    // Fallback: delete only top-level docs
    const snap = await db.collection(collectionName).get();
    for (const doc of snap.docs) {
      await doc.ref.delete();
      console.log(`Deleted from ${collectionName}:`, doc.id);
    }
  }
}

async function deleteAllAuthUsers() {
  let nextPageToken = undefined;
  do {
    const listResult = await auth.listUsers(1000, nextPageToken);
    for (const userRecord of listResult.users) {
      await auth.deleteUser(userRecord.uid);
      console.log('Deleted user:', userRecord.uid);
    }
    nextPageToken = listResult.pageToken;
  } while (nextPageToken);
}

(async () => {
  try {
    for (const col of collectionsToDelete) {
      await deleteCollectionRecursively(col);
    }
    await deleteAllAuthUsers();
    console.log('All user data (except word cache) deleted, including subcollections.');
    process.exit(0);
  } catch (e) {
    console.error('Error deleting users:', e);
    process.exit(1);
  }
})();
