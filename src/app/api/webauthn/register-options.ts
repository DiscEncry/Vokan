import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getAuth } from 'firebase-admin/auth';
import { firestore } from '@/lib/firebase/firebaseConfig';

// This endpoint returns WebAuthn registration options for the client
export async function POST(req: NextRequest) {
  // TODO: Authenticate user (e.g., via session/cookie)
  const { uid, email } = await req.json();
  // Generate registration options
  const options = generateRegistrationOptions({
    rpName: 'Vokan',
    rpID: process.env.NEXT_PUBLIC_DOMAIN || 'localhost',
    userID: uid,
    userName: email,
    attestationType: 'none',
    authenticatorSelection: { userVerification: 'preferred' },
  });
  // Store challenge in Firestore for later verification
  await firestore.collection('webauthnChallenges').doc(uid).set({ challenge: options.challenge, createdAt: Date.now() });
  return NextResponse.json(options);
}
