import { firestore } from './firebaseConfig';
import { collection, addDoc, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';

export type QuizLogEntry = {
  word: string;
  correct: boolean;
  duration: number;
  game: string;
  timestamp: number;
};

// Add a quiz log entry for a user
export async function addQuizLogEntry(uid: string, entry: QuizLogEntry) {
  const ref = collection(firestore, 'users', uid, 'quizLogs');
  await addDoc(ref, {
    ...entry,
    timestamp: entry.timestamp || Date.now(),
    createdAt: Timestamp.now(),
  });
}

// Get the last N quiz log entries for a user (default 200)
export async function getQuizLogEntries(uid: string, max = 200): Promise<QuizLogEntry[]> {
  const ref = collection(firestore, 'users', uid, 'quizLogs');
  const q = query(ref, orderBy('timestamp', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map(doc => doc.data() as QuizLogEntry);
}
