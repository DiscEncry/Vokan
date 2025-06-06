import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase/firebaseConfig';
import { confirmPasswordReset } from 'firebase/auth';
import zxcvbn from 'zxcvbn';

export async function POST(req: NextRequest) {
  try {
    const { oobCode, newPassword } = await req.json();
    if (!oobCode || typeof oobCode !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing reset code.' }, { status: 400 });
    }
    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
    }
    // Server-side password strength validation
    const pwStrength = zxcvbn(newPassword);
    if (pwStrength.score < 3) {
      return NextResponse.json({ error: 'Password is too weak. Please use a mix of uppercase, lowercase, numbers, and symbols.' }, { status: 400 });
    }
    await confirmPasswordReset(auth, oobCode, newPassword);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed to reset password.' }, { status: 400 });
  }
}
