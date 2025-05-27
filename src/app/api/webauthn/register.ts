import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { getAuth } from 'firebase-admin/auth';
import { firestore } from '@/lib/firebase/firebaseConfig';

// This endpoint verifies the WebAuthn registration response and stores the credential
export async function POST(req: NextRequest) {
  const { uid, credential } = await req.json();
  // Get challenge from Firestore
  const challengeDoc = await firestore.collection('webauthnChallenges').doc(uid).get();
  const challenge = challengeDoc.data()?.challenge;
  if (!challenge) return NextResponse.json({ error: 'No challenge found' }, { status: 400 });
  // Verify registration
  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge: challenge,
    expectedOrigin: process.env.NEXT_PUBLIC_ORIGIN,
    expectedRPID: process.env.NEXT_PUBLIC_DOMAIN || 'localhost',
  });
  if (!verification.verified) return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  // Store credential public key in Firestore
  await firestore.collection('webauthnCredentials').doc(uid).set({ credential: verification.registrationInfo, createdAt: Date.now() });
  return NextResponse.json({ success: true });
}
