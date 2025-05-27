import { NextRequest, NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase/firebaseConfig';
import { randomBytes } from 'crypto';
import { getAuth } from 'firebase-admin/auth';
import * as argon2 from 'argon2';

// Generate backup codes for MFA
export async function POST(req: NextRequest) {
  const { uid } = await req.json();
  // Generate 10 random backup codes
  const codes = Array.from({ length: 10 }, () => randomBytes(8).toString('hex'));
  // Hash codes before storing
  const hashedCodes = await Promise.all(codes.map(code => argon2.hash(code)));
  await firestore.collection('mfaBackupCodes').doc(uid).set({ codes: hashedCodes, createdAt: Date.now() });
  return NextResponse.json({ codes }); // Return plain codes to user (show once)
}
