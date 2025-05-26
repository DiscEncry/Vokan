// User profile type for Firestore
export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  createdAt: string; // ISO string
  provider: 'google' | 'password';
}
