// src/context/useProfileCreation.ts
// Utility for user profile creation logic, extracted from AuthContext for clarity.
import { createUserProfile } from '@/lib/firebase/userProfile';
import type { UserProfile } from '@/types/userProfile';

/**
 * Creates a new user profile in Firestore.
 * Used for onboarding new users after authentication.
 */
export async function createProfile(profile: UserProfile) {
  await createUserProfile(profile);
}
