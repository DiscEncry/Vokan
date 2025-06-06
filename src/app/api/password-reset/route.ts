import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase/firebaseConfig';
import { sendPasswordResetEmail } from 'firebase/auth';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }
    await sendPasswordResetEmail(auth, email);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to send password reset email.' }, { status: 400 });
  }
}
