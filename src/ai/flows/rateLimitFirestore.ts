import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "@/lib/firebase/firebaseAdmin";

// Log rate limit events for monitoring
async function logRateLimitEvent({
  key,
  allowed,
  retryAfter,
  ip,
}: {
  key: string;
  allowed: boolean;
  retryAfter?: number;
  ip?: string;
}) {
  const db = getFirestore(getFirebaseAdminApp());
  const ref = db.collection("rateLimitLogs").doc(`${key}_${Date.now()}`);
  await ref.set({
    key,
    allowed,
    retryAfter: retryAfter || null,
    ip: ip || null,
    timestamp: FieldValue.serverTimestamp(),
  });
}

// Firestore-based rate limiter
// key: unique identifier (userId, IP, etc)
// limit: max allowed requests
// windowMs: time window in ms
export async function checkAndUpdateRateLimit({
  key,
  limit,
  windowMs,
  ip,
}: {
  key: string;
  limit: number;
  windowMs: number;
  ip?: string;
}): Promise<{ allowed: boolean; retryAfter?: number }> {
  const db = getFirestore(getFirebaseAdminApp());
  const ref = db.collection("rateLimits").doc(key);
  const now = Date.now();
  const docSnap = await ref.get();

  let data = docSnap.exists ? docSnap.data() : null;
  let count = 0;
  let reset = now + windowMs;

  if (data && data.reset > now) {
    count = data.count;
    reset = data.reset;
  } else {
    count = 0;
    reset = now + windowMs;
  }

  let allowed = true;
  let retryAfter: number | undefined = undefined;
  if (count >= limit) {
    allowed = false;
    retryAfter = reset - now;
  }

  if (docSnap.exists) {
    await ref.update({
      count: allowed ? count + 1 : count,
      reset,
      last: FieldValue.serverTimestamp(),
    });
  } else {
    await ref.set({
      count: 1,
      reset,
      last: FieldValue.serverTimestamp(),
    });
  }

  // Log the event for monitoring
  await logRateLimitEvent({ key, allowed, retryAfter, ip });

  return allowed ? { allowed: true } : { allowed: false, retryAfter };
}