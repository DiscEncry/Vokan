import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminApp } from '@/lib/firebase/firebaseAdmin';
import { getFirestore } from 'firebase-admin/firestore';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = (searchParams.get('username') || '').toLowerCase();
  if (!username) {
    return NextResponse.json({ available: false, error: 'No username provided' }, { status: 400 });
  }
  try {
    const app = getFirebaseAdminApp();
    const db = getFirestore(app);
    const snapshot = await db.collection('profiles').where('username', '==', username).limit(1).get();
    return NextResponse.json({ available: snapshot.empty });
  } catch (error) {
    return NextResponse.json({ available: false, error: 'Server error' }, { status: 500 });
  }
}
