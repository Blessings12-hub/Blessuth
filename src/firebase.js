// Public Firebase config — all of these values are safe to expose in
// client code (that's how every Firebase web app works; the private side
// lives only in the server's FIREBASE_SERVICE_ACCOUNT env var, never
// here). Fill these in from Firebase Console → Project Settings → General
// → "Your apps" → Web app → SDK setup and configuration.

import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let appInstance = null
function getFirebaseApp() {
  if (!appInstance) {
    appInstance = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
  }
  return appInstance
}

// Messaging isn't supported in every browser (notably some iOS/Safari
// versions, and any non-HTTPS context) — this resolves to null instead of
// throwing when that's the case.
export async function getMessagingIfSupported() {
  const supported = await isSupported().catch(() => false)
  if (!supported) return null
  return getMessaging(getFirebaseApp())
}
