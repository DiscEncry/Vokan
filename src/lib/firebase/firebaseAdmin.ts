// Minimal admin SDK init for Next.js API routes
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Support loading credentials from a JSON string in cloud environments
function getAdminCredential() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      return cert({
        projectId: credentials.project_id,
        clientEmail: credentials.client_email,
        privateKey: credentials.private_key,
      });
    } catch (e) {
      throw new Error('Invalid GOOGLE_APPLICATION_CREDENTIALS_JSON');
    }
  }
  // Fallback to individual env vars (for local dev)
  return cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  });
}

const firebaseAdminConfig = {
  credential: getAdminCredential(),
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
