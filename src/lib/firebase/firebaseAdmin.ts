// Minimal admin SDK init for Next.js API routes
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const firebaseAdminConfig = {
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
};

let app: App | undefined;

export function getFirebaseAdminApp(): App {
  if (!getApps().length) {
    app = initializeApp(firebaseAdminConfig);
  } else {
    app = getApps()[0];
  }
  return app!;
}

export { getFirestore };
