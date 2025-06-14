// User profile type for Firestore
import { Timestamp } from 'firebase/firestore';
export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  createdAt: Timestamp; // Firestore timestamp
  provider: 'google' | 'password';
}
