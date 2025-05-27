import { NextRequest, NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase/firebaseConfig';
import * as argon2 from 'argon2';

// Verify a backup code for MFA
export async function POST(req: NextRequest) {
  const { uid, code } = await req.json();
  const doc = await firestore.collection('mfaBackupCodes').doc(uid).get();
  const hashedCodes: string[] = doc.data()?.codes || [];
  let found = false;
  let newCodes: string[] = [];
  for (const hash of hashedCodes) {
    if (!found && (await argon2.verify(hash, code))) {
      found = true;
      continue; // Remove used code
    }
    newCodes.push(hash);
  }
  if (!found)
    return NextResponse.json(
      { success: false, error: 'Invalid or already used backup code.' },
      { status: 400 }
    );
  // Update Firestore to remove used code
  await firestore.collection('mfaBackupCodes').doc(uid).set({
    codes: newCodes,
    updatedAt: Date.now(),
  });
  return NextResponse.json({ success: true });
}
