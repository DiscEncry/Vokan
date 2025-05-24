// Import the functions you need from the SDKs you need
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
// Replace these values with the ones from your Firebase project
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Check if all required Firebase config values are provided
const validateFirebaseConfig = (config: any) => {
  const requiredFields = ['apiKey', 'authDomain', 'projectId'];
  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    console.error(`Missing required Firebase configuration: ${missingFields.join(', ')}`);
    console.error('Please set the appropriate environment variables in your .env.local file');
    return false;
  }
  return true;
};

// Initialize Firebase
let firebaseApp: FirebaseApp;

if (!getApps().length && validateFirebaseConfig(firebaseConfig)) {
  firebaseApp = initializeApp(firebaseConfig);
} else if (!getApps().length) {
  console.warn('Firebase initialization skipped due to missing config values');
}

// Export Firebase services
export const auth = getApps().length ? getAuth() : null;
export const firestore = getApps().length ? getFirestore() : null;

export default firebaseApp;
