import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { firestore } from '@/lib/firebase/firebaseConfig';

// This endpoint returns WebAuthn authentication options for the client
export async function POST(req: NextRequest) {
  const { uid } = await req.json();
  // Get credential for user
  const credDoc = await firestore.collection('webauthnCredentials').doc(uid).get();
  const credential = credDoc.data()?.credential;
  if (!credential) return NextResponse.json({ error: 'No credential found' }, { status: 400 });
  // Generate authentication options
  const options = generateAuthenticationOptions({
    rpID: process.env.NEXT_PUBLIC_DOMAIN || 'localhost',
    allowCredentials: [{ id: credential.credentialID, type: 'public-key' }],
    userVerification: 'preferred',
  });
  // Store challenge in Firestore
  await firestore.collection('webauthnChallenges').doc(uid).set({ challenge: options.challenge, createdAt: Date.now() });
  return NextResponse.json(options);
}
