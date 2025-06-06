import { NextRequest, NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase/firebaseConfig';
import { doc, runTransaction } from 'firebase/firestore';
import { z } from 'zod';

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const RATE_LIMIT_ATTEMPTS = 10;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

async function checkAndUpdateRateLimit(email: string) {
  if (!firestore) throw new Error('Firestore not initialized');
  const ref = doc(firestore, 'rateLimits', email);
  return await runTransaction(firestore, async (transaction) => {
    const snap = await transaction.get(ref);
    const now = Date.now();
    let attempts = 0;
    let firstAttempt = now;
    if (snap.exists()) {
      const data = snap.data();
      attempts = data.attempts || 0;
      firstAttempt = data.firstAttempt || now;
      if (now - firstAttempt < RATE_LIMIT_WINDOW_MS) {
        if (attempts >= RATE_LIMIT_ATTEMPTS) {
          return { allowed: false, retryAfter: RATE_LIMIT_WINDOW_MS - (now - firstAttempt) };
        }
        attempts++;
      } else {
        attempts = 1;
        firstAttempt = now;
      }
    } else {
      attempts = 1;
      firstAttempt = now;
    }
    transaction.set(ref, { attempts, firstAttempt });
    return { allowed: true };
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { email } = parsed.data;
    // Rate limit by email
    const rateLimit = await checkAndUpdateRateLimit(email.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: `Too many sign-in attempts. Try again in ${Math.ceil((rateLimit.retryAfter || 0) / 1000)} seconds.` }, { status: 429 });
    }
    // Do not perform sign-in here; let the client handle Firebase Auth sign-in after passing rate limit
    return NextResponse.json({ allowed: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Sign-in failed.' }, { status: 400 });
  }
}
