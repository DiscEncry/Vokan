import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getAuth } from 'firebase-admin/auth';
import { firestore } from '@/lib/firebase/firebaseConfig';

// This endpoint verifies the WebAuthn authentication response and mints a Firebase custom token
export async function POST(req: NextRequest) {
  const { uid, assertion } = await req.json();
  // Get challenge from Firestore
  const challengeDoc = await firestore.collection('webauthnChallenges').doc(uid).get();
  const challenge = challengeDoc.data()?.challenge;
  if (!challenge) return NextResponse.json({ error: 'No challenge found' }, { status: 400 });
  // Get credential public key
  const credDoc = await firestore.collection('webauthnCredentials').doc(uid).get();
  const credential = credDoc.data()?.credential;
  if (!credential) return NextResponse.json({ error: 'No credential found' }, { status: 400 });
  // Verify authentication
  const verification = await verifyAuthenticationResponse({
    response: assertion,
    expectedChallenge: challenge,
    expectedOrigin: process.env.NEXT_PUBLIC_ORIGIN,
    expectedRPID: process.env.NEXT_PUBLIC_DOMAIN || 'localhost',
    authenticator: credential,
  });
  if (!verification.verified) return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  // Mint Firebase custom token
  const auth = getAuth();
  const firebaseToken = await auth.createCustomToken(uid);
  return NextResponse.json({ firebaseToken });
}
