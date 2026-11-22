import type { Counters, UserSettings } from '@satark/core';
import { firebaseConfigured } from './config';
import { ensureCloud, initFirebase } from './cloud';

/**
 * Opt-in Firestore sync. Writes exactly three fields to users/{uid}: settings (mode and
 * explanation language), aggregate counters, and updatedAt. Never page text, URLs or receipts.
 * firestore.rules rejects any other field. Firestore is loaded only when sync is on.
 */
export async function syncToFirestore(settings: UserSettings, counters: Counters): Promise<void> {
  if (!settings.sync || !firebaseConfigured || !navigator.onLine) return;
  await ensureCloud();
  const { app } = await initFirebase();
  const { getAuth } = await import('firebase/auth/web-extension');
  const uid = getAuth(app).currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  const { getFirestore, doc, setDoc, serverTimestamp } = await import('firebase/firestore');
  await setDoc(doc(getFirestore(app), 'users', uid), {
    settings: { mode: settings.mode, outputLanguage: settings.outputLanguage },
    counters,
    updatedAt: serverTimestamp(),
  });
}

/** Deletes the synced document, for when the user turns sync off. */
export async function deleteSyncedData(): Promise<void> {
  if (!firebaseConfigured) return;
  await ensureCloud();
  const { app } = await initFirebase();
  const { getAuth } = await import('firebase/auth/web-extension');
  const uid = getAuth(app).currentUser?.uid;
  if (!uid) return;
  const { getFirestore, doc, deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(getFirestore(app), 'users', uid));
}
