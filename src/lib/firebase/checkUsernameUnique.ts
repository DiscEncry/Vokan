// Server-side username uniqueness check for settings page (debounced, like registration)
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, cert, getApps } from "firebase-admin/app";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export async function checkUsernameUnique(username: string): Promise<boolean> {
  const db = getFirestore();
  const snapshot = await db.collection("profiles").where("username", "==", username).get();
  return snapshot.empty;
}
