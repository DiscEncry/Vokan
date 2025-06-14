import { NextRequest, NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase/firebaseConfig';
import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { registrationSchema } from '@/lib/validation';
import zxcvbn from 'zxcvbn';
import type { UserProfile } from '@/types/userProfile';

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
    // Use shared registration schema
    const parsed = registrationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { email, username, uid, provider, password, confirm } = parsed.data;
    // Password strength validation
    const pwStrength = zxcvbn(password);
    if (pwStrength.score < 3) {
      return NextResponse.json({ error: 'Password is too weak. Please use a mix of uppercase, lowercase, numbers, and symbols.' }, { status: 400 });
    }
    // Rate limit by email
    const rateLimit = await checkAndUpdateRateLimit(email.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: `Too many registration attempts. Try again in ${Math.ceil((rateLimit.retryAfter || 0) / 1000)} seconds.` }, { status: 429 });
    }
    // Ensure email and username are unique
    // Atomic registration: username lock + user profile
    const userRef = doc(firestore, 'users', uid);
    const usernameRef = doc(firestore, 'usernames', username.toLowerCase());
    const emailRef = doc(firestore, 'emails', email.toLowerCase());
    await runTransaction(firestore, async (transaction) => {
      const usernameSnap = await transaction.get(usernameRef);
      if (usernameSnap.exists()) {
        throw new Error('Username already taken');
      }
      const emailSnap = await transaction.get(emailRef);
      if (emailSnap.exists()) {
        throw new Error('Email already registered');
      }
      const userProfile: UserProfile = {
        uid,
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        createdAt: Timestamp.now(),
        provider,
      };
      transaction.set(userRef, userProfile, { merge: false });
      transaction.set(usernameRef, { uid, username: username.toLowerCase() });
      transaction.set(emailRef, { uid, email: email.toLowerCase() });
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    // Log error for monitoring
    console.error('Registration error:', e);
    // Generic error to avoid leaking info
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 400 });
  }
}
