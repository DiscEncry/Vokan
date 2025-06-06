import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase/firebaseAdmin';

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');
  if (!email) {
    return NextResponse.json({ available: false, error: 'Missing email' }, { status: 400 });
  }
  try {
    const app = getFirebaseAdminApp();
    const db = getFirestore(app);
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email.toLowerCase()).limit(1).get();
    return NextResponse.json({ available: snapshot.empty });
  } catch (error) {
    return NextResponse.json({ available: false, error: 'Server error' }, { status: 500 });
  }
}
