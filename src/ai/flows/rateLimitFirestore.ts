import { getFirestore, doc, getDoc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getApp } from "firebase/app";

// Firestore-based rate limiter
// key: unique identifier (userId, IP, etc)
// limit: max allowed requests
// windowMs: time window in ms
export async function checkAndUpdateRateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
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

  if (count >= limit) {
    return { allowed: false, retryAfter: reset - now };
  }

  if (docSnap.exists()) {
    await updateDoc(ref, {
      count: count + 1,
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

  return { allowed: true };
}
