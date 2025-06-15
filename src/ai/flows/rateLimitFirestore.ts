import { getFirestore, doc, getDoc, setDoc, serverTimestamp, updateDoc, FieldValue } from "firebase/firestore";
import { getApp } from "firebase/app";

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
  const db = getFirestore(getApp());
  const ref = doc(db, "rateLimitLogs", `${key}_${Date.now()}`);
  await setDoc(ref, {
    key,
    allowed,
    retryAfter: retryAfter || null,
    ip: ip || null,
    timestamp: serverTimestamp(),
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
  const db = getFirestore(getApp());
  const ref = doc(db, "rateLimits", key);
  const now = Date.now();
  const docSnap = await getDoc(ref);

  let data = docSnap.exists() ? docSnap.data() : null;
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

  if (docSnap.exists()) {
    await updateDoc(ref, {
      count: allowed ? count + 1 : count,
      reset,
      last: serverTimestamp(),
    });
  } else {
    await setDoc(ref, {
      count: 1,
      reset,
      last: serverTimestamp(),
    });
  }

  // Log the event for monitoring
  await logRateLimitEvent({ key, allowed, retryAfter, ip });

  return allowed ? { allowed: true } : { allowed: false, retryAfter };
}